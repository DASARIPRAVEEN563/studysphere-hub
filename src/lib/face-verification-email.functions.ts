import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendFaceVerificationEmail,
  sendPasswordChangedEmail,
  sendPasswordResetCodeEmail,
} from "./face-verification-email.server";

const detailsSchema = z
  .object({
    registrationId: z.string().trim().max(40).nullish(),
    department: z.string().trim().max(60).nullish(),
    year: z.string().trim().max(20).nullish(),
    semester: z.string().trim().max(20).nullish(),
    email: z.string().trim().max(254).nullish(),
  })
  .optional();

export const sendFaceVerificationConfirmation = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
        image: z.string().max(4_000_000).nullish(),
        code: z.string().trim().max(12).nullish(),
        details: detailsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    sendFaceVerificationEmail(data.to, data.fullName, {
      image: data.image ?? null,
      code: data.code ?? null,
      details: data.details ?? {},
    }),
  );

export const sendPasswordChangedNotice = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
        details: detailsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    sendPasswordChangedEmail(data.to, data.fullName, data.details ?? {}),
  );

export const sendPasswordResetCode = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
        code: z.string().trim().min(4).max(12),
        details: detailsSchema,
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    sendPasswordResetCodeEmail(data.to, data.fullName, data.code, data.details ?? {}),
  );
