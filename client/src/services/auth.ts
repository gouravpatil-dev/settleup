import { apiFetch } from "./api";
import type { User } from "../types";

export function registerUser(input: {
  email: string;
  name: string;
  password: string;
}): Promise<{ user: User }> {
  return apiFetch("/auth/register", { method: "POST", body: JSON.stringify(input) });
}

export function loginUser(input: { email: string; password: string }): Promise<{ user: User }> {
  return apiFetch("/auth/login", { method: "POST", body: JSON.stringify(input) });
}

export function logoutUser(): Promise<void> {
  return apiFetch("/auth/logout", { method: "POST" });
}

export function getCurrentUser(): Promise<{ user: User }> {
  return apiFetch("/auth/me");
}
