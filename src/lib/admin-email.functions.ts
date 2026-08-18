import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";

const schema = z.object({
  recipients: z.array(z.string().trim().email()).min(1, "Add at least one recipient").max(300),
  from: z.string().trim().min(3).max(160),
  subject: z.string().trim().min(1, "Subject is required").max(200),
  message: z.string().trim().min(1, "Message is required").max(20_000),
  attachments: z
    .array(
      z.object({
        name: z.string().trim().max(160),
        mime: z.string().trim().max(120),
        dataUrl: z.string().max(6_000_000),
      }),
    )
    .max(5)
    .default([]),
});

export const sendAdminEmailBlast = createServerFn({ method: "POST" })
  .inputValidator((data: unknown) => schema.parse(data))
  .handler(async ({ data }) => {
    const { sendAdminMail } = await import("./admin-email.server");
    return sendAdminMail(data);
  });
