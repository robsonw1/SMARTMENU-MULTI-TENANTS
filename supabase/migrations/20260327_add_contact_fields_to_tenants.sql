-- Add contact fields to tenants table
alter table "public"."tenants" add column "contact_email" text default null;
alter table "public"."tenants" add column "contact_phone" text default null;

-- Add comments
comment on column "public"."tenants"."contact_email" is 'Email de contato do proprietário da loja';
comment on column "public"."tenants"."contact_phone" is 'Telefone de contato do proprietário da loja';
