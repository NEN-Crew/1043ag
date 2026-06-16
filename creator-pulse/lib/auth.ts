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

export function setAdminSession() {
  cookies().set(ADM, sign("admin"), cookieOpts);
}

export function isAdmin(): boolean {
  const c = cookies().get(ADM)?.value;
  return c ? unsign(c) === "admin" : false;
}

export function clearSessions() {
  cookies().delete(INF);
  cookies().delete(ADM);
}
