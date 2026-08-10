-- One file, four tables. Instagram and TikTok numbers live in separate tables,
-- one row per influencer each.

create table if not exists influencers (
  id                     text primary key,
  name                   text not null,
  email                  text unique not null,
  password_hash          text not null,
  -- Rate-limits the influencer's own refresh button (admin is unlimited).
  last_manual_refresh_at timestamptz,
  created_at             timestamptz not null default now()
);

-- Migration for databases created before the column existed.
alter table influencers add column if not exists last_manual_refresh_at timestamptz;

-- One OAuth connection per (influencer, platform). Tokens are encrypted.
create table if not exists connections (
  influencer_id    text not null references influencers(id) on delete cascade,
  platform         text not null check (platform in ('instagram','tiktok')),
  account_id       text,
  username         text,
  access_token     text not null,
  refresh_token    text,
  token_expires_at timestamptz,
  connected_at     timestamptz not null default now(),
  primary key (influencer_id, platform)
);

create table if not exists instagram_stats (
  influencer_id    text primary key references influencers(id) on delete cascade,
  username         text,
  followers        integer,
  following        integer,
  media_count      integer,
  posts            jsonb not null default '[]',
  account_insights jsonb,
  demographics     jsonb,
  updated_at       timestamptz not null default now()
);

-- Migration for databases created before the insights columns existed.
alter table instagram_stats add column if not exists account_insights jsonb;
alter table instagram_stats add column if not exists demographics jsonb;

create table if not exists tiktok_stats (
  influencer_id text primary key references influencers(id) on delete cascade,
  username      text,
  followers     integer,
  following     integer,
  likes_total   bigint,
  video_count   integer,
  videos        jsonb not null default '[]',
  updated_at    timestamptz not null default now()
);

-- Append-only snapshots, one row per refresh, so history is never lost.
-- post_metrics/video_metrics hold slim per-item numbers (no captions/urls)
-- to keep rows small.
create table if not exists instagram_stats_history (
  id               bigint generated always as identity primary key,
  influencer_id    text not null references influencers(id) on delete cascade,
  followers        integer,
  following        integer,
  media_count      integer,
  account_insights jsonb,
  demographics     jsonb,
  post_metrics     jsonb not null default '[]',
  captured_at      timestamptz not null default now()
);
create index if not exists instagram_stats_history_influencer_idx
  on instagram_stats_history (influencer_id, captured_at);

create table if not exists tiktok_stats_history (
  id            bigint generated always as identity primary key,
  influencer_id text not null references influencers(id) on delete cascade,
  followers     integer,
  following     integer,
  likes_total   bigint,
  video_count   integer,
  video_metrics jsonb not null default '[]',
  captured_at   timestamptz not null default now()
);
create index if not exists tiktok_stats_history_influencer_idx
  on tiktok_stats_history (influencer_id, captured_at);
