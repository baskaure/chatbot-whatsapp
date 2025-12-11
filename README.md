# Chatbot WhatsApp (qualification + scoring + Calendly)

## Démarrage rapide
1) Installe Node 18+  
2) `npm install`  
3) Configure `.env` (voir ci-dessous)  
4) `npm run dev`  
Le serveur écoute sur `PORT` (3000 par défaut) avec un webhook `POST /webhook/whatsapp`.

### Variables d’environnement clés
- `PUBLIC_URL` : URL publique du webhook (https://.../webhook/whatsapp) pour la validation Twilio  
- `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_MESSAGING_SERVICE_SID` ou `TWILIO_WHATSAPP_FROM`  
- `REDIS_URL` : stockage des sessions (fallback mémoire si absent)  
- `SESSION_TTL_SECONDS` : durée de vie des sessions (par défaut 6h)  
- `GSHEET_ID`, `GSHEET_TAB` (optionnel), `GCP_SERVICE_ACCOUNT_KEY` (base64 du JSON service account)  
- `BOT_CONFIG_PATH` : chemin alternatif vers le fichier de config

## Configuration sans code
- `config/config.json` contient : questions, options, scores, seuil, messages, liens.  
- `BOT_CONFIG_PATH` peut pointer vers un autre fichier.  
- Liens à personnaliser : `messages.calendly_link`, `messages.resource_link`.  
- Ajuste `qualified_threshold` pour changer le seuil de qualification.

## Intégration provider WhatsApp
- Adapter le parsing dans `src/index.ts` (`From` / `Body`) pour Twilio/360dialog/etc.  
- Remplacer `src/provider/sendMessage.ts` par l’appel SDK du provider.  
- Assurer l’URL publique `POST /webhook/whatsapp` dans la console du provider.

## Flow
1. Premier message → accueil (si mot-clé pas détecté).  
2. Réponse “ok/oui/ready/go” → démarrage des 5 questions.  
3. Chaque question force une réponse valide (sinon relance avec options).  
4. Score calculé, seuil configurable.  
5. Si qualifié : message d’intro + lien Calendly.  
6. Si non qualifié : message ressource + lien PDF/vidéo.  
7. Sauvegarde basique en local `data/conversations.jsonl` (JSONL). Brancher Sheets/Notion/DB au besoin.

## Connecteurs de stockage
- Par défaut : append JSONL via `src/storage/localStore.ts`.  
- Tu peux ajouter un connecteur Notion/Sheets et appeler `persistConversation` avec l’implémentation cible.

## Reprise et état
- État en mémoire via `src/sessionStore.ts` (à remplacer par Redis pour la prod).  
- `currentQuestionIndex` gère la reprise après interruption.

## À personnaliser rapidement
- Provider WA (Twilio/360dialog) : parsing entrant + envoi sortant.  
- Lien Calendly + ressource.  
- Options/score/questions dans `config/config.json`.  
- Persistant : Redis + DB/Sheets/Notion.

## Tests

### Méthode 1 : Scripts automatisés

**Windows (PowerShell) :**
```powershell
.\test-bot.ps1
```

**Linux/Mac (Bash) :**
```bash
chmod +x test-bot.sh
./test-bot.sh
```

### Méthode 2 : Tests manuels avec curl

1. **Démarrer le serveur :**
```bash
npm run dev
```

2. **Test Health Check :**
```bash
curl http://localhost:3000/health
```

3. **Simuler une conversation complète :**

```bash
# Message initial (mot déclencheur)
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Coach"}'

# Réponse "Oui" pour commencer
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Oui"}'

# Réponses aux questions (prospect qualifié)
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Coach"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"50k+"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Oui"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Plus de leads"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"Oui je peux"}'

# Préférence matin/après-midi
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33612345678","Body":"matin"}'
```

### Méthode 3 : Test avec Node.js

```bash
node test-bot.js
```

### Vérification des résultats

- **Logs du serveur** : Les messages envoyés apparaissent dans la console avec `[SEND]`
- **Données sauvegardées** : Vérifiez `data/conversations.jsonl` après un flow complet
- **Score calculé** : Le score final apparaît dans les logs et dans le fichier de sauvegarde

### Test d'un prospect non qualifié

Pour tester le cas "non qualifié", utilisez des réponses avec un score faible :
- Secteur : "Autre"
- CA : "0–5k"
- Pub : "Non"
- Objectif : "Autre"
- Budget : "Non"

Le bot devrait envoyer le message de disqualification + lien ressource.

