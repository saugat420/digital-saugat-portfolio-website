# Digital Saugat

One-page portfolio and consultation landing page for Saugat Basnet. The project uses the Next.js App Router through the Sites Vinext runtime, TypeScript, and Tailwind CSS.

## Local development

1. Install dependencies: `npm ci`
2. Copy `.env.example` to `.env.local` and add the server-only values described below.
3. Start the site: `npm run dev`
4. Open the local URL printed by the development server.

Never commit `.env.local`, a service-account JSON file, or an API key.

## Connect Google Sheets

1. In Google Sheets, create a new spreadsheet. Rename its first tab to `Consultation Enquiries`.
2. Add this header row in cells A1:H1, in this exact order:

   `Submission ID | Submitted at | Name | Email | Website or business | Message | Source page URL | Email notification status`

3. Copy the Sheet ID from the URL. It is the value between `/d/` and `/edit`. Put that real value in `GOOGLE_SHEET_ID`; do not use a made-up ID.
4. In Google Cloud Console, create or select a project, then open **APIs & Services → Library** and enable **Google Sheets API**.
5. Open **IAM & Admin → Service Accounts**, create a service account, then create a JSON key for it.
6. Copy `client_email` from the downloaded JSON to `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`.
7. Copy `private_key` to `GOOGLE_SHEETS_PRIVATE_KEY`. In an env file it should remain quoted and use `\n` for line breaks, as shown in `.env.example`.
8. Back in Google Sheets, use **Share** and add the service account email as an **Editor**. The API cannot append rows until the sheet is shared with this address.
9. If you use a different tab name, set the exact name in `GOOGLE_SHEET_NAME`.

The endpoint writes with `valueInputOption=RAW` and also prefixes formula-like visitor input before saving it. This protects the sheet from formula injection.

## Connect Brevo email

1. Create a Brevo account and open **Settings → Senders, Domains & Dedicated IPs**.
2. Add and verify the sender address or, preferably, authenticate the sender domain. Use that verified address for `BREVO_SENDER_EMAIL`.
3. Open **SMTP & API → API Keys**, create an API key, and store it as `BREVO_API_KEY`.
4. Set `BREVO_SENDER_NAME` to the display name you want recipients to see.
5. The notification always goes to `bsaugat59@gmail.com`. The sender is the verified Brevo address, while Reply-To is set to the visitor’s validated email.

Brevo plan limits change over time, so confirm the current transactional-email allowance in the Brevo account before launch. A sender must be verified even when the recipient is a Gmail address.

## Production configuration

Set the following as encrypted/runtime environment values in the hosting platform, not in source control:

- `GOOGLE_SHEET_ID`
- `GOOGLE_SHEET_NAME`
- `GOOGLE_SHEETS_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_SHEETS_PRIVATE_KEY`
- `BREVO_API_KEY`
- `BREVO_SENDER_EMAIL`
- `BREVO_SENDER_NAME`
- `SITE_URL` — the exact production origin, such as `https://example.com`

Deploy a new saved version after changing production environment values.

## Form reliability

The server validates and bounds every field, checks a honeypot, applies a per-instance request limit, and uses a browser-generated UUID for idempotency. It looks up that UUID before appending, so normal retries do not create another row. Sheet storage and email notification are handled independently: a saved enquiry remains successful even if Brevo fails, its row is marked for retry, and the visitor can retry the email alert without re-entering the form. No success response is returned if the Sheet write cannot be verified.

For higher-volume public traffic, replace the in-memory rate limiter with a durable edge rate-limiting service or D1-backed limit. The current limiter is intentionally dependency-free and is best-effort across separate Worker isolates.

## Commands

- `npm run dev` — local development
- `npm run build` — production build
- `npm run lint` — lint source
