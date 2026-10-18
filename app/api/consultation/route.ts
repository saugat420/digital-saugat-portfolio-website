export const runtime = "edge";

type Enquiry = {
  submissionId: string;
  name: string;
  email: string;
  business: string;
  message: string;
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
const RECIPIENT = "bsaugat59@gmail.com";

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
    message: cleanMessage(value.message, 1500),
    sourcePageUrl: clean(value.sourcePageUrl, 500),
    company: clean(value.company, 100),
  };
  if (data.company) return { error: "Please check the form and try again." };
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.submissionId)) return { error: "Please refresh the page and try again." };
  if (data.name.length < 2) return { error: "Please enter your name." };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email)) return { error: "Please enter a valid email address." };
  if (!data.business) return { error: "Please enter your website or business name." };
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

function sheetName() {
  return (process.env.GOOGLE_SHEET_NAME || "Consultation Enquiries").replace(/'/g, "''");
}

function sheetsUrl(range: string) {
  const sheetId = process.env.GOOGLE_SHEET_ID;
  if (!sheetId) throw new Error("google_sheet_missing");
  return `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(sheetId)}/values/${encodeURIComponent(`'${sheetName()}'!${range}`)}`;
}

async function findRecord(token: string, id: string): Promise<SheetRecord | null> {
  const response = await fetch(sheetsUrl("A:H"), { headers: { authorization: `Bearer ${token}` } });
  if (!response.ok) throw new Error("google_sheet_read_failed");
  const result = await response.json() as { values?: string[][] };
  const index = (result.values || []).findIndex((row) => row[0] === id);
  return index >= 0 ? { row: index + 1, values: result.values![index] } : null;
}

function safeCell(value: string) {
  return /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
}

async function appendRecord(token: string, data: Enquiry, submittedAt: string) {
  const response = await fetch(`${sheetsUrl("A:H")}:append?valueInputOption=RAW&insertDataOption=INSERT_ROWS`, {
    method: "POST",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify({ values: [[
      data.submissionId,
      submittedAt,
      safeCell(data.name),
      safeCell(data.email),
      safeCell(data.business),
      safeCell(data.message),
      safeCell(data.sourcePageUrl),
      "PENDING",
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

async function sendNotification(data: Enquiry, submittedAt: string) {
  const apiKey = process.env.BREVO_API_KEY;
  const senderEmail = process.env.BREVO_SENDER_EMAIL;
  const senderName = process.env.BREVO_SENDER_NAME || "Digital Saugat Website";
  if (!apiKey || !senderEmail) throw new Error("brevo_credentials_missing");
  const localTime = new Intl.DateTimeFormat("en-GB", {
    dateStyle: "medium",
    timeStyle: "long",
    timeZone: "Asia/Kathmandu",
  }).format(new Date(submittedAt));
  const sheetLink = process.env.GOOGLE_SHEET_ID ? `https://docs.google.com/spreadsheets/d/${encodeURIComponent(process.env.GOOGLE_SHEET_ID)}/edit` : "";
  const html = `
    <h2>New consultation request</h2>
    <p><strong>Name:</strong> ${escapeHtml(data.name)}</p>
    <p><strong>Email:</strong> ${escapeHtml(data.email)}</p>
    <p><strong>Website or business:</strong> ${escapeHtml(data.business)}</p>
    <p><strong>Message:</strong><br>${escapeHtml(data.message || "Not provided").replace(/\n/g, "<br>")}</p>
    <p><strong>Submitted:</strong> ${escapeHtml(localTime)} (Asia/Kathmandu)</p>
    <p><strong>Submission ID:</strong> ${escapeHtml(data.submissionId)}</p>
    ${sheetLink ? `<p><a href="${sheetLink}">Open the Google Sheet</a></p>` : ""}
  `;
  const response = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: { "api-key": apiKey, "content-type": "application/json", accept: "application/json" },
    body: JSON.stringify({
      sender: { email: senderEmail, name: senderName },
      to: [{ email: RECIPIENT, name: "Saugat Basnet" }],
      replyTo: { email: data.email, name: data.name },
      subject: `New Digital Saugat Consultation Request — ${data.name}`,
      htmlContent: html,
    }),
  });
  if (!response.ok) throw new Error("brevo_send_failed");
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

  if (record.values[7] === "SENT") return json({ received: true, notified: true, duplicate: true });

  const storedData: Enquiry = {
    submissionId: record.values[0] || data.submissionId,
    name: record.values[2] || data.name,
    email: record.values[3] || data.email,
    business: record.values[4] || data.business,
    message: record.values[5] || data.message,
    sourcePageUrl: record.values[6] || data.sourcePageUrl,
    company: "",
  };

  try {
    await sendNotification(storedData, record.values[1] || submittedAt);
    await updateStatus(token, record.row, "SENT");
    return json({ received: true, notified: true });
  } catch (error) {
    try { await updateStatus(token, record.row, "FAILED — retry available"); } catch { /* The saved row remains the source of truth. */ }
    console.error("consultation_notification_failed", data.submissionId.slice(-8), error instanceof Error ? error.message : "unknown");
    return json({ received: true, notified: false, retryAvailable: true }, 202);
  }
}
