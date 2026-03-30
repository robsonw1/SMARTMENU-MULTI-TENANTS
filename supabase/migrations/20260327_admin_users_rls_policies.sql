-- RLS Policies para admin_users (isolamento por tenant)

-- Drop existing policies if any
DROP POLICY IF EXISTS "Admins can view their own record" ON public.admin_users;
DROP POLICY IF EXISTS "Admins can update their own record" ON public.admin_users;
DROP POLICY IF EXISTS "Service role can manage admin users" ON public.admin_users;

-- Enable RLS
ALTER TABLE public.admin_users ENABLE ROW LEVEL SECURITY;

-- Policy 1: Admins can view their own admin_users record
CREATE POLICY "Admins can view their own record"
ON public.admin_users
FOR SELECT
TO authenticated
USING (auth.uid() = id);

-- Policy 2: Admins can update their own record (except tenant_id and role)
CREATE POLICY "Admins can update their own record"
ON public.admin_users
FOR UPDATE
TO authenticated
USING (auth.uid() = id)
WITH CHECK (auth.uid() = id);

-- Policy 3: Service role (edge functions) can manage all admin users
CREATE POLICY "Service role can manage admin users"
ON public.admin_users
FOR ALL
TO service_role
USING (true)
WITH CHECK (true);

-- Ensure indexes exist
CREATE INDEX IF NOT EXISTS idx_admin_users_tenant_id ON public.admin_users(tenant_id);
CREATE INDEX IF NOT EXISTS idx_admin_users_email ON public.admin_users(email);
CREATE INDEX IF NOT EXISTS idx_admin_users_id ON public.admin_users(id);
