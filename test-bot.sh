#!/bin/bash
# Script de test pour le chatbot WhatsApp
# Usage: ./test-bot.sh

BASE_URL="http://localhost:3000"
PHONE="whatsapp:+33612345678"

echo "=== Test du Chatbot WhatsApp ==="
echo ""

# Test 1: Health check
echo "1. Test Health Check..."
if curl -s "$BASE_URL/health" | grep -q "ok"; then
    echo "✓ Serveur OK"
else
    echo "✗ Erreur: Serveur non disponible"
    exit 1
fi

echo ""

# Test 2: Premier message (déclencheur)
echo "2. Envoi du premier message (mot déclencheur)..."
curl -s -X POST "$BASE_URL/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d "{\"From\":\"$PHONE\",\"Body\":\"Coach\"}" > /dev/null
echo "✓ Message envoyé"
echo "  → Le bot devrait envoyer le message d'accueil"
sleep 2

# Test 3: Réponse "Oui" pour commencer
echo ""
echo "3. Réponse 'Oui' pour commencer..."
curl -s -X POST "$BASE_URL/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d "{\"From\":\"$PHONE\",\"Body\":\"Oui\"}" > /dev/null
echo "✓ Message envoyé"
echo "  → Le bot devrait poser la première question"
sleep 2

# Test 4-8: Réponses aux questions (prospect qualifié)
echo ""
echo "4-8. Réponses aux questions (prospect qualifié)..."
ANSWERS=("Coach" "50k+" "Oui" "Plus de leads" "Oui je peux")

for answer in "${ANSWERS[@]}"; do
    echo "  → Envoi: $answer"
    curl -s -X POST "$BASE_URL/webhook/whatsapp" \
      -H "Content-Type: application/json" \
      -d "{\"From\":\"$PHONE\",\"Body\":\"$answer\"}" > /dev/null
    sleep 1
done

echo "✓ Toutes les réponses envoyées"
echo "  → Le bot devrait calculer le score et proposer Calendly"
sleep 2

# Test 9: Préférence matin/après-midi
echo ""
echo "9. Préférence 'matin'..."
curl -s -X POST "$BASE_URL/webhook/whatsapp" \
  -H "Content-Type: application/json" \
  -d "{\"From\":\"$PHONE\",\"Body\":\"matin\"}" > /dev/null
echo "✓ Message envoyé"
echo "  → Le bot devrait envoyer le lien Calendly"

echo ""
echo "=== Test terminé ==="
echo "Vérifiez les logs du serveur pour voir les messages envoyés"
echo "Vérifiez le fichier data/conversations.jsonl pour les données sauvegardées"

