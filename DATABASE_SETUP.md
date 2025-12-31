# Configuration PostgreSQL

## Sur Render

1. **Créer une base de données PostgreSQL** :
   - Allez sur [Render Dashboard](https://dashboard.render.com)
   - Cliquez sur "New +" → "PostgreSQL"
   - Choisissez un nom (ex: `chatbot-db`)
   - Sélectionnez le plan gratuit (Free)
   - Cliquez sur "Create Database"

2. **Récupérer l'URL de connexion** :
   - Une fois créée, allez dans les paramètres de votre base de données
   - Copiez l'**Internal Database URL** (pour les services sur Render)
   - Ou l'**External Database URL** (pour développement local)

3. **Configurer la variable d'environnement** :
   - Dans votre service web sur Render, allez dans "Environment"
   - Ajoutez la variable : `DATABASE_URL` = l'URL copiée
   - Redéployez votre service

## Développement local

1. **Installer PostgreSQL** (si pas déjà fait) :
   - Windows : [PostgreSQL Windows](https://www.postgresql.org/download/windows/)
   - Mac : `brew install postgresql`
   - Linux : `sudo apt-get install postgresql`

2. **Créer une base de données** :
   ```bash
   createdb chatbot_dev
   ```

3. **Configurer la variable d'environnement** :
   Créez un fichier `.env` :
   ```
   DATABASE_URL=postgresql://username:password@localhost:5432/chatbot_dev
   ```

## Fonctionnement

- **Si `DATABASE_URL` est défini** : Les données sont sauvegardées dans PostgreSQL (persistance garantie)
- **Si `DATABASE_URL` n'est pas défini** : Fallback vers les fichiers locaux (pour développement)

Les tables sont créées automatiquement au premier démarrage si elles n'existent pas.

## Tables créées

- `prospects` : Fiches prospects (une par numéro de téléphone)
- `conversations` : Historique des conversations sauvegardées
- `answers` : Toutes les réponses individuelles en temps réel

