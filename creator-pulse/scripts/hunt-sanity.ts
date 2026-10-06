/**
 * Sanity check of the hunt fetchers against the roster's official numbers.
 *
 * Runs the public fetchers on connected roster creators and compares
 * followers and per-post likes, comments and views with the stored
 * instagram_stats / tiktok_stats rows. Nothing is written: this bypasses
 * lookup(), which would redirect a roster handle to /admin/[id].
 *
 *   npx tsx --env-file=.env scripts/hunt-sanity.ts
 *
 * Needs SCRAPECREATORS_API_KEY and/or IG_DISCOVERY_TOKEN + IG_DISCOVERY_ACCOUNT_ID.
 */
import { neon } from "@neondatabase/serverless";
import { fetchInstagramProspect, instagramConfigured } from "../lib/hunt-instagram";
import { fetchTiktokProspect, tiktokConfigured } from "../lib/hunt-tiktok";

const sql = neon(process.env.DATABASE_URL!);
const pct = (a: number | null, b: number | null) =>
  a == null || b == null ? "—" : b === 0 ? "—" : `${(((a - b) / b) * 100).toFixed(1)}%`;

async function main() {
  const ig = (await sql`select influencer_id, username, followers, posts from instagram_stats`) as any[];
  const tt = (await sql`select influencer_id, username, followers, videos from tiktok_stats`) as any[];

  if (instagramConfigured()) {
    for (const row of ig) {
      if (!row.username) continue;
      console.log(`\n== instagram @${row.username} (${row.influencer_id})`);
      try {
        const f = await fetchInstagramProspect(String(row.username).toLowerCase());
        console.log(`followers  official ${row.followers}  public ${f.followers}  diff ${pct(f.followers, row.followers)}`);
        const byId = new Map(f.posts.map((p: any) => [p.id, p]));
        let n = 0;
        for (const p of row.posts.slice(0, 15)) {
          const q = byId.get(p.id);
          if (!q) continue;
          n++;
          console.log(
            `  ${String(p.timestamp).slice(0, 10)}  likes ${p.likes}/${q.likes} (${pct(q.likes, p.likes)})  comments ${p.comments}/${q.comments} (${pct(q.comments, p.comments)})  views ${p.views}/${q.views} (${pct(q.views, p.views)})`
          );
        }
        console.log(`  matched ${n} posts by id; likes_hidden=${f.likesHidden}`);
      } catch (e: any) {
        console.log("  failed:", e.code ?? "", e.message);
      }
    }
  } else console.log("\ninstagram: not configured, skipped");

  if (tiktokConfigured()) {
    for (const row of tt) {
      if (!row.username || /\s/.test(row.username)) {
        console.log(`\n== tiktok ${row.influencer_id}: username "${row.username}" is not a handle yet (reconnect or wait for the next refresh)`);
        continue;
      }
      console.log(`\n== tiktok @${row.username} (${row.influencer_id})`);
      try {
        const f = await fetchTiktokProspect(String(row.username).toLowerCase());
        console.log(`followers  official ${row.followers}  public ${f.followers}  diff ${pct(f.followers, row.followers)}`);
        const byId = new Map(f.posts.map((p: any) => [p.id, p]));
        let n = 0;
        for (const v of row.videos.slice(0, 15)) {
          const q = byId.get(v.id);
          if (!q) continue;
          n++;
          console.log(
            `  ${new Date(v.createTime * 1000).toISOString().slice(0, 10)}  views ${v.views}/${q.views} (${pct(q.views, v.views)})  likes ${v.likes}/${q.likes} (${pct(q.likes, v.likes)})  comments ${v.comments}/${q.comments} (${pct(q.comments, v.comments)})`
          );
        }
        console.log(`  matched ${n} videos by id`);
      } catch (e: any) {
        console.log("  failed:", e.code ?? "", e.message);
      }
    }
  } else console.log("\ntiktok: not configured, skipped");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
