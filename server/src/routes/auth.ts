import { Router } from "express";
import { AuthService } from "../services/AuthService.js";
import { getDb } from "../db/connection.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../middleware/errorHandler.js";
import { requireAuth } from "../middleware/requireAuth.js";
import { registerSchema, loginSchema } from "../schemas/authSchemas.js";
import { SESSION_COOKIE_NAME } from "../config/constants.js";
import { env } from "../config/env.js";

export const authRouter = Router();

function cookieOptions(expiresAt: string) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: env.NODE_ENV === "production",
    expires: new Date(expiresAt),
  };
}

authRouter.post(
  "/register",
  validate(registerSchema),
  asyncHandler(async (req, res) => {
    const authService = new AuthService(getDb());
    const { user, sessionId, expiresAt } = await authService.register(req.body);
    res.cookie(SESSION_COOKIE_NAME, sessionId, cookieOptions(expiresAt));
    res.status(201).json({ user });
  })
);

authRouter.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (req, res) => {
    const authService = new AuthService(getDb());
    const { user, sessionId, expiresAt } = await authService.login(req.body);
    res.cookie(SESSION_COOKIE_NAME, sessionId, cookieOptions(expiresAt));
    res.status(200).json({ user });
  })
);

authRouter.post("/logout", (req, res) => {
  const sessionId = req.cookies?.[SESSION_COOKIE_NAME] as string | undefined;
  if (sessionId) {
    const authService = new AuthService(getDb());
    authService.logout(sessionId);
  }
  res.clearCookie(SESSION_COOKIE_NAME);
  res.status(204).send();
});

authRouter.get("/me", requireAuth, (req, res) => {
  res.status(200).json({ user: req.user });
});
