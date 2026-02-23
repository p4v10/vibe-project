-- Developer API Keys table
create table if not exists developer_api_keys (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  name        text not null default 'API Key',
  key_hash    text not null unique,
  key_prefix  text not null,
  last_four   text not null,
  status      text not null default 'active' check (status in ('active', 'revoked')),
  created_at  timestamptz not null default now(),
  last_used_at timestamptz
);

alter table developer_api_keys enable row level security;

create policy "users can view own api keys"
  on developer_api_keys for select
  using (user_id = auth.uid());

create policy "users can insert own api keys"
  on developer_api_keys for insert
  with check (user_id = auth.uid());

create policy "users can update own api keys"
  on developer_api_keys for update
  using (user_id = auth.uid());

create policy "users can delete own api keys"
  on developer_api_keys for delete
  using (user_id = auth.uid());

-- API Usage Logs table (no raw prompt content stored — privacy rule)
create table if not exists api_usage_logs (
  id              uuid primary key default gen_random_uuid(),
  api_key_id      uuid not null references developer_api_keys(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  endpoint        text not null default '/v1/scan',
  bytes_processed integer not null default 0,
  risk_score      integer not null default 0,
  risk_level      text not null default 'low',
  is_blocked      boolean not null default false,
  redaction_count integer not null default 0,
  created_at      timestamptz not null default now()
);

alter table api_usage_logs enable row level security;

create policy "users can view own usage logs"
  on api_usage_logs for select
  using (user_id = auth.uid());
