# 🚀 PROMPT - Implementar Modelo 2 (Automático) - Copiar e Colar

**Quando estiver com 5-10 clientes, copie e cole exatamente isso:**

---

Implemente o **Modelo 2 (Automático) de Onboarding de Estabelecimentos** no app. Aqui está exatamente o que precisa fazer:

## 🎯 Requisitos

### 1️⃣ **Criar Página de Onboarding Automático**
- Rota: `/onboarding` (pública, após compra)
- Form com campos:
  - Nome do estabelecimento (já preenchido do email de compra se possível)
  - Email do dono
  - Telefone
  - Tipo de pizza (inteira, meia-meia, ambas, customizado)
  - Horário de funcionamento (segunda a domingo)
  - Logo/Foto do estabelecimento (upload)
- Botão: "Criar Meu App Agora"

### 2️⃣ **Criar Tenant Automaticamente**
- Ao submeter form, inserir em tabela `tenants`:
  - `id`: UUID automático
  - `name`: Nome do estabelecimento
  - `subdomain`: auto-gerar de formato "seu-nome-aqui"
  - `email`: Email do dono
  - `phone`: Telefone
  - `logo_url`: URL da foto uploadada
  - `business_type`: tipo de pizza (inteira/meia/customizado)
  - `schedule`: JSON com horários
  - `created_at`: now()
  - `created_by`: ID do comprador
  - `status`: 'pending_setup' (até configurar token MP e impressora)
- Gerar senha aleatória (send via email)

### 3️⃣ **Upload de Logo**
- Usar Supabase Storage (bucket: `logos`)
- Path: `{tenant_id}/{filename}`
- Retornar URL pública

### 4️⃣ **Criar Subdomínio/Página com contexto do Tenant**
- Adicionar `subdomain` ao detectar tenant no frontend
- No `App.tsx`: Detectar tenant por:
  ```
  const subdomain = window.location.hostname.split('.')[0];
  const tenant = await fetchTenant(subdomain);
  ```
- Aplicar styles/configs do tenant:
  - Logo customizada
  - Horários específicos
  - Regras de negócio (meia-meia sim/não)
  - Tipo de cardápio

### 5️⃣ **Redirecionar Automático**
- Após criar tenant → redirecionar para:
  ```
  https://{subdomain}.seu-dominio.com/admin
  ```
- Login pré-preenchido com email + senha aleatória enviada
- Primeira coisa: Tutorial obrigatório (15 min)
  - Como adicionar token Mercado Pago
  - Como encontrar ID PrintNode
  - Como customizar cardápio
  - Como habilitar/desabilitar meia-meia

### 6️⃣ **Validação por Tenant em Toda Parte**
- Auditar todas as queries para ter `.eq('tenant_id', currentTenantId)`
- Adicionar logs de segurança quando tenant_id não match
- Testar cross-tenant (simular 2 tenants simultâneos)

### 7️⃣ **Testes Críticos**
- ✅ Criar 2 tenants simultâneos
- ✅ Verificar dados não vazam entre tenants
- ✅ Validar subdomínios funcionam
- ✅ Testar RLS está bloqueando dados cruzados
- ✅ Mercado Pago pega token correto de cada tenant
- ✅ Admin dashboard mostra SÓ dados do seu tenant

## 🛠️ Stack/Libs Que Pode Precisar
- `uuid.v4()` para subdomain
- Supabase Storage para uploads
- Email service (Resend ou SendGrid) para nova senha
- Dynamic subdomains (Vercel/Next.js suposta)

## ⚠️ Pontos Críticos
1. **NUNCA** use `limit(1)` sem filtro tenant_id
2. **SEMPRE** valide que `auth.user.tenant_id === requested_tenant_id`
3. **Logo URL** deve ser pública e servir rápido (CDN)
4. **Subdomínios** precisam estar configurados no DNS antes de mexer
5. **Senhas aleatórias** precisam ser força 12+ chars

## 📝 Schema SQL Adicional (se precisar)
```sql
-- Já existe, mas valide:
ALTER TABLE tenants ADD COLUMN IF NOT EXISTS (
  subdomain VARCHAR UNIQUE NOT NULL,
  business_type VARCHAR DEFAULT 'tradicional',
  logo_url TEXT,
  status VARCHAR DEFAULT 'pending_setup'
);

-- Criar index para subdomínio (importante)
CREATE INDEX IF NOT EXISTS idx_tenants_subdomain ON tenants(subdomain);
```

---

## ✅ Checklist Final
- [ ] Página de onboarding criada
- [ ] Tenant criado automaticamente
- [ ] Logo uploadada no Storage
- [ ] Subdomínio funcionando
- [ ] Redirecionamento automático ok
- [ ] Validação tenant_id em todas queries
- [ ] Tutorial obrigatório implementado
- [ ] 2 tenants simultâneos testados
- [ ] RLS validado (sem data leak)
- [ ] Email com senha aleatória enviado
- [ ] Admin dashboard isolado por tenant
- [ ] Mercado Pago pega token correto

---

**Quando estiver pronto com isso acima, copie E COLE este prompt inteiro novamente comigo que eu implemento tudo.**
