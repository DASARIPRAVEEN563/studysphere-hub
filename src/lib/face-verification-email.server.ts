const GATEWAY_URL = "https://connector-gateway.lovable.dev/google_mail/gmail/v1";

function encodeMessage(value: string) {
  return Buffer.from(value, "utf8")
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

export async function sendFaceVerificationEmail(to: string, fullName: string) {
  const lovableApiKey = process.env["LOVABLE_API_KEY"];
  const gmailApiKey = process.env["GOOGLE_MAIL_API_KEY"];
  if (!lovableApiKey || !gmailApiKey) {
    throw new Error("The Gmail connection is not available");
  }

  const safeName = fullName.replace(/[\r\n]/g, " ").trim() || "Student";
  const safeTo = to.replace(/[\r\n]/g, "").trim();
  const message = [
    `To: ${safeTo}`,
    "From: STUDENTS KA NOTES SHARING HUB <studentsnotessharing@gmail.com>",
    "Reply-To: studentsnotessharing@gmail.com",
    "Subject: Face verification successful - STUDENTS KA NOTES SHARING HUB",
    "Content-Type: text/plain; charset=UTF-8",
    "MIME-Version: 1.0",
    "",
    `Hello ${safeName},`,
    "",
    "Face verified is successfully completed.",
    "You can now download and share notes on STUDENTS KA NOTES SHARING HUB.",
    "",
    "- Notes Hub Team",
  ].join("\r\n");

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
    throw new Error(`Gmail could not send the confirmation [${response.status}]`);
  }

  const result = (await response.json()) as { id?: string };
  return { sent: true as const, to: safeTo, messageId: result.id ?? null };
}