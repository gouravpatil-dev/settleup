import type { NextFunction, Request, Response } from "express";
import { AppError } from "../utils/AppError.js";
import { env } from "../config/env.js";

/**
 * Catches errors from any route/middleware (via Express's next(err) or
 * an async wrapper). Known AppErrors return their intended status code
 * and message. Anything else is logged server-side and returned as a
 * generic 500 so internal details never leak to the client.
 */
export function errorHandler(
  err: unknown,
  req: Request,
  res: Response,
  _next: NextFunction
): void {
  if (err instanceof AppError) {
    res.status(err.statusCode).json({
      error: {
        message: err.message,
        ...(err.details ? { details: err.details } : {}),
      },
    });
    return;
  }

  // Unexpected error — log full detail server-side, never expose it.
  console.error("Unhandled error:", err);

  res.status(500).json({
    error: {
      message: "Internal server error",
      ...(env.NODE_ENV === "development" && err instanceof Error
        ? { debug: err.message }
        : {}),
    },
  });
}

export function notFoundHandler(req: Request, res: Response): void {
  res.status(404).json({
    error: { message: `Route not found: ${req.method} ${req.path}` },
  });
}

/**
 * Wraps an async route handler so thrown errors / rejected promises
 * reach errorHandler via next(), instead of crashing the process.
 */
export function asyncHandler<T extends (...args: any[]) => Promise<any>>(fn: T) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
