// Configuration de l'API
const API_BASE = window.location.origin;
const ADMIN_BASE = window.location.origin;

// État global
let currentConfig = null;
let currentStats = null;

// Initialisation
document.addEventListener('DOMContentLoaded', () => {
    initTabs();
    loadData();
    setupEventListeners();
});

// Gestion des onglets
function initTabs() {
    const tabButtons = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    
    tabButtons.forEach(btn => {
        btn.addEventListener('click', () => {
            const targetTab = btn.dataset.tab;
            
            // Désactiver tous les onglets
            tabButtons.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            
            // Activer l'onglet sélectionné
            btn.classList.add('active');
            document.getElementById(`${targetTab}-tab`).classList.add('active');
            
            // Recharger les données de l'onglet actif
            loadData();
        });
    });
}

// Charger toutes les données
async function loadData() {
    showLoading(true);
    try {
        await Promise.all([
            loadConfig(),
            loadStats(),
            loadProspects(),
            loadAnswers(),
            loadConversations()
        ]);
    } catch (error) {
        console.error('Erreur lors du chargement des données:', error);
        showToast('Erreur lors du chargement des données', 'error');
    } finally {
        showLoading(false);
    }
}

// Afficher/masquer l'indicateur de chargement
function showLoading(show) {
    const header = document.querySelector('header');
    if (!header) return;
    
    let loadingIndicator = document.getElementById('loading-indicator');
    
    if (show) {
        if (!loadingIndicator) {
            loadingIndicator = document.createElement('div');
            loadingIndicator.id = 'loading-indicator';
            loadingIndicator.className = 'loading-indicator';
            loadingIndicator.innerHTML = 'Actualisation...';
            header.appendChild(loadingIndicator);
        }
        loadingIndicator.style.display = 'block';
    } else {
        if (loadingIndicator) {
            loadingIndicator.style.display = 'none';
        }
    }
}

