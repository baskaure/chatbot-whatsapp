// Script de test Node.js pour le chatbot WhatsApp
const http = require('http');

const BASE_URL = 'http://localhost:3000';
const PHONE = 'whatsapp:+33612345678';

function sendWebhook(body) {
  return new Promise((resolve, reject) => {
    const data = JSON.stringify({
      From: PHONE,
      Body: body
    });

    const options = {
      hostname: 'localhost',
      port: 3000,
      path: '/webhook/whatsapp',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': data.length
      }
    };

    const req = http.request(options, (res) => {
      let responseData = '';
      res.on('data', (chunk) => {
        responseData += chunk;
      });
      res.on('end', () => {
        resolve({ status: res.statusCode, data: responseData });
      });
    });

    req.on('error', (error) => {
      reject(error);
    });

    req.write(data);
    req.end();
  });
}

async function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function test() {
  console.log('=== Test du Chatbot WhatsApp ===\n');

  // Test 1: Health check
  console.log('1. Test Health Check...');
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log(`✓ Serveur OK: ${data.status}\n`);
  } catch (error) {
    console.error('✗ Erreur:', error.message);
    process.exit(1);
  }

  // Test 2: Premier message (déclencheur)
  console.log('2. Envoi du premier message (mot déclencheur)...');
  try {
    await sendWebhook('Coach');
    console.log('✓ Message envoyé');
    console.log('  → Le bot devrait envoyer le message d\'accueil\n');
  } catch (error) {
    console.error('✗ Erreur:', error.message);
  }

  await sleep(2000);

  // Test 3: Réponse "Oui" pour commencer
  console.log('3. Réponse "Oui" pour commencer...');
  try {
    await sendWebhook('Oui');
    console.log('✓ Message envoyé');
    console.log('  → Le bot devrait poser la première question\n');
  } catch (error) {
    console.error('✗ Erreur:', error.message);
  }

  await sleep(2000);

  // Test 4-8: Réponses aux questions (prospect qualifié)
  console.log('4-8. Réponses aux questions (prospect qualifié)...');
  const answers = ['Coach', '50k+', 'Oui', 'Plus de leads', 'Oui je peux'];

  for (const answer of answers) {
    console.log(`  → Envoi: ${answer}`);
    try {
      await sendWebhook(answer);
      await sleep(1000);
    } catch (error) {
      console.error(`  ✗ Erreur: ${error.message}`);
    }
  }

  console.log('✓ Toutes les réponses envoyées');
  console.log('  → Le bot devrait calculer le score et proposer Calendly\n');
  await sleep(2000);

  // Test 9: Préférence matin/après-midi
  console.log('9. Préférence "matin"...');
  try {
    await sendWebhook('matin');
    console.log('✓ Message envoyé');
    console.log('  → Le bot devrait envoyer le lien Calendly\n');
  } catch (error) {
    console.error('✗ Erreur:', error.message);
  }

  console.log('=== Test terminé ===');
  console.log('Vérifiez les logs du serveur pour voir les messages envoyés');
  console.log('Vérifiez le fichier data/conversations.jsonl pour les données sauvegardées');
}

// Utiliser fetch si disponible (Node 18+), sinon fallback
if (typeof fetch === 'undefined') {
  global.fetch = async (url) => {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const options = {
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || 3000,
        path: parsedUrl.pathname,
        method: 'GET'
      };

      const req = http.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          resolve({
            json: async () => JSON.parse(data),
            status: res.statusCode
          });
        });
      });

      req.on('error', reject);
      req.end();
    });
  };
}

test().catch(console.error);

