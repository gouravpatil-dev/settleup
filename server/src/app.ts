import express from "express";
import cors from "cors";
import cookieParser from "cookie-parser";
import { env } from "./config/env.js";
import { healthRouter } from "./routes/health.js";
import { authRouter } from "./routes/auth.js";
import { groupsRouter } from "./routes/groups.js";
import { errorHandler, notFoundHandler } from "./middleware/errorHandler.js";

/**
 * Builds the Express app without starting a listener, so tests can
 * import it directly (supertest) without binding a real port.
 */
export function createApp() {
  const app = express();

  app.use(cors({ origin: env.CLIENT_ORIGIN, credentials: true }));
  app.use(express.json());
  app.use(cookieParser());

  app.use("/api/health", healthRouter);
  app.use("/api/auth", authRouter);
  app.use("/api/groups", groupsRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
