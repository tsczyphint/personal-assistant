-- ============================================================
-- 個人助理 PWA — Supabase Schema
-- 在 Supabase Dashboard > SQL Editor 執行此檔案
-- ============================================================

-- 啟用 UUID 擴充
create extension if not exists "pgcrypto";

-- ============================================================
-- users 擴充表（搭配 Supabase Auth 內建的 auth.users）
-- ============================================================
create table public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  display_name  text,
  google_cal_token    text,          -- 加密存放，或用 Supabase Vault
  google_cal_refresh  text,
  strava_token        text,
  garmin_token        text,
  reminder_default_minutes int default 30,
  created_at    timestamptz default now()
);

alter table public.profiles enable row level security;
create policy "users can only see own profile"
  on public.profiles for all using (auth.uid() = id);

-- ============================================================
-- events（語音建立 + Google Calendar 同步）
-- ============================================================
create table public.events (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  title           text not null,
  location        text,
  start_at        timestamptz not null,
  end_at          timestamptz,
  all_day         boolean default false,
  reminder_minutes int default 30,         -- 提醒前幾分鐘
  source          text default 'manual',   -- 'voice' | 'google_cal' | 'manual'
  google_event_id text unique,             -- Google Calendar event ID，用於雙向同步
  raw_voice_text  text,                    -- 保留原始語音文字
  parsed_by_ai    boolean default false,
  is_synced       boolean default false,   -- 是否已推回 Google Calendar
  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

alter table public.events enable row level security;
create policy "users can crud own events"
  on public.events for all using (auth.uid() = user_id);

-- 更新時間自動更新
create or replace function update_updated_at()
returns trigger as $$
begin new.updated_at = now(); return new; end;
$$ language plpgsql;

create trigger events_updated_at
  before update on public.events
  for each row execute function update_updated_at();

-- ============================================================
-- reminders（一個事件可有多個提醒）
-- ============================================================
create table public.reminders (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references public.events(id) on delete cascade,
  fire_at         timestamptz not null,
  minutes_before  int not null,
  status          text default 'pending',  -- 'pending' | 'fired' | 'dismissed'
  created_at      timestamptz default now()
);

alter table public.reminders enable row level security;
create policy "users can crud own reminders"
  on public.reminders for all
  using (
    exists (
      select 1 from public.events e
      where e.id = event_id and e.user_id = auth.uid()
    )
  );

-- ============================================================
-- activities（Strava / Garmin 運動紀錄）
-- ============================================================
create table public.activities (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  source          text not null,           -- 'strava' | 'garmin' | 'manual'
  activity_type   text,                    -- 'run' | 'ride' | 'swim' | 'walk'
  title           text,
  distance_km     numeric(8,3),
  duration_sec    int,
  avg_heart_rate  int,
  max_heart_rate  int,
  avg_pace        numeric(6,2),            -- min/km
  calories        int,
  elevation_m     numeric(7,1),
  recorded_at     timestamptz not null,
  external_id     text,                    -- Strava/Garmin activity ID
  raw_data        jsonb,                   -- 原始 API 回傳資料
  created_at      timestamptz default now(),
  unique (source, external_id)             -- 避免重複匯入
);

alter table public.activities enable row level security;
create policy "users can crud own activities"
  on public.activities for all using (auth.uid() = user_id);

-- ============================================================
-- trips（行程主表）
-- ============================================================
create table public.trips (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  title       text not null,
  trip_type   text default 'personal',     -- 'personal' | 'family' | 'business'
  start_date  date not null,
  end_date    date not null,
  destination text,
  status      text default 'planning',     -- 'planning' | 'confirmed' | 'ongoing' | 'done'
  notes       text,
  created_at  timestamptz default now()
);

alter table public.trips enable row level security;
create policy "users can crud own trips"
  on public.trips for all using (auth.uid() = user_id);

-- ============================================================
-- trip_items（機票、車票、飯店、租車等明細）
-- ============================================================
create table public.trip_items (
  id                uuid primary key default gen_random_uuid(),
  trip_id           uuid not null references public.trips(id) on delete cascade,
  item_type         text not null,          -- 'flight' | 'train' | 'hotel' | 'car' | 'other'
  title             text not null,
  confirmation_code text,
  provider          text,                   -- 航空公司、飯店名稱
  depart_at         timestamptz,
  arrive_at         timestamptz,
  depart_location   text,
  arrive_location   text,
  seat_info         text,
  document_url      text,                   -- Supabase Storage 的 PDF 連結
  notes             text,
  sort_order        int default 0,
  created_at        timestamptz default now()
);

alter table public.trip_items enable row level security;
create policy "users can crud own trip items"
  on public.trip_items for all
  using (
    exists (
      select 1 from public.trips t
      where t.id = trip_id and t.user_id = auth.uid()
    )
  );

-- ============================================================
-- Index（加速常用查詢）
-- ============================================================
create index on public.events (user_id, start_at);
create index on public.events (google_event_id) where google_event_id is not null;
create index on public.reminders (fire_at) where status = 'pending';
create index on public.activities (user_id, recorded_at desc);
create index on public.trips (user_id, start_date);
create index on public.trip_items (trip_id, sort_order);
