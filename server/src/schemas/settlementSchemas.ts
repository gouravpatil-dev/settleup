import { z } from "zod";

export const recordSettlementSchema = z
  .object({
    fromUserId: z.string().uuid(),
    toUserId: z.string().uuid(),
    amount: z.number().int().positive("Amount must be a positive integer (minor currency units)"),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
    note: z.string().trim().max(500).optional(),
  })
  .refine((data) => data.fromUserId !== data.toUserId, {
    message: "fromUserId and toUserId must be different",
    path: ["toUserId"],
  });

export const settlementIdParamsSchema = z.object({
  groupId: z.string().uuid("Invalid group id"),
  settlementId: z.string().uuid("Invalid settlement id"),
});
