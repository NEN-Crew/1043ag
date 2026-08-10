-- One file, four tables. Instagram and TikTok numbers live in separate tables,
-- one row per influencer each.

create table if not exists influencers (
  id            text primary key,
  name          text not null,
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

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
