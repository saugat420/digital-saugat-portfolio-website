import nodemailer from "nodemailer";

export const runtime = "nodejs";

type Enquiry = {
  submissionId: string;
  name: string;
  email: string;
  business: string;
  goal: string;
  budget: string;
  readiness: string;
  challenge: string;
  sourcePageUrl: string;
  company: string;
};

type SheetRecord = {
  row: number;
  values: string[];
};

const attempts = new Map<string, { count: number; resetAt: number }>();
const RATE_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT = 5;
const DEFAULT_RECIPIENT = "digitalsaugatb@gmail.com";
const SHEET_HEADERS = [
  "Submission ID",
  "Submitted at",
  "Name",
  "Email",
  "Website or business",
  "Biggest growth challenge",
  "Source page URL",
  "Email notification status",
  "Main growth goal",
  "Monthly budget",
  "Readiness",
];
const GOALS = new Set([
  "More qualified leads",
  "Better website or landing page conversions",
  "Email nurturing and automation",
  "A complete funnel strategy",
  "Not sure yet",
]);
const BUDGETS = new Set([
  "Under USD 1,000/month",
  "USD 1,000–3,000/month",
  "USD 3,000–5,000/month",
  "USD 5,000–10,000/month",
  "USD 10,000+/month",
  "Not decided yet",
]);
const READINESS_OPTIONS = new Set([
  "Ready to start now",
  "Ready within the next 30 days",
  "Planning for the next 1–3 months",
  "Exploring options for later",
]);

function json(body: object, status = 200) {
  return Response.json(body, {
    status,
    headers: { "cache-control": "no-store" },
  });
}

function clean(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ").slice(0, max) : "";
}

function cleanMessage(value: unknown, max: number) {
  return typeof value === "string" ? value.trim().replace(/\r\n/g, "\n").slice(0, max) : "";
}

function validate(input: unknown): { data?: Enquiry; error?: string } {
  if (!input || typeof input !== "object") return { error: "Please check the form and try again." };
  const value = input as Record<string, unknown>;
  const data: Enquiry = {
    submissionId: clean(value.submissionId, 64),
    name: clean(value.name, 80),
    email: clean(value.email, 254).toLowerCase(),
    business: clean(value.business, 160),
    goal: clean(value.goal, 100),
    budget: clean(value.budget, 80),
    readiness: clean(value.readiness, 80),
    challenge: cleanMessage(value.challenge, 1500),
    sourcePageUrl: clean(value.sourcePageUrl, 500),
    company: clean(value.company, 100),
  };
  if (data.company) return { error: "Please check the form and try again." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId)) return { error: "Please refresh the page and try again." };
  if (data.name.length < 2) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: "Please enter a valid email address." };
  if (!data.business) return { error: "Please enter your website or business name." };
  if (!GOALS.has(data.goal)) return { error: "Please select your main growth goal." };
  if (!BUDGETS.has(data.budget)) return { error: "Please select an approximate monthly budget." };
  if (!READINESS_OPTIONS.has(data.readiness)) return { error: "Please select when you are ready to move forward." };
  if (data.challenge.length < 15) return { error: "Please share a little more about your biggest growth challenge." };
  if (data.sourcePageUrl) {
    try { new URL(data.sourcePageUrl); } catch { data.sourcePageUrl = ""; }
  }
  return { data };
}

function isRateLimited(request: Request) {
  const key = request.headers.get("cf-connecting-ip") || request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const now = Date.now();
  const current = attempts.get(key);
  if (!current || current.resetAt <= now) {
    attempts.set(key, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return false;
  }
  current.count += 1;
  return current.count > RATE_LIMIT;
}

function base64Url(input: string | Uint8Array) {
  const binary = typeof input === "string" ? input : Array.from(input, (byte) => String.fromCharCode(byte)).join("");
  return btoa(binary).replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function googleAccessToken() {
  const email = process.env.GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SHEETS_PRIVATE_KEY?.replace(/\\n/g, "\n");
  if (!email || !privateKey) throw new Error("google_credentials_missing");
  const now = Math.floor(Date.now() / 1000);
  const header = base64Url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const claim = base64Url(JSON.stringify({
    iss: email,
    scope: "https://www.googleapis.com/auth/spreadsheets",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));
  const pem = privateKey.replace(/-----BEGIN PRIVATE KEY-----|-----END PRIVATE KEY-----|\s/g, "");
  const bytes = Uint8Array.from(atob(pem), (char) => char.charCodeAt(0));
  const key = await crypto.subtle.importKey("pkcs8", bytes, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["sign"]);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", key, new TextEncoder().encode(`${header}.${claim}`));
  const assertion = `${header}.${claim}.${base64Url(new Uint8Array(signature))}`;
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion }),
  });
  if (!response.ok) throw new Error("google_auth_failed");
  const result = await response.json() as { access_token?: string };
  if (!result.access_token) throw new Error("google_auth_failed");
  return result.access_token;
}

