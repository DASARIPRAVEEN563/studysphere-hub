import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import {
  sendFaceVerificationEmail,
  sendPasswordChangedEmail,
} from "./face-verification-email.server";

export const sendFaceVerificationConfirmation = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
        image: z.string().max(4_000_000).nullish(),
        confirmUrl: z.string().max(2000).nullish(),
      })
      .parse(data),
  )
  .handler(async ({ data }) =>
    sendFaceVerificationEmail(data.to, data.fullName, {
      image: data.image ?? null,
      confirmUrl: data.confirmUrl ?? null,
    }),
  );

export const sendPasswordChangedNotice = createServerFn({ method: "POST" })
  .validator((data) =>
    z
      .object({
        to: z.string().trim().email("Incorrect email ID").max(254),
        fullName: z.string().trim().max(120),
      })
      .parse(data),
  )
  .handler(async ({ data }) => sendPasswordChangedEmail(data.to, data.fullName));
