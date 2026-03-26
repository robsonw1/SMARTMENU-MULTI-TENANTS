import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
import { useLoyaltySettingsStore } from './useLoyaltySettingsStore';

export interface Customer {
  id: string;
  email: string;
  cpf?: string;
  name?: string;
  phone?: string;
  totalPoints: number;
  totalSpent: number;
  totalPurchases: number;
  isRegistered: boolean;
  registeredAt?: string;
  createdAt: string;
  lastPurchaseAt?: string;
  // Endereço padrão de entrega
  street?: string;
  number?: string;
  complement?: string;
  neighborhood?: string;
  city?: string;
  zipCode?: string;
}

export interface LoyaltyTransaction {
  id: string;
  customerId: string;
  orderId?: string;
  pointsEarned?: number;
  pointsSpent?: number;
  transactionType: 'purchase' | 'redemption' | 'signup_bonus';
  description: string;
  createdAt: string;
}

export interface LoyaltyCoupon {
  id: string;
  customerId: string;
  couponCode: string;
  discountPercentage?: number;
  discountAmount?: number;
  pointsThreshold: number;
  isActive: boolean;
  isUsed: boolean;
  usedAt?: string;
  expiresAt?: string;
  createdAt: string;
}

interface LoyaltyStore {
  currentCustomer: Customer | null;
  points: number;
  pointsToRedeem: number;
  transactions: LoyaltyTransaction[];
  coupons: LoyaltyCoupon[];
  activeCoupon: LoyaltyCoupon | null;
  isRemembered: boolean;
  
  // Actions
  findOrCreateCustomer: (email: string) => Promise<Customer | null>;
  registerCustomer: (email: string, cpf: string, name: string, phone?: string) => Promise<boolean>;
  registerCustomerWithoutBonus: (email: string, cpf: string, name: string, phone?: string) => Promise<boolean>;
  addPointsFromPurchase: (customerId: string, amount: number, orderId: string, pointsRedeemed?: number) => Promise<void>;
  addSignupBonus: (customerId: string) => Promise<void>;
  redeemPoints: (customerId: string, pointsToSpend: number) => Promise<{ success: boolean; discountAmount: number }>;
  getCustomerByEmail: (email: string) => Promise<Customer | null>;
  setCurrentCustomer: (customer: Customer | null) => void;
  setPointsToRedeem: (points: number) => void;
  getTransactionHistory: (customerId: string) => Promise<LoyaltyTransaction[]>;
  refreshCurrentCustomer: (customerId?: string) => Promise<void>;
  
  // Login/Logout
  loginCustomer: (email: string, cpf: string, rememberMe?: boolean) => Promise<boolean>;
  logoutCustomer: () => Promise<void>;
  restoreRememberedLogin: () => Promise<boolean>;
  saveDefaultAddress: (address: {
    street: string;
    number: string;
    complement?: string;
    neighborhood: string;
    city: string;
    zipCode: string;
  }) => Promise<boolean>;
  
  // Coupon actions
  generateAutoCoupon: (customerId: string) => Promise<LoyaltyCoupon | null>;
  getCoupons: (customerId: string) => Promise<LoyaltyCoupon[]>;
  useCoupon: (couponId: string) => Promise<boolean>;
}

const getPointsPerReal = () => useLoyaltySettingsStore.getState().settings?.pointsPerReal ?? 1;
const getPointsValue = () => useLoyaltySettingsStore.getState().settings?.discountPer100Points ?? 5;
const getSignupBonusPoints = () => useLoyaltySettingsStore.getState().settings?.signupBonusPoints ?? 50;
const getMinPointsToRedeem = () => useLoyaltySettingsStore.getState().settings?.minPointsToRedeem ?? 50;

// Helper para obter hora local em formato ISO string sem timezone
const getLocalISOString = (): string => {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const date = String(now.getDate()).padStart(2, '0');
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  const seconds = String(now.getSeconds()).padStart(2, '0');
  return `${year}-${month}-${date}T${hours}:${minutes}:${seconds}`;
};

