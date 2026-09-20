import { z } from "zod";

export const createGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100),
});

export const renameGroupSchema = z.object({
  name: z.string().trim().min(1, "Group name is required").max(100),
});

export const addMemberSchema = z.object({
  email: z.string().trim().email("Must be a valid email address"),
});

export const groupIdParamsSchema = z.object({
  groupId: z.string().uuid("Invalid group id"),
});

export const groupMemberParamsSchema = z.object({
  groupId: z.string().uuid("Invalid group id"),
  userId: z.string().uuid("Invalid user id"),
});
