import express from "express";
import bodyParser from "body-parser";
import { v4 as uuid } from "uuid";
import { createRequire } from "module";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { loadConfig, saveConfig } from "./config.js";
import { handleIncoming } from "./flow.js";
import { IncomingMessage, BotConfig } from "./types.js";
import { isDuplicate } from "./dedup.js";
import { resetSession, allSessions } from "./sessionStore.js";
import { getAllProspects, getAllConversations, getAllAnswers, resetProspectProfile } from "./storage/localStore.js";
import {
  getAllProspectsDB,
  getAllConversationsDB,
  getAllAnswersDB,
  resetProspectProfileDB,
  initDatabase,
  isDatabaseAvailable,
} from "./storage/db.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const port = process.env.PORT || 3000;
let config = loadConfig();
const require = createRequire(import.meta.url);
const twilio = require("twilio");

// Initialiser la base de données au démarrage
if (isDatabaseAvailable()) {
  initDatabase().then((success) => {
    if (success) {
      // eslint-disable-next-line no-console
      console.log("[APP] Base de données PostgreSQL initialisée");
    } else {
      // eslint-disable-next-line no-console
      console.log("[APP] Base de données non disponible, utilisation des fichiers locaux");
    }
  });
}

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Servir les fichiers statiques du panel admin
app.use("/admin", express.static(path.join(__dirname, "../admin")));

// Servir les fichiers statiques du dossier public (logo, etc.)
app.use("/public", express.static(path.join(__dirname, "../public")));

// Route pour servir index.html du panel admin
app.get("/admin", (_req, res) => {
  res.sendFile(path.join(__dirname, "../admin/index.html"));
});

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Normaliser le numéro de téléphone (enlever whatsapp: si présent)
function normalizePhone(phone: string): string {
  return phone.replace(/^whatsapp:/i, "").trim();
}

// Endpoint admin pour réinitialiser une conversation
app.post("/admin/reset", async (req, res) => {
  const phoneRaw = req.body?.phone || req.query?.phone;
  if (!phoneRaw) {
    return res.status(400).json({ error: "Paramètre 'phone' requis" });
  }
  try {
    const phone = normalizePhone(phoneRaw);
    
    // 1. Supprimer la session en mémoire/Redis
    await resetSession(phone);
    
    // 2. Supprimer la fiche prospect (DB ou fichier)
    if (isDatabaseAvailable()) {
      await resetProspectProfileDB(phone);
    } else {
      resetProspectProfile(phone);
    }
    
    // eslint-disable-next-line no-console
    console.log(`[ADMIN] Session et fiche prospect réinitialisées pour ${phone}`);
    res.json({ ok: true, message: `Session réinitialisée pour ${phone}` });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur réinitialisation session:", err);
    res.status(500).json({ error: "Erreur lors de la réinitialisation" });
  }
});

// Endpoint pour envoyer un message pré-rempli (pour la pub)
app.post("/admin/send-prefill", async (req, res) => {
  const phone = req.body?.phone || req.query?.phone;
  const message = req.body?.message || config.prefill_message?.body || config.welcome;
  
  if (!phone) {
    return res.status(400).json({ error: "Paramètre 'phone' requis" });
  }
  
  try {
    const { sendMessage } = await import("./provider/sendMessage.js");
    await sendMessage({ to: phone, body: message });
    // eslint-disable-next-line no-console
    console.log(`[ADMIN] Message pré-rempli envoyé à ${phone}`);
    res.json({ ok: true, message: `Message pré-rempli envoyé à ${phone}` });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur envoi message pré-rempli:", err);
    res.status(500).json({ error: "Erreur lors de l'envoi du message" });
  }
});

// API Admin - Récupérer la configuration
app.get("/api/admin/config", (_req, res) => {
  try {
    // Utiliser la config en mémoire (toujours à jour après sauvegarde)
    // Ne pas recharger depuis le fichier pour éviter d'écraser les modifications
    res.json(config);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur chargement config:", err);
    res.status(500).json({ error: "Erreur lors du chargement de la configuration" });
  }
});

// API Admin - Sauvegarder la configuration
app.post("/api/admin/config", (req, res) => {
  try {
    const newConfig = req.body as BotConfig;
    
    // Sauvegarder dans le fichier
    saveConfig(newConfig);
    
    // Mettre à jour la config en mémoire IMMÉDIATEMENT
    config = newConfig;
    
    // eslint-disable-next-line no-console
    console.log("[ADMIN] Configuration sauvegardée et mise à jour en mémoire");
    // eslint-disable-next-line no-console
    console.log("[ADMIN] Nombre de questions:", newConfig.questions.length);
    
    res.json({ ok: true, message: "Configuration sauvegardée avec succès" });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur sauvegarde config:", err);
    res.status(500).json({ error: "Erreur lors de la sauvegarde de la configuration" });
  }
});