// 🔒 NORMALIZAR EMAIL: Lowercase + Trim + Remove acentos (URGENTE #6)
// Evita múltiplas contas do mesmo cliente com variações de email
const normalizeEmail = (email: string): string => {
  return email
    .toLowerCase()
    .trim()
    .normalize('NFD')                           // Remove acentos
    .replace(/[\u0300-\u036f]/g, '');          // Remove diacríticos
};

export const useLoyaltyStore = create<LoyaltyStore>((set, get) => ({
  currentCustomer: null,
  points: 0,
  pointsToRedeem: 0,
  transactions: [],
  coupons: [],
  activeCoupon: null,
  isRemembered: false,

  findOrCreateCustomer: async (email: string) => {
    try {
      // 🔒 Normalizar email para evitar múltiplas contas (URGENTE #6)
      const normalizedEmail = normalizeEmail(email);
      
      // Procurar cliente existente
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('email', normalizedEmail)
        .single();

      if (error && error.code !== 'PGRST116') {
        console.error('Erro ao buscar cliente:', error);
        return null;
      }

      if (data) {
        const customer = mapCustomerFromDB(data);
        set({ currentCustomer: customer, points: customer.totalPoints });
        return customer;
      }

      // ❌ NÃO criar cliente automaticamente aqui
      // Cliente será criado MANUALMENTE quando cliente preencher CPF no popupde signup
      // Retornar null se cliente não encontrado (apenas procura, não cria)
      console.log('ℹ️ [LOYALTY] Cliente anônimo - nenhuma conta encontrada com email:', normalizedEmail);
      return null;
    } catch (error) {
      console.error('Erro em findOrCreateCustomer:', error);
      return null;
    }
  },

  registerCustomer: async (email: string, cpf: string, name: string, phone?: string) => {
    try {
      // 🔒 Normalizar email (URGENTE #6)
      const normalizedEmail = normalizeEmail(email);
      
      console.log('registerCustomer chamado com:', { normalizedEmail, cpf, name, phone });

      // Usar UPSERT para garantir que os dados sejam salvos mesmo se o email for diferente
      const { data, error } = await (supabase as any)
        .from('customers')
        .upsert(
          {
            email: normalizedEmail,
            cpf,
            name,
            phone: phone || null,
            is_registered: true,
            registered_at: getLocalISOString(),
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (error) {
        console.error('Erro ao registrar cliente (upsert):', error);
        return false;
      }

      console.log('Cliente registrado com sucesso:', data);

      // Adicionar bônus de signup
      await get().addSignupBonus(normalizedEmail);

      // Recarregar dados do cliente
      const customer = await get().getCustomerByEmail(normalizedEmail);
      if (customer) {
        set({ currentCustomer: customer, points: customer.totalPoints });
      }

      return true;
    } catch (error) {
      console.error('Erro em registerCustomer:', error);
      return false;
    }
  },

  registerCustomerWithoutBonus: async (email: string, cpf: string, name: string, phone?: string) => {
    try {
      // 🔒 Normalizar email (URGENTE #6)
      const normalizedEmail = normalizeEmail(email);
      
      console.log('registerCustomerWithoutBonus chamado com:', { normalizedEmail, cpf, name, phone });

      // Usar UPSERT para garantir que os dados sejam salvos mesmo se o email for diferente
      const { data, error } = await (supabase as any)
        .from('customers')
        .upsert(
          {
            email: normalizedEmail,
            cpf,
            name,
            phone: phone || null,
            is_registered: true,
            registered_at: getLocalISOString(),
          },
          { onConflict: 'email' }
        )
        .select()
        .single();

      if (error) {
        console.error('Erro ao registrar cliente sem bônus (upsert):', error);
        return false;
      }

      console.log('Cliente registrado com sucesso (sem bônus):', data);

      // ✅ NÃO adiciona bônus de signup - apenas registro simples
      // Recarregar dados do cliente
      const customer = await get().getCustomerByEmail(normalizedEmail);
      if (customer) {
        set({ currentCustomer: customer, points: customer.totalPoints });
      }

      return true;
    } catch (error) {
      console.error('Erro em registerCustomerWithoutBonus:', error);
      return false;
    }
  },

  addSignupBonus: async (emailOrId: string) => {
    try {
      // Procurar cliente por email ou id
      let customerId: string;
      
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('id, total_points, received_signup_bonus')
        .eq(emailOrId.includes('@') ? 'email' : 'id', emailOrId)
        .single();

      if (error || !data) {
        console.error('Cliente não encontrado para bônus:', error);
        return;
      }

      customerId = data.id;

      // Verificar se já recebeu bônus
      if (data.received_signup_bonus) {
        console.log('ℹ️ Cliente já recebeu bônus de signup');
        return;
      }

      const signupBonus = getSignupBonusPoints();
      
      // Calcular data de expiração dos pontos
      const expirationDays = useLoyaltySettingsStore.getState().settings?.pointsExpirationDays ?? 365;
      const expiresAtDate = new Date();
      expiresAtDate.setDate(expiresAtDate.getDate() + expirationDays);
      const expiresAtISO = expiresAtDate.toISOString();

      // Adicionar pontos ao total existente
      const newTotalPoints = (data.total_points || 0) + signupBonus;

      // Atualizar pontos e marcar como recebido
      await (supabase as any)
        .from('customers')
        .update({ 
          total_points: newTotalPoints,
          received_signup_bonus: true,
        })
        .eq('id', customerId);

      // Registrar transação com hora local e data de expiração
      await (supabase as any)
        .from('loyalty_transactions')
        .insert([{
          customer_id: customerId,
          points_earned: signupBonus,
          transaction_type: 'signup_bonus',
          description: `Bônus de cadastro - ${signupBonus} pontos`,
          created_at: getLocalISOString(),
          expires_at: expiresAtISO,
        }]);

      console.log('✅ Bônus de signup adicionado:', signupBonus, 'pontos | Total:', newTotalPoints);
    } catch (error) {
      console.error('Erro em addSignupBonus:', error);
    }
  },

  addPointsFromPurchase: async (customerId: string, amount: number, orderId: string, pointsRedeemed: number = 0) => {
    try {
      // 🔑 REGRA: Se cliente usou pontos para desconto, não ganha pontos nesta compra
      if (pointsRedeemed > 0) {
        console.log('⏭️ [POINTS] Pontos para compra NÃO adicionados', {
          reason: 'Cliente usou desconto de pontos nesta compra',
          pointsRedeemed,
          rule: 'Se pontos foram resgatados, não é possível ganhar novos pontos'
        });
        return;
      }

      const pointsPerReal = getPointsPerReal();
      const pointsEarned = Math.floor(amount * pointsPerReal);

      console.log('💰 [POINTS] Adicionando novos pontos da compra', {
        customerId,
        amount,
        pointsPerReal,
        pointsEarned,
        rule: 'Cliente NÃO usou desconto de pontos - pode ganhar novos pontos'
      });

      // Buscar pontos atuais do cliente
      const { data: customerData, error: fetchError } = await (supabase as any)
        .from('customers')
        .select('total_points, total_spent, total_purchases')
        .eq('id', customerId)
        .single();

      if (fetchError || !customerData) {
        console.error('Erro ao buscar cliente:', fetchError);
        return;
      }

      const newTotalPoints = (customerData.total_points || 0) + pointsEarned;
      const newTotalSpent = (customerData.total_spent || 0) + amount;
      const newTotalPurchases = (customerData.total_purchases || 0) + 1;
      const isFirstPurchase = (customerData.total_purchases || 0) === 0;

      const localISO = getLocalISOString();

      // Calcular data de expiração dos pontos
      const expirationDays = useLoyaltySettingsStore.getState().settings?.pointsExpirationDays ?? 365;
      const expiresAtDate = new Date();
      expiresAtDate.setDate(expiresAtDate.getDate() + expirationDays);
      const expiresAtISO = expiresAtDate.toISOString();

      // Atualizar total de pontos e gasto
      await (supabase as any)
        .from('customers')
        .update({
          total_points: newTotalPoints,
          total_spent: newTotalSpent,
          total_purchases: newTotalPurchases,
          last_purchase_at: localISO,
        })
        .eq('id', customerId);

      // Registrar transação com hora local e data de expiração
      await (supabase as any)
        .from('loyalty_transactions')
        .insert([{
          customer_id: customerId,
          order_id: orderId,
          points_earned: pointsEarned,
          transaction_type: 'purchase',
          description: `Compra no valor de R$ ${amount.toFixed(2)} - ${pointsEarned} pontos`,
          created_at: localISO,
          expires_at: expiresAtISO,
        }]);

      // Nota: Cupons agora são gerados manualmente pelo admin via painel de controle

      console.log('✅ [POINTS] Pontos adicionados com sucesso', {
        pointsEarned,
        totalPoints: newTotalPoints,
        totalSpent: newTotalSpent,
        message: `${pointsEarned} pontos ganhos | Total agora: ${newTotalPoints}`
      });
    } catch (error) {
      console.error('Erro em addPointsFromPurchase:', error);
    }
  },

  redeemPoints: async (customerId: string, pointsToSpend: number) => {
    try {
      console.log('🔄 [REDEEM] Iniciando resgate de pontos:', {
        customerId,
        pointsToSpend,
      });

      // ✅ CRÍTICO: Buscar customer do BD usando customerId (funciona para logado e anônimo)
      const { data: customerData, error: fetchError } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('id', customerId)
        .single();

      if (fetchError || !customerData) {
        console.error('❌ [REDEEM] Erro ao buscar cliente no BD:', fetchError);
        return { success: false, discountAmount: 0 };
      }

      const customer = mapCustomerFromDB(customerData);
      
      // Validar pontos suficientes
      if (!customer || customer.totalPoints < pointsToSpend) {
        console.error('❌ [REDEEM] Pontos insuficientes. Disponível:', customer?.totalPoints, 'Tentando gastar:', pointsToSpend);
        return { success: false, discountAmount: 0 };
      }

      // Calcular desconto (100 pontos = configuração dinâmica)
      const pointsValue = getPointsValue();
      const discountAmount = (pointsToSpend / 100) * pointsValue;

      console.log('🔄 [REDEEM] Dados do cliente:', {
        customerId,
        pointsToSpend,
        currentPoints: customer.totalPoints,
        newPoints: customer.totalPoints - pointsToSpend,
        discountAmount
      });

      // Atualizar pontos NO BD
      const { data: updateData, error: updateError } = await (supabase as any)
        .from('customers')
        .update({
          total_points: customer.totalPoints - pointsToSpend,
        })
        .eq('id', customerId)
        .select();  // Retorna dados atualizados

      if (updateError) {
        console.error('❌ [REDEEM] Erro ao atualizar pontos no BD:', updateError);
        return { success: false, discountAmount: 0 };
      }

      if (!updateData || updateData.length === 0) {
        console.error('❌ [REDEEM] Nenhum cliente atualizado no BD');
        return { success: false, discountAmount: 0 };
      }

      console.log('✅ [REDEEM] Pontos atualizados no BD:', {
        id: updateData[0].id,
        totalPoints: updateData[0].total_points
      });

      // Registrar transação com hora local
      const { data: transData, error: transError } = await (supabase as any)
        .from('loyalty_transactions')
        .insert([{
          customer_id: customerId,
          points_spent: pointsToSpend,
          transaction_type: 'redemption',
          description: `Resgate de ${pointsToSpend} pontos - Desconto de R$ ${discountAmount.toFixed(2)}`,
          created_at: getLocalISOString(),
        }])
        .select();

      if (transError) {
        console.warn('⚠️ [REDEEM] Erro ao registrar transação (não crítico):', transError);
      } else {
        console.log('✅ [REDEEM] Transação registrada:', transData);
      }

      // ✅ ATUALIZAR ESTADO LOCAL SE É O CLIENTE LOGADO
      const state = get();
      if (state.currentCustomer?.id === customerId) {
        const newCustomer = {
          ...state.currentCustomer,
          totalPoints: state.currentCustomer.totalPoints - pointsToSpend,
        };
        
        set({
          currentCustomer: newCustomer,
          points: newCustomer.totalPoints,
        });
        
        console.log('✅ [REDEEM] Estado local (logado) atualizado com sucesso:', {
          pointsToSpend,
          novoSaldo: newCustomer.totalPoints,
          desconto: `R$ ${discountAmount.toFixed(2)}`
        });
      } else {
        console.log('✅ [REDEEM] Pontos resgatados no BD para cliente anônimo:', {
          customerId,
          pointsToSpend,
          newBalance: customer.totalPoints - pointsToSpend,
          desconto: `R$ ${discountAmount.toFixed(2)}`
        });
      }

      return { success: true, discountAmount };
    } catch (error) {
      console.error('❌ [REDEEM] Erro crítico em redeemPoints:', error);
      return { success: false, discountAmount: 0 };
    }
  },

  getCustomerByEmail: async (email: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('email', email)
        .single();

      if (error || !data) return null;
      return mapCustomerFromDB(data);
    } catch (error) {
      console.error('Erro em getCustomerByEmail:', error);
      return null;
    }
  },

  setCurrentCustomer: (customer: Customer | null) => {
    set({ 
      currentCustomer: customer,
      points: customer?.totalPoints || 0,
    });
  },

  setPointsToRedeem: (points: number) => {
    set({ pointsToRedeem: points });
  },

  refreshCurrentCustomer: async (customerId?: string) => {
    try {
      const state = get();
      
      // ✅ Usar customerId fornecido OU currentCustomer.id (para retrocompatibilidade)
      const idToRefresh = customerId || state.currentCustomer?.id;
      
      if (!idToRefresh) {
        console.error('❌ [REFRESH] Nenhum cliente para refrescar (sem ID fornecido e sem logado)');
        return;
      }

      console.log('🔄 [REFRESH] Buscando dados atualizados do cliente:', idToRefresh);

      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('id', idToRefresh)
        .single();

      if (error) {
        console.error('❌ [REFRESH] Erro ao buscar cliente:', error);
        return;
      }

      if (!data) {
        console.warn('⚠️ [REFRESH] Cliente não encontrado no BD');
        return;
      }

      const customer = mapCustomerFromDB(data);
      console.log('📊 [REFRESH] Dados obtidos do BD:', {
        totalPoints: customer.totalPoints,
        totalSpent: customer.totalSpent,
        totalPurchases: customer.totalPurchases,
        timestamp: new Date().toLocaleTimeString(),
      });

      // ✅ Se é o cliente logado atualmente, atualizar store completo
      // ✅ Se é outro cliente, apenas retornar os dados (não afeta currentCustomer)
      if (!customerId || customerId === state.currentCustomer?.id) {
        set({
          currentCustomer: customer,
          points: customer.totalPoints,
        });
        console.log('✅ [REFRESH] Store atualizado com sucesso!', {
          newPoints: customer.totalPoints,
          newSpent: customer.totalSpent,
        });
      } else {
        console.log('✅ [REFRESH] Dados atualizados para cliente:', {
          customerId,
          newPoints: customer.totalPoints,
          newSpent: customer.totalSpent,
        });
      }
    } catch (error) {
      console.error('❌ [REFRESH] Erro crítico ao refrescar cliente:', error);
    }
  },

  loginCustomer: async (email: string, cpf: string, rememberMe?: boolean) => {
    try {
      // 🔒 Normalizar email (URGENTE #6)
      const normalizedEmail = normalizeEmail(email);
      
      console.log('Tentando fazer login com:', { normalizedEmail, cpf, rememberMe });

      // Buscar cliente por email e CPF
      const { data, error } = await (supabase as any)
        .from('customers')
        .select('*')
        .eq('email', normalizedEmail)
        .eq('cpf', cpf.replace(/\D/g, ''))
        .single();

      if (error || !data) {
        console.error('Cliente não encontrado:', error);
        return false;
      }

      const customer = mapCustomerFromDB(data);
      
      // Carregar dados do cliente
      const [transactions, coupons] = await Promise.all([
        get().getTransactionHistory(customer.id),
        get().getCoupons(customer.id),
      ]);

      // Se rememberMe está ativado, salvar credenciais no localStorage
      if (rememberMe) {
        const payload = {
          email: normalizedEmail,
          cpf,
          timestamp: Date.now(),
        };
        localStorage.setItem('loyalty_remembered_login', JSON.stringify(payload));
        console.log('💾 [STORAGE] localStorage.setItem executado com:', payload);
        console.log('💾 [STORAGE] Verificando localStorage agora:', localStorage.getItem('loyalty_remembered_login'));
      } else {
        localStorage.removeItem('loyalty_remembered_login');
        console.log('🗑️  [STORAGE] localStorage.removeItem executado');
      }

      set({
        currentCustomer: customer,
        points: customer.totalPoints,
        transactions,
        coupons,
        isRemembered: !!rememberMe,
      });

      console.log('✅ Login bem-sucedido:', customer, '| Remembered:', rememberMe);
      return true;
    } catch (error) {
      console.error('Erro em loginCustomer:', error);
      return false;
    }
  },

  restoreRememberedLogin: async () => {
    try {
      const remembered = localStorage.getItem('loyalty_remembered_login');
      console.log('📝 [RESTORE] localStorage.getItem resultado:', remembered);
      
      if (!remembered) {
        console.log('ℹ️ [RESTORE] Nenhum login lembrado encontrado no localStorage');
        return false;
      }

      const { email, cpf } = JSON.parse(remembered);
      console.log('🔄 [RESTORE] Restaurando login lembrado para:', email);

      const success = await get().loginCustomer(email, cpf, true);
      console.log('🔄 [RESTORE] loginCustomer retornou:', success);
      
      if (success) {
        set({ isRemembered: true });
        console.log('✅ [RESTORE] Cliente restaurado e isRemembered = true');
      }
      return success;
    } catch (error) {
      console.error('❌ [RESTORE] Erro ao restaurar login:', error);
      localStorage.removeItem('loyalty_remembered_login');
      return false;
    }
  },

  logoutCustomer: async () => {
    console.log('Fazendo logout do cliente');
    localStorage.removeItem('loyalty_remembered_login');
    set({
      currentCustomer: null,
      points: 0,
      pointsToRedeem: 0,
      transactions: [],
      coupons: [],
      activeCoupon: null,
      isRemembered: false,
    });
  },

  saveDefaultAddress: async (address) => {
    try {
      const state = get();
      if (!state.currentCustomer?.id) {
        console.error('Nenhum cliente logado para salvar endereço');
        return false;
      }

      const { error, data } = await (supabase as any)
        .from('customers')
        .update({
          street: address.street,
          number: address.number,
          complement: address.complement || null,
          neighborhood: address.neighborhood,
          city: address.city,
          zip_code: address.zipCode,
        })
        .eq('id', state.currentCustomer.id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao salvar endereço:', error);
        return false;
      }

      // Atualizar currentCustomer com o novo endereço
      const customer = mapCustomerFromDB(data);
      set({ currentCustomer: customer });
      console.log('✅ Endereço padrão salvo com sucesso');
      return true;
    } catch (error) {
      console.error('Erro em saveDefaultAddress:', error);
      return false;
    }
  },

  getTransactionHistory: async (customerId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('loyalty_transactions')
        .select('id, customer_id, order_id, points_earned, points_spent, transaction_type, description, created_at, expires_at')
        .eq('customer_id', customerId)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      const transactions = data.map(mapTransactionFromDB);
      set({ transactions });
      return transactions;
    } catch (error) {
      console.error('Erro em getTransactionHistory:', error);
      return [];
    }
  },

  generateAutoCoupon: async (customerId: string) => {
    try {
      const couponCode = `TIER${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
      
      const { data, error } = await (supabase as any)
        .from('loyalty_coupons')
        .insert([{
          customer_id: customerId,
          coupon_code: couponCode,
          discount_percentage: 10,
          points_threshold: 100,
          is_active: true,
          is_used: false,
          expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        }])
        .select()
        .single();

      if (error) {
        console.error('Erro ao gerar cupom:', error);
        return null;
      }

      console.log('✅ Cupom auto-gerado:', couponCode);
      return mapCouponFromDB(data);
    } catch (error) {
      console.error('Erro em generateAutoCoupon:', error);
      return null;
    }
  },

  getCoupons: async (customerId: string) => {
    try {
      const { data, error } = await (supabase as any)
        .from('loyalty_coupons')
        .select('*')
        .eq('customer_id', customerId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error || !data) return [];
      set({ coupons: data });
      return data.map(mapCouponFromDB);
    } catch (error) {
      console.error('Erro em getCoupons:', error);
      return [];
    }
  },

  useCoupon: async (couponId: string) => {
    try {
      const { error } = await (supabase as any)
        .from('loyalty_coupons')
        .update({ is_used: true, used_at: getLocalISOString() })
        .eq('id', couponId);

      if (error) {
        console.error('Erro ao usar cupom:', error);
        return false;
      }

      console.log('✅ Cupom utilizado:', couponId);
      return true;
    } catch (error) {
      console.error('Erro em useCoupon:', error);
      return false;
    }
  },


}));

// Helper para mapear dados do DB
function mapCustomerFromDB(data: any): Customer {
  return {
    id: data.id,
    email: data.email,
    cpf: data.cpf,
    name: data.name,
    phone: data.phone,
    totalPoints: data.total_points || 0,
    totalSpent: data.total_spent || 0,
    totalPurchases: data.total_purchases || 0,
    isRegistered: data.is_registered || false,
    registeredAt: data.registered_at,
    createdAt: data.created_at,
    lastPurchaseAt: data.last_purchase_at,
    // Endereço padrão
    street: data.street,
    number: data.number,
    complement: data.complement,
    neighborhood: data.neighborhood,
    city: data.city,
    zipCode: data.zip_code,
  };
}

function mapTransactionFromDB(data: any): LoyaltyTransaction {
  return {
    id: data.id,
    customerId: data.customer_id,
    orderId: data.order_id,
    pointsEarned: data.points_earned,
    pointsSpent: data.points_spent,
    transactionType: data.transaction_type,
    description: data.description,
    createdAt: data.created_at,
  };
}

function mapCouponFromDB(data: any): LoyaltyCoupon {
  return {
    id: data.id,
    customerId: data.customer_id,
    couponCode: data.coupon_code,
    discountPercentage: data.discount_percentage,
    discountAmount: data.discount_amount,
    pointsThreshold: data.points_threshold,
    isActive: data.is_active,
    isUsed: data.is_used,
    usedAt: data.used_at,
    expiresAt: data.expires_at,
    createdAt: data.created_at,
  };
}
