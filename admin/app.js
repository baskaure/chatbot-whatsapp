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
    
    // Actualiser toutes les 10 secondes
    setInterval(() => {
        const activeTab = document.querySelector('.tab-content.active');
        if (activeTab) {
            loadData();
        }
    }, 10000);
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
            <td>${phone}</td>
            <td>${prospect.score || 0}</td>
            <td><span class="badge">${prospect.status || ''}</span></td>
            <td><span class="badge badge-${decision}">${decision}</span></td>
            <td><span class="badge badge-${engagement}">${engagement}</span></td>
            <td>${formatDate(prospect.lastActivityAt)}</td>
            <td>
                <button class="btn btn-secondary" onclick="viewProspect('${phone.replace(/'/g, "\\'")}')">Voir</button>
                <button class="btn btn-warning" onclick="resetProspect('${phone.replace(/'/g, "\\'")}')">Réinitialiser</button>
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
        displayAnswers(answers);
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
        const response = await fetch(`${API_BASE}/api/admin/conversations`);
        const conversations = await response.json();
        displayConversations(conversations);
    } catch (error) {
        console.error('Erreur chargement conversations:', error);
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
            currentConfig = config;
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
    document.querySelectorAll('.question-item').forEach(item => {
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
        
        if (question.id && question.label && question.options.length > 0) {
            config.questions.push(question);
        }
    });
    
    return config;
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
}

