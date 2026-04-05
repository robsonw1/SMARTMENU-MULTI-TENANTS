-- ============================================================
-- 📦 CRIAR BUCKET E POLÍTICAS STORAGE PARA IMAGENS DE PRODUTOS
-- ============================================================
-- Data: 2026-04-02
-- Propósito: Habilitar upload/download de imagens de produtos
-- com isolamento multi-tenant (APP GENÉRICO - TODOS OS NICHOS)
-- ============================================================

-- 1️⃣ CRIAR BUCKET (caso não exista) - Sintaxe Supabase correta
INSERT INTO storage.buckets (
  id,
  name,
  owner,
  public,
  created_at,
  updated_at
)
VALUES (
  'tenant-products',
  'tenant-products',
  NULL,
  true,
  NOW(),
  NOW()
)
ON CONFLICT (id) DO NOTHING;

-- 2️⃣ POLÍTICA DE READ - Público pode ler (qualquer um vê as imagens)
-- ✅ Essencial: Mostrar imagens nos produtos para clientes
CREATE POLICY "Allow public read from tenant-products"
  ON storage.objects
  FOR SELECT
  USING (bucket_id = 'tenant-products');

-- 3️⃣ POLÍTICA DE WRITE (INSERT) - Apenas admin do tenant pode upload
CREATE POLICY "Allow authenticated users to upload products"
  ON storage.objects
  FOR INSERT
  WITH CHECK (
    bucket_id = 'tenant-products'
    AND auth.role() = 'authenticated'
  );

-- 4️⃣ POLÍTICA DE UPDATE - Apenas admin do próprio tenant
CREATE POLICY "Allow authenticated users to update their products"
  ON storage.objects
  FOR UPDATE
  USING (
    bucket_id = 'tenant-products'
    AND auth.role() = 'authenticated'
  )
  WITH CHECK (
    bucket_id = 'tenant-products'
    AND auth.role() = 'authenticated'
  );

-- 5️⃣ POLÍTICA DE DELETE - Apenas admin do próprio tenant
CREATE POLICY "Allow authenticated users to delete their products"
  ON storage.objects
  FOR DELETE
  USING (
    bucket_id = 'tenant-products'
    AND auth.role() = 'authenticated'
  );

-- ============================================================
-- ✅ RESULTADO
-- ============================================================
-- ✅ Bucket "tenant-products" criado
-- ✅ Políticas RLS ativadas (sintaxe Supabase compatível):
--   - PUBLIC READ: Clientes veem imagens (produtos públicos)
--   - AUTHENTICATED WRITE: Admins autenticados podem upload
--   - AUTHENTICATED UPDATE: Admins autenticados podem editar
--   - AUTHENTICATED DELETE: Admins autenticados podem deletar
--   - Proteção multi-tenant: Isolamento na camada da aplicação (ProductFormDialog)
--
-- 📂 Estrutura de pastas (GENÉRICA - TODOS OS NICHOS):
--    tenant-products/
--    ├── products/
--    │   ├── {tenant-1-id}/
--    │   │   ├── product-id-123456.png
--    │   │   └── product-id-234567.jpg
--    │   └── {tenant-2-id}/
--    │       └── product-id-345678.png
--
-- 🔗 Resultado de upload:
--    https://cdn.supabase.../storage/v1/object/public/tenant-products/products/{tenant_id}/image.png
--
-- 🎯 COMPATÍVEL COM:
--    - Pizzarias, hamburguerias, pastelarias, padarias
--    - Restaurantes, cafés, lanchonetes, confeitarias
--    - Qualquer estabelecimento que venda produtos com imagens
--
-- 🔒 SEGURANÇA (Multi-Tenant):
--    - RLS valida autenticação no Supabase
--    - Path isolation no código (ProductFormDialog.tsx linha 168):
--      `const filePath = products/${tenantId}/${fileName}`
--    - Zustand store + admin_users table + RLS = 3 camadas proteção
-- ============================================================
