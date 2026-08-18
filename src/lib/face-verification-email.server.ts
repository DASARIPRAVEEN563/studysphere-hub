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

/**
 * Face verification mail: contains the captured photo and a one-time
 * verification code the student pastes on the website to unlock everything.
 */
export async function sendFaceVerificationEmail(
  to: string,
  fullName: string,
  options: { image?: string | null; code?: string | null } = {},
) {
  const safeName = clean(fullName) || "Student";
  const safeTo = clean(to);
  const code = options.code ? clean(options.code) : "";
  const boundary = `sknsh_${Date.now().toString(36)}`;

  const html = [
    "<div style=\"font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111\">",
    `<p>Hello ${safeName},</p>`,
    "<p><b>Face verified is successfully completed.</b></p>",
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
export async function sendPasswordChangedEmail(to: string, fullName: string) {
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
    `Your account password was changed on ${new Date().toUTCString()}.`,
    "If this was not you, contact the admin immediately.",
    "",
    "- Notes Hub Team",
  ].join("\r\n");
  const result = await sendRaw(message);
  return { ...result, to: safeTo };
}
