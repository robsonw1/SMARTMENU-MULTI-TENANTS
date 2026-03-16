📋 CHECKLIST FINAL - PUSH NOTIFICATIONS

## ✅ VERIFICAÇÕES COMPLETADAS

1. ✅ use-push-notifications.ts
   - savePushSubscription corrigido (INSERT/UPDATE com error handling)
   - subscribeToPush agora usa VITE_VAPID_PUBLIC_KEY (vai vir do .env.local)
   - requestNotificationPermission chama subscribeToPush após permissão
   - Logs detalhados em cada etapa

2. ✅ use-orders-notification.ts
   - triggerPushNotification chama Edge Function corretamente
   - Não bloqueia realtime (usa queueMicrotask)

3. ✅ send-push-notification/index.ts (Edge Function)
   - Verifica se VAPID_PRIVATE_KEY e VAPID_PUBLIC_KEY estão em Secrets
   - Envia para cada subscription
   - Remove subscriptions expiradas (410)
   - Logs detalhados

4. ✅ Migrations RLS
   - add_push_subscriptions_table.sql - permite cliente INSERT sua subscription
   - fix_push_subscriptions_rls_2025_03_16.sql - permite service_role ler subscriptions

5. ✅ PushNotificationPrompt renderizado em App.tsx

---

## 🔴 O QUE O USUÁRIO PRECISA FAZER

### 1️⃣ Criar .env.local na raiz do projeto
```
VITE_VAPID_PUBLIC_KEY=<COPIAR_CHAVE_PUBLICA>
```

### 2️⃣ Gerar VAPID Keys (Terminal uma única vez)
```bash
npm install -g web-push
web-push generate-vapid-keys
```

Vai aparecer:
```
Public Key: BL...
Private Key: <muito longo>
```

COPIAR:
- Public Key → colar em .env.local como VITE_VAPID_PUBLIC_KEY
- Private Key → colar em Supabase Secrets como VAPID_PRIVATE_KEY

### 3️⃣ Supabase Dashboard → Settings → Secrets
Adicionar 2 secrets:

**Secret 1:**
- Key: VAPID_PUBLIC_KEY
- Value: <copiar da chave pública gerada>

**Secret 2:**
- Key: VAPID_PRIVATE_KEY  
- Value: <copiar da chave privada gerada>

### 4️⃣ Supabase SQL Editor
Executar:
```sql
CREATE POLICY "Service role can read push subscriptions for notifications"
  ON public.push_subscriptions
  FOR SELECT
  USING (auth.role() = 'service_role');

CREATE POLICY "Service role can update push subscriptions"
  ON public.push_subscriptions
  FOR UPDATE
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
```

### 5️⃣ Deploy Edge Function
```bash
supabase functions deploy send-push-notification
```

### 6️⃣ Fazer npm run build e deploy para produção

---

## 🧪 COMO TESTAR

1. Abrir app no navegador
2. Customer faz login
3. Prompt "Notificações do seu Pedido" aparece (após 2 segundos)
4. Click "Ativar"
5. Permitir notificação no navegador
6. ✅ Deve ver "[PUSH] ✅ Subscription salva no banco" no console (F12)
7. Admin muda status do pedido para "preparing" ou outro
8. ✅ Notificação deve aparecer no navegador do cliente

---

## 🐛 DEBUG SE NÃO FUNCIONAR

Se subscription não está sendo salvo:
- F12 → Console
- Procurar por [PUSH]  
- Se vir erro, copiar e enviar

Se notificação não chega após status mudar:
- Supabase Dashboard → Logs → Functions
- Ver logs da Edge Function send-push-notification

Se subscription foi salvo mas status não muda:
- Verificar em use-orders-notification.ts se triggerPushNotification está sendo chamado
- Console deve mostrar [ORDERS-NOTIFICATION] 📱 Enviando push

---

## 🚀 ORDEM CORRETA DE EXECUÇÃO

1. Gerar VAPID keys (terminal)
2. Criar .env.local com chave pública
3. Adicionar chaves em Supabase Secrets
4. Executar SQL no Supabase
5. Deploy Edge Function
6. Fazer npm run build
7. Deploy para produção
8. Testar no navegador
