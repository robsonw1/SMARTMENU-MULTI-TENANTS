# 🍕 SMARTMENU - Multi-Tenant SaaS Platform

> **Plataforma completa de e-commerce multi-nicho para gestão de pedidos online** com suporte a múltiplos tipos de negócios: Pizzarias, Sorverias, Padarias, Hamburguerias, Mercados, etc.

[![GitHub Repo](https://img.shields.io/badge/GitHub-robsonw1%2FSMART--MENU--MULTI--TENANTS-blue?style=flat&logo=github)](https://github.com/robsonw1/SMARTMENU-MULTI-TENANTS)
[![Version](https://img.shields.io/badge/Version-10.0.0-brightgreen)]()
[![License](https://img.shields.io/badge/License-MIT-green)](LICENSE)

---

## 📋 Visão Geral

SMARTMENU é uma plataforma SaaS production-ready que oferece:

- ✅ **E-commerce completo** com carrinho de compras, checkout e múltiplas formas de pagamento
- ✅ **Multi-tenant isolado** com RLS (Row Level Security) garantido no PostgreSQL
- ✅ **Pagamentos integrados** (Mercado Pago OAuth, PIX automático)
- ✅ **Notificações em tempo real** (WhatsApp Business, Impressão térmica com PrintNode)
- ✅ **Sistema de fidelização** com pontos, cupons e cashback
- ✅ **Agendamento de pedidos** com horários customizáveis por tenant
- ✅ **Dashboard administrativo** completo para gestão de pedidos, produtos, relatórios
- ✅ **Sincronização em tempo real** via Supabase Realtime
- ✅ **Generalização multi-nicho** (não é mais apenas pizzaria!)
- ✅ **TypeScript 100%** com zero erros de compilação
- ✅ **PWA** (Progressive Web App) com suporte offline

---

## 🏗️ Arquitetura

### Diagrama de Sistema

```
┌─────────────────────────────────────────────────────────────┐
│                    Frontend (React 18)                       │
│  ├─ Vite (Builder)                                          │
│  ├─ TypeScript                                              │
│  ├─ shadcn-ui + Tailwind CSS                                │
│  └─ Zustand Store + React Query                             │
└────────────────────────┬────────────────────────────────────┘
                         │ HTTPS / WebSocket
        ┌────────────────┴────────────────┐
        ▼                                 ▼
┌──────────────────────┐      ┌────────────────────────┐
│  Supabase REST API   │      │ Supabase Realtime      │
│  (PostgreSQL)        │      │ (WebSocket)            │
└──────────────────────┘      └────────────────────────┘
        │
        ├─ Auth (JWT)
        ├─ RLS Policies (Multi-tenant)
        ├─ Edge Functions (Deno)
        └─ Storage (Logos, Imagens)

┌──────────────────────────────────────────┐
│     Edge Functions (Deno/Serverless)     │
├──────────────────────────────────────────┤
│ ✓ mercadopago-webhook                    │
│ ✓ mercadopago-payment                    │
│ ✓ validate-pix-payment                   │
│ ✓ printorder (Kitchen Receipt)           │
│ ✓ whatsapp-templates                     │
│ ✓ send-welcome-email                     │
│ ✓ send-reset-password-email              │
│ ✓ get-logo                               │
│ ✓ process-async-jobs                     │
│ ✓ process-cron                           │
│ + 18+ Edge Functions adicionais          │
└──────────────────────────────────────────┘

┌──────────────────────────────────────────┐
│      Integrações Externas                │
├──────────────────────────────────────────┤
│ ➢ Mercado Pago (OAuth + Webhooks)        │
│ ➢ WhatsApp Business API                  │
│ ➢ PrintNode (Impressoras Térmicas)       │
│ ➢ Firebase/Push Notifications (Opcional) │
└──────────────────────────────────────────┘
```

### Multi-Tenant Architecture

Isolamento garantido via:
- **RLS Policies** (3 camadas: service_role, authenticated, anonymous)
- **tenant_id** em TODAS as tabelas como Foreign Key
- **Supabase Auth** para autenticação por tenant
- **Supabase Storage** com path `{tenant_id}/{filename}`

---

## 🛠️ Stack Tecnológico

### Frontend
- **React 18** - UI Framework
- **Vite** - Build tool (lightning fast)
- **TypeScript** - Type safety
- **Tailwind CSS** - Styling
- **shadcn-ui** - Component library
- **Zustand** - State management
- **React Query** - Server state
- **React Router v6** - Routing
- **date-fns** - Date manipulation
- **Sonner** - Toast notifications

### Backend
- **Supabase** - PostgreSQL + Auth + Realtime
- **Deno** - Runtime para Edge Functions
- **PostgreSQL** - Banco de dados
- **PostgREST** - Auto-generated REST API

### Integrações
- **Mercado Pago API** - Pagamentos
- **WhatsApp Business API** - Notificações
- **PrintNode API** - Impressoras
- **Firebase** - Push notifications (opcional)

### Deploy & DevOps
- **Vercel** - Frontend hosting
- **Supabase** - Backend hosting
- **Docker** - Containerization
- **GitHub Actions** - CI/CD (opcional)

---

## 📁 Estrutura do Projeto

```
APP multi-tenants v10/
├── src/
│   ├── components/                 # React Components
│   │   ├── ui/                    # shadcn-ui components
│   │   ├── admin/                 # Admin-specific components
│   │   │   ├── OrderItemDetailsRenderer.tsx
│   │   │   ├── AdminDashboard.tsx
│   │   │   ├── CategoryManagementDialog.tsx
│   │   │   ├── AnalyticsPanel.tsx
│   │   │   ├── WhatsAppSettingsPanel.tsx
│   │   │   └── ... (20+ more)
│   │   ├── CartDrawer.tsx
│   │   ├── CheckoutModal.tsx
│   │   ├── ProductModal.tsx
│   │   ├── DynamicMetaTags.tsx    # Meta tags com logo dinâmico
│   │   └── ... (30+ more)
│   ├── pages/
│   │   ├── Index.tsx              # Catálogo de produtos
│   │   ├── AdminDashboard.tsx     # Admin dashboard
│   │   ├── AdminLogin.tsx
│   │   ├── PasswordReset.tsx
│   │   ├── RegisterTenantPage.tsx # Tenant onboarding
│   │   └── SuperAdminDashboard.tsx
│   ├── hooks/                      # Custom React Hooks
│   │   ├── use-admin-auth.ts
│   │   ├── use-settings-realtime-sync.ts
│   │   ├── use-admin-realtime-sync.ts
│   │   ├── use-customer-onboarding.ts
│   │   ├── use-tenant-settings.ts
│   │   ├── useAppUrl.ts
│   │   └── ... (15+ more)
│   ├── store/                      # Zustand stores
│   │   ├── useOrdersStore.ts      # Gerencia pedidos
│   │   ├── useSettingsStore.ts    # Configurações do tenant
│   │   ├── useLoyaltyStore.ts     # Programa de fidelização
│   │   ├── useStore.ts            # Estado global
│   │   └── ... (5+ more)
│   ├── data/
│   │   └── products.ts            # Tipos genéricos (itemType, comboItems, etc)
│   ├── lib/
│   │   ├── tenant-resolver.ts     # Multi-tenant resolver
│   │   ├── diagnostic-settings.ts
│   │   └── ... (utilities)
│   ├── integrations/
│   │   └── supabase/
│   │       ├── client.ts
│   │       └── types.ts           # Tipos do banco
│   └── assets/
│       ├── logo.jpg               # Logo genérico
│       ├── hero.jpg               # Hero dinâmico
│       └── ...
├── supabase/
│   ├── functions/                  # 28+ Deno Edge Functions
│   │   ├── mercadopago-webhook/
│   │   ├── mercadopago-payment/
│   │   ├── validate-pix-payment/
│   │   ├── printorder/             # Kitchen receipt
│   │   ├── whatsapp-templates/
│   │   ├── send-welcome-email/
│   │   ├── get-logo/
│   │   ├── process-async-jobs/
│   │   ├── process-cron/
│   │   └── ... (18+ more)
│   ├── migrations/                 # 63+ Database migrations
│   │   ├── 20260330_add_tenant_isolation_*.sql
│   │   ├── 20260331_auto_create_tenant_settings*.sql
│   │   ├── 20260401_consolidate_tenant_settings.sql
│   │   └── ... (60+ more)
│   └── config.toml
├── public/
│   ├── service-worker.js
│   ├── favicon.ico
│   └── manifest.json
├── package.json
├── vite.config.ts
├── tsconfig.json
├── tailwind.config.ts
├── postcss.config.js
├── README.md
└── Dockerfile
```

---

## 🚀 Quick Start

### Pré-requisitos

- **Node.js** >= 18 (recomendado usar nvm)
- **npm** ou **bun**
- **Git**
- **Conta Supabase** (https://supabase.com)
- **Conta Mercado Pago** (para pagamentos)
- **Conta Twilio/WhatsApp Business API** (para notificações)

### Instalação Local

```bash
# 1. Clone o repositório
git clone https://github.com/robsonw1/SMARTMENU-MULTI-TENANTS.git
cd SMARTMENU-MULTI-TENANTS

# 2. Instale dependências
npm install
# Ou com bun
bun install

# 3. Configure environment variables
cp .env.example .env.local
# Edite .env.local com suas credenciais

# 4. Inicie o servidor de desenvolvimento
npm run dev
# Ou com bun
bun run dev

# 5. Abra no navegador
# http://localhost:5173
```

### Estrutura do `.env.local`

```env
# Supabase
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=seu-anon-key-aqui

# Mercado Pago (para webhook)
MERCADO_PAGO_ACCESS_TOKEN=seu-token-aqui
MERCADO_PAGO_CLIENT_ID=seu-client-id

# Opcional: WhatsApp Business API
WHATSAPP_BUSINESS_ACCOUNT_ID=seu-account-id
WHATSAPP_BUSINESS_API_TOKEN=seu-token

# Opcional: PrintNode
PRINTNODE_API_KEY=sua-chave-api

# App
VITE_APP_URL=http://localhost:5173
```

---

## 🗄️ Banco de Dados (Supabase)

### Tabelas Principais

| Tabela | Descrição | tenant_id |
|--------|-----------|-----------|
| `tenants` | Cada negócio/franquia | PK |
| `settings` | Configurações por tenant | FK |
| `products` | Produtos do catálogo | FK |
| `categories` | Categorias de produtos | FK |
| `orders` | Pedidos dos clientes | FK |
| `order_items` | Itens de cada pedido | FK |
| `customers` | Clientes/Usuários | FK |
| `loyalty_transactions` | Transações de pontos | FK |
| `loyalty_settings` | Config de fidelização | FK |
| `coupons` | Cupons de desconto | FK |
| `neighborhoods` | Bairros para entrega | FK |
| `whatsapp_status_messages` | Templates WhatsApp | FK |
| `pending_pix_orders` | PIX pendentes | FK |
| `async_jobs_queue` | Fila de jobs | FK |

### RLS (Row Level Security)

**3 Camadas de Acesso:**

1. **service_role** - Acesso total (Backend)
2. **authenticated** - Acesso restrito ao tenant do usuário
3. **anonymous** - Leitura pública apenas (catalogo)

**Exemplo de Policy:**

```sql
CREATE POLICY "Users can only read their own tenant data"
ON products
FOR SELECT
USING (
  (SELECT auth.uid()) IS NOT NULL 
  AND tenant_id = (
    SELECT tenant_id FROM auth.users 
    WHERE id = auth.uid()
  )
);
```

---

## ⚙️ Edge Functions (Servidor)

### Functions Disponíveis

**Payment Processing:**
- `mercadopago-webhook` - Confirma pagamentos do Mercado Pago
- `mercadopago-payment` - Inicia pagamento
- `validate-pix-payment` - Valida PIX
- `confirm-payment-and-add-points` - Registra pontos de fidelização

**Notifications:**
- `whatsapp-templates` - Envia mensagens WhatsApp
- `send-welcome-email` - Email de boas-vindas
- `send-reset-password-email` - Email de reset
- `printorder` - Envia pedido para impressora térmica

**Utilities:**
- `get-logo` - Retorna logo do tenant
- `get-manifest` - Retorna manifest.json dinâmico
- `create-neighborhood` - Cria bairro para delivery
- `update-admin-settings` - Atualiza config do tenant
- `process-async-jobs` - Processa jobs em fila
- `process-cron` - Processa tarefas agendadas
- `queue-monitor` - Monitora fila de jobs
- `render-html` - Renderiza HTML para email

### Deploy de Edge Functions

```bash
# 1. Login no Supabase
supabase login

# 2. Link projeto local ao projeto Supabase
supabase link --project-ref seu-projeto-ref

# 3. Deploy functions
supabase functions deploy mercadopago-webhook
supabase functions deploy printorder
# ... deploy todas as functions

# 4. Definir secrets (variáveis de ambiente)
supabase secrets set MERCADO_PAGO_ACCESS_TOKEN=seu-token
supabase secrets set PRINTNODE_API_KEY=sua-chave
```

---

## 💳 Integrações

### Mercado Pago

**OAuth Flow:**

1. Tenant acessa "Conectar Mercado Pago"
2. Redireciona para OAuth do Mercado Pago
3. Retorna com `access_token` salvo no Supabase
4. Pagamentos processados via `mercadopago-webhook`

**PIX Automático:**

- Webhook valida confirmação de PIX a cada 5s
- Se confirmado, cria pedido e notifica WhatsApp

### WhatsApp Business API

**Templates configurados:**

- `order_confirmation` - Confirmação de pedido
- `payment_confirmated` - Pagamento confirmado
- `order_ready` - Pedido pronto
- `order_delivered` - Pedido entregue

**Envio:**

```typescript
// Edge Function envia automaticamente via Supabase
const response = await fetch('https://seu-projeto.supabase.co/functions/v1/whatsapp-templates', {
  method: 'POST',
  body: JSON.stringify({
    template_name: 'order_confirmation',
    phone: '+5511999999999',
    variables: { order_id: '123', total: '50.00' }
  })
});
```

### PrintNode (Impressoras Térmicas)

**Suportado:**

- Impressoras térmicas (58mm ou 80mm)
- Endereço IP na rede local
- Formato de ticket customizável

**Fluxo:**

```
Pedido confirmado → mercadopago-webhook → printorder → PrintNode API → Impressora
```

---

## 🎯 Features Principais

### 🛒 E-Commerce
- [ ] Catálogo de produtos por categoria
- [ ] Carrinho de compras persistente
- [ ] Checkout com múltiplas etapas
- [ ] Cupons e promoções
- [ ] Produtos com variações (meia-meia, complementos)

### 💰 Pagamentos
- [ ] Mercado Pago (Débito/Crédito)
- [ ] PIX e QR Code dinâmico
- [ ] Dinheiro (na entrega)
- [ ] Cashback em pontos
- [ ] Múltiplos métodos simultâneos

### 🎁 Fidelização
- [ ] Programa de pontos
- [ ] Histórico de transações
- [ ] Resgate de cupons
- [ ] Cashback automático
- [ ] Status VIP (cliente fiel)

### 🚚 Entrega
- [ ] Horários de funcionamento customizáveis
- [ ] Agendamento de pedidos
- [ ] Cálculo automático de taxa de delivery
- [ ] Bairros com regras diferentes
- [ ] Rastreamento em tempo real (opcional)

### 📊 Admin Dashboard
- [ ] Gestão de pedidos em tempo real
- [ ] Relatórios e análises
- [ ] Gestão de produtos e categorias
- [ ] Configuração de horários
- [ ] Integração Mercado Pago
- [ ] Templates WhatsApp
- [ ] Configuração de impressoras
- [ ] Loyalty settings

### 👥 Clientes
- [ ] Login/Registro
- [ ] Perfil customizável
- [ ] Histórico de pedidos
- [ ] Endereços salvos
- [ ] Programa de fidelização
- [ ] Notificações de pedidos

### 🔐 Segurança
- [ ] Autenticação JWT via Supabase
- [ ] RLS em TODAS as operações
- [ ] CORS configurado
- [ ] Webhook secrets validados
- [ ] Rate limiting (opcional)
- [ ] HTTPS obrigatório

---

## 📱 Generalização Multi-Nicho

O projeto foi generalizado de "Pizzaria Forneiro Eden" para suportar:

- 🍕 Pizzarias
- 🍦 Sorverias
- 🥐 Padarias
- 🍔 Hamburguerias
- 🍱 Restaurantes
- 🛒 Mercados
- 🎂 Confeitarias
- E qualquer outro negócio de food/retail!

### Como Funciona

1. **Tipos Genéricos** - `itemType`, `comboItems`, `itemNumber` (não mais `pizzaType`, `comboPizzas`)
2. **Logos Dinâmicos** - Cada tenant tem seu logo em `Supabase Storage`
3. **Branding Customizável** - Nome, cores, horários por tenant
4. **Labels Genéricos** - "Produtos", "Sabores", "Adicionar ao Carrinho" (não pizzas!)
5. **Backward Compatibility** - Código antigo ainda funciona via aliases

---

## 🔄 Sincronização em Tempo Real

### Realtime Subscriptions

```typescript
// Hook automático usa realtime do Supabase
const { orders } = useOrdersRealtime(tenantId);

// Atualiza:
// - Novos pedidos aparecem instantaneamente
// - Status de pedido (novo, preparando, pronto, entregue)
// - Alterações de configuração
```

### WebSocket Connection

- Supabase Realtime (WebSocket)
- Fallback para polling se necessário
- Auto-reconnect em desconexão

---

## 🚀 Deployment

### Frontend (Vercel)

```bash
# 1. Push para GitHub
git push origin main

# 2. Vercel auto-deploy
# Configurado via vercel.json

# 3. Custom domain
# Acesse Vercel Dashboard > Settings > Domains
```

### Backend (Supabase)

```bash
# Supabase CLI
supabase login
supabase link --project-ref seu-projeto

# Deploy migrations
supabase db push

# Deploy functions
supabase functions deploy --all

# Deploy storage
supabase storage buckets create logos --public
```

### Docker (Self-hosted)

```bash
# Build
docker build -t smartmenu:latest .

# Run
docker run -p 5173:5173 \
  -e VITE_SUPABASE_URL=... \
  -e VITE_SUPABASE_ANON_KEY=... \
  smartmenu:latest
```

---

## 📊 Estatísticas do Projeto

| Métrica | Valor |
|---------|-------|
| **Componentes React** | 50+ |
| **Edge Functions** | 28+ |
| **Migrations Database** | 63 |
| **Custom Hooks** | 18+ |
| **Zustand Stores** | 7 |
| **Linhas de TypeScript** | 15,000+ |
| **TypeScript Errors** | 0 ⭐ |
| **Test Coverage** | Planejado |

---

## 🤝 Como Contribuir

1. **Fork** o repositório
2. **Clone** localmente: `git clone https://github.com/seu-usuario/SMARTMENU.git`
3. **Crie uma branch**: `git checkout -b feature/nova-feature`
4. **Commit**: `git commit -am 'feat: adiciona nova feature'`
5. **Push**: `git push origin feature/nova-feature`
6. **Abra um Pull Request**

### Padrões de Código

- **TypeScript** - Sempre
- **Componentes Funcionais** - Não class components
- **Hooks Customizados** - Para lógica compartilhada
- **Zustand** - Para state global
- **Tailwind + shadcn** - Para UI

---

## 📚 Documentação Adicional

- [Guia de Arquitetura Multi-Tenant](./docs/ARCHITECTURE.md)
- [Guia de Deployment](./docs/DEPLOYMENT.md)
- [Guia de Integrações](./docs/INTEGRATIONS.md)
- [API Reference](./docs/API.md)
- [Troubleshooting](./docs/TROUBLESHOOTING.md)

---

## 🐛 Reportar Bugs

Encontrou um bug? Abra uma issue em: [GitHub Issues](https://github.com/robsonw1/SMARTMENU-MULTI-TENANTS/issues)

**Inclua:**
- Descrição do problema
- Steps para reproduzir
- Expected vs actual behavior
- Screenshots/logs

---

## 📝 Changelog

### v10.0.0 (Abril 2026)
- ✨ Generalização multi-nicho (não apenas pizzarias!)
- ✨ 17 novas migrations com RLS policies
- ✨ 8 novas Edge Functions
- ✨ Logos dinâmicos por tenant
- ✨ TypeScript 100% (0 erros)
- 🔧 Corrigido printorder (variable references)
- 🔧 Sincronizado Edge Functions com tipos genéricos
- 📦 Cleanup de 41 arquivos temporários

### v9.0.0 (Março 2026)
- Implementação inicial de multi-tenant
- Supabase RLS policies
- Mercado Pago integration
- WhatsApp notifications

---

## 📄 Licença

Este projeto é licenciado sob a **MIT License** - veja [LICENSE](LICENSE) para detalhes.

---

## 👨‍💻 Autor

**Robson W**
- GitHub: [@robsonw1](https://github.com/robsonw1)
- Email: contato@example.com

---

## 🙏 Agradecimentos

- [Supabase](https://supabase.com) - Backend
- [Vercel](https://vercel.com) - Frontend hosting
- [shadcn/ui](https://ui.shadcn.com) - Components
- [Tailwind CSS](https://tailwindcss.com) - Styling
- [React](https://react.dev) - Framework

---

## 📞 Suporte

Precisa de ajuda?

- **Documentação**: https://smartmenu-docs.example.com
- **Discord Community**: https://discord.gg/smartmenu
- **Email**: support@smartmenu.example.com
- **GitHub Discussions**: https://github.com/robsonw1/SMARTMENU-MULTI-TENANTS/discussions

---

**Feito com ❤️ para transformar negócios de food & retail**
