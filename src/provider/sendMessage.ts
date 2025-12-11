import { createRequire } from "module";
import { OutgoingMessage } from "../types.js";

const require = createRequire(import.meta.url);
// twilio est CommonJS : on le charge via require pour éviter les soucis d'import ESM/CJS.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const twilio: typeof import("twilio") = require("twilio");

const {
  TWILIO_ACCOUNT_SID,
  TWILIO_AUTH_TOKEN,
  TWILIO_MESSAGING_SERVICE_SID,
  TWILIO_WHATSAPP_FROM,
} = process.env;

const twilioClient =
  TWILIO_ACCOUNT_SID && TWILIO_AUTH_TOKEN ? twilio(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN) : null;

export async function sendMessage(msg: OutgoingMessage): Promise<void> {
  if (!twilioClient) {
    // eslint-disable-next-line no-console
    console.log("[SEND:DRY-RUN]", msg.to, msg.body);
    return;
  }

  const payload: any = {
    to: msg.to.startsWith("whatsapp:") ? msg.to : `whatsapp:${msg.to}`,
    body: msg.body,
  } as const;

  if (TWILIO_MESSAGING_SERVICE_SID) {
    payload.messagingServiceSid = TWILIO_MESSAGING_SERVICE_SID;
  } else if (TWILIO_WHATSAPP_FROM) {
    payload.from = TWILIO_WHATSAPP_FROM.startsWith("whatsapp:")
      ? TWILIO_WHATSAPP_FROM
      : `whatsapp:${TWILIO_WHATSAPP_FROM}`;
  } else {
    throw new Error("Configurer TWILIO_MESSAGING_SERVICE_SID ou TWILIO_WHATSAPP_FROM");
  }

  await twilioClient.messages.create(payload);
}

