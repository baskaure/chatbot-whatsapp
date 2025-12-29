import { google, sheets_v4 } from "googleapis";
import { ConversationState, AnswerHistory } from "../types.js";

const SHEET_ID = process.env.GSHEET_ID;
const SHEET_TAB = process.env.GSHEET_TAB || "Conversations";
const ANSWERS_TAB = process.env.ANSWERS_TAB || "Answers";
const PROSPECTS_TAB = process.env.PROSPECTS_TAB || "Prospects";
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

async function ensureSheetExists(client: sheets_v4.Sheets, sheetId: string, tabName: string): Promise<boolean> {
  try {
    const metadata = await client.spreadsheets.get({ spreadsheetId: sheetId });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === tabName);
    if (exists) return true;
    // Créer l'onglet s'il n'existe pas
    await client.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    });
    // Ajouter les en-têtes
    await client.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:L1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Date", "Téléphone", "Réponses", "Score", "Statut", "Décision", "Raison décision", "Calendly envoyé", "Ressource envoyée", "Préférence", "Questions répondues", "Niveau engagement"]],
      },
    });
    // eslint-disable-next-line no-console
    console.log(`[SHEETS] Onglet "${tabName}" créé avec en-têtes`);
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`[SHEETS] Erreur création onglet "${tabName}":`, err?.response?.data || err?.message || err);
    return false;
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
    // S'assurer que l'onglet existe
    await ensureSheetExists(client, SHEET_ID, SHEET_TAB);
    const values = [
      [
        new Date().toISOString(),
        state.phone,
        JSON.stringify(state.answers),
        state.score,
        state.status,
        state.decision ?? "",
        state.decisionReason ?? "",
        state.calendlySent,
        state.resourceSent,
        state.calendlyPreference ?? "",
        state.metadata.answeredQuestions,
        state.metadata.engagementLevel,
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

// Sauvegarde en temps réel de chaque réponse
export async function persistAnswerToSheet(
  phone: string,
  answerHistory: AnswerHistory,
  updatedState: ConversationState
): Promise<boolean> {
  const client = getClient();
  if (!client || !SHEET_ID) {
    return false;
  }
  try {
    await ensureAnswersSheetExists(client, SHEET_ID, ANSWERS_TAB);
    const values = [
      [
        new Date().toISOString(),
        phone,
        answerHistory.questionId,
        answerHistory.questionLabel,
        answerHistory.answer,
        answerHistory.score,
        updatedState.score,
        updatedState.metadata.answeredQuestions,
      ],
    ];
    await client.spreadsheets.values.append({
      spreadsheetId: SHEET_ID,
      range: `${ANSWERS_TAB}!A:A`,
      valueInputOption: "RAW",
      insertDataOption: "INSERT_ROWS",
      requestBody: { values },
    });
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[SHEETS] Erreur export réponse:", err?.response?.data || err?.message || err);
    return false;
  }
}

// Mise à jour de la fiche prospect en temps réel
export async function updateProspectProfile(phone: string, state: ConversationState): Promise<boolean> {
  const client = getClient();
  if (!client || !SHEET_ID) {
    return false;
  }
  try {
    await ensureProspectsSheetExists(client, SHEET_ID, PROSPECTS_TAB);
    
    // Chercher si le prospect existe déjà
    const existing = await client.spreadsheets.values.get({
      spreadsheetId: SHEET_ID,
      range: `${PROSPECTS_TAB}!A:A`,
    });
    
    const rows = existing.data.values || [];
    let rowIndex = -1;
    for (let i = 1; i < rows.length; i++) {
      if (rows[i]?.[1] === phone) {
        rowIndex = i + 1; // +1 car les indices Sheets commencent à 1
        break;
      }
    }
    
    const values = [
      [
        new Date().toISOString(),
        state.phone,
        state.startedAt,
        state.lastActivityAt,
        JSON.stringify(state.answers),
        JSON.stringify(state.answerHistory),
        state.score,
        state.status,
        state.decision ?? "",
        state.decisionReason ?? "",
        state.calendlySent,
        state.resourceSent,
        state.calendlyPreference ?? "",
        state.metadata.totalQuestions,
        state.metadata.answeredQuestions,
        state.metadata.engagementLevel,
      ],
    ];
    
    if (rowIndex > 0) {
      // Mettre à jour la ligne existante
      await client.spreadsheets.values.update({
        spreadsheetId: SHEET_ID,
        range: `${PROSPECTS_TAB}!A${rowIndex}:P${rowIndex}`,
        valueInputOption: "RAW",
        requestBody: { values },
      });
    } else {
      // Ajouter une nouvelle ligne
      await client.spreadsheets.values.append({
        spreadsheetId: SHEET_ID,
        range: `${PROSPECTS_TAB}!A:A`,
        valueInputOption: "RAW",
        insertDataOption: "INSERT_ROWS",
        requestBody: { values },
      });
    }
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error("[SHEETS] Erreur mise à jour prospect:", err?.response?.data || err?.message || err);
    return false;
  }
}

async function ensureAnswersSheetExists(client: sheets_v4.Sheets, sheetId: string, tabName: string): Promise<boolean> {
  try {
    const metadata = await client.spreadsheets.get({ spreadsheetId: sheetId });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === tabName);
    if (exists) return true;
    
    await client.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    });
    
    await client.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:H1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [["Timestamp", "Téléphone", "Question ID", "Question", "Réponse", "Score question", "Score total", "Questions répondues"]],
      },
    });
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`[SHEETS] Erreur création onglet "${tabName}":`, err?.response?.data || err?.message || err);
    return false;
  }
}

async function ensureProspectsSheetExists(client: sheets_v4.Sheets, sheetId: string, tabName: string): Promise<boolean> {
  try {
    const metadata = await client.spreadsheets.get({ spreadsheetId: sheetId });
    const exists = metadata.data.sheets?.some((sheet) => sheet.properties?.title === tabName);
    if (exists) return true;
    
    await client.spreadsheets.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        requests: [
          {
            addSheet: {
              properties: {
                title: tabName,
              },
            },
          },
        ],
      },
    });
    
    await client.spreadsheets.values.update({
      spreadsheetId: sheetId,
      range: `${tabName}!A1:P1`,
      valueInputOption: "RAW",
      requestBody: {
        values: [[
          "Dernière MAJ",
          "Téléphone",
          "Début conversation",
          "Dernière activité",
          "Réponses (JSON)",
          "Historique réponses (JSON)",
          "Score",
          "Statut",
          "Décision",
          "Raison décision",
          "Calendly envoyé",
          "Ressource envoyée",
          "Préférence calendly",
          "Total questions",
          "Questions répondues",
          "Niveau engagement",
        ]],
      },
    });
    return true;
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error(`[SHEETS] Erreur création onglet "${tabName}":`, err?.response?.data || err?.message || err);
    return false;
  }
}