// Charger la configuration
async function loadConfig() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/config`);
        const config = await response.json();
        currentConfig = config;
        populateConfigForm(config);
    } catch (error) {
        showToast('Erreur lors du chargement de la configuration', 'error');
        console.error(error);
    }
}

// Remplir le formulaire de configuration
function populateConfigForm(config) {
    document.getElementById('config-welcome').value = config.welcome || '';
    document.getElementById('config-start-keywords').value = config.start_keywords?.join(', ') || '';
    document.getElementById('config-qualified-threshold').value = config.qualified_threshold || 0;
    
    // Règles de décision
    if (config.decision_rules) {
        document.getElementById('rule-rdv-min').value = config.decision_rules.rdv?.minScore || '';
        document.getElementById('rule-humain-min').value = config.decision_rules.humain?.minScore || '';
        document.getElementById('rule-nurturing-min').value = config.decision_rules.nurturing?.minScore || '';
        document.getElementById('rule-nurturing-max').value = config.decision_rules.nurturing?.maxScore || '';
        document.getElementById('rule-sortie-max').value = config.decision_rules.sortie?.maxScore || '';
    }
    
    // Messages
    if (config.messages) {
        document.getElementById('config-message-rdv').value = config.messages.rdv_message || '';
        document.getElementById('config-message-humain').value = config.messages.humain_message || '';
        document.getElementById('config-message-nurturing').value = config.messages.nurturing_message || '';
        document.getElementById('config-message-sortie').value = config.messages.sortie_message || '';
        document.getElementById('config-calendly-link').value = config.messages.calendly_link || '';
        document.getElementById('config-resource-link').value = config.messages.resource_link || '';
    }
    
    // Message pré-rempli
    if (config.prefill_message) {
        document.getElementById('config-prefill-enabled').checked = config.prefill_message.enabled || false;
        document.getElementById('config-prefill-message').value = config.prefill_message.body || '';
    }
    
    // Questions
    populateQuestions(config.questions || []);
    
    // Form Flows
    populateFormFlows(config.form_flows || []);
    
    // Sector Flows
    populateSectorFlows(config.sector_flows || []);
    
    // Sector Question
    if (config.default_sector_question) {
        populateSectorQuestion(config.default_sector_question);
    }
}

// Remplir les questions
function populateQuestions(questions) {
    const container = document.getElementById('questions-container');
    container.innerHTML = '';
    
    questions.forEach((q, index) => {
        container.appendChild(createQuestionElement(q, index));
    });
}

// Créer un élément de question
function createQuestionElement(question, index) {
    const div = document.createElement('div');
    div.className = 'question-item';
    div.dataset.index = index;
    
    // Gérer les options - peut être un array ou un object
    const optionsArray = Array.isArray(question.options) 
        ? question.options 
        : Object.keys(question.options || {});
    const scores = question.scores || {};
    
    div.innerHTML = `
        <div class="question-header">
            <h3>Question ${index + 1}</h3>
            <button class="btn delete-question" onclick="deleteQuestion(${index})">Supprimer cette question</button>
        </div>
        
        <div class="question-fields">
            <div class="question-field-group">
                <label class="field-label">Identifiant unique</label>
                <p class="field-help">Utilisé en interne (ex: sector, revenue, budget)</p>
                <input type="text" class="question-id config-input" value="${question.id || ''}" placeholder="sector">
            </div>
            
            <div class="question-field-group">
                <label class="field-label">Texte de la question</label>
                <p class="field-help">Question affichée au prospect</p>
                <input type="text" class="question-label config-input" value="${question.label || ''}" placeholder="Quel est votre secteur d'activité ?">
            </div>
        </div>
        
        <div class="options-section">
            <div class="options-header">
                <label class="field-label">Réponses possibles et leurs scores</label>
                <p class="field-help">Chaque réponse doit avoir un score (0 = faible, 3 = élevé)</p>
            </div>
            <div class="options-list" data-question-index="${index}">
                ${optionsArray.length > 0 ? optionsArray.map((opt, optIndex) => {
                    const optValue = typeof opt === 'string' ? opt : opt;
                    const optScore = scores[optValue] || 0;
                    return `
                    <div class="option-row">
                        <div class="option-input-group">
                            <label class="option-label">Réponse ${optIndex + 1}</label>
                            <input type="text" class="option-text config-input" value="${optValue}" placeholder="Ex: Coach, Infopreneur, SaaS">
                        </div>
                        <div class="score-input-group">
                            <label class="option-label">Score</label>
                            <input type="number" class="option-score config-input" value="${optScore}" placeholder="0" min="0" max="10">
                        </div>
                        <button class="btn-remove-option" onclick="deleteOption(${index}, ${optIndex})" title="Supprimer cette réponse">×</button>
                    </div>
                `;
                }).join('') : '<p class="no-options">Aucune réponse définie. Ajoutez au moins une réponse.</p>'}
            </div>
            <button class="btn btn-secondary btn-add-option" onclick="addOption(${index})">+ Ajouter une réponse</button>
        </div>
    `;
    
    return div;
}

// Ajouter une question
document.getElementById('add-question-btn')?.addEventListener('click', () => {
    if (!currentConfig) {
        showToast('Veuillez d\'abord charger la configuration', 'error');
        return;
    }
    const newQuestion = {
        id: '',
        label: '',
        options: [],
        scores: {}
    };
    if (!currentConfig.questions) currentConfig.questions = [];
    currentConfig.questions.push(newQuestion);
    populateQuestions(currentConfig.questions);
});

// Supprimer une question
window.deleteQuestion = function(index) {
    if (!currentConfig || !currentConfig.questions) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer cette question ?')) {
        currentConfig.questions.splice(index, 1);
        populateQuestions(currentConfig.questions);
    }
};

// Ajouter une option
window.addOption = function(questionIndex) {
    const question = currentConfig.questions[questionIndex];
    if (!question.options) question.options = [];
    if (!question.scores) question.scores = {};
    
    question.options.push('');
    populateQuestions(currentConfig.questions);
};

// Supprimer une option
window.deleteOption = function(questionIndex, optionIndex) {
    if (!currentConfig || !currentConfig.questions) return;
    const question = currentConfig.questions[questionIndex];
    if (!question) return;
    
    if (!question.options) question.options = [];
    if (!question.scores) question.scores = {};
    
    const optionText = question.options[optionIndex];
    question.options.splice(optionIndex, 1);
    if (optionText) {
        delete question.scores[optionText];
    }
    populateQuestions(currentConfig.questions);
};

// Charger les statistiques
async function loadStats() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/stats`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const stats = await response.json();
        currentStats = stats;
        displayStats(stats);
    } catch (error) {
        console.error('Erreur chargement stats:', error);
    }
}

// Afficher les statistiques
function displayStats(stats) {
    document.getElementById('stat-total-prospects').textContent = stats.totalProspects || 0;
    document.getElementById('stat-total-conversations').textContent = stats.totalConversations || 0;
    document.getElementById('stat-total-answers').textContent = stats.totalAnswers || 0;
    document.getElementById('stat-avg-score').textContent = stats.averageScore?.toFixed(1) || '0';
    
    if (stats.byDecision) {
        document.getElementById('stat-rdv').textContent = stats.byDecision.rdv || 0;
        document.getElementById('stat-humain').textContent = stats.byDecision.humain || 0;
        document.getElementById('stat-nurturing').textContent = stats.byDecision.nurturing || 0;
        document.getElementById('stat-sortie').textContent = stats.byDecision.sortie || 0;
    }
    
    if (stats.engagementLevel) {
        document.getElementById('stat-engagement-high').textContent = stats.engagementLevel.high || 0;
        document.getElementById('stat-engagement-medium').textContent = stats.engagementLevel.medium || 0;
        document.getElementById('stat-engagement-low').textContent = stats.engagementLevel.low || 0;
    }
}

