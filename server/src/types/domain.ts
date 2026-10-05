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

/** Group shape safe to send to clients — camelCase, matches every other public DTO. */
export interface PublicGroup {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
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

export interface SettlementRow {
  id: string;
  group_id: string;
  from_user_id: string;
  to_user_id: string;
  amount: number;
  settled_date: string;
  note: string | null;
  recorded_by: string;
  created_at: string;
}

export interface PublicSettlement {
  id: string;
  groupId: string;
  fromUserId: string;
  toUserId: string;
  amount: number;
  date: string;
  note: string | null;
  recordedBy: string;
  createdAt: string;
  fromName: string | null;
  toName: string | null;
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
