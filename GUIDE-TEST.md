# Guide de Test - Chatbot WhatsApp

## 🚀 Démarrage rapide

1. **Démarrer le serveur :**
```bash
npm run dev
```

Vous devriez voir :
```
Bot listening on port 3000
```

2. **Dans un autre terminal, lancer les tests :**

### Windows :
```powershell
.\test-bot.ps1
```

### Linux/Mac :
```bash
chmod +x test-bot.sh
./test-bot.sh
```

### Node.js (toutes plateformes) :
```bash
node test-bot.js
```

## 📋 Flow de test complet

Le script de test simule une conversation complète :

1. ✅ **Health Check** - Vérifie que le serveur fonctionne
2. 📱 **Message initial** - Envoie "Coach" (mot déclencheur)
3. ✅ **Réponse "Oui"** - Démarre le questionnaire
4. 📝 **5 Questions** - Réponses d'un prospect qualifié :
   - Secteur : "Coach"
   - CA : "50k+"
   - Pub : "Oui"
   - Objectif : "Plus de leads"
   - Budget : "Oui je peux"
5. 🎯 **Score calculé** - Le bot détermine que c'est qualifié (score ≥ 7)
6. 📅 **Lien Calendly** - Le bot envoie le lien de réservation

## 👀 Où voir les résultats ?

### 1. Console du serveur
Les messages envoyés par le bot apparaissent avec le préfixe `[SEND]` :
```
[SEND] whatsapp:+33612345678 Salut, ici l'assistant de Kingdom Ads...
[SEND] whatsapp:+33612345678 Secteur d'activité
- Coach
- Infopreneur
...
```

### 2. Fichier de sauvegarde
Après chaque conversation complète, vérifiez :
```
data/conversations.jsonl
```

Chaque ligne contient un JSON avec :
- `phone` : Numéro WhatsApp
- `startedAt` : Date de début
- `answers` : Toutes les réponses
- `score` : Score final calculé
- `status` : "qualified" ou "disqualified"
- `calendlySent` : true/false
- `resourceSent` : true/false

## 🧪 Tests manuels

### Test 1 : Prospect qualifié
```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33611111111","Body":"Coach"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33611111111","Body":"Oui"}'

# Puis répondre aux questions dans l'ordre
```

### Test 2 : Prospect non qualifié
```bash
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33622222222","Body":"Coach"}'

curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33622222222","Body":"Oui"}'

# Réponses avec score faible :
# - Secteur : "Autre"
# - CA : "0–5k"
# - Pub : "Non"
# - Objectif : "Autre"
# - Budget : "Non"
```

### Test 3 : Réponse invalide
```bash
# Envoyer une réponse qui n'est pas dans les options
curl -X POST http://localhost:3000/webhook/whatsapp \
  -H "Content-Type: application/json" \
  -d '{"From":"whatsapp:+33633333333","Body":"blabla"}'

# Le bot devrait renvoyer les options disponibles
```

## 🔍 Vérifications importantes

- ✅ Le serveur répond sur `/health`
- ✅ Le message d'accueil est envoyé au premier message
- ✅ Les questions sont posées dans l'ordre
- ✅ Les réponses invalides sont rejetées
- ✅ Le score est calculé correctement
- ✅ Le lien Calendly est envoyé aux qualifiés
- ✅ La ressource est envoyée aux non qualifiés
- ✅ Les données sont sauvegardées dans `data/conversations.jsonl`

## 🐛 Dépannage

### Le serveur ne démarre pas
- Vérifiez que le port 3000 n'est pas utilisé : `netstat -ano | findstr :3000` (Windows)
- Changez le port avec : `PORT=3001 npm run dev`

### Les messages n'apparaissent pas
- Vérifiez que le serveur est bien démarré
- Regardez les logs dans la console
- Vérifiez que le webhook reçoit bien les requêtes

### Les données ne sont pas sauvegardées
- Vérifiez que le dossier `data/` existe
- Vérifiez les permissions d'écriture
- Regardez les erreurs dans la console

## 📊 Exemple de données sauvegardées

```json
{
  "phone": "whatsapp:+33612345678",
  "startedAt": "2024-01-15T10:30:00.000Z",
  "answers": {
    "sector": "Coach",
    "revenue": "50k+",
    "ads": "Oui",
    "goal": "Plus de leads",
    "budget": "Oui je peux"
  },
  "score": 12,
  "status": "qualified",
  "calendlySent": true,
  "resourceSent": false
}
```

