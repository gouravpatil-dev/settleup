import type { Response } from "supertest";

/** Extracts the raw "sid=..." cookie header value from a set-cookie response. */
export function extractSessionCookie(res: Response): string {
  const setCookie = res.headers["set-cookie"] as unknown as string[] | undefined;
  const sidCookie = setCookie?.find((c) => c.startsWith("sid="));
  if (!sidCookie) {
    throw new Error("No sid cookie found in response");
  }
  return sidCookie.split(";")[0]; // "sid=<value>"
}
