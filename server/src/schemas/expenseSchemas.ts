import { z } from "zod";

const baseExpenseFields = {
  description: z.string().trim().min(1, "Description is required").max(200),
  amount: z.number().int().positive("Amount must be a positive integer (minor currency units)"),
  currency: z.string().trim().length(3).optional().default("INR"),
  paidBy: z.string().uuid("paidBy must be a valid user id"),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be in YYYY-MM-DD format"),
  category: z.string().trim().max(50).optional(),
  notes: z.string().trim().max(1000).optional(),
};

const equalParticipant = z.object({ userId: z.string().uuid() });
const exactParticipant = z.object({
  userId: z.string().uuid(),
  amount: z.number().int().min(0),
});
const percentageParticipant = z.object({
  userId: z.string().uuid(),
  percentage: z.number().positive().max(100),
});
const sharesParticipant = z.object({
  userId: z.string().uuid(),
  shares: z.number().int().positive(),
});

export const createExpenseSchema = z.discriminatedUnion("splitType", [
  z.object({
    splitType: z.literal("equal"),
    participants: z.array(equalParticipant).min(1),
    ...baseExpenseFields,
  }),
  z.object({
    splitType: z.literal("exact"),
    participants: z.array(exactParticipant).min(1),
    ...baseExpenseFields,
  }),
  z.object({
    splitType: z.literal("percentage"),
    participants: z.array(percentageParticipant).min(1),
    ...baseExpenseFields,
  }),
  z.object({
    splitType: z.literal("shares"),
    participants: z.array(sharesParticipant).min(1),
    ...baseExpenseFields,
  }),
]);

export const expenseIdParamsSchema = z.object({
  groupId: z.string().uuid("Invalid group id"),
  expenseId: z.string().uuid("Invalid expense id"),
});