function rawSheetName() {
  return process.env.GOOGLE_SHEET_NAME || "Enquiry";
}

function sheetName() {
  return rawSheetName().replace(/'/g, "''");
}

function sheetsUrl(range: string) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("google_sheet_missing");
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${sheetName()}'!${range}`)}`;
}

function spreadsheetUrl(suffix = "") {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("google_sheet_missing");
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}${suffix}`;
}

async function ensureSheetPresentation(token: string) {
  const authHeaders = { authorization: `Bearer ${token}` };
  const headerResponse = await fetch(`${sheetsUrl("A1:K1")}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify({ values: [SHEET_HEADERS] }),
  });
  if (!headerResponse.ok) throw new Error("google_sheet_header_failed");

  const metadataResponse = await fetch(`${spreadsheetUrl()}?fields=sheets.properties(sheetId,title)`, { headers: authHeaders });
  if (!metadataResponse.ok) throw new Error("google_sheet_metadata_failed");
  const metadata = await metadataResponse.json() as { sheets?: Array<{ properties?: { sheetId?: number; title?: string } }> };
  const sheet = metadata.sheets?.find((item) => item.properties?.title === rawSheetName());
  const sheetId = sheet?.properties?.sheetId;
  if (typeof sheetId !== "number") throw new Error("google_sheet_tab_missing");

  const columnWidths = [190, 175, 150, 220, 220, 360, 260, 190, 250, 190, 220];
  const requests: object[] = [
    {
      updateSheetProperties: {
        properties: { sheetId, gridProperties: { frozenRowCount: 1 } },
        fields: "gridProperties.frozenRowCount",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: {
          userEnteredFormat: {
            backgroundColor: { red: 0.067, green: 0.067, blue: 0.067 },
            horizontalAlignment: "CENTER",
            verticalAlignment: "MIDDLE",
            wrapStrategy: "WRAP",
            textFormat: { foregroundColor: { red: 1, green: 0.816, blue: 0 }, bold: true, fontSize: 10 },
          },
        },
        fields: "userEnteredFormat(backgroundColor,horizontalAlignment,verticalAlignment,wrapStrategy,textFormat)",
      },
    },
    {
      repeatCell: {
        range: { sheetId, startRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        cell: { userEnteredFormat: { verticalAlignment: "TOP", wrapStrategy: "WRAP" } },
        fields: "userEnteredFormat(verticalAlignment,wrapStrategy)",
      },
    },
    {
      updateDimensionProperties: {
        range: { sheetId, dimension: "ROWS", startIndex: 0, endIndex: 1 },
        properties: { pixelSize: 38 },
        fields: "pixelSize",
      },
    },
    {
      updateBorders: {
        range: { sheetId, startRowIndex: 0, endRowIndex: 1, startColumnIndex: 0, endColumnIndex: 11 },
        bottom: { style: "SOLID_THICK", color: { red: 1, green: 0.816, blue: 0 } },
      },
    },
    ...columnWidths.map((pixelSize, index) => ({
      updateDimensionProperties: {
        range: { sheetId, dimension: "COLUMNS", startIndex: index, endIndex: index + 1 },
        properties: { pixelSize },
        fields: "pixelSize",
      },
    })),
  ];

  const formatResponse = await fetch(spreadsheetUrl(":batchUpdate"), {
    method: "POST",
    headers: { ...authHeaders, "content-type": "application/json" },
    body: JSON.stringify({ requests }),
  });
  if (!formatResponse.ok) throw new Error("google_sheet_format_failed");
}

