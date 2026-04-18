create table public.companies (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  created_at timestamptz not null default now()
);

create table public.agents (
  id uuid primary key references auth.users(id) on delete cascade,
  company_id uuid not null references public.companies(id) on delete cascade,
  email text not null,
  name text not null
);

create table public.inspections (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null references public.companies(id) on delete cascade,
  agent_id uuid not null references public.agents(id) on delete cascade,
  owner_name text,
  address text,
  date date,
  status text not null default 'draft' check (status in ('draft', 'completed')),
  construction_year int,
  living_area numeric,
  heating_type text,
  hot_water_system text,
  ventilation_type text,
  insulation_context text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.levels (
  id uuid primary key default gen_random_uuid(),
  inspection_id uuid not null references public.inspections(id) on delete cascade,
  label text not null,
  fractional_index text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.spaces (
  id uuid primary key default gen_random_uuid(),
  level_id uuid not null references public.levels(id) on delete cascade,
  name text not null,
  area numeric,
  window_count int,
  glazing_type text,
  heating_presence boolean not null default false,
  heating_type text,
  ventilation_presence boolean not null default false,
  ventilation_type text,
  insulation_rating text,
  fractional_index text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
