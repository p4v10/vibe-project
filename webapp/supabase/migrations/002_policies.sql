-- User policies table (policy-based guardrails)
create table if not exists user_policies (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  enabled boolean not null default true,
  condition_type text not null check (condition_type in ('detection_type', 'keyword', 'risk_score')),
  condition_detection_type text,
  condition_count_gt integer,
  condition_keyword text,
  condition_risk_score_gt integer,
  action text not null check (action in ('allow', 'warn', 'mask', 'block')),
  created_at timestamptz not null default now()
);

alter table user_policies enable row level security;

create policy "Users can manage own policies"
  on user_policies for all
  using (auth.uid() = user_id);
