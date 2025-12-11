# Script de test pour le chatbot WhatsApp
# Usage: .\test-bot.ps1

$baseUrl = "http://localhost:3000"
$phone = "whatsapp:+33612345678"

Write-Host "=== Test du Chatbot WhatsApp ===" -ForegroundColor Cyan
Write-Host ""

# Test 1: Health check
Write-Host "1. Test Health Check..." -ForegroundColor Yellow
try {
    $response = Invoke-RestMethod -Uri "$baseUrl/health" -Method GET
    Write-Host "✓ Serveur OK: $($response.status)" -ForegroundColor Green
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
    exit 1
}

Write-Host ""

# Test 2: Premier message (déclencheur)
Write-Host "2. Envoi du premier message (mot déclencheur)..." -ForegroundColor Yellow
$body = @{
    From = $phone
    Body = "Coach"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/webhook/whatsapp" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Message envoyé" -ForegroundColor Green
    Write-Host "  → Le bot devrait envoyer le message d'accueil" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 3: Réponse "Oui" pour commencer
Write-Host ""
Write-Host "3. Réponse 'Oui' pour commencer..." -ForegroundColor Yellow
$body = @{
    From = $phone
    Body = "Oui"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/webhook/whatsapp" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Message envoyé" -ForegroundColor Green
    Write-Host "  → Le bot devrait poser la première question" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

Start-Sleep -Seconds 2

# Test 4-8: Réponses aux questions (prospect qualifié)
Write-Host ""
Write-Host "4-8. Réponses aux questions (prospect qualifié)..." -ForegroundColor Yellow
$answers = @("Coach", "50k+", "Oui", "Plus de leads", "Oui je peux")

foreach ($answer in $answers) {
    Write-Host "  → Envoi: $answer" -ForegroundColor Gray
    $body = @{
        From = $phone
        Body = $answer
    } | ConvertTo-Json
    
    try {
        $response = Invoke-RestMethod -Uri "$baseUrl/webhook/whatsapp" -Method POST -Body $body -ContentType "application/json"
        Start-Sleep -Seconds 1
    } catch {
        Write-Host "  ✗ Erreur: $_" -ForegroundColor Red
    }
}

Write-Host "✓ Toutes les réponses envoyées" -ForegroundColor Green
Write-Host "  → Le bot devrait calculer le score et proposer Calendly" -ForegroundColor Gray

Start-Sleep -Seconds 2

# Test 9: Préférence matin/après-midi
Write-Host ""
Write-Host "9. Préférence 'matin'..." -ForegroundColor Yellow
$body = @{
    From = $phone
    Body = "matin"
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri "$baseUrl/webhook/whatsapp" -Method POST -Body $body -ContentType "application/json"
    Write-Host "✓ Message envoyé" -ForegroundColor Green
    Write-Host "  → Le bot devrait envoyer le lien Calendly" -ForegroundColor Gray
} catch {
    Write-Host "✗ Erreur: $_" -ForegroundColor Red
}

Write-Host ""
Write-Host "=== Test terminé ===" -ForegroundColor Cyan
Write-Host "Vérifiez les logs du serveur pour voir les messages envoyés" -ForegroundColor Gray
Write-Host "Vérifiez le fichier data/conversations.jsonl pour les données sauvegardées" -ForegroundColor Gray

