import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
  name: z.string().trim().min(1, "Name is required").max(100),
  password: z.string().min(8, "Password must be at least 8 characters").max(200),
});

export const loginSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
  password: z.string().min(1, "Password is required"),
});
