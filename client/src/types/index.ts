export interface User {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

export interface Group {
  id: string;
  name: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export type GroupRole = "owner" | "member";

export interface GroupMember {
  id: string;
  groupId: string;
  userId: string;
  role: GroupRole;
  joinedAt: string;
  name: string;
  email: string;
}

export type SplitType = "equal" | "exact" | "percentage" | "shares";

export interface ExpenseParticipant {
  userId: string;
  amount: number;
  percentage: number | null;
  shares: number | null;
}

export interface Expense {
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
  participants: ExpenseParticipant[];
}

export interface MemberBalance {
  userId: string;
  balance: number;
  name: string | null;
  email: string | null;
}

export interface SettlementTransaction {
  from: string;
  to: string;
  amount: number;
  fromName: string | null;
  toName: string | null;
}

export interface Settlement {
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