async function findRecord(token: string, id: string): Promise<SheetRecord | null> {
  const response = await fetch(sheetsUrl("A:K"), { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("google_sheet_read_failed");
  const result = await response.json() as { values?: string[][] };
  const index = (result.values || []).findIndex((row) => row[0] === id);
  return index >= 0 ? { row: index + 1, values: result.values![index] } : null;
}

function safeCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

async function appendRecord(token: string, data: Enquiry, submittedAt: string) {
  const response = await fetch(`${sheetsUrl("A:K")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [[
      data.submissionId,
      submittedAt,
      safeCell(data.name),
      safeCell(data.email),
      safeCell(data.business),
      safeCell(data.challenge),
      safeCell(data.sourcePageUrl),
      "PENDING",
      safeCell(data.goal),
      safeCell(data.budget),
      safeCell(data.readiness),
    ]] }),
  });
  if (!response.ok) throw new Error("google_sheet_append_failed");
}

async function updateStatus(token: string, row: number, status: string) {
  const response = await fetch(`${sheetsUrl(`H${row}`)}?valueInputOption=RAW`, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [[status]] }),
  });
  if (!response.ok) throw new Error("google_sheet_status_failed");
}

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[char]!);
}

function emailShell(preheader: string, heading: string, body: string) {
  return `<!doctype html>
  <html><body style="margin:0;background:#f3f3ef;color:#111;font-family:Arial,Helvetica,sans-serif;">
    <div style="display:none;max-height:0;overflow:hidden;opacity:0;">${escapeHtml(preheader)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f3ef;padding:32px 14px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:640px;background:#fff;border:1px solid #deded8;">
          <tr><td style="background:#111;padding:24px 30px;border-bottom:4px solid #ffd000;">
            <div style="font-size:20px;font-weight:800;letter-spacing:-.4px;color:#fff;">DIGITAL <span style="color:#ffd000;">SAUGAT</span></div>
          </td></tr>
          <tr><td style="padding:34px 30px 30px;">
            <h1 style="margin:0 0 22px;font-size:30px;line-height:1.15;letter-spacing:-.8px;color:#111;">${heading}</h1>
            ${body}
          </td></tr>
          <tr><td style="background:#111;padding:18px 30px;color:#aaa;font-size:12px;line-height:1.5;">Digital Saugat · Strategy, messaging and conversion-focused execution</td></tr>
        </table>
      </td></tr>
    </table>
  </body></html>`;
}

function detailRow(label: string, value: string) {
  return `<tr>
    <td style="width:38%;padding:12px 12px 12px 0;border-bottom:1px solid #e7e7e2;color:#686864;font-size:13px;font-weight:700;vertical-align:top;">${escapeHtml(label)}</td>
    <td style="padding:12px 0;border-bottom:1px solid #e7e7e2;color:#111;font-size:14px;line-height:1.55;vertical-align:top;">${escapeHtml(value).replace(/\n/g, "<br>")}</td>
  </tr>`;
}

async function sendNotifications(data: Enquiry, submittedAt: string) {
  const gmailUser = process.env.GMAIL_USER;
  const appPassword = process.env.GMAIL_APP_PASSWORD?.replace(/\s/g, "");
  const recipient = process.env.NOTIFICATION_EMAIL || DEFAULT_RECIPIENT;
  if (!gmailUser || !appPassword) throw new Error("gmail_credentials_missing");

  const transporter = nodemailer.createTransport({
    service: "gmail",
    auth: { user: gmailUser, pass: appPassword },
  });
  const localTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(submittedAt));
  const sheetLink = process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/edit` : "";
  const ownerBody = `
    <p style="margin:0 0 22px;color:#555;font-size:15px;line-height:1.65;">A new prospect has completed the consultation questionnaire. Their key details are below.</p>
    <div style="display:inline-block;margin:0 0 20px;padding:8px 12px;background:#fff7c7;border-left:4px solid #ffd000;color:#111;font-size:13px;font-weight:700;">${escapeHtml(data.readiness)}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0">
      ${detailRow("Name", data.name)}
      ${detailRow("Email", data.email)}
      ${detailRow("Business", data.business)}
      ${detailRow("Main growth goal", data.goal)}
      ${detailRow("Monthly budget", data.budget)}
      ${detailRow("Readiness", data.readiness)}
      ${detailRow("Biggest challenge", data.challenge)}
      ${detailRow("Submitted", `${localTime} (Asia/Kathmandu)`)}
    </table>
    ${sheetLink ? `<p style="margin:26px 0 0;"><a href="${sheetLink}" style="display:inline-block;background:#ffd000;color:#111;text-decoration:none;font-size:14px;font-weight:800;padding:13px 18px;">Open enquiry spreadsheet ↗</a></p>` : ""}
  `;
  const customerBody = `
    <p style="margin:0 0 18px;color:#333;font-size:16px;line-height:1.7;">Hi ${escapeHtml(data.name)},</p>
    <p style="margin:0 0 24px;color:#555;font-size:15px;line-height:1.7;">Thanks for sharing what is happening in your business. I’ve received your consultation request and will review your answers before getting back to you.</p>
    <div style="background:#f8f8f4;border-left:4px solid #ffd000;padding:18px 20px;margin:0 0 24px;">
      <p style="margin:0 0 9px;color:#777;font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;">Your consultation focus</p>
      <p style="margin:0;color:#111;font-size:18px;font-weight:800;line-height:1.45;">${escapeHtml(data.goal)}</p>
    </div>
    <p style="margin:0 0 12px;color:#111;font-size:15px;font-weight:800;">What happens next</p>
    <p style="margin:0 0 26px;color:#555;font-size:15px;line-height:1.7;">I’ll look at your goal, budget, timeline and current challenge, then reply with the best next step for your business.</p>
    <p style="margin:0;color:#333;font-size:15px;line-height:1.7;">Speak soon,<br><strong>Saugat Basnet</strong><br><span style="color:#777;">Digital Saugat</span></p>
  `;

  const ownerText = `New consultation request\n\nName: ${data.name}\nEmail: ${data.email}\nBusiness: ${data.business}\nGoal: ${data.goal}\nBudget: ${data.budget}\nReadiness: ${data.readiness}\nChallenge: ${data.challenge}\nSubmitted: ${localTime} (Asia/Kathmandu)${sheetLink ? `\nSheet: ${sheetLink}` : ""}`;
  const customerText = `Hi ${data.name},\n\nThanks for sharing what is happening in your business. I’ve received your consultation request and will review your answers before getting back to you.\n\nConsultation focus: ${data.goal}\n\nI’ll look at your goal, budget, timeline and current challenge, then reply with the best next step for your business.\n\nSpeak soon,\nSaugat Basnet\nDigital Saugat`;

  await transporter.sendMail({
    from: `Digital Saugat <${gmailUser}>`,
    to: recipient,
    replyTo: { address: data.email, name: data.name },
    subject: `New consultation enquiry — ${data.name}`,
    text: ownerText,
    html: emailShell(`New enquiry from ${data.name}`, "New consultation enquiry", ownerBody),
  });
  await transporter.sendMail({
    from: `Digital Saugat <${gmailUser}>`,
    to: { address: data.email, name: data.name },
    replyTo: recipient,
    subject: "Your Digital Saugat consultation request",
    text: customerText,
    html: emailShell("Your consultation request has been received", "Thanks — I’ve received your request.", customerBody),
  });
}

export async function POST(request: Request) {
  if (Number(request.headers.get("content-length") || 0) > 10_000) return json({ message: "Please shorten your message and try again." }, 413);
  const configuredOrigin = process.env.SITE_URL;
  const origin = request.headers.get("origin");
  if (configuredOrigin && origin && new URL(configuredOrigin).origin !== origin) return json({ message: "This request could not be verified." }, 403);
  if (isRateLimited(request)) return json({ message: "Too many attempts. Please wait a few minutes and try again." }, 429);

  let input: unknown;
  try { input = await request.json(); } catch { return json({ message: "Please check the form and try again." }, 400); }
  const validated = validate(input);
  if (!validated.data) return json({ message: validated.error }, 400);
  const data = validated.data;

  let token: string;
  try {
    token = await googleAccessToken();
  } catch (error) {
    console.error("consultation_storage_unavailable", data.submissionId.slice(-8), error instanceof Error ? error.message : "unknown");
    return json({ received: false, message: "The enquiry service is temporarily unavailable. Please try again later." }, 503);
  }

  let record: SheetRecord | null;
  const submittedAt = new Date().toISOString();
  try {
    await ensureSheetPresentation(token);
  } catch (error) {
    console.warn("consultation_sheet_formatting_failed", error instanceof Error ? error.message : "unknown");
  }
  try {
    record = await findRecord(token, data.submissionId);
    if (!record) {
      await appendRecord(token, data, submittedAt);
      record = await findRecord(token, data.submissionId);
      if (!record) throw new Error("google_sheet_verify_failed");
    }
  } catch (error) {
    console.error("consultation_storage_failed", data.submissionId.slice(-8), error instanceof Error ? error.message : "unknown");
    return json({ received: false, message: "The enquiry service is temporarily unavailable. Please try again later." }, 503);
  }

  const isNewRecord = record.values.length >= 11;
  if (record.values[7] === "SENT") return json({ received: true, notified: true, duplicate: true });

  const storedData: Enquiry = {
    submissionId: record.values[0] || data.submissionId,
    name: record.values[2] || data.name,
    email: record.values[3] || data.email,
    business: record.values[4] || data.business,
    goal: isNewRecord ? record.values[8] || data.goal : data.goal,
    budget: isNewRecord ? record.values[9] || data.budget : data.budget,
    readiness: isNewRecord ? record.values[10] || data.readiness : data.readiness,
    challenge: record.values[5] || data.challenge,
    sourcePageUrl: record.values[6] || data.sourcePageUrl,
    company: "",
  };

  try {
    await sendNotifications(storedData, record.values[1] || submittedAt);
    await updateStatus(token, record.row, "SENT");
    return json({ received: true, notified: true });
  } catch (error) {
    try { await updateStatus(token, record.row, "FAILED — retry available"); } catch { /* The saved row remains the source of truth. */ }
    console.error("consultation_notification_failed", data.submissionId.slice(-8), error instanceof Error ? error.message : "unknown");
    return json({ received: true, notified: false, retryAvailable: true }, 202);
  }
}
