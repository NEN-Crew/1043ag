// Hand-written, fictional prospects for local verification. Deleted afterwards.
import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
const day = 864e5;
const iso = (d) => new Date(Date.now() - d * day).toISOString();

const igPosts = Array.from({ length: 22 }, (_, i) => {
  const d = 2 + i * 4;
  const type = i % 3 === 0 ? "VIDEO" : i % 3 === 1 ? "CAROUSEL_ALBUM" : "IMAGE";
  const likes = 900 + ((i * 137) % 700);
  return {
    id: `ig-fx-${i}`,
    caption: i === 4 ? "Look do dia com a @ parceira #publi" : i === 9 ? "Bônus de boas-vindas na betano, use o código LU10" : i === 15 ? "Receita rápida de domingo #ad" : `Post fictício número ${i}`,
    permalink: `https://www.instagram.com/p/fx${i}/`,
    thumbnail: null,
    type,
    timestamp: iso(d),
    likes,
    comments: 20 + ((i * 31) % 60),
    views: type === "VIDEO" ? 15000 + ((i * 911) % 20000) : null,
    reach: null, saves: null, shares: null,
  };
});
const ttVideos = Array.from({ length: 30 }, (_, i) => ({
  id: `tt-fx-${i}`,
  title: i === 3 ? "Dancinha nova #publi com a marca" : i === 11 ? "aposta de quem ganha o jogo? comenta aí" : `Vídeo fictício ${i}`,
  shareUrl: `https://www.tiktok.com/@exemplo.hunt/video/7${String(i).padStart(18, "0")}`,
  cover: null,
  createTime: Math.floor((Date.now() - (1 + i * 3) * day) / 1000),
  views: 40000 + ((i * 7919) % 90000),
  likes: 2500 + ((i * 613) % 4000),
  comments: 40 + ((i * 17) % 120),
  shares: 30 + ((i * 11) % 90),
  collects: 150 + ((i * 29) % 300),
  paidFlag: i === 7,
}));

await sql`delete from hunt_profiles where handle in ('exemplo.hunt', 'exemplo.hunt.ig')`;
await sql`insert into hunt_profiles (id, platform, handle, display_name, bio, link, followers, following, media_count, posts, source, fetched_at, fetched_by, status, created_by)
  values ('hunt-fx00000001', 'instagram', 'exemplo.hunt.ig', 'Lu Exemplo', 'moda e cafés em são paulo ☕', 'https://exemplo.test', 28400, 812, 640,
          ${JSON.stringify(igPosts)}::jsonb, 'meta_business_discovery', now() - interval '2 days', 'shared', 'contatado', 'shared')`;
await sql`insert into hunt_profiles (id, platform, handle, display_name, bio, followers, following, media_count, likes_total, posts, source, fetched_at, fetched_by, status, created_by)
  values ('hunt-fx00000002', 'tiktok', 'exemplo.hunt', 'exemplo hunt', 'humor e rotina 🎬', 143200, 310, 420, 5120000,
          ${JSON.stringify(ttVideos)}::jsonb, 'scrapecreators', now() - interval '9 days', 'shared', 'encontrado', 'shared')`;
for (const [d, f] of [[40, 27100], [20, 27800], [9, 28400]]) {
  await sql`insert into hunt_snapshots (profile_id, captured_at, source, followers, following, media_count) values ('hunt-fx00000001', ${iso(d)}, 'meta_business_discovery', ${f}, 812, 640)`;
}
await sql`insert into hunt_snapshots (profile_id, captured_at, source, followers, following, media_count, likes_total) values ('hunt-fx00000002', ${iso(9)}, 'scrapecreators', 143200, 310, 420, 5120000)`;
console.log(await sql`select id, platform, handle, status from hunt_profiles`);
