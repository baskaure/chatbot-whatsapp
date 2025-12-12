import { google, sheets_v4 } from "googleapis";
import { ConversationState } from "../types.js";

const SHEET_ID = process.env.GSHEET_ID;
const SHEET_TAB = process.env.GSHEET_TAB || "Conversations";
const SERVICE_ACCOUNT_KEY = process.env.GCP_SERVICE_ACCOUNT_KEY; // base64 JSON

function getClient(): sheets_v4.Sheets | null {
  if (!SHEET_ID) {
    // eslint-disable-next-line no-console
    console.log("[SHEETS] GSHEET_ID non défini");
    return null;
  }
  if (!SERVICE_ACCOUNT_KEY) {
    // eslint-disable-next-line no-console
    console.log("[SHEETS] GCP_SERVICE_ACCOUNT_KEY non défini");
    return null;
  }
  try {
    const json = JSON.parse(Buffer.from(SERVICE_ACCOUNT_KEY, "base64").toString("utf8"));
    const auth = new google.auth.JWT({
      email: json.client_email,
      key: json.private_key,
      scopes: ["https://www.googleapis.com/auth/spreadsheets"],
    });
    return google.sheets({ version: "v4", auth });
  } catch (err) {
    // eslint-disable-next-line no-console
    console.error("[SHEETS] Erreur parsing clé service account:", err);
    return null;
  }
}

export async function persistToSheet(state: ConversationState): Promise<boolean> {
  const client = getClient();
  if (!client || !SHEET_ID) {
    // eslint-disable-next-line no-console
    console.log("[SHEETS] Client non disponible, fallback vers local");
    return false;
  }
  try {
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
    // eslint-disable-next-line no-console
    console.log(`[SHEETS] Tentative export vers ${SHEET_ID}, onglet "${SHEET_TAB}"`);
    const result = await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${SHEET_TAB}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    // eslint-disable-next-line no-console
    console.log(`[SHEETS] Export réussi, ${result.data.updates?.updatedRows || 0} ligne(s) ajoutée(s)`);
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[SHEETS] Erreur export Google Sheets:", err?.response?.data || err?.message || err);
    return false;
  }
}