// Charger les prospects
async function loadProspects() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/prospects`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const prospects = await response.json();
        console.log(`[ADMIN] ${prospects.length} prospects chargés`);
        displayProspects(prospects);
        
        if (prospects.length === 0) {
            const tbody = document.getElementById('prospects-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #999;">Aucun prospect pour le moment</td></tr>';
            }
        }
    } catch (error) {
        console.error('Erreur chargement prospects:', error);
        const tbody = document.getElementById('prospects-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px; color: #dc3545;">Erreur lors du chargement des prospects</td></tr>';
        }
    }
}

// Afficher les prospects
function displayProspects(prospects) {
    const tbody = document.getElementById('prospects-tbody');
    tbody.innerHTML = '';
    
    prospects.slice(0, 100).forEach(prospect => {
        const tr = document.createElement('tr');
        const phone = prospect.phone || '';
        const decision = prospect.decision || 'N/A';
        const engagement = prospect.metadata?.engagementLevel || 'low';
        
        tr.innerHTML = `
            <td data-label="Téléphone">${phone}</td>
            <td data-label="Score">${prospect.score || 0}</td>
            <td data-label="Statut"><span class="badge">${prospect.status || ''}</span></td>
            <td data-label="Décision"><span class="badge badge-${decision}">${decision}</span></td>
            <td data-label="Engagement"><span class="badge badge-${engagement}">${engagement}</span></td>
            <td data-label="Dernière activité">${formatDate(prospect.lastActivityAt)}</td>
            <td data-label="Actions">
                <div class="action-buttons">
                    <button class="btn btn-secondary" onclick="viewProspect('${phone.replace(/'/g, "\\'")}')">Voir</button>
                    <button class="btn btn-warning" onclick="resetProspect('${phone.replace(/'/g, "\\'")}')">Réinitialiser</button>
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Charger les réponses
async function loadAnswers() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/answers`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const answers = await response.json();
        console.log(`[ADMIN] ${answers.length} réponses chargées`);
        displayAnswers(answers);
        
        if (answers.length === 0) {
            const container = document.getElementById('answers-container');
            if (container) {
                container.innerHTML = '<div class="empty-state"><p>Aucune réponse pour le moment</p></div>';
            }
        }
    } catch (error) {
        console.error('Erreur chargement réponses:', error);
        const container = document.getElementById('answers-container');
        if (container) {
            container.innerHTML = '<div class="empty-state"><p>Erreur lors du chargement des réponses</p></div>';
        }
    }
}

// Afficher les réponses
function displayAnswers(answers) {
    const container = document.getElementById('answers-container');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (answers.length === 0) {
        container.innerHTML = '<div class="empty-state"><p>Aucune réponse enregistrée pour le moment</p></div>';
        return;
    }
    
    // Grouper par téléphone
    const groupedByPhone = {};
    answers.forEach(answer => {
        const phone = answer.phone || 'Inconnu';
        if (!groupedByPhone[phone]) {
            groupedByPhone[phone] = [];
        }
        groupedByPhone[phone].push(answer);
    });
    
    // Trier par date (plus récent en premier)
    Object.keys(groupedByPhone).forEach(phone => {
        groupedByPhone[phone].sort((a, b) => {
            const dateA = new Date(a.timestamp || a.savedAt || 0);
            const dateB = new Date(b.timestamp || b.savedAt || 0);
            return dateB - dateA;
        });
    });
    
    // Afficher les réponses groupées
    Object.entries(groupedByPhone).forEach(([phone, phoneAnswers]) => {
        const phoneCard = document.createElement('div');
        phoneCard.className = 'phone-answers-card';
        
        const header = document.createElement('div');
        header.className = 'phone-answers-header';
        header.innerHTML = `
            <div class="phone-info">
                <strong>${phone}</strong>
                <span class="answer-count">${phoneAnswers.length} réponse${phoneAnswers.length > 1 ? 's' : ''}</span>
            </div>
        `;
        phoneCard.appendChild(header);
        
        const answersList = document.createElement('div');
        answersList.className = 'answers-list';
        
        phoneAnswers.forEach((answer, idx) => {
            const answerCard = document.createElement('div');
            answerCard.className = 'answer-card';
            answerCard.innerHTML = `
                <div class="answer-header">
                    <div class="answer-question">
                        <span class="question-badge">Q${idx + 1}</span>
                        <strong>${answer.questionLabel || answer.question || 'Question'}</strong>
                    </div>
                    <div class="answer-meta">
                        <span class="answer-time">${formatDate(answer.timestamp || answer.savedAt)}</span>
                    </div>
                </div>
                <div class="answer-content">
                    <div class="answer-value">
                        <span class="answer-label">Réponse :</span>
                        <span class="answer-text">${answer.answer || answer.answerText || 'N/A'}</span>
                    </div>
                    <div class="answer-score-info">
                        <span class="score-item">
                            <span class="score-label">Score question :</span>
                            <span class="score-value">${answer.score || 0}</span>
                        </span>
                        <span class="score-item">
                            <span class="score-label">Score total :</span>
                            <span class="score-value total">${answer.currentScore || answer.score || 0}</span>
                        </span>
                    </div>
                </div>
            `;
            answersList.appendChild(answerCard);
        });
        
        phoneCard.appendChild(answersList);
        container.appendChild(phoneCard);
    });
}

// Charger les conversations
async function loadConversations() {
    try {
        const response = await fetch(`${API_BASE}/api/admin/conversations`, {
            cache: 'no-cache',
            headers: {
                'Cache-Control': 'no-cache'
            }
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const conversations = await response.json();
        console.log(`[ADMIN] ${conversations.length} conversations chargées`);
        displayConversations(conversations);
        
        if (conversations.length === 0) {
            const tbody = document.getElementById('conversations-tbody');
            if (tbody) {
                tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #999;">Aucune conversation pour le moment</td></tr>';
            }
        }
    } catch (error) {
        console.error('Erreur chargement conversations:', error);
        const tbody = document.getElementById('conversations-tbody');
        if (tbody) {
            tbody.innerHTML = '<tr><td colspan="6" style="text-align: center; padding: 20px; color: #dc3545;">Erreur lors du chargement des conversations</td></tr>';
        }
    }
}

// Afficher les conversations
function displayConversations(conversations) {
    const tbody = document.getElementById('conversations-tbody');
    tbody.innerHTML = '';
    
    conversations.slice(0, 100).reverse().forEach(conv => {
        const tr = document.createElement('tr');
        const phone = conv.phone || '';
        const decision = conv.decision || 'N/A';
        tr.innerHTML = `
            <td>${formatDate(conv.savedAt || conv.startedAt)}</td>
            <td>${phone}</td>
            <td>${conv.score || 0}</td>
            <td><span class="badge">${conv.status || ''}</span></td>
            <td><span class="badge badge-${decision}">${decision}</span></td>
            <td>
                <button class="btn btn-secondary" onclick="viewConversation('${phone.replace(/'/g, "\\'")}')">Voir</button>
            </td>
        `;
        tbody.appendChild(tr);
    });
}

// Sauvegarder la configuration
async function saveConfig() {
    try {
        const config = buildConfigFromForm();
        
        const response = await fetch(`${API_BASE}/api/admin/config`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(config)
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showToast('Configuration sauvegardée avec succès !', 'success');
            // Mettre à jour currentConfig avec la config sauvegardée
            currentConfig = config;
            // Recharger depuis le serveur pour s'assurer qu'on a la version à jour
            await loadConfig();
        } else {
            showToast('Erreur lors de la sauvegarde', 'error');
        }
    } catch (error) {
        showToast('Erreur lors de la sauvegarde', 'error');
        console.error(error);
    }
}

// Construire la config depuis le formulaire
function buildConfigFromForm() {
    const config = { ...currentConfig };
    
    // Messages de base
    config.welcome = document.getElementById('config-welcome').value;
    config.start_keywords = document.getElementById('config-start-keywords').value.split(',').map(s => s.trim()).filter(Boolean);
    config.qualified_threshold = parseInt(document.getElementById('config-qualified-threshold').value) || 0;
    
    // Règles de décision
    config.decision_rules = {
        rdv: { minScore: parseInt(document.getElementById('rule-rdv-min').value) || 0 },
        humain: { minScore: parseInt(document.getElementById('rule-humain-min').value) || 0 },
        nurturing: {
            minScore: parseInt(document.getElementById('rule-nurturing-min').value) || 0,
            maxScore: parseInt(document.getElementById('rule-nurturing-max').value) || 0
        },
        sortie: { maxScore: parseInt(document.getElementById('rule-sortie-max').value) || 0 }
    };
    
    // Messages
    config.messages = {
        ...config.messages,
        rdv_message: document.getElementById('config-message-rdv').value,
        humain_message: document.getElementById('config-message-humain').value,
        nurturing_message: document.getElementById('config-message-nurturing').value,
        sortie_message: document.getElementById('config-message-sortie').value,
        calendly_link: document.getElementById('config-calendly-link').value,
        resource_link: document.getElementById('config-resource-link').value
    };
    
    // Message pré-rempli
    config.prefill_message = {
        enabled: document.getElementById('config-prefill-enabled').checked,
        body: document.getElementById('config-prefill-message').value
    };
    
    // Questions
    config.questions = [];
    document.querySelectorAll('#questions-container .question-item').forEach(item => {
        const question = extractQuestionFromElement(item);
        if (question) config.questions.push(question);
    });
    
    // Form Flows
    config.form_flows = [];
    document.querySelectorAll('.form-flow-item').forEach((item, index) => {
        const flow = extractFormFlowFromElement(item);
        if (flow) {
            config.form_flows.push(flow);
        } else {
            console.warn(`Form flow ${index} non sauvegardé (incomplet ou vide)`);
        }
    });
    
    // Sector Flows
    config.sector_flows = [];
    document.querySelectorAll('.sector-flow-item').forEach((item, index) => {
        const flow = extractSectorFlowFromElement(item);
        if (flow) {
            config.sector_flows.push(flow);
        } else {
            console.warn(`Sector flow ${index} non sauvegardé (incomplet ou vide)`);
        }
    });
    
    // Sector Question
    const sectorQuestionEl = document.querySelector('#sector-question-container .question-item');
    if (sectorQuestionEl) {
        const sectorQ = extractQuestionFromElement(sectorQuestionEl);
        if (sectorQ) config.default_sector_question = sectorQ;
    }
    
    return config;
}

// Extraire une question d'un élément DOM
function extractQuestionFromElement(item) {
    if (!item) return null;
    
    const question = {
        id: item.querySelector('.question-id')?.value?.trim() || '',
        label: item.querySelector('.question-label')?.value?.trim() || '',
        options: [],
        scores: {}
    };
    
    item.querySelectorAll('.option-row').forEach(optRow => {
        const optText = optRow.querySelector('.option-text')?.value?.trim();
        const optScore = parseInt(optRow.querySelector('.option-score')?.value) || 0;
        if (optText) {
            question.options.push(optText);
            question.scores[optText] = optScore;
        }
    });
    
    // Sauvegarder la question même si elle n'est pas complète (permet de sauvegarder en cours de création)
    // Mais on exige au minimum un ID ou un label pour éviter les questions complètement vides
    if (question.id || question.label) {
        return question;
    }
    return null;
}

// Extraire un form flow d'un élément DOM
function extractFormFlowFromElement(item) {
    const flow = {
        id: item.dataset.flowId || `form_${Date.now()}`,
        keyword: item.querySelector('.flow-keyword')?.value?.trim() || '',
        name: item.querySelector('.flow-name')?.value?.trim() || '',
        prefill_message: item.querySelector('.flow-prefill')?.value?.trim() || '',
        questions: [],
        skip_questions: []
    };
    
    // Extraire les questions
    const questionsContainer = item.querySelector('.flow-questions');
    if (questionsContainer) {
        questionsContainer.querySelectorAll('.question-item').forEach((qItem, qIdx) => {
            const q = extractQuestionFromElement(qItem);
            if (q) {
                flow.questions.push(q);
            } else {
                console.warn(`Question ${qIdx} du flow "${flow.name || flow.keyword}" non sauvegardée (incomplète)`);
            }
        });
    }
    
    // Extraire les questions à ignorer
    item.querySelectorAll('.skip-question-checkbox:checked').forEach(cb => {
        flow.skip_questions.push(cb.value);
    });
    
    // Sauvegarder le flow même s'il n'est pas complètement rempli (permet de sauvegarder en cours de création)
    // Mais on exige au minimum un nom ou un mot-clé pour éviter les flows vides
    if (flow.keyword || flow.name) {
        return flow;
    }
    return null;
}

// Extraire un sector flow d'un élément DOM
function extractSectorFlowFromElement(item) {
    const flow = {
        sector: item.querySelector('.sector-name')?.value?.trim() || '',
        questions: []
    };
    
    const questionsContainer = item.querySelector('.sector-questions');
    if (questionsContainer) {
        questionsContainer.querySelectorAll('.question-item').forEach((qItem, qIdx) => {
            const q = extractQuestionFromElement(qItem);
            if (q) {
                flow.questions.push(q);
            } else {
                console.warn(`Question ${qIdx} du secteur "${flow.sector}" non sauvegardée (incomplète)`);
            }
        });
    }
    
    // Sauvegarder le flow même s'il n'a pas encore de questions (permet de sauvegarder en cours de création)
    if (flow.sector) {
        return flow;
    }
    return null;
}

// Remplir les form flows
function populateFormFlows(flows) {
    const container = document.getElementById('form-flows-container');
    if (!container) return;
    container.innerHTML = '';
    
    flows.forEach((flow, index) => {
        container.appendChild(createFormFlowElement(flow, index));
    });
}

// Remplir les sector flows
function populateSectorFlows(flows) {
    const container = document.getElementById('sector-flows-container');
    if (!container) return;
    container.innerHTML = '';
    
    flows.forEach((flow, index) => {
        container.appendChild(createSectorFlowElement(flow, index));
    });
}

// Remplir la question secteur
function populateSectorQuestion(question) {
    const container = document.getElementById('sector-question-container');
    if (!container) return;
    container.innerHTML = '';
    container.appendChild(createQuestionElement(question, 0));
}

// Créer un élément form flow
function createFormFlowElement(flow, index) {
    const div = document.createElement('div');
    div.className = 'form-flow-item';
    div.dataset.flowId = flow.id || `form_${index}`;
    
    div.innerHTML = `
        <div class="form-flow-header">
            <h3>Flow: ${flow.name || 'Nouveau Flow'}</h3>
            <button class="btn delete-form-flow" onclick="deleteFormFlow(${index})">Supprimer</button>
        </div>
        <div class="form-flow-fields">
            <div class="form-field-group">
                <label class="field-label">Nom du formulaire</label>
                <input type="text" class="flow-name config-input" value="${flow.name || ''}" placeholder="Expert Habitat">
            </div>
            <div class="form-field-group">
                <label class="field-label">Mot-clé</label>
                <p class="field-help">Mot-clé présent dans le message pré-rempli (ex: "expert habitat")</p>
                <input type="text" class="flow-keyword config-input" value="${flow.keyword || ''}" placeholder="expert habitat">
            </div>
            <div class="form-field-group">
                <label class="field-label">Message pré-rempli</label>
                <p class="field-help">Message avec le mot-clé qui sera envoyé via le lien WhatsApp</p>
                <textarea class="flow-prefill config-input" rows="2" placeholder="Salut, je suis intéressé par expert habitat">${flow.prefill_message || ''}</textarea>
            </div>
            <div class="form-field-group">
                <label class="field-label">Questions à ignorer</label>
                <p class="field-help">Sélectionnez les questions déjà posées dans le formulaire Facebook (elles ne seront pas reposées)</p>
                <div class="skip-questions-list" data-flow-index="${index}">
                    ${generateSkipQuestionsCheckboxes(flow.skip_questions || [])}
                </div>
            </div>
        </div>
        <div class="form-flow-questions">
            <h4>Questions de ce flow</h4>
            <div class="flow-questions" data-flow-index="${index}">
                ${flow.questions.map((q, qIdx) => createQuestionElementHTML(q, qIdx, `flow_${index}`)).join('')}
            </div>
            <button class="btn btn-secondary" onclick="addQuestionToFlow(${index})">+ Ajouter une question</button>
        </div>
    `;
    
    return div;
}

// Créer un élément sector flow
function createSectorFlowElement(flow, index) {
    const div = document.createElement('div');
    div.className = 'sector-flow-item';
    div.dataset.index = index;
    
    div.innerHTML = `
        <div class="sector-flow-header">
            <h3>Secteur: ${flow.sector || 'Nouveau Secteur'}</h3>
            <button class="btn delete-sector-flow" onclick="deleteSectorFlow(${index})">Supprimer</button>
        </div>
        <div class="sector-flow-fields">
            <div class="form-field-group">
                <label class="field-label">Nom du secteur</label>
                <input type="text" class="sector-name config-input" value="${flow.sector || ''}" placeholder="Coach">
            </div>
        </div>
        <div class="sector-flow-questions">
            <h4>Questions pour ce secteur</h4>
            <div class="sector-questions" data-sector-index="${index}">
                ${flow.questions.map((q, qIdx) => createQuestionElementHTML(q, qIdx, `sector_${index}`)).join('')}
            </div>
            <button class="btn btn-secondary" onclick="addQuestionToSector(${index})">+ Ajouter une question</button>
        </div>
    `;
    
    return div;
}

// Générer les checkboxes pour les questions à ignorer
function generateSkipQuestionsCheckboxes(skipQuestions) {
    if (!currentConfig || !currentConfig.questions) return '<p class="help-text">Aucune question disponible</p>';
    
    return currentConfig.questions.map(q => `
        <label class="checkbox-label">
            <input type="checkbox" class="skip-question-checkbox" value="${q.id}" ${skipQuestions.includes(q.id) ? 'checked' : ''}>
            ${q.label || q.id}
        </label>
    `).join('');
}

// Créer le HTML d'une question (pour insertion dans les flows)
function createQuestionElementHTML(question, index, prefix) {
    const optionsArray = Array.isArray(question.options) ? question.options : Object.keys(question.options || {});
    const scores = question.scores || {};
    
    return `
        <div class="question-item" data-index="${index}">
            <div class="question-header">
                <h4>Question ${index + 1}</h4>
                <button class="btn delete-question" onclick="deleteQuestionFromFlow('${prefix}', ${index})">×</button>
            </div>
            <div class="question-fields">
                <div class="question-field-group">
                    <label class="field-label">ID</label>
                    <input type="text" class="question-id config-input" value="${question.id || ''}" placeholder="question_id">
                </div>
                <div class="question-field-group">
                    <label class="field-label">Texte</label>
                    <input type="text" class="question-label config-input" value="${question.label || ''}" placeholder="Question ?">
                </div>
            </div>
            <div class="options-section">
                <div class="options-list">
                    ${optionsArray.map((opt, optIdx) => `
                        <div class="option-row">
                            <div class="option-input-group">
                                <label class="option-label">Réponse ${optIdx + 1}</label>
                                <input type="text" class="option-text config-input" value="${opt}" placeholder="Option">
                            </div>
                            <div class="score-input-group">
                                <label class="option-label">Score</label>
                                <input type="number" class="option-score config-input" value="${scores[opt] || 0}" min="0">
                            </div>
                            <button class="btn-remove-option" onclick="deleteOptionFromFlow('${prefix}', ${index}, ${optIdx})">×</button>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-secondary" onclick="addOptionToFlow('${prefix}', ${index})">+ Ajouter une réponse</button>
            </div>
        </div>
    `;
}

// Envoyer un message pré-rempli
async function sendPrefillMessage() {
    const phone = document.getElementById('action-phone').value;
    const message = document.getElementById('action-message').value || currentConfig?.prefill_message?.body;
    
    if (!phone) {
        showToast('Veuillez entrer un numéro de téléphone', 'error');
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_BASE}/admin/send-prefill`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone, message })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showToast('Message envoyé avec succès !', 'success');
            document.getElementById('action-phone').value = '';
            document.getElementById('action-message').value = '';
        } else {
            showToast('Erreur lors de l\'envoi', 'error');
        }
    } catch (error) {
        showToast('Erreur lors de l\'envoi', 'error');
        console.error(error);
    }
}

// Réinitialiser une session
async function resetSession() {
    const phone = document.getElementById('reset-phone').value.trim();
    
    if (!phone) {
        showToast('Veuillez entrer un numéro de téléphone', 'error');
        return;
    }
    
    if (!confirm(`Êtes-vous sûr de vouloir réinitialiser la session pour ${phone} ?`)) {
        return;
    }
    
    try {
        const response = await fetch(`${ADMIN_BASE}/admin/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        
        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Erreur HTTP ' + response.status }));
            throw new Error(errorData.error || 'Erreur lors de la réinitialisation');
        }
        
        const result = await response.json();
        
        if (result.ok) {
            showToast('Session réinitialisée avec succès !', 'success');
            document.getElementById('reset-phone').value = '';
            // Attendre un peu avant de recharger pour que la session soit bien supprimée
            setTimeout(() => loadData(), 500);
        } else {
            showToast(result.error || 'Erreur lors de la réinitialisation', 'error');
        }
    } catch (error) {
        showToast(error.message || 'Erreur lors de la réinitialisation', 'error');
        console.error('Erreur reset session:', error);
    }
}

