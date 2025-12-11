import express from "express";
import bodyParser from "body-parser";
import { v4 as uuid } from "uuid";
import { createRequire } from "module";
import dotenv from "dotenv";
import { loadConfig } from "./config.js";
import { handleIncoming } from "./flow.js";
import { IncomingMessage } from "./types.js";

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;
const config = loadConfig();
const require = createRequire(import.meta.url);
const { validateRequest } = require("twilio").webhooks || { validateRequest: undefined };

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Webhook endpoint to plug with WhatsApp provider
app.post("/webhook/whatsapp", async (req, res) => {
  // Optionnel : validation de signature Twilio
  const twilioAuth = process.env.TWILIO_AUTH_TOKEN;
  const publicUrl = process.env.PUBLIC_URL;
  const signature = req.headers["x-twilio-signature"] as string | undefined;
  if (twilioAuth && publicUrl && signature) {
    const isValid = validateRequest(twilioAuth, signature, `${publicUrl}${req.originalUrl}`, req.body);
    if (!isValid) {
      return res.status(403).json({ error: "Invalid signature" });
    }
  }

  // Adapt parsing according to provider payload
  const body = req.body?.Body || req.body?.body || "";
  const from = req.body?.From || req.body?.from || "unknown";

  const incoming: IncomingMessage = {
    id: uuid(),
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
