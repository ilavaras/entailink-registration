create schema entailink_onboarding;
revoke all on schema entailink_onboarding from public;
create table entailink_onboarding.settings (key text primary key, value text not null);
create table entailink_onboarding.requests (
 id uuid primary key, token_hash text not null, slug text not null unique,
 organisation text not null, admin_name text not null, email text not null,
 role text not null, erp text not null, ip_hash text, step integer not null default 0,
 state text not null default 'PENDING_REVIEW', details jsonb not null default '{}',
 history jsonb not null default '[]', created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
alter table entailink_onboarding.settings enable row level security;
alter table entailink_onboarding.requests enable row level security;
revoke all on all tables in schema entailink_onboarding from public, anon, authenticated;

-- The private function is accessible only through a server-held secret.
-- It provides one transaction for reservation, ordered transitions and audit.
create function entailink_onboarding.operation(secret text, operation text, data jsonb)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare r entailink_onboarding.requests; result jsonb; next_step integer;
begin
 if not exists (select 1 from entailink_onboarding.settings where key='api_hash' and value=encode(extensions.digest(secret,'sha256'),'hex')) then
   raise exception 'Unauthorized' using errcode='42501';
 end if;
 if operation='register' then
   if data->>'slug' !~ '^[a-z][a-z0-9-]{2,39}$' or data->>'slug' = any(array['www','app','api','admin','auth','registration','sandbox','support','demo','procurement-api','hub-api','erpnext-api','odoo-api','zoho-api']) then
     raise exception 'Choose a valid workspace name';
   end if;
   perform pg_advisory_xact_lock(hashtext(coalesce(data->>'ipHash','unknown')));
   if not exists(select 1 from entailink_onboarding.requests where id=(data->>'id')::uuid) and
      (select count(*) from entailink_onboarding.requests where ip_hash=data->>'ipHash' and created_at>now()-interval '1 hour')>=10 then
     raise exception 'Too many registrations. Please try again later.';
   end if;
   insert into entailink_onboarding.requests(id,token_hash,slug,organisation,admin_name,email,role,erp,ip_hash,history)
   values ((data->>'id')::uuid,data->>'tokenHash',data->>'slug',data->>'organisation',data->>'adminName',lower(data->>'email'),data->>'role',data->>'erp',data->>'ipHash',
    jsonb_build_array(jsonb_build_object('step',0,'action','SUBMITTED','at',now())))
   on conflict(id) do nothing;
   select * into r from entailink_onboarding.requests where id=(data->>'id')::uuid;
   if r.token_hash <> data->>'tokenHash' then raise exception 'Request identity mismatch'; end if;
 elsif operation='list' then
   select coalesce(jsonb_agg(to_jsonb(q) - 'token_hash'),'[]') into result from
    (select * from entailink_onboarding.requests order by created_at desc limit 100) q;
   return result;
 else
   select * into r from entailink_onboarding.requests where id=(data->>'id')::uuid for update;
   if not found then raise exception 'Request not found'; end if;
   if operation='status' and r.token_hash <> data->>'tokenHash' then raise exception 'Unauthorized' using errcode='42501'; end if;
   if operation='complete' then
     if r.step <> (data->>'expectedStep')::integer or r.state in ('ACTIVE','REJECTED') then raise exception 'The request has changed. Refresh before continuing.'; end if;
     if coalesce(length(data->>'notes'),0)<3 then raise exception 'Completion evidence is required'; end if;
     if data->>'decision'='reject' and r.step=0 then
       update entailink_onboarding.requests set state='REJECTED',history=history || jsonb_build_array(jsonb_build_object('step',step,'action','REJECTED','notes',data->>'notes','at',now())),updated_at=now() where id=r.id returning * into r;
     else
       next_step := r.step+1;
       update entailink_onboarding.requests set step=next_step,
         state=case when next_step=6 then 'ACTIVE' else 'IN_PROGRESS' end,
         details=details || coalesce(data->'evidence','{}'),
         history=history || jsonb_build_array(jsonb_build_object('step',step,'action','COMPLETED','notes',data->>'notes','at',now())),updated_at=now()
         where id=r.id returning * into r;
     end if;
   elsif operation <> 'status' and operation <> 'get' then raise exception 'Unknown operation';
   end if;
 end if;
 if operation='status' or operation='register' then
   return jsonb_build_object('id',r.id,'slug',r.slug,'workspaceUrl','https://' || r.slug || '.zapplink.com','step',r.step,'state',r.state,'createdAt',r.created_at,'updatedAt',r.updated_at);
 end if;
 return to_jsonb(r)-'token_hash';
end $$;
revoke all on function entailink_onboarding.operation(text,text,jsonb) from public;
grant usage on schema entailink_onboarding to anon;
grant execute on function entailink_onboarding.operation(text,text,jsonb) to anon;
create function public.entailink_onboarding_rpc(secret text, operation text, data jsonb)
returns jsonb language sql security invoker set search_path='' as $$
 select entailink_onboarding.operation(secret,operation,data);
$$;
revoke all on function public.entailink_onboarding_rpc(text,text,jsonb) from public;
grant execute on function public.entailink_onboarding_rpc(text,text,jsonb) to anon;
