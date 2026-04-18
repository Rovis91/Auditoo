alter table public.agents enable row level security;
alter table public.companies enable row level security;

-- agents: read own row and company peers
create policy "agents_select"
  on public.agents for select
  using (company_id = (select company_id from public.agents where id = auth.uid()));

-- companies: read own company
create policy "companies_select"
  on public.companies for select
  using (id = (select company_id from public.agents where id = auth.uid()));
