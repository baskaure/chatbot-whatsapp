# Panel Admin - Bot WhatsApp

## Accès au Panel

Une fois le serveur démarré, accédez au panel admin via :
```
http://localhost:3000/admin
```

## Fonctionnalités

### 📊 Statistiques
- Vue d'ensemble des prospects, conversations et réponses
- Répartition par décision (RDV, Humain, Nurturing, Sortie)
- Niveau d'engagement des prospects
- Score moyen

### ⚙️ Configuration
Modifiez tous les paramètres du bot en temps réel :
- **Message de bienvenue** : Message initial envoyé aux prospects
- **Mots-clés de démarrage** : Mots qui déclenchent le questionnaire
- **Seuil de qualification** : Score minimum pour être qualifié
- **Règles de décision** : Scores pour chaque type de décision
- **Messages** : Personnalisez les messages pour chaque décision
- **Questions** : Ajoutez, modifiez ou supprimez des questions
  - Pour chaque question : ID, Label, Options et Scores
- **Message pré-rempli** : Configuration pour les campagnes publicitaires

### 👥 Prospects
- Liste de tous les prospects avec leurs informations
- Filtrage et recherche
- Voir les détails complets d'un prospect
- Réinitialiser une session

### 💬 Conversations
- Historique de toutes les conversations
- Détails des réponses et scores
- Statut et décision prise

### 🎯 Actions
- **Envoyer un message pré-rempli** : Pour les campagnes publicitaires
- **Réinitialiser une session** : Pour recommencer une conversation

## Utilisation

1. **Modifier la configuration** :
   - Allez dans l'onglet "Configuration"
   - Modifiez les champs souhaités
   - Cliquez sur "💾 Sauvegarder"
   - Les modifications sont appliquées immédiatement

2. **Ajouter une question** :
   - Dans l'onglet "Configuration" > Section "Questions"
   - Cliquez sur "+ Ajouter une Question"
   - Remplissez l'ID, le Label
   - Ajoutez des options avec leurs scores
   - Sauvegardez

3. **Envoyer un message pré-rempli** :
   - Allez dans l'onglet "Actions"
   - Entrez le numéro de téléphone (format: +33612345678)
   - Entrez le message ou laissez vide pour utiliser le message par défaut
   - Cliquez sur "📤 Envoyer"

4. **Consulter les statistiques** :
   - L'onglet "Statistiques" se met à jour automatiquement toutes les 30 secondes
   - Cliquez sur "🔄 Actualiser" pour forcer la mise à jour

## API Endpoints

Le panel utilise les endpoints suivants :

- `GET /api/admin/config` - Récupérer la configuration
- `POST /api/admin/config` - Sauvegarder la configuration
- `GET /api/admin/prospects` - Liste des prospects
- `GET /api/admin/conversations` - Liste des conversations
- `GET /api/admin/answers` - Liste des réponses
- `GET /api/admin/stats` - Statistiques
- `POST /admin/send-prefill` - Envoyer un message pré-rempli
- `POST /admin/reset` - Réinitialiser une session

## Notes

- Les modifications de configuration sont sauvegardées dans `config/config.json`
- Le panel se met à jour automatiquement toutes les 30 secondes
- Tous les changements sont appliqués immédiatement au bot

