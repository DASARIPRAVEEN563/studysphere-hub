import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { sendFaceVerificationEmail } from "./face-verification-email.server";

export const sendFaceVerificationConfirmation = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => sendFaceVerificationEmail(data.to, data.fullName));