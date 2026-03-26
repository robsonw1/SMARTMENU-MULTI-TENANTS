#!/bin/bash

# ============================================================
# GUIA DE DEPLOYMENT - AEZap SmartMenu SaaS Multi-Tenant
# ============================================================
# Este arquivo documenta os pasos para fazer deploy do sistema

# 1. DEPLOY DATABASE - Executar migrations no Supabase
# ============================================================

echo "📊 STEP 1: Aplicando migrations no Supabase..."
echo "Copie e execute NO SUPABASE SQL EDITOR:"
echo ""
echo "✅ supabase/migrations/20260326_create_tenant_settings.sql"
echo "✅ supabase/migrations/20260320_add_tenant_id_to_products.sql"
echo "✅ supabase/migrations/add_tenant_id_to_orders.sql"
echo ""

# 2. DEPLOY EDGE FUNCTIONS
# ============================================================

echo ""
echo "🚀 STEP 2: Deploy das Edge Functions..."
echo ""
echo "Executar na pasta raiz:"
echo "  supabase functions deploy create-tenant"
echo "  supabase functions deploy send-welcome-email"
echo ""

# 3. CONFIGURAR VARIÁVEIS DE AMBIENTE
# ============================================================

echo ""
echo "🔑 STEP 3: Configurar variáveis de ambiente..."
echo ""
echo "Frontend (.env):"
echo "  VITE_SUPABASE_PROJECT_ID=ltmhmjnvksbkiqbdcxkj"
echo "  VITE_SUPABASE_PUBLISHABLE_KEY=..."
echo "  VITE_SUPABASE_URL=https://ltmhmjnvksbkiqbdcxkj.supabase.co"
echo "  VITE_APP_URL=https://app.aezap.site"
echo "  VITE_ADMIN_URL=https://admin-app.aezap.site"
echo ""
echo "Edge Functions (supabase/.env):"
echo "  SUPABASE_URL=..."
echo "  SUPABASE_SERVICE_ROLE_KEY=..."
echo "  RESEND_API_KEY=re_xxxxx (https://resend.com)"
echo "  EVOLUTION_API_URL=..."
echo "  EVOLUTION_API_KEY=..."
echo ""

# 4. CONFIGURAR DNS WILDCARD
# ============================================================

echo ""
echo "🌐 STEP 4: Configurar DNS wildcard no seu DOMÍNIO..."
echo ""
echo "Criar registro DNS:"
echo "  Tipo: A ou CNAME"
echo "  Nome: *.app.aezap.site"
echo "  Apontar para: IP do seu servidor ou CNAME do Easypanel"
echo ""
echo "Exemplo:"
echo "  *.app.aezap.site  A  192.168.1.1"
echo "  OU"
echo "  *.app.aezap.site  CNAME  easypanel.seu-servidor.com"
echo ""

# 5. CONFIGURAR EASYPANEL
# ============================================================

echo ""
echo "⚙️  STEP 5: Configurar Easypanel para multidomínio..."
echo ""
echo "Para cada tenant criado:"
echo "  1. Easypanel cria um SERVICE com:"
echo "     - Nome: {tenant_slug}-app"
echo "     - Domínio: {tenant_slug}-app.aezap.site"
echo "     - Fonte: repositório do cliente (ou monorepo)"
echo ""
echo "Alternativa (Recomendado): Use MONOREPO + Dynamic routing"
echo "  - Um único service que detecta o subdomain"
echo "  - Route para /[tenant] dentro da aplicação"
echo ""

# 6. TESTAR MULTI-TENANT
# ============================================================

echo ""
echo "✅ STEP 6: Testar o fluxo multi-tenant..."
echo ""
echo "1. Acesse: http://localhost:5173/cadastro"
echo "   (ou https://app.aezap.site/cadastro em produção)"
echo ""
echo "2. Preencha formulário:"
echo "   - Nome: 'Teste Pizzaria'"
echo "   - Email: seu@email.com"
echo "   - Telefone: (85) 99999-9999"
echo ""
echo "3. Verifique:")
echo "   ✓ Email recebido com credenciais"
echo "   ✓ Tenant criado no Supabase (SELECT * FROM tenants)"
echo "   ✓ tenant_settings criado automaticamente"
echo "   ✓ Produtos padrão inseridos"
echo "   ✓ Bairros padrão inseridos"
echo ""
echo "4. Acesse URL do email ou:"
echo "   https://teste-pizzaria-app.aezap.site"
echo ""
echo "5. Faça login com credenciais do email"
echo ""
echo "6. Acesse /admin/dashboard → Aba 'Loja'"
echo "   Customize e salve configurações"
echo ""

# 7. CONFIGURAR DOMÍNIOS NO CNAME
# ============================================================

echo ""
echo "🎯 STEP 7: CPanelAPE - Apontar subdomínios..."
echo ""
echo "No cPanel de seu domínio aezap.site:"
echo ""
echo "Criar CNAME wildcard:"
echo "  Domínio: *.app.aezap.site"
echo "  Aponta para: app.aezap.site (ou IP de seu servidor)"
echo ""
echo "Isso faz qualquer *.app.aezap.site chegar ao seu servidor"
echo "A aplicação React detectará o subdomain e carregará o tenant correto"
echo ""

# 8. RLS POLICIES - VERIFICAÇÃO CRÍTICA
# ============================================================

echo ""
echo "🔒 STEP 8: Verificar que RLS Policies estão ativadas..."
echo ""
echo "No Supabase Dashboard:"
echo "  1. Vá para SQL Editor"
echo "  2. Execute:"
echo ""
echo "SELECT tablename FROM pg_tables WHERE schemaname='public';"
echo ""
echo "Para cada tabela, verificar que existe RLS habilitado:"
echo "ALTER TABLE table_name ENABLE ROW LEVEL SECURITY;"
echo ""
echo "3. Verifique que existem policies para isolamentos:"
echo "   - products (tenant_id)"
echo "   - orders (tenant_id)"
echo "   - neighborhoods (tenant_id)"
echo "   - customers (user_id ou tenant_id)"
echo "   - tenant_settings (tenant_id)"
echo ""

# 9. WEBHOOK RESEND (Opcional - melhor deliverability)
# ============================================================

echo ""
echo "📧 STEP 9 (Opcional): Configurar webhook Resend..."
echo ""
echo "Se quiser rastrear bounces/complaints:"
echo "  1. Vá a https://resend.com/webhooks"
echo "  2. Configure webhook para sua URL"
echo "  3. Receba eventos de delivery, bounce, etc"
echo ""

# 10. MONITORAMENTO
# ============================================================

echo ""
echo "📊 STEP 10: Monitoramento..."
echo ""
echo "Criar alertas para:"
echo "  - Erros em create-tenant (logs de Edge Function)"
echo "  - Falhas de send-welcome-email (Resend bounces)"
echo "  - Taxa de fallha na criação de tenants"
echo ""
echo "Verificar regularmente:"
echo "  - SELECT COUNT(*) FROM tenants"
echo "  - SELECT COUNT(*) FROM tenant_settings"
echo "  - Verificar RLS queries não resultam em acesso cruzado"
echo ""

echo ""
echo "✅ DEPLOYMENT COMPLETO!"
echo "🍕 Sistema multi-tenant pronto para produção!"
echo ""
