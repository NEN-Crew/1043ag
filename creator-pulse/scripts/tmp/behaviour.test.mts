// Cache / lock / failure / suppression behaviour, with the vendor stubbed.
// Hand-written fixture data; the row is deleted at the end.
process.env.SCRAPECREATORS_API_KEY = "test-key";
const H = "fx.behaviour";
let calls = 0;
let mode: "ok" | "fail" = "ok";
const realFetch = globalThis.fetch;
globalThis.fetch = (async (url: any, init?: any) => {
  const u = String(url);
  if (!u.startsWith("https://api.scrapecreators.com")) return realFetch(url, init);
  calls++;
  await new Promise((r) => setTimeout(r, 300));
  if (mode === "fail") return new Response(JSON.stringify({ success: false, error: "boom" }), { status: 500 });
  if (u.includes("/v1/tiktok/profile")) {
    return new Response(JSON.stringify({ success: true, user: { id: "1", uniqueId: H, nickname: "Fx", signature: "", verified: false, privateAccount: false },
      stats: { followerCount: 1000, followingCount: 10, heartCount: 5000, videoCount: 2 }, statsV2: { followerCount: "1001", followingCount: "10", heartCount: "5001", videoCount: "2" } }), { status: 200 });
  }
  return new Response(JSON.stringify({ aweme_list: [
    { aweme_id: "a1", desc: "um", create_time: Math.floor(Date.now()/1000) - 86400, statistics: { play_count: 100, digg_count: 10, comment_count: 1, share_count: 1, collect_count: 2 }, share_url: "https://t/1" },
    { aweme_id: "a2", desc: "dois #publi", create_time: Math.floor(Date.now()/1000) - 172800, statistics: { play_count: 200, digg_count: 20, comment_count: 2, share_count: 2, collect_count: 4 }, is_paid_partnership: true },
  ], has_more: 0, max_cursor: "" }), { status: 200 });
}) as any;

const { sql } = await import("../../lib/db.ts");
const hunt = await import("../../lib/hunt.ts");
const ok = (label: string, cond: boolean, extra?: any) => console.log(cond ? "PASS" : "FAIL", label, extra ?? "");

await sql`delete from hunt_profiles where handle = ${H}`;
await sql`delete from hunt_suppressed where handle_hash = ${hunt.hashHandle("tiktok", H)}`;

// two simultaneous lookups → one fetch (profile + videos = 2 calls)
calls = 0;
const [a, b] = await Promise.all([hunt.lookup("tiktok", H, "t1"), hunt.lookup("tiktok", H, "t2")]);
ok("both lookups ok", a.status === "ok" && b.status === "ok", [a, b]);
ok("one fetch for two lookups (2 vendor calls)", calls === 2, calls);
const p1 = await hunt.getProfileByHandle("tiktok", H);
ok("statsV2 preferred (1001)", p1?.followers === 1001, p1?.followers);
ok("paidFlag kept", p1?.posts.some((x: any) => x.paidFlag === true));
let snaps = await hunt.listSnapshots(p1!.id);
ok("one snapshot", snaps.length === 1, snaps.length);

// second search within 7 days → cached, no new snapshot
calls = 0;
const c = await hunt.lookup("tiktok", H, "t1");
ok("cached lookup, no vendor call", c.status === "ok" && (c as any).cached && calls === 0, c);
snaps = await hunt.listSnapshots(p1!.id);
ok("still one snapshot", snaps.length === 1);

// manual update inside 12h → cooldown
const r1 = await hunt.refreshProfile(p1!.id, { auto: false, by: "t1" });
ok("cooldown within 12h", r1?.status === "cooldown", r1);
const r2 = await hunt.refreshProfile(p1!.id, { auto: true, by: "t1" });
ok("auto on fresh copy → fresh", r2?.status === "fresh", r2);

// make it stale, force a failure → saved copy kept, last_error set, lock cleared
await sql`update hunt_profiles set fetched_at = now() - interval '8 days' where id = ${p1!.id}`;
mode = "fail";
const r3 = await hunt.refreshProfile(p1!.id, { auto: true, by: "t1" });
const p2 = await hunt.getProfileByHandle("tiktok", H);
ok("failure reported", r3?.status === "error", r3);
ok("saved copy kept", p2?.followers === 1001 && p2.posts.length === 2);
ok("last_error set, lock cleared", Boolean(p2?.last_error) && p2?.fetching_since == null, p2?.last_error);
ok("no snapshot added on failure", (await hunt.listSnapshots(p1!.id)).length === 1);

// stale + success → second snapshot
mode = "ok";
const r4 = await hunt.refreshProfile(p1!.id, { auto: true, by: "t1" });
ok("stale auto refresh ok", r4?.status === "ok", r4);
ok("second snapshot", (await hunt.listSnapshots(p1!.id)).length === 2);
ok("last_error cleared", (await hunt.getProfile(p1!.id))?.last_error == null);

// lock: concurrent refreshes → one fetch
await sql`update hunt_profiles set fetched_at = now() - interval '8 days' where id = ${p1!.id}`;
calls = 0;
const [x, y] = await Promise.all([hunt.refreshProfile(p1!.id, { auto: true, by: "t1" }), hunt.refreshProfile(p1!.id, { auto: true, by: "t2" })]);
ok("concurrent refresh: one ok, one busy", [x?.status, y?.status].sort().join() === "busy,ok", [x, y]);
ok("one fetch", calls === 2, calls);

// not found → no row kept
const nf = await hunt.lookup("tiktok", "fx.naoexiste", "t1").catch((e) => e);
// (stub returns a user for any handle; simulate by failing)
mode = "fail";
const nf2 = await hunt.lookup("tiktok", "fx.naoexiste", "t1");
ok("failed new lookup leaves no row", nf2.status === "error" && !(await hunt.getProfileByHandle("tiktok", "fx.naoexiste")), nf2);
mode = "ok";
await sql`delete from hunt_profiles where handle = 'fx.naoexiste'`;

// delete with "pedido do perfil" → suppressed on next lookup
await hunt.deleteProfile(p1!.id, "pedido_do_perfil");
ok("row gone", !(await hunt.getProfileByHandle("tiktok", H)));
const s = await hunt.lookup("tiktok", H, "t1");
ok("suppressed afterwards", s.status === "error" && s.code === "suppressed", s);
await sql`delete from hunt_suppressed where handle_hash = ${hunt.hashHandle("tiktok", H)}`;
console.log("cleanup done");
