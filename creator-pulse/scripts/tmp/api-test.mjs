import { readFileSync } from "node:fs";
const env = Object.fromEntries(readFileSync(".env","utf8").split("\n").filter(l=>l.includes("=")&&!l.startsWith("#")).map(l=>{const i=l.indexOf("=");return [l.slice(0,i).trim(),l.slice(i+1).trim()]}));
const B = "http://localhost:3000";
let cookie = "";
const call = async (path, method, body, auth = true) => {
  const r = await fetch(B + path, { method, headers: { "Content-Type": "application/json", ...(auth && cookie ? { cookie } : {}) }, body: body ? JSON.stringify(body) : undefined });
  const t = await r.text(); let j; try { j = JSON.parse(t); } catch { j = t.slice(0, 80); }
  return [r.status, j];
};
const log = (l, v) => console.log(l.padEnd(34), JSON.stringify(v));
log("no session lookup", await call("/api/hunt/lookup", "POST", { input: "x" }, false));
log("no session patch", await call("/api/hunt/hunt-fx00000001", "PATCH", {}, false));
log("no session refresh", await call("/api/hunt/hunt-fx00000001/refresh", "POST", {}, false));
const lr = await fetch(B + "/api/auth/admin-login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password: env.ADMIN_PASSWORD }) });
cookie = lr.headers.get("set-cookie").split(";")[0];
log("invalid handle", await call("/api/hunt/lookup", "POST", { platform: "instagram", input: "@lu exemplo" }));
log("roster ig link", await call("/api/hunt/lookup", "POST", { input: "https://www.instagram.com/PerschAnge/?hl=pt" }));
log("roster tt link", await call("/api/hunt/lookup", "POST", { input: "https://www.tiktok.com/@g.capelari" }));
log("cached", await call("/api/hunt/lookup", "POST", { platform: "tiktok", input: "@exemplo.hunt" }));
log("new, unconfigured", await call("/api/hunt/lookup", "POST", { platform: "tiktok", input: "@alguem.novo" }));
log("refresh auto, fresh", await call("/api/hunt/hunt-fx00000001/refresh", "POST", { auto: true }));
log("refresh manual, stale, unconf", await call("/api/hunt/hunt-fx00000002/refresh", "POST", {}));
log("patch ok", await call("/api/hunt/hunt-fx00000002", "PATCH", { status: "em_conversa", contact: "+55 11 9", notes: "teste" }));
log("patch bad status", await call("/api/hunt/hunt-fx00000002", "PATCH", { status: "bogus" }));
log("patch bad influencer", await call("/api/hunt/hunt-fx00000002", "PATCH", { influencerId: "nope" }));
log("patch link influencer", await call("/api/hunt/hunt-fx00000002", "PATCH", { influencerId: "caio-patez-0ef1" }));
log("delete bad reason", await call("/api/hunt/hunt-fx00000002", "DELETE", { reason: "x" }));
// creator session: log in as a creator? No creator password known; simulate with a bogus cookie
cookie = "cp_inf=garbage";
log("creator-ish session lookup", await call("/api/hunt/lookup", "POST", { input: "x" }));
const pg = await fetch(B + "/admin/hunt", { headers: { cookie } }); const html = await pg.text();
log("/admin/hunt w/o admin → gate", [pg.status, html.includes("senha da agência")]);
