/* Swole Hub schema (also usable directly in a SQL editor). Safe to run repeatedly. */
export const SCHEMA = `
create table if not exists users (
  name     text primary key,
  pin_hash text not null
);

create table if not exists program (
  id            bigserial primary key,
  user_name     text not null,
  day           text not null,
  ord           int,
  exercise      text not null,
  sets          double precision,
  reps          double precision,
  target_weight double precision,
  load_type     text,
  category      text,
  preset        text
);
create index if not exists program_user_idx on program (user_name);

create table if not exists log (
  id         bigserial primary key,
  ts         timestamptz not null default now(),
  date       date not null,
  day        text,
  exercise   text not null,
  sets       double precision,
  reps       double precision,
  weight     double precision,
  load_type  text,
  eff_weight double precision,
  volume     double precision,
  progress   text,
  category   text,
  notes      text,
  time       double precision,
  level      double precision,
  pace       text,
  calories   double precision,
  user_name  text not null,
  unique (user_name, exercise, date)
);

create table if not exists skips (
  user_name text not null,
  date      date not null,
  exercise  text not null,
  day       text,
  primary key (user_name, exercise, date)
);

-- Supabase exposes the public schema over its REST API. RLS on with no policies = no anon access.
-- The app connects as the database owner, which bypasses RLS.
alter table users   enable row level security;
alter table program enable row level security;
alter table log     enable row level security;
alter table skips   enable row level security;
do $$ begin if exists (select 1 from pg_roles where rolname = 'anon') then revoke all on users, program, log, skips from anon, authenticated; end if; end $$;
`;
