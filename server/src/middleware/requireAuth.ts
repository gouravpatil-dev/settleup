import type { NextFunction, Request, Response } from "express";
import { AuthService } from "../services/AuthService.js";
import { UnauthorizedError } from "../utils/AppError.js";
import { getDb } from "../db/connection.js";
import { SESSION_COOKIE_NAME } from "../config/constants.js";

/**
 * Reads the session cookie, resolves it to a user, and attaches it as
 * req.user. Any protected route mounts this first; anything downstream
 * can assume req.user is present.
 */
export function requireAuth(req: Request, _res: Response, next: NextFunction): void {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;

  if (!sessionId) {
    next(new UnauthorizedError("Not authenticated"));
    return;
  }

  const authService = new AuthService(getDb());
  const user = authService.resolveSession(sessionId);

  if (!user) {
    next(new UnauthorizedError("Session expired or invalid"));
    return;
  }

  req.user = user;
  next();
}
