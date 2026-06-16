import { neon } from "@neondatabase/serverless";

// One shared SQL tag. Usage: await sql`select * from influencers`
export const sql = neon(process.env.DATABASE_URL!);

export type Influencer = {
  id: string;
  name: string;
  email: string;
};

export type InstagramStats = {
  username: string | null;
  followers: number | null;
  following: number | null;
  media_count: number | null;
  posts: any[];
  updated_at: string;
};

export type TiktokStats = {
  username: string | null;
  followers: number | null;
  following: number | null;
  likes_total: number | null;
  video_count: number | null;
  videos: any[];
  updated_at: string;
};
