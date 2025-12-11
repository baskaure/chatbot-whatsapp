import { OutgoingMessage } from "../types.js";

// Placeholder provider adapter.
// Replace this with Twilio/360dialog/etc. SDK calls.
export async function sendMessage(msg: OutgoingMessage): Promise<void> {
  // eslint-disable-next-line no-console
  console.log("[SEND]", msg.to, msg.body);
}

