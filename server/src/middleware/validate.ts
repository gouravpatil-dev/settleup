import type { NextFunction, Request, Response } from "express";
import type { ZodSchema } from "zod";
import { ValidationError } from "../utils/AppError.js";

type Target = "body" | "query" | "params";

/**
 * Validates req[target] against a Zod schema and replaces it with the
 * parsed (and type-coerced) result. Throws ValidationError (400) with
 * field-level details on failure, caught by the central error handler.
 */
export function validate(schema: ZodSchema, target: Target = "body") {
  return (req: Request, _res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[target]);
    if (!result.success) {
      next(new ValidationError("Invalid request data", result.error.flatten().fieldErrors));
      return;
    }
    req[target] = result.data;
    next();
  };
}
