export interface UserRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  created_at: string;
  updated_at: string;
}

/** User shape safe to send to clients — never includes password_hash. */
export interface PublicUser {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface SessionRow {
  id: string;
  user_id: string;
  expires_at: string;
  created_at: string;
}

export type GroupRole = "owner" | "member";

export interface GroupRow {
  id: string;
  name: string;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface GroupMemberRow {
  id: string;
  group_id: string;
  user_id: string;
  role: GroupRole;
  joined_at: string;
}

export interface GroupMemberWithUser {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  name: string;
  email: string;
}

/** Attached to req.user by requireAuth. */
export interface AuthenticatedUser {
  id: string;
  email: string;
  name: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}
