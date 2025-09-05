// mail/mj.ts
import Mailjet from "node-mailjet";

// Prefer ENV, but fall back to the creds you provided (dev only)
const MJ_API_KEY = process.env.MJ_API_KEY || "7a3b5821bb36be1f5d1748c721bb2bc2";
const MJ_API_SECRET =
  process.env.MJ_API_SECRET || "77248d130332e189df7884044ebde325";

export const mj = Mailjet.apiConnect(MJ_API_KEY, MJ_API_SECRET);

export type SendOtpArgs = {
  toEmail: string;
  toName: string;
  otp: string;
  fromEmail?: string;
  fromName?: string;
  subject?: string;
  html?: string; // if you want to override the default template
  text?: string;
};

export async function sendOtpEmail({
  toEmail,
  toName,
  otp,
  fromEmail = "rokotoko@docketrun.com",
  fromName = "Roko Toko Info",
  subject = "Your Roko Toko verification code",
  html,
  text,
}: SendOtpArgs) {
  const textPart =
    text ||
    `Hi ${toName},\n\nYour verification code is: ${otp}\nThis code will expire soon. If you did not request it, please ignore this email.\n\n— Roko Toko`;

  const htmlPart = html || generateOTPEmailTemplate(otp, toName);

  const res = await mj.post("send", { version: "v3.1" }).request({
    Messages: [
      {
        From: { Email: fromEmail, Name: fromName },
        To: [{ Email: toEmail, Name: toName }],
        Subject: subject,
        TextPart: textPart,
        HTMLPart: htmlPart,
      },
    ],
  });

  // Optionally inspect response:
  // const { Status } = res.body.Messages?.[0] || {};
  return res.body;
}

/** Minimal export so controllers can import it if needed */
export function generateOTPEmailTemplate(otp: string, name: string) {
  return `
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Verify your email</title>
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <style>
    /* Dark-ish, clean, email-safe styles (inline-friendly fallbacks) */
    .wrap { max-width: 560px; margin: 0 auto; background: #0B0F1A; color: #E6EAF2; 
            font-family: -apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,Inter,"Helvetica Neue",Arial,sans-serif; 
            border-radius: 16px; overflow: hidden; }
    .head { padding: 24px 28px; background: linear-gradient(135deg,#1b2240,#0b0f1a); border-bottom: 1px solid #1e293b; }
    .brand { font-size: 18px; font-weight: 700; letter-spacing: .3px; }
    .body { padding: 28px; }
    .h1 { font-size: 20px; margin: 0 0 12px; }
    .p { margin: 0 0 16px; line-height: 1.55; color: #c7cfdd; }
    .code { display: inline-block; font-size: 28px; letter-spacing: 6px; font-weight: 800; 
            padding: 12px 16px; border-radius: 12px; background: #111827; color: #7dd3fc; 
            border: 1px solid #1f2937; margin: 12px 0 8px; }
    .meta { font-size: 12px; color: #9aa4b2; margin-top: 12px; }
    .footer { padding: 18px 28px; font-size: 12px; color: #94a3b8; border-top: 1px solid #1e293b; background: #0b0f1a; }
    a { color: #7dd3fc; text-decoration: none; }
  </style>
</head>
<body style="background:#0b0f1a;margin:0;padding:20px;">
  <div class="wrap">
    <div class="head">
      <div class="brand">🔐 Roko Toko</div>
    </div>
    <div class="body">
      <h1 class="h1">Hi ${escapeHtml(name)}, verify your OTP</h1>
      <p class="p">Use the verification code below to login.</p>
      <div class="code">${escapeHtml(otp)}</div>
      <p class="meta">This code will expire shortly. If you didn’t request it, you can safely ignore this email.</p>
    </div>
    <div class="footer">
      © ${new Date().getFullYear()} Roko Toko • <a href="https://docketrun.com">docketrun.com</a>
    </div>
  </div>
</body>
</html>`;
}

/** Basic HTML escape for template safety */
function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
