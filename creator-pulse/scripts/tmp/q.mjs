import { neon } from "@neondatabase/serverless";
const sql = neon(process.env.DATABASE_URL);
console.log(await sql`select influencer_id, username, followers, jsonb_array_length(videos) n, updated_at from tiktok_stats`);
console.log(await sql`select influencer_id, username, followers, jsonb_array_length(posts) n, updated_at from instagram_stats`);
console.log(await sql`select id, name from influencers`);
console.log(await sql`select to_regclass('hunt_profiles') as hp`);
