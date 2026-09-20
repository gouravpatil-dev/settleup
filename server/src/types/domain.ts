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

export type SplitType = "equal" | "exact" | "percentage" | "shares";

export interface ExpenseRow {
  id: string;
  group_id: string;
  description: string;
  amount: number;
  currency: string;
  paid_by: string;
  split_type: SplitType;
  expense_date: string;
  category: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface ExpenseParticipantRow {
  id: string;
  expense_id: string;
  user_id: string;
  share_amount: number;
  percentage: number | null;
  shares: number | null;
}

export interface PublicExpense {
  id: string;
  groupId: string;
  description: string;
  amount: number;
  currency: string;
  paidBy: string;
  splitType: SplitType;
  date: string;
  category: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
  participants: Array<{
    userId: string;
    amount: number;
    percentage: number | null;
    shares: number | null;
  }>;
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
