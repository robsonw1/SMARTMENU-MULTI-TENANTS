import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';

export interface CategoryConfig {
  id: string;
  label: string;
  icon_name: string; // 'Gift' | 'Tag' | 'Pizza' | 'Crown' | 'Star' | 'Cake' | 'GlassWater'
  enabled: boolean;
  order: number; // Para reordenação
}

export interface SizeConfig {
  id: string;
  name: string;
  description: string;
  isActive: boolean;
  order: number;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

export interface WeekSchedule {
  monday: DaySchedule;
  tuesday: DaySchedule;
  wednesday: DaySchedule;
  thursday: DaySchedule;
  friday: DaySchedule;
  saturday: DaySchedule;
  sunday: DaySchedule;
}

interface StoreSettings {
  name: string;
  phone: string;
  address: string;
  slogan: string;
  schedule: WeekSchedule;
  isManuallyOpen: boolean; // Manual override for open/closed
  deliveryTimeMin: number;
  deliveryTimeMax: number;
  pickupTimeMin: number;
  pickupTimeMax: number;
  adminPassword: string;
  store_logo_url?: string | null; // ✅ NOVO: URL da logo do estabelecimento
  printnode_printer_id?: string | null;
  print_mode?: string;
  auto_print_pix?: boolean;
  auto_print_card?: boolean;
  auto_print_cash?: boolean;
  orderAlertEnabled?: boolean; // Ativar/desativar som de alerta para novos pedidos
  sendOrderSummaryToWhatsApp?: boolean; // Ativar/desativar envio de resumo para WhatsApp
  enableScheduling?: boolean; // Ativar/desativar agendamento de pedidos
  minScheduleMinutes?: number; // M├¡nimo de minutos que cliente precisa esperar
  maxScheduleDays?: number; // M├íximo de dias que pode agendar
  allowSchedulingOnClosedDays?: boolean; // Permite agendar em dias que loja est├í fechada
  allowSchedulingOutsideBusinessHours?: boolean; // Permite agendar fora do hor├írio de atendimento
  respectBusinessHoursForScheduling?: boolean; // Se TRUE, s├│ exibe slots dentro do hor├írio
  allowSameDaySchedulingOutsideHours?: boolean; // Se TRUE, permite agendar para HOJE fora do hor├írio
  timezone?: string; // Fuso hor├írio do tenant (ex: America/Sao_Paulo)
  // Configura├ß├Ķes de Card├ípio (toggles)
  meia_meia_enabled?: boolean;
  imagens_enabled?: boolean;
  adicionais_enabled?: boolean;
  bebidas_enabled?: boolean;
  bordas_enabled?: boolean;
  broto_enabled?: boolean;
  grande_enabled?: boolean;
  // Configurações de Categorias (dinâmicas)
  categories_config?: CategoryConfig[];
  // Configurações de Tamanhos (dinâmicos)
  sizes_config?: SizeConfig[];
}

interface SettingsStore {
  settings: StoreSettings;
  // 🔐 NOVO: Cache isolado por tenant
  _loadedTenantId?: string;
  _lastLoadTime?: number;
  _isLoadingInProgress?: boolean;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  loadSettingsFromSupabase: (forceRefresh?: boolean) => Promise<void>;
  loadSettingsLocally: (settings: Partial<StoreSettings>) => void;
  setSetting: (key: keyof StoreSettings, value: any) => void;
  updateDaySchedule: (day: keyof WeekSchedule, schedule: Partial<DaySchedule>) => void;
  toggleManualOpen: () => void;
  changePassword: (currentPassword: string, newPassword: string) => { success: boolean; message: string };
  isStoreOpen: () => boolean;
  syncSettingsToSupabase: () => Promise<{ success: boolean; message: string }>;
}

const defaultDaySchedule: DaySchedule = {
  isOpen: true,
  openTime: '18:00',
  closeTime: '23:00',
};

const defaultWeekSchedule: WeekSchedule = {
  monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
  tuesday: { ...defaultDaySchedule },
  wednesday: { ...defaultDaySchedule },
  thursday: { ...defaultDaySchedule },
  friday: { ...defaultDaySchedule },
  saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
  sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
};

const defaultCategoriesConfig: CategoryConfig[] = [
  { id: 'combos', label: 'Combos', icon_name: 'Gift', enabled: true, order: 0 },
  { id: 'promocionais', label: 'Promocionais', icon_name: 'Tag', enabled: true, order: 1 },
  { id: 'tradicionais', label: 'Tradicionais', icon_name: 'ShoppingBag', enabled: true, order: 2 },
  { id: 'premium', label: 'Premium', icon_name: 'Crown', enabled: true, order: 3 },
  { id: 'especiais', label: 'Especiais', icon_name: 'Star', enabled: true, order: 4 },
  { id: 'doces', label: 'Doces', icon_name: 'Cake', enabled: true, order: 5 },
  { id: 'bebidas', label: 'Bebidas', icon_name: 'GlassWater', enabled: true, order: 6 },
];

const defaultSizesConfig: SizeConfig[] = [
  { id: 'broto', name: 'Broto', description: '4 fatias', isActive: true, order: 0 },
  { id: 'grande', name: 'Grande', description: '8 fatias', isActive: true, order: 1 },
  { id: 'size3', name: '', description: '', isActive: false, order: 2 },
  { id: 'size4', name: '', description: '', isActive: false, order: 3 },
  { id: 'size5', name: '', description: '', isActive: false, order: 4 },
  { id: 'size6', name: '', description: '', isActive: false, order: 5 },
  { id: 'size7', name: '', description: '', isActive: false, order: 6 },
];

const defaultSettings: StoreSettings = {
  name: 'Carregando...',
  phone: 'carregando...',
  address: 'carregando',
  slogan: 'carregando...',
  schedule: defaultWeekSchedule,
  isManuallyOpen: true,
  deliveryTimeMin: 60,
  deliveryTimeMax: 70,
  pickupTimeMin: 40,
  pickupTimeMax: 50,
  adminPassword: 'admin123456', // Default, should be changed per tenant
  store_logo_url: null,
  orderAlertEnabled: true,
  sendOrderSummaryToWhatsApp: false,
  broto_enabled: true,
  grande_enabled: true,
  enableScheduling: false,
  minScheduleMinutes: 30,
  maxScheduleDays: 7,
  allowSchedulingOnClosedDays: false,
  allowSchedulingOutsideBusinessHours: false,
  respectBusinessHoursForScheduling: true,
  allowSameDaySchedulingOutsideHours: false,
  timezone: 'America/Sao_Paulo',
  // Configura├ß├Ķes de Card├ípio (toggles)
  meia_meia_enabled: true,
  imagens_enabled: true,
  adicionais_enabled: true,
  bebidas_enabled: true,
  bordas_enabled: true,
  categories_config: undefined, // Vai carregar do Supabase / localStorage
  sizes_config: undefined, // Vai carregar do Supabase / localStorage
};

const dayNames: (keyof WeekSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  _loadedTenantId: undefined,
  _lastLoadTime: undefined,
  _isLoadingInProgress: false,

  loadSettingsFromSupabase: async (forceRefresh = false) => {
    try {
      // ✅ NOVO (30/03/2026): Obter tenant_id de sessionStorage ÚNICAMENTE
      // SEM fallback getUser() - evita contention no auth
      // Se vazio, skip - deixar que useSecureTenantId preencha
      
      // 🔍 Procurar tenant_id em AMBAS as localizações:
      // - 'sb-tenant-id-by-slug': Cliente via initTenantResolver (URL slug) ← PRIORIDADE
      // - 'sb-auth-tenant-id': Admin autenticado via useAdminAuth
      const authTenantId = sessionStorage.getItem('sb-auth-tenant-id');
      const slugTenantId = sessionStorage.getItem('sb-tenant-id-by-slug');
      // ✅ SLUG deve ter PRIORIDADE porque é sempre tenant_id (não user_id)
      let tenantId = slugTenantId || authTenantId;
      
      // 🔍 DEBUG: Mostrar qual tenant_id está sendo usado
      if (forceRefresh || authTenantId !== slugTenantId) {
        console.log('[LOAD-SUPABASE] 🔍 DEBUG Tenant IDs:', {
          authTenantId: authTenantId || '(não encontrado)',
          slugTenantId: slugTenantId || '(não encontrado)',
          utilizando: tenantId || '(nenhum!)',
          forceRefresh,
        });
      }
      
      if (!tenantId) {
        console.log('[LOAD-SUPABASE] tenant_id vazio (não encontrou em sb-auth-tenant-id nem em sb-tenant-id-by-slug)');
        return;
      }
      
      console.log('[LOAD-SUPABASE] Usando tenant_id:', tenantId);
      const currentState = get();

      // 🔐 NOVO: Verificar cache isolado por tenant
      // Se já foi carregado para este tenant_id E está dentro de 5min, retornar
      // EXCETO se forceRefresh = true (chamado pelo webhook Realtime)
      if (
        !forceRefresh && // ✅ NOVO: Bypassar cache se forceRefresh = true
        currentState._loadedTenantId === tenantId &&
        currentState._lastLoadTime &&
        Date.now() - currentState._lastLoadTime < 5 * 60 * 1000 // 5 minutos
      ) {
        console.log(`✅ [LOAD-SUPABASE] Cache válido para tenant ${tenantId} - pulando fetch`);
        return;
      }
      
      if (forceRefresh) {
        console.log(`🔄 [LOAD-SUPABASE] forceRefresh = true - ignorando cache (webhook Realtime)`);
      }

      // 🔐 Evitar múltiplas requisições simultâneas
      if (currentState._isLoadingInProgress) {
        console.log(`⏳ [LOAD-SUPABASE] Carregamento já em progresso para ${tenantId}`);
        return;
      }

      // Marcar como carregando
      set({ _isLoadingInProgress: true });

      console.log('[LOAD-SUPABASE] Usando tenant_id:', tenantId);
      
      // ✅ CORRIGIDO (30/03/2026): Usar ID tenant-specific (antes era hardcoded 'store-settings')
      const settingsId = `settings_${tenantId}`;
      
      console.log('[LOAD-SUPABASE] 🔍 Query:', { settingsId, tenantId });
      
      const { data, error } = await (supabase as any)
        .from('settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('id', settingsId)
        .single();

      if (error) {
        console.error('[LOAD-SUPABASE] ❌ Erro ao carregar settings:', {
          code: error.code,
          message: error.message,
          details: error.details,
          hint: error.hint,
          searchParams: { settingsId, tenantId },
        });
        // Se não encontrar, usar defaults - é normal para tentant novo
        set({ 
          _loadedTenantId: tenantId,
          _lastLoadTime: Date.now(),
          _isLoadingInProgress: false,
        });
        return;
      }

      if (data) {
        const settingsData = data as any;
        const valueJson = settingsData.value || {};
        
        // ✅ Extrair store_logo_url do value.store_logo_url
        const storeLogoUrl = valueJson.store_logo_url || null;
        console.log('✅ [LOAD-SUPABASE] Dados do banco carregados com sucesso:', {
          id: settingsData.id,
          tenant_id: settingsData.tenant_id,
          name: valueJson.name,
          phone: valueJson.phone,
          slogan: valueJson.slogan,
          store_logo_url: storeLogoUrl,
          forceRefresh,
        });
        
        // ✅ Carregar schedule com defaults se não tiver
        const loadedSchedule = valueJson.schedule || {
          monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
        };

        set({
          settings: {
            name: valueJson.name || 'carregando...',
            phone: valueJson.phone || 'carregando...',
            address: valueJson.address || 'carregando...',
            slogan: valueJson.slogan || 'carregando...',
            schedule: loadedSchedule,
            isManuallyOpen: settingsData.is_manually_open !== null ? settingsData.is_manually_open : (valueJson.isManuallyOpen ?? true),
            deliveryTimeMin: valueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: valueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: valueJson.pickupTimeMin ?? 40,
            pickupTimeMax: valueJson.pickupTimeMax ?? 50,
            adminPassword: valueJson.adminPassword || 'admin123456',
            store_logo_url: storeLogoUrl,
            printnode_printer_id: settingsData.printnode_printer_id || valueJson.printnode_printer_id || null,
            print_mode: settingsData.print_mode || valueJson.print_mode || 'auto',
            auto_print_pix: settingsData.auto_print_pix ?? (valueJson.auto_print_pix ?? false),
            auto_print_card: settingsData.auto_print_card ?? (valueJson.auto_print_card ?? false),
            auto_print_cash: settingsData.auto_print_cash ?? (valueJson.auto_print_cash ?? false),
            orderAlertEnabled: valueJson.orderAlertEnabled ?? true,
            sendOrderSummaryToWhatsApp: valueJson.sendOrderSummaryToWhatsApp ?? false,
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: settingsData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: settingsData.allow_same_day_scheduling_outside_hours ?? false,
            timezone: valueJson.timezone || 'America/Sao_Paulo',
            // ✅ Toggles de Cardápio (mapeados do BD)
            meia_meia_enabled: settingsData.meia_meia_enabled ?? true,
            imagens_enabled: settingsData.imagens_enabled ?? true,
            adicionais_enabled: settingsData.adicionais_enabled ?? true,
            bebidas_enabled: settingsData.bebidas_enabled ?? true,
            bordas_enabled: settingsData.bordas_enabled ?? true,
            broto_enabled: settingsData.broto_enabled ?? true,
            grande_enabled: settingsData.grande_enabled ?? true,
            // ✅ Configurações de Categorias (mapeadas do BD)
            categories_config: settingsData.categories_config ?? defaultCategoriesConfig,
            // ✅ Configurações de Tamanhos (mapeadas do BD)
            sizes_config: settingsData.sizes_config ?? defaultSizesConfig,
          },
          // 🔐 NOVO: Registrar que este tenant foi carregado com sucesso
          _loadedTenantId: tenantId,
          _lastLoadTime: Date.now(),
          _isLoadingInProgress: false,
        });

        console.log('✅ [LOAD-SUPABASE] Settings carregados e cached para tenant:', tenantId);
      }
    } catch (error) {
      console.error('❌ [LOAD-SUPABASE] Exceção ao carregar settings:', error);
      set({ _isLoadingInProgress: false });
    }
  },

  updateSettings: async (newSettings) => {
    try {
      // ✅ CORRIGIDO (30/03/2026): Chamar Edge Function em vez de fazer UPDATE direto
      // Isso garante que RLS service_role seja respeitada
      
      // 1. ATUALIZAR ESTADO LOCAL PRIMEIRO
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
      
      // 2. PEGAR ESTADO ATUALIZADO
      const { settings: currentSettings } = get();
      
      // 3. OBTER tenant_id de sessionStorage APENAS
      // 🔍 Priorizar slug porque é SEMPRE tenant_id (admin tem ambos, cliente só tem slug)
      let tenantId = sessionStorage.getItem('sb-tenant-id-by-slug') || 
                     sessionStorage.getItem('sb-auth-tenant-id');
      
      if (!tenantId) {
        console.warn('[UPDATE-SETTINGS] tenant_id vazio - não pode atualizar');
        return;
      }
      console.log('🔐 [UPDATE-SETTINGS] Usando Edge Function com tenant_id:', tenantId);

      // 4. PREPARAR DADOS
      const jsonbValue = {
        name: currentSettings.name,
        phone: currentSettings.phone,
        address: currentSettings.address,
        slogan: currentSettings.slogan,
        schedule: currentSettings.schedule,
        isManuallyOpen: currentSettings.isManuallyOpen,
        deliveryTimeMin: currentSettings.deliveryTimeMin,
        deliveryTimeMax: currentSettings.deliveryTimeMax,
        pickupTimeMin: currentSettings.pickupTimeMin,
        pickupTimeMax: currentSettings.pickupTimeMax,
        orderAlertEnabled: currentSettings.orderAlertEnabled,
        sendOrderSummaryToWhatsApp: currentSettings.sendOrderSummaryToWhatsApp,
        // ✅ CRÍTICO: Sempre preservar logo - NUNCA deixar ser removido!
        store_logo_url: currentSettings.store_logo_url || null,
      };

      const updatePayload = {
        tenantId,
        updates: {
          value: jsonbValue,
          printnode_printer_id: currentSettings.printnode_printer_id || null,
          print_mode: currentSettings.print_mode || 'auto',
          auto_print_pix: currentSettings.auto_print_pix ?? false,
          auto_print_card: currentSettings.auto_print_card ?? false,
          auto_print_cash: currentSettings.auto_print_cash ?? false,
          is_manually_open: currentSettings.isManuallyOpen,
          enable_scheduling: currentSettings.enableScheduling,
          min_schedule_minutes: currentSettings.minScheduleMinutes,
          max_schedule_days: currentSettings.maxScheduleDays,
          allow_scheduling_on_closed_days: currentSettings.allowSchedulingOnClosedDays,
          allow_scheduling_outside_business_hours: currentSettings.allowSchedulingOutsideBusinessHours,
          respect_business_hours_for_scheduling: currentSettings.respectBusinessHoursForScheduling,
          allow_same_day_scheduling_outside_hours: currentSettings.allowSameDaySchedulingOutsideHours,
          // ✅ Toggles de Cardápio
          meia_meia_enabled: currentSettings.meia_meia_enabled ?? true,
          imagens_enabled: currentSettings.imagens_enabled ?? true,
          adicionais_enabled: currentSettings.adicionais_enabled ?? true,
          bebidas_enabled: currentSettings.bebidas_enabled ?? true,
          bordas_enabled: currentSettings.bordas_enabled ?? true,
          broto_enabled: currentSettings.broto_enabled ?? true,
          grande_enabled: currentSettings.grande_enabled ?? true,
          // ✅ Configurações de Categorias
          categories_config: currentSettings.categories_config ?? defaultCategoriesConfig,
          // ✅ NOVO: Configurações de Tamanhos
          sizes_config: currentSettings.sizes_config ?? undefined,
        },
      };

      console.log('📤 [UPDATE-SETTINGS] Payload COMPLETO que será enviado:', {
        tenantId,
        categories_config: updatePayload.updates.categories_config ? 'Presente' : 'Ausente',
        sizes_config: updatePayload.updates.sizes_config ? 'Presente' : 'Ausente',
        meia_meia_enabled: updatePayload.updates.meia_meia_enabled,
      });

      // 5. CHAMAR EDGE FUNCTION (que executa como service_role)
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      if (!supabaseUrl) {
        throw new Error('VITE_SUPABASE_URL not configured');
      }

      console.log('📡 [UPDATE-SETTINGS] INICIANDO fetch para Edge Function...');
      // ✅ AbortController para evitar requisição pendurada eternamente
      const controller = new AbortController();
      const timeoutHandle = setTimeout(() => {
        controller.abort();
        console.error('⏱️  [UPDATE-SETTINGS] Requisição expirou após 15 segundos!');
      }, 15000); // 15 segundos timeout

      try {
        const response = await fetch(
          `${supabaseUrl}/functions/v1/update-admin-settings`,
          {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify(updatePayload),
            signal: controller.signal,
          }
        );

        clearTimeout(timeoutHandle);
        console.log('✅ [UPDATE-SETTINGS] Resposta recebida com status:', response.status);

        const responseData = await response.json();

        if (!response.ok) {
          console.error('❌ [UPDATE-SETTINGS] Edge Function erro:', responseData);
          throw new Error(responseData.error || `Failed to update settings. Status: ${response.status}`);
        }

        console.log('✅ [UPDATE-SETTINGS] Edge Function retornou sucesso:', responseData.data);
      } catch (fetchError: any) {
        clearTimeout(timeoutHandle);
        if (fetchError.name === 'AbortError') {
          console.error('❌ [UPDATE-SETTINGS] Requisição foi cancelada por timeout!');
          throw new Error('Requisição expirou. Verifique sua conexão.');
        }
        throw fetchError;
      }
    } catch (error) {
      console.error('❌ [UPDATE-SETTINGS] EXCEÇÃO FATAL:', error);
      throw error;
    }
  },

  setSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),

  // Ô£à NOVO: Carrega settings S├ô em mem├│ria, SEM resalvar no Supabase
  loadSettingsLocally: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  updateDaySchedule: (day, schedule) => {
    // Ô£à CORRE├ç├âO: updateDaySchedule() S├ô atualiza estado local, N├âO salva no Supabase
    // O saveamento completo acontece em updateSettings() quando o admin clica "Salvar Altera├º├Áes"
    // Assim evitamos race condition onde updateDaySchedule() sobrescreve dados recentes
    set((state) => ({
      settings: {
        ...state.settings,
        schedule: {
          ...state.settings.schedule,
          [day]: { ...state.settings.schedule[day], ...schedule },
        },
      },
    }));
  },

  toggleManualOpen: () =>
    set((state) => ({
      settings: { ...state.settings, isManuallyOpen: !state.settings.isManuallyOpen },
    })),

  changePassword: (currentPassword, newPassword) => {
    const { settings } = get();
    if (currentPassword !== settings.adminPassword) {
      return { success: false, message: 'Senha atual incorreta' };
    }
    if (newPassword.length < 6) {
      return { success: false, message: 'A nova senha deve ter pelo menos 6 caracteres' };
    }
    set((state) => ({
      settings: { ...state.settings, adminPassword: newPassword },
    }));
    return { success: true, message: 'Senha alterada com sucesso!' };
  },

  isStoreOpen: () => {
    const { settings } = get();
    
    const debugInfo = {
      isManuallyOpen: settings.isManuallyOpen,
      scheduleExiste: !!settings.schedule,
      diasDoSchedule: settings.schedule ? Object.keys(settings.schedule) : [],
      horaAtual: new Date().toLocaleTimeString('pt-BR'),
      diaAtual: new Date().toLocaleDateString('pt-BR', { weekday: 'long' }),
    };
    
    console.log('­ƒöì [IS-STORE-OPEN] Iniciando verifica├º├úo:', debugInfo);
    
    // ÔØî Se manual close button foi clicado: SEMPRE fechado (sem exce├º├Áes)
    if (settings.isManuallyOpen === false) {
      console.log('ÔØî LOJA FECHADA - Bot├úo manual FECHADO pelo gerente');
      return false;
    }

    // Ô£à Se manual open button foi clicado: AINDA RESPEITA OS HOR├üRIOS CONFIGURADOS
    // O gerente pode abrir manualmente, mas os hor├írios do menu (Seg-Dom) SEMPRE s├úo respeitados
    // Isso garante que nenhum pedido seja feito fora do hor├írio configurado
    
    const now = new Date();
    const currentDay = dayNames[now.getDay()];
    
    console.log('­ƒöì [IS-STORE-OPEN] Dia atual do sistema:', currentDay);

    const daySchedule = settings.schedule ? settings.schedule[currentDay] : null;

    // Se n├úo tem schedule configurado para hoje
    if (!daySchedule) {
      console.log('ÔØî LOJA FECHADA - Schedule do dia', currentDay, 'n├úo encontrado no settings.schedule:', {
        schedule: settings.schedule,
        diaRequisitado: currentDay,
      });
      return false;
    }

    console.log(`­ƒôà [IS-STORE-OPEN] Schedule carregado para ${currentDay}:`, daySchedule);

    // ÔÜá´©Å CR├ìTICO: Verificar se o dia est├í marcado como FECHADO
    if (daySchedule.isOpen === false) {
      console.log('ÔØî LOJA FECHADA - Dia', currentDay, 'est├í marcado como FECHADO (isOpen=false)');
      return false;
    }

    if (!daySchedule.openTime || !daySchedule.closeTime) {
      console.log('ÔØî LOJA FECHADA - Hor├írios n├úo configurados para hoje:', {
        openTime: daySchedule.openTime,
        closeTime: daySchedule.closeTime,
      });
      return false;
    }

    // ÔÅ░ Calcular hora atual em minutos
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    try {
      const [openHour, openMinute] = daySchedule.openTime.split(':').map(Number);
      const [closeHour, closeMinute] = daySchedule.closeTime.split(':').map(Number);
      
      const openTime = openHour * 60 + openMinute;
      let closeTime = closeHour * 60 + closeMinute;
      
      console.log('ÔÅ░ [IS-STORE-OPEN] Verificando hor├írio:', {
        horaAtual: `${currentHour}:${String(currentMinute).padStart(2, '0')} (${currentTime} min)`,
        horaAbertura: `${daySchedule.openTime} (${openTime} min)`,
        horaFechamento: `${daySchedule.closeTime} (${closeTime} min)`,
      });
      
      // Handle closing time past midnight (e.g., 00:00 means midnight)
      if (closeTime <= openTime) {
        closeTime += 24 * 60; // Add 24 hours
        const adjustedCurrentTime = currentTime < openTime ? currentTime + 24 * 60 : currentTime;
        const isOpen = adjustedCurrentTime >= openTime && adjustedCurrentTime < closeTime;
        console.log('ÔÅ░ [IS-STORE-OPEN] Hor├írio com midnight:', isOpen ? `Ô£à ABERTA (${daySchedule.openTime}-${daySchedule.closeTime})` : `ÔØî FECHADA (${daySchedule.openTime}-${daySchedule.closeTime}) - Hora atual: ${now.toLocaleTimeString('pt-BR')}`);
        return isOpen;
      }

      const isOpen = currentTime >= openTime && currentTime < closeTime;
      const status = isOpen ? `Ô£à ABERTA (${daySchedule.openTime}-${daySchedule.closeTime})` : `ÔØî FECHADA (${daySchedule.openTime}-${daySchedule.closeTime})`;
      console.log('ÔÅ░ [IS-STORE-OPEN]', status, '- Hora atual:', now.toLocaleTimeString('pt-BR'));
      return isOpen;
    } catch (error) {
      console.error('Erro ao calcular hor├írio de funcionamento:', error);
      return false;
    }
  },

  syncSettingsToSupabase: async () => {
    try {
      const { settings } = get();

      // ✅ OBTER tenant_id de sessionStorage APENAS (NUNCA chamar getUser()!)
      // Evita lock stealing com useAdminAuth
      // 🔍 Priorizar slug porque é SEMPRE tenant_id
      let tenantId = sessionStorage.getItem('sb-tenant-id-by-slug') || 
                     sessionStorage.getItem('sb-auth-tenant-id');
      
      if (!tenantId) {
        console.warn('[SYNC-SUPABASE] ❌ Sessão não autenticada em sessionStorage');
        return { success: false, message: 'Sessão expirada - faça login novamente' };
      }

      const settingsId = `settings_${tenantId}`;

      const updateData: any = {
        value: {
          name: settings.name,
          phone: settings.phone,
          address: settings.address,
          slogan: settings.slogan,
          schedule: settings.schedule,
          isManuallyOpen: settings.isManuallyOpen,
          deliveryTimeMin: settings.deliveryTimeMin,
          deliveryTimeMax: settings.deliveryTimeMax,
          pickupTimeMin: settings.pickupTimeMin,
          pickupTimeMax: settings.pickupTimeMax,
          orderAlertEnabled: settings.orderAlertEnabled,
          sendOrderSummaryToWhatsApp: settings.sendOrderSummaryToWhatsApp,
        },
        enable_scheduling: settings.enableScheduling,
        min_schedule_minutes: settings.minScheduleMinutes,
        max_schedule_days: settings.maxScheduleDays,
        allow_scheduling_on_closed_days: settings.allowSchedulingOnClosedDays,
        allow_scheduling_outside_business_hours: settings.allowSchedulingOutsideBusinessHours,
        respect_business_hours_for_scheduling: settings.respectBusinessHoursForScheduling,
        allow_same_day_scheduling_outside_hours: settings.allowSameDaySchedulingOutsideHours,
        updated_at: new Date().toISOString(),
      };

      // ✅ Usar o ID dinâmico e filtrar por tenant_id
      // ✅ Guardar logo em value.store_logo_url (JSONB)
      const updateDataWithLogo = {
        ...updateData,
        value: {
          ...(updateData.value || {}),
          store_logo_url: settings.store_logo_url || null,
        },
      };
      
      const { error } = await (supabase as any)
        .from('settings')
        .update(updateDataWithLogo)
        .eq('id', settingsId)
        .eq('tenant_id', tenantId);

      if (error) {
        console.error('❌ Erro ao sincronizar settings com Supabase:', error);
        return { success: false, message: 'Erro ao sincronizar configurações' };
      }

      console.log('✅ Settings sincronizados com Supabase com TODOS os dados');
      return { success: true, message: 'Configurações sincronizadas com sucesso!' };
    } catch (error) {
      console.error('❌ Erro ao sincronizar settings:', error);
      return { success: false, message: 'Erro ao sincronizar configurações' };
    }
  },
}));