// API Admin - Récupérer tous les prospects
app.get("/api/admin/prospects", (_req, res) => {
  try {
    const prospects = getAllProspects();
    // eslint-disable-next-line no-console
    console.log(`[API] Récupération de ${prospects.length} prospects`);
    res.json(prospects);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur récupération prospects:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des prospects", details: String(err) });
  }
});

// API Admin - Récupérer toutes les conversations
app.get("/api/admin/conversations", async (_req, res) => {
  try {
    const conversations = isDatabaseAvailable()
      ? await getAllConversationsDB()
      : getAllConversations();
    res.json(conversations);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur récupération conversations:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des conversations" });
  }
});

// API Admin - Récupérer toutes les réponses
app.get("/api/admin/answers", async (_req, res) => {
  try {
    const answers = isDatabaseAvailable()
      ? await getAllAnswersDB()
      : getAllAnswers();
    // eslint-disable-next-line no-console
    console.log(`[API] Récupération de ${answers.length} réponses`);
    res.json(answers);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur récupération réponses:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des réponses", details: String(err) });
  }
});

// API Admin - Récupérer les sessions actives
app.get("/api/admin/sessions", async (_req, res) => {
  try {
    const sessions = await allSessions();
    res.json(sessions);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur récupération sessions:", err);
    res.status(500).json({ error: "Erreur lors de la récupération des sessions" });
  }
});

// API Admin - Statistiques
app.get("/api/admin/stats", (_req, res) => {
  try {
    const prospects = getAllProspects();
    const conversations = getAllConversations();
    const answers = getAllAnswers();
    
    const stats = {
      totalProspects: prospects.length,
      totalConversations: conversations.length,
      totalAnswers: answers.length,
      byDecision: {
        rdv: prospects.filter((p) => p.decision === "rdv").length,
        humain: prospects.filter((p) => p.decision === "humain").length,
        nurturing: prospects.filter((p) => p.decision === "nurturing").length,
        sortie: prospects.filter((p) => p.decision === "sortie").length,
        null: prospects.filter((p) => !p.decision).length,
      },
      byStatus: {
        collecting: prospects.filter((p) => p.status === "collecting").length,
        completed: prospects.filter((p) => p.status === "completed").length,
        qualified: prospects.filter((p) => p.status === "qualified").length,
        disqualified: prospects.filter((p) => p.status === "disqualified").length,
      },
      averageScore: prospects.length > 0
        ? prospects.reduce((sum, p) => sum + p.score, 0) / prospects.length
        : 0,
      engagementLevel: {
        high: prospects.filter((p) => p.metadata.engagementLevel === "high").length,
        medium: prospects.filter((p) => p.metadata.engagementLevel === "medium").length,
        low: prospects.filter((p) => p.metadata.engagementLevel === "low").length,
      },
    };
    
    res.json(stats);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur calcul statistiques:", err);
    res.status(500).json({ error: "Erreur lors du calcul des statistiques" });
  }
});

// Webhook endpoint to plug with WhatsApp provider
app.post("/webhook/whatsapp", async (req, res) => {
  // Optionnel : validation de signature Twilio
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const publicUrl = process.env.PUBLIC_URL;
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (twilioAuth && publicUrl && signature && typeof twilio?.validateRequest === "function") {
    const isValid = twilio.validateRequest(twilioAuth, signature, `${publicUrl}${req.originalUrl}`, req.body);
    if (!isValid) return res.status(403).json({ error: "Invalid signature" });
  }

  // Adapt parsing according to provider payload
  const body = req.body?.Body || req.body?.body || "";
  const from = req.body?.From || req.body?.from || "unknown";
  const messageSid = req.body?.MessageSid || req.body?.SmsMessageSid || undefined;

  // Déduplication basique pour éviter les traitements multiples du même message
  if (await isDuplicate(messageSid)) {
    return res.json({ ok: true, dedup: true });
  }

  const incoming: IncomingMessage = {
    id: uuid(),
    messageSid,
    from,
    body,
  };

  try {
    await handleIncoming(incoming, config);
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Error handling incoming", err);
  }

  res.json({ ok: true });
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Bot listening on port ${port}`);
});
