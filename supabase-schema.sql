create extension if not exists pgcrypto;

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  unit text not null,
  cost_per_unit numeric(10, 2) not null check (cost_per_unit >= 0),
  category text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.cleaners (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  name text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  client_name text not null,
  job_date date not null,
  cleaner_id uuid references public.cleaners (id) on delete set null,
  job_type text not null check (job_type in ('residential', 'commercial', 'deep clean', 'move-out')),
  charge_to_client numeric(10, 2) not null check (charge_to_client >= 0),
  created_at timestamptz not null default now()
);

create table if not exists public.job_supply_lines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  job_id uuid not null references public.jobs (id) on delete cascade,
  product_id uuid not null references public.products (id) on delete restrict,
  quantity numeric(10, 2) not null check (quantity > 0),
  created_at timestamptz not null default now()
);

alter table public.products enable row level security;
alter table public.cleaners enable row level security;
alter table public.jobs enable row level security;
alter table public.job_supply_lines enable row level security;

create policy "Users can read their own products"
  on public.products
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own products"
  on public.products
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own products"
  on public.products
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own products"
  on public.products
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their own cleaners"
  on public.cleaners
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own cleaners"
  on public.cleaners
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own cleaners"
  on public.cleaners
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own cleaners"
  on public.cleaners
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their own jobs"
  on public.jobs
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own jobs"
  on public.jobs
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own jobs"
  on public.jobs
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own jobs"
  on public.jobs
  for delete
  using (auth.uid() = user_id);

create policy "Users can read their own supply lines"
  on public.job_supply_lines
  for select
  using (auth.uid() = user_id);

create policy "Users can insert their own supply lines"
  on public.job_supply_lines
  for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own supply lines"
  on public.job_supply_lines
  for update
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create policy "Users can delete their own supply lines"
  on public.job_supply_lines
  for delete
  using (auth.uid() = user_id);
