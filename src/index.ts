import express from "express";
import bodyParser from "body-parser";
import { v4 as uuid } from "uuid";
import { createRequire } from "module";
import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { handleIncoming } from "./flow.js";
import { IncomingMessage } from "./types.js";
import { isDuplicate } from "./dedup.js";
import { resetSession } from "./sessionStore.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const config = loadConfig();
const require = createRequire(import.meta.url);
const twilio = require("twilio");

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Endpoint admin pour réinitialiser une conversation
app.post("/admin/reset", async (req, res) => {
  const phone = req.body?.phone || req.query?.phone;
  if (!phone) {
    return res.status(400).json({ error: "Paramètre 'phone' requis" });
  }
  try {
    await resetSession(phone);
    // eslint-disable-next-line no-console
    console.log(`[ADMIN] Session réinitialisée pour ${phone}`);
    res.json({ ok: true, message: `Session réinitialisée pour ${phone}` });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("Erreur réinitialisation session:", err);
    res.status(500).json({ error: "Erreur lors de la réinitialisation" });
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
