import type Database from "better-sqlite3";
import { UserRepository, toPublicUser } from "../repositories/UserRepository.js";
import { SessionRepository } from "../repositories/SessionRepository.js";
import { hashPassword, comparePassword } from "../utils/password.js";
import { ConflictError, UnauthorizedError } from "../utils/AppError.js";
import type { AuthenticatedUser, PublicUser } from "../types/domain.js";

export const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 7; // 7 days

export class AuthService {
  private readonly users: UserRepository;
  private readonly sessions: SessionRepository;

  constructor(db: Database.Database) {
    this.users = new UserRepository(db);
    this.sessions = new SessionRepository(db);
  }

  async register(params: {
    email: string;
    name: string;
    password: string;
  }): Promise<{ user: PublicUser; sessionId: string; expiresAt: string }> {
    const existing = this.users.findByEmail(params.email);
    if (existing) {
      throw new ConflictError("An account with this email already exists");
    }

    const passwordHash = await hashPassword(params.password);
    const userRow = this.users.create({
      email: params.email,
      name: params.name,
      passwordHash,
    });

    const session = this.sessions.create(userRow.id, SESSION_TTL_MS);
    return { user: toPublicUser(userRow), sessionId: session.id, expiresAt: session.expires_at };
  }

  async login(params: {
    email: string;
    password: string;
  }): Promise<{ user: PublicUser; sessionId: string; expiresAt: string }> {
    const userRow = this.users.findByEmail(params.email);
    // Same error for "no such user" and "wrong password" — never reveal
    // which one it was, to avoid leaking which emails are registered.
    if (!userRow) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const valid = await comparePassword(params.password, userRow.password_hash);
    if (!valid) {
      throw new UnauthorizedError("Invalid email or password");
    }

    const session = this.sessions.create(userRow.id, SESSION_TTL_MS);
    return { user: toPublicUser(userRow), sessionId: session.id, expiresAt: session.expires_at };
  }

  logout(sessionId: string): void {
    this.sessions.delete(sessionId);
  }

  /** Resolves a session cookie value to the authenticated user, or undefined. */
  resolveSession(sessionId: string): AuthenticatedUser | undefined {
    const session = this.sessions.findValid(sessionId);
    if (!session) return undefined;

    const userRow = this.users.findById(session.user_id);
    if (!userRow) return undefined;

    return { id: userRow.id, email: userRow.email, name: userRow.name };
  }
}
