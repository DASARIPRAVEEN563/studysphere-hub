const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function encodeMessage(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

function clean(value: string) {
  return value.replace(/[\r\n]/g, " ").trim();
}

async function sendRaw(message: string) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const gmailApiKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableApiKey || !gmailApiKey) {
    throw new Error("The Gmail connection is not available");
  }
  const response = await fetch(`${GATEWAY_URL}/users/me/messages/send`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${lovableApiKey}`,
      "X-Connection-Api-Key": gmailApiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ raw: encodeMessage(message) }),
  });
  if (!response.ok) {
    const errorBody = await response.text();
    console.error(`Gmail request failed [${response.status}]: ${errorBody}`);
    throw new Error(`Gmail could not send the email [${response.status}]`);
  }
  const result = (await response.json()) as { id?: string };
  return { sent: true as const, messageId: result.id ?? null };
}

const FROM = "STUDENTS KA NOTES SHARING HUB <studentsnotessharing@gmail.com>";

export type UserDetails = {
  registrationId?: string | null | undefined;
  department?: string | null | undefined;
  year?: string | null | undefined;
  semester?: string | null | undefined;
  email?: string | null | undefined;
};

/** Renders the student's account details so every mail identifies the recipient. */
function detailsHtml(fullName: string, details: UserDetails = {}) {
  const rows: [string, string][] = [
    ["Name", clean(fullName) || "Student"],
    ["Registration ID", clean(String(details.registrationId ?? "")) || "-"],
    ["Department", clean(String(details.department ?? "")) || "-"],
    ["Year", clean(String(details.year ?? "")) || "-"],
    ["Semester", clean(String(details.semester ?? "")) || "-"],
    ["Email ID", clean(String(details.email ?? "")) || "-"],
  ];
  return [
    '<table style="border-collapse:collapse;margin:14px 0;font-size:14px">',
    ...rows.map(
      ([k, v]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#555">${k}</td><td style="padding:6px 0;font-weight:bold">${v}</td></tr>`,
    ),
    "</table>",
  ].join("");
}

function detailsText(fullName: string, details: UserDetails = {}) {
  return [
    `Name: ${clean(fullName) || "Student"}`,
    `Registration ID: ${clean(String(details.registrationId ?? "")) || "-"}`,
    `Department: ${clean(String(details.department ?? "")) || "-"}`,
    `Year: ${clean(String(details.year ?? "")) || "-"}`,
    `Semester: ${clean(String(details.semester ?? "")) || "-"}`,
    `Email ID: ${clean(String(details.email ?? "")) || "-"}`,
  ].join("\r\n");
}

/**
 * Face verification mail: contains the captured photo and a one-time
 * verification code the student pastes on the website to unlock everything.
 */
export async function sendFaceVerificationEmail(
  to: string,
  fullName: string,
  options: { image?: string | null; code?: string | null; details?: UserDetails } = {},
) {
  const safeName = clean(fullName) || "Student";
  const safeTo = clean(to);
  const code = options.code ? clean(options.code) : "";
  const boundary = `sknsh_${Date.now().toString(36)}`;

  const html = [
    "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111\">",
    `<p>Hello ${safeName},</p>`,
    "<p><b>Face verified is successfully completed.</b></p>",
    detailsHtml(safeName, { ...(options.details ?? {}), email: options.details?.email ?? safeTo }),
    "<p>The photo captured during verification is attached below. Enter the code shown here on the website to unlock notes, sharing and chat on STUDENTS KA NOTES SHARING HUB.</p>",
    options.image ? '<p><img src="cid:faceimage" alt="Captured face" width="240" style="border-radius:12px" /></p>' : "",
    code
      ? `<p style="font-size:14px;color:#555">Your verification code:</p><p style="background:#6d28d9;color:#fff;padding:14px 22px;border-radius:12px;font-size:30px;letter-spacing:8px;font-weight:bold;display:inline-block">${code}</p><p style="font-size:12px;color:#555">Paste this code in the profile page. Never share it with anyone.</p>`
      : "",
    "<p>- Notes Hub Team</p>",
    "</div>",
  ].join("");

  const parts: string[] = [
    `To: ${safeTo}`,
    `From: ${FROM}`,
    "Reply-To: studentsnotessharing@gmail.com",
    `Subject: ${code ? `${code} is your verification code` : "Face verification"} | STUDENTS KA NOTES SHARING HUB`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/related; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ];

  const base64 = options.image?.includes(",") ? options.image.split(",")[1] : null;
  if (base64) {
    parts.push(
      `--${boundary}`,
      "Content-Type: image/jpeg",
      "Content-Transfer-Encoding: base64",
      "Content-ID: <faceimage>",
      'Content-Disposition: inline; filename="face-verification.jpg"',
      "",
      base64.replace(/(.{76})/g, "$1\r\n"),
    );
  }
  parts.push(`--${boundary}--`, "");

  const result = await sendRaw(parts.join("\r\n"));
  return { ...result, to: safeTo };
}

/** Security notice sent whenever an account password changes. */
export async function sendPasswordResetCodeEmail(
  to: string,
  fullName: string,
  code: string,
  details: UserDetails = {},
) {
  const safeName = clean(fullName) || "Student";
  const safeTo = clean(to);
  const safeCode = clean(code);
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111">',
    `<p>Hello ${safeName},</p>`,
    detailsHtml(safeName, { ...details, email: details.email ?? safeTo }),
    "<p>Use the code below on the website to reset your password.</p>",
    `<p style="background:#6d28d9;color:#fff;padding:14px 22px;border-radius:12px;font-size:30px;letter-spacing:8px;font-weight:bold;display:inline-block">${safeCode}</p>`,
    '<p style="font-size:12px;color:#555">The code expires in 20 minutes. Never share it with anyone. If you did not request a reset, ignore this email.</p>',
    "<p>- Notes Hub Team</p>",
    "</div>",
  ].join("");
  const message = [
    `To: ${safeTo}`,
    `From: ${FROM}`,
    "Reply-To: studentsnotessharing@gmail.com",
    `Subject: ${safeCode} is your password reset code | STUDENTS KA NOTES SHARING HUB`,
    "MIME-Version: 1.0",
    "Content-Type: text/html; charset=UTF-8",
    "",
    html,
  ].join("\r\n");
  const result = await sendRaw(message);
  return { ...result, to: safeTo };
}

/** Security notice sent whenever an account password changes. */
export async function sendPasswordChangedEmail(
  to: string,
  fullName: string,
  details: UserDetails = {},
) {
  const safeName = clean(fullName) || "Student";
  const safeTo = clean(to);
  const message = [
    `To: ${safeTo}`,
    `From: ${FROM}`,
    "Reply-To: studentsnotessharing@gmail.com",
    "Subject: Your password was changed | STUDENTS KA NOTES SHARING HUB",
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    `Hello ${safeName},`,
    "",
    detailsText(safeName, { ...details, email: details.email ?? safeTo }),
    "",
    `Your account password was changed on ${new Date().toUTCString()}.`,
    "If this was not you, contact the admin immediately.",
    "",
    "- Notes Hub Team",
  ].join("\r\n");
  const result = await sendRaw(message);
  return { ...result, to: safeTo };
}
