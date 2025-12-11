import { google, sheets_v4 } from "googleapis";
import { ConversationState } from "../types.js";

const SHEET_ID = process.env.GSHEET_ID;
const SHEET_TAB = process.env.GSHEET_TAB || "Conversations";
const SERVICE_ACCOUNT_KEY = process.env.GCP_SERVICE_ACCOUNT_KEY; // base64 JSON

function getClient(): sheets_v4.Sheets | null {
  if (!SHEET_ID || !SERVICE_ACCOUNT_KEY) return null;
  const json = JSON.parse(Buffer.from(SERVICE_ACCOUNT_KEY, "base64").toString("utf8"));
  const auth = new google.auth.JWT({
    email: json.client_email,
    key: json.private_key,
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return google.sheets({ version: "v4", auth });
}

export async function persistToSheet(state: ConversationState): Promise<boolean> {
  const client = getClient();
  if (!client || !SHEET_ID) return false;
  const values = [
    [
      new Date().toISOString(),
      state.phone,
      JSON.stringify(state.answers),
      state.score,
      state.status,
      state.calendlySent,
      state.resourceSent,
      state.calendlyPreference ?? "",
    ],
  ];
  await client.spreadsheets.values.append({
    spreadsheetId: SHEET_ID,
    range: `${SHEET_TAB}!A1`,
    valueInputOption: "RAW",
    requestBody: { values },
  });
  return true;
}

