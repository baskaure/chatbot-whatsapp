import express from "express";
import bodyParser from "body-parser";
import { v4 as uuid } from "uuid";
import { loadConfig } from "./config.js";
import { handleIncoming } from "./flow.js";
import { IncomingMessage } from "./types.js";

const app = express();
const port = process.env.PORT || 3000;
const config = loadConfig();

app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

app.get("/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Webhook endpoint to plug with WhatsApp provider
app.post("/webhook/whatsapp", async (req, res) => {
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

