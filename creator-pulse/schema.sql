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
-- Profile photo, for the masthead. A CDN link that expires, so it's re-pulled
-- on every refresh and the UI falls back to a placeholder.
alter table instagram_stats add column if not exists avatar_url text;

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

alter table tiktok_stats add column if not exists avatar_url text;

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

-- Agency staff. An admin logs in at /login like a creator does, but lands on
-- /admin and sees the whole roster. Kept apart from influencers so an admin
-- never shows up in the ranking as a creator with nothing connected.
create table if not exists admins (
  id            text primary key,
  name          text not null,
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz not null default now()
);

-- The commercial area. One row per orçamento (a publi from quote to payment).
-- Every stage status lives on the row. The stage a deal sits in and whether a
-- payment is late are derived in lib/commercial.ts, never stored, so they
-- can't drift from the dates they're computed from.
create table if not exists deals (
  id                  text primary key,
  influencer_id       text not null references influencers(id) on delete cascade,
  agency              text,
  brand               text not null,
  campaign            text,
  scope               text,
  deliverable         text,
  amount              numeric(12,2) not null,
  payment_terms_days  integer,
  received_at         date not null,
  quote_status        text not null default 'aberto'
                      check (quote_status in ('aberto','aprovado','declinado')),
  contract_status     text not null default 'aguardando_envio'
                      check (contract_status in ('aguardando_envio','enviado','assinado')),
  -- Two invoices per job: the creator's (80%) and the agency's (20%).
  nf_creator_status   text not null default 'aguardando'
                      check (nf_creator_status in ('aguardando','emitida','enviada')),
  nf_creator_issued_at date,
  nf_agency_status    text not null default 'aguardando'
                      check (nf_agency_status in ('aguardando','emitida','enviada')),
  nf_agency_issued_at date,
  paid_at             date,
  notes               text,
  created_by          text,
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index if not exists deals_influencer_idx on deals (influencer_id, received_at);