// Voir un prospect
window.viewProspect = async function(phone) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/prospects`);
        const prospects = await response.json();
        const prospect = prospects.find(p => p.phone === phone);
        
        if (prospect) {
            showModal('Détails du Prospect', `
                <p><strong>Téléphone:</strong> ${prospect.phone}</p>
                <p><strong>Score:</strong> ${prospect.score}</p>
                <p><strong>Statut:</strong> ${prospect.status}</p>
                <p><strong>Décision:</strong> ${prospect.decision || 'N/A'}</p>
                <p><strong>Engagement:</strong> ${prospect.metadata?.engagementLevel || 'N/A'}</p>
                <p><strong>Réponses:</strong></p>
                <pre>${JSON.stringify(prospect.answers, null, 2)}</pre>
                <p><strong>Historique:</strong></p>
                <pre>${JSON.stringify(prospect.answerHistory, null, 2)}</pre>
            `);
        }
    } catch (error) {
        console.error(error);
    }
};

// Voir une conversation
window.viewConversation = async function(phone) {
    try {
        const response = await fetch(`${API_BASE}/api/admin/conversations`);
        const conversations = await response.json();
        const conv = conversations.find(c => c.phone === phone);
        
        if (conv) {
            showModal('Détails de la Conversation', `
                <p><strong>Téléphone:</strong> ${conv.phone}</p>
                <p><strong>Score:</strong> ${conv.score}</p>
                <p><strong>Statut:</strong> ${conv.status}</p>
                <p><strong>Décision:</strong> ${conv.decision || 'N/A'}</p>
                <p><strong>Réponses:</strong></p>
                <pre>${JSON.stringify(conv.answers, null, 2)}</pre>
            `);
        }
    } catch (error) {
        console.error(error);
    }
};

// Réinitialiser un prospect
window.resetProspect = async function(phone) {
    if (!confirm(`Réinitialiser la session pour ${phone} ?`)) return;
    
    try {
        const response = await fetch(`${ADMIN_BASE}/admin/reset`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ phone })
        });
        
        const result = await response.json();
        
        if (result.ok) {
            showToast('Session réinitialisée !', 'success');
            loadData();
        } else {
            showToast('Erreur', 'error');
        }
    } catch (error) {
        showToast('Erreur', 'error');
        console.error(error);
    }
};

// Afficher une modal
function showModal(title, body) {
    document.getElementById('modal-title').textContent = title;
    document.getElementById('modal-body').innerHTML = body;
    document.getElementById('modal').style.display = 'block';
}

// Fermer la modal
document.querySelector('.close-modal')?.addEventListener('click', () => {
    document.getElementById('modal').style.display = 'none';
});

window.onclick = function(event) {
    const modal = document.getElementById('modal');
    if (event.target === modal) {
        modal.style.display = 'none';
    }
};

// Afficher un toast
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;
    toast.className = `toast ${type} show`;
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Formater une date
function formatDate(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('fr-FR');
}

// Configuration des event listeners
function setupEventListeners() {
    document.getElementById('saveConfigBtn')?.addEventListener('click', saveConfig);
    document.getElementById('refreshBtn')?.addEventListener('click', () => {
        loadData();
        showToast('Données actualisées', 'success');
    });
    document.getElementById('send-prefill-btn')?.addEventListener('click', sendPrefillMessage);
    document.getElementById('reset-session-btn')?.addEventListener('click', resetSession);
    document.getElementById('add-form-flow-btn')?.addEventListener('click', addFormFlow);
    document.getElementById('add-sector-flow-btn')?.addEventListener('click', addSectorFlow);
}

// Ajouter un form flow
function addFormFlow() {
    if (!currentConfig) {
        showToast('Veuillez d\'abord charger la configuration', 'error');
        return;
    }
    if (!currentConfig.form_flows) currentConfig.form_flows = [];
    const newFlow = {
        id: `form_${Date.now()}`,
        keyword: '',
        name: '',
        prefill_message: '',
        questions: [],
        skip_questions: []
    };
    currentConfig.form_flows.push(newFlow);
    populateFormFlows(currentConfig.form_flows);
}

// Supprimer un form flow
window.deleteFormFlow = function(index) {
    if (!currentConfig || !currentConfig.form_flows) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce flow de formulaire ?')) {
        currentConfig.form_flows.splice(index, 1);
        populateFormFlows(currentConfig.form_flows);
    }
};

// Ajouter un secteur flow
function addSectorFlow() {
    if (!currentConfig) {
        showToast('Veuillez d\'abord charger la configuration', 'error');
        return;
    }
    if (!currentConfig.sector_flows) currentConfig.sector_flows = [];
    const newFlow = {
        sector: '',
        questions: []
    };
    currentConfig.sector_flows.push(newFlow);
    populateSectorFlows(currentConfig.sector_flows);
}

// Supprimer un secteur flow
window.deleteSectorFlow = function(index) {
    if (!currentConfig || !currentConfig.sector_flows) return;
    if (confirm('Êtes-vous sûr de vouloir supprimer ce flow par secteur ?')) {
        currentConfig.sector_flows.splice(index, 1);
        populateSectorFlows(currentConfig.sector_flows);
    }
};

// Ajouter une question à un flow
window.addQuestionToFlow = function(flowIndex) {
    if (!currentConfig || !currentConfig.form_flows) return;
    const flow = currentConfig.form_flows[flowIndex];
    if (!flow.questions) flow.questions = [];
    flow.questions.push({
        id: '',
        label: '',
        options: [],
        scores: {}
    });
    populateFormFlows(currentConfig.form_flows);
};

// Ajouter une question à un secteur
window.addQuestionToSector = function(sectorIndex) {
    if (!currentConfig || !currentConfig.sector_flows) return;
    const flow = currentConfig.sector_flows[sectorIndex];
    if (!flow.questions) flow.questions = [];
    flow.questions.push({
        id: '',
        label: '',
        options: [],
        scores: {}
    });
    populateSectorFlows(currentConfig.sector_flows);
};

// Supprimer une question d'un flow
window.deleteQuestionFromFlow = function(prefix, questionIndex) {
    const [type, index] = prefix.split('_');
    if (type === 'flow' && currentConfig?.form_flows) {
        const flow = currentConfig.form_flows[parseInt(index)];
        if (flow && flow.questions) {
            flow.questions.splice(questionIndex, 1);
            populateFormFlows(currentConfig.form_flows);
        }
    } else if (type === 'sector' && currentConfig?.sector_flows) {
        const flow = currentConfig.sector_flows[parseInt(index)];
        if (flow && flow.questions) {
            flow.questions.splice(questionIndex, 1);
            populateSectorFlows(currentConfig.sector_flows);
        }
    }
};

// Ajouter une option à une question dans un flow
window.addOptionToFlow = function(prefix, questionIndex) {
    const [type, index] = prefix.split('_');
    let questions;
    if (type === 'flow' && currentConfig?.form_flows) {
        questions = currentConfig.form_flows[parseInt(index)]?.questions;
    } else if (type === 'sector' && currentConfig?.sector_flows) {
        questions = currentConfig.sector_flows[parseInt(index)]?.questions;
    }
    if (questions && questions[questionIndex]) {
        if (!questions[questionIndex].options) questions[questionIndex].options = [];
        if (!questions[questionIndex].scores) questions[questionIndex].scores = {};
        questions[questionIndex].options.push('');
        if (type === 'flow') {
            populateFormFlows(currentConfig.form_flows);
        } else {
            populateSectorFlows(currentConfig.sector_flows);
        }
    }
};

// Supprimer une option d'une question dans un flow
window.deleteOptionFromFlow = function(prefix, questionIndex, optionIndex) {
    const [type, index] = prefix.split('_');
    let questions;
    if (type === 'flow' && currentConfig?.form_flows) {
        questions = currentConfig.form_flows[parseInt(index)]?.questions;
    } else if (type === 'sector' && currentConfig?.sector_flows) {
        questions = currentConfig.sector_flows[parseInt(index)]?.questions;
    }
    if (questions && questions[questionIndex]) {
        const optText = questions[questionIndex].options[optionIndex];
        questions[questionIndex].options.splice(optionIndex, 1);
        if (optText && questions[questionIndex].scores) {
            delete questions[questionIndex].scores[optText];
        }
        if (type === 'flow') {
            populateFormFlows(currentConfig.form_flows);
        } else {
            populateSectorFlows(currentConfig.sector_flows);
        }
    }
};
