import { cookies } from "next/headers";
import { sign, unsign } from "./crypto";

const INF = "cp_inf";   // influencer session cookie
const ADM = "cp_adm";   // admin session cookie

const cookieOpts = {
  httpOnly: true,
  secure: process.env.NODE_ENV === "production",
  sameSite: "lax" as const,
  path: "/",
  maxAge: 60 * 60 * 24 * 30, // 30 days
};

export function setInfluencerSession(id: string) {
  cookies().set(INF, sign(id), cookieOpts);
}

export function getInfluencerId(): string | null {
  const c = cookies().get(INF)?.value;
  return c ? unsign(c) : null;
}

/**
 * Two ways in: a named admin account (id from the admins table) or the shared
 * agency password, which signs in as "shared". Both carry the same rights.
 */
export function setAdminSession(adminId: string = "shared") {
  cookies().set(ADM, sign(`admin:${adminId}`), cookieOpts);
}

export function getAdminId(): string | null {
  const c = cookies().get(ADM)?.value;
  const v = c ? unsign(c) : null;
  if (!v) return null;
  // "admin" is the pre-accounts cookie value; still honoured until it expires.
  if (v === "admin") return "shared";
  return v.startsWith("admin:") ? v.slice("admin:".length) : null;
}

export function isAdmin(): boolean {
  return getAdminId() != null;
}

export function clearSessions() {
  cookies().delete(INF);
  cookies().delete(ADM);
}
