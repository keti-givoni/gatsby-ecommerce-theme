-- Podcast platform: profiles, episodes, adapted versions, subscriptions.

create extension if not exists pgcrypto;

-- ---------- profiles ----------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  phone text,
  preferred_style text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ---------- episodes ----------
create table if not exists public.episodes (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  description text,
  youtube_id text unique,
  published_at date,
  is_published boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.episode_versions (
  id uuid primary key default gen_random_uuid(),
  episode_id uuid not null references public.episodes (id) on delete cascade,
  style text not null,
  label text,
  video_url text not null,
  created_at timestamptz not null default now(),
  unique (episode_id, style)
);

-- ---------- subscriptions ----------
do $$ begin
  create type public.subscription_status as enum ('pending', 'active', 'past_due', 'canceled');
exception when duplicate_object then null; end $$;

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  status public.subscription_status not null default 'pending',
  provider text not null default 'grow',
  plan_sum numeric(10,2),
  currency text not null default 'ILS',
  grow_process_id text,
  grow_process_token text,
  grow_transaction_id text,
  grow_recurring_id text,
  started_at timestamptz,
  current_period_end timestamptz,
  canceled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists subscriptions_user_idx on public.subscriptions (user_id);
create index if not exists subscriptions_process_idx on public.subscriptions (grow_process_id);
create index if not exists subscriptions_recurring_idx on public.subscriptions (grow_recurring_id);

create table if not exists public.payment_events (
  id bigserial primary key,
  subscription_id uuid references public.subscriptions (id) on delete set null,
  kind text not null,
  payload jsonb,
  created_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin new.updated_at = now(); return new; end $$;

drop trigger if exists profiles_updated_at on public.profiles;
create trigger profiles_updated_at before update on public.profiles
  for each row execute procedure public.set_updated_at();
drop trigger if exists subscriptions_updated_at on public.subscriptions;
create trigger subscriptions_updated_at before update on public.subscriptions
  for each row execute procedure public.set_updated_at();

-- Active = status active and the paid period has not ended (3 days grace).
create or replace function public.is_active_subscriber(uid uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.subscriptions s
    where s.user_id = uid
      and s.status in ('active', 'past_due')
      and (s.current_period_end is null or s.current_period_end + interval '3 days' > now())
  );
$$;

-- ---------- row level security ----------
alter table public.profiles enable row level security;
alter table public.episodes enable row level security;
alter table public.episode_versions enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payment_events enable row level security;

drop policy if exists "profiles: own row" on public.profiles;
create policy "profiles: own row" on public.profiles
  for select using (auth.uid() = id);
drop policy if exists "profiles: update own row" on public.profiles;
create policy "profiles: update own row" on public.profiles
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "episodes: public read" on public.episodes;
create policy "episodes: public read" on public.episodes
  for select using (is_published);

-- Version rows (which carry the video URLs) are only visible to active subscribers.
drop policy if exists "versions: subscribers read" on public.episode_versions;
create policy "versions: subscribers read" on public.episode_versions
  for select using (public.is_active_subscriber(auth.uid()));

drop policy if exists "subscriptions: own rows" on public.subscriptions;
create policy "subscriptions: own rows" on public.subscriptions
  for select using (auth.uid() = user_id);

-- payment_events and all writes to episodes/versions/subscriptions happen with
-- the service role key from the server, so no further policies are needed.
