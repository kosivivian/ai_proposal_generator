import { z } from "zod";

/**
 * Client identity fields — separate from proposal-specific intake
 * (lib/intake/schema.ts). Email is genuinely required: it's the unique key
 * used to resolve "does this client already exist" everywhere else in
 * lib/clients/resolve.ts.
 */
export const clientSchema = z.object({
  client_name: z.string().trim().min(1, "Client contact name is required"),
  company_name: z.string().trim().optional().default(""),
  client_contact_email: z
    .string()
    .trim()
    .min(1, "Client contact email is required")
    .refine((v) => z.string().email().safeParse(v).success, { message: "Must be a valid email" }),
});

export type ClientInput = z.infer<typeof clientSchema>;
