/** Server-only helper that lets an admin send a custom mail blast (festival
 * greetings, event notices) with optional images / files attached. */
const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function encodeMessage(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

const clean = (value: string) => value.replace(/[\r\n]/g, " ").trim();

const b64 = (value: string) => Buffer.from(value, "utf8").toString("base64");

async function sendRaw(message: string) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const gmailApiKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableApiKey || !gmailApiKey) throw new Error("The Gmail connection is not available");
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
    console.error(`Gmail blast failed [${response.status}]: ${errorBody}`);
    throw new Error(`Gmail could not send the email [${response.status}]`);
  }
  const result = (await response.json()) as { id?: string };
  return result.id ?? null;
}

export type MailAttachment = { name: string; mime: string; dataUrl: string };

function buildMessage(input: {
  to: string;
  from: string;
  subject: string;
  html: string;
  attachments: MailAttachment[];
}) {
  const boundary = `sknsh_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  const parts: string[] = [
    `To: ${clean(input.to)}`,
    `From: ${clean(input.from)}`,
    `Reply-To: ${clean(input.from)}`,
    `Subject: ${clean(input.subject)}`,
    "MIME-Version: 1.0",
    `Content-Type: multipart/mixed; boundary="${boundary}"`,
    "",
    `--${boundary}`,
    "Content-Type: text/html; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "",
    b64(input.html).replace(/(.{76})/g, "$1\r\n"),
  ];
  for (const file of input.attachments) {
    const raw = file.dataUrl.includes(",") ? file.dataUrl.split(",")[1] : file.dataUrl;
    if (!raw) continue;
    parts.push(
      `--${boundary}`,
      `Content-Type: ${clean(file.mime) || "application/octet-stream"}`,
      "Content-Transfer-Encoding: base64",
      `Content-Disposition: attachment; filename="${clean(file.name) || "attachment"}"`,
      "",
      raw.replace(/(.{76})/g, "$1\r\n"),
    );
  }
  parts.push(`--${boundary}--`, "");
  return parts.join("\r\n");
}

export async function sendAdminMail(input: {
  recipients: string[];
  from: string;
  subject: string;
  message: string;
  attachments: MailAttachment[];
}) {
  const html = [
    '<div style="font-family:Arial,Helvetica,sans-serif;font-size:15px;color:#111;line-height:1.6">',
    input.message
      .split(/\n{2,}/)
      .map((p) => `<p>${p.replace(/\n/g, "<br/>")}</p>`)
      .join(""),
    '<p style="font-size:12px;color:#777">STUDENTS KA NOTES SHARING HUB</p>',
    "</div>",
  ].join("");

  const sent: string[] = [];
  const failed: { to: string; error: string }[] = [];
  for (const to of input.recipients) {
    try {
      await sendRaw(buildMessage({ ...input, to, html }));
      sent.push(to);
    } catch (error) {
      failed.push({ to, error: (error as Error).message });
    }
  }
  return { sent: sent.length, failed };
}
