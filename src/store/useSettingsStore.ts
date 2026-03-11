import { create } from 'zustand';
import { supabase } from '@/integrations/supabase/client';
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
  printnode_printer_id?: string | null;
  print_mode?: string;
  auto_print_pix?: boolean;
  auto_print_card?: boolean;
  auto_print_cash?: boolean;
  orderAlertEnabled?: boolean; // Ativar/desativar som de alerta para novos pedidos
  sendOrderSummaryToWhatsApp?: boolean; // Ativar/desativar envio de resumo para WhatsApp
  enableScheduling?: boolean; // Ativar/desativar agendamento de pedidos
  minScheduleMinutes?: number; // Mínimo de minutos que cliente precisa esperar
  maxScheduleDays?: number; // Máximo de dias que pode agendar
  allowSchedulingOnClosedDays?: boolean; // Permite agendar em dias que loja está fechada
  allowSchedulingOutsideBusinessHours?: boolean; // Permite agendar fora do horário de atendimento
  respectBusinessHoursForScheduling?: boolean; // Se TRUE, só exibe slots dentro do horário
  allowSameDaySchedulingOutsideHours?: boolean; // Se TRUE, permite agendar para HOJE fora do horário
  timezone?: string; // Fuso horário do tenant (ex: America/Sao_Paulo)
}

interface SettingsStore {
  settings: StoreSettings;
  updateSettings: (settings: Partial<StoreSettings>) => Promise<void>;
  loadSettingsFromSupabase: () => Promise<void>;
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

const defaultSettings: StoreSettings = {
  name: 'Forneiro Éden',
  phone: '(11) 99999-9999',
  address: 'Rua das Pizzas, 123 - Centro',
  slogan: 'A Pizza mais recheada da cidade 🇮🇹',
  schedule: defaultWeekSchedule,
  isManuallyOpen: true,
  deliveryTimeMin: 60,
  deliveryTimeMax: 70,
  pickupTimeMin: 40,
  pickupTimeMax: 50,
  adminPassword: 'admin123',
  orderAlertEnabled: true,
  sendOrderSummaryToWhatsApp: false,
  enableScheduling: false,
  minScheduleMinutes: 30,
  maxScheduleDays: 7,
  allowSchedulingOnClosedDays: false,
  allowSchedulingOutsideBusinessHours: false,
  respectBusinessHoursForScheduling: true,
  allowSameDaySchedulingOutsideHours: false,
  timezone: 'America/Sao_Paulo',
};

const dayNames: (keyof WeekSchedule)[] = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,

  loadSettingsFromSupabase: async () => {
    try {
      console.log('📥 [LOAD-SUPABASE] ════════════════════════════════════════');
      console.log('📥 [LOAD-SUPABASE] Carregando TODAS as settings do Supabase...');
      
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'store-settings')
        .single();

      if (error) {
        console.error('❌ [LOAD-SUPABASE] Erro ao carregar settings:', error);
        return;
      }

      if (data) {
        const settingsData = data as any;
        const valueJson = settingsData.value || {};
        
        console.log('📥 [LOAD-SUPABASE] Dados brutos do banco:');
        console.log('📥 [LOAD-SUPABASE] value.schedule:', valueJson.schedule);
        
        // ✅ CARREGAR SCHEDULE COM DEFAULTS SE NÃO TIVER
        const loadedSchedule = valueJson.schedule || {
          monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
        };

        console.log('📥 [LOAD-SUPABASE] Schedule que será usado:', loadedSchedule);

        // ✅ MAPEAR TODOS OS CAMPOS DO BANCO PARA O ESTADO
        set({
          settings: {
            name: valueJson.name || 'Forneiro Éden',
            phone: valueJson.phone || '(11) 99999-9999',
            address: valueJson.address || 'Rua das Pizzas, 123 - Centro',
            slogan: valueJson.slogan || 'A Pizza mais recheada da cidade 🇮🇹',
            schedule: loadedSchedule,
            // 🔓 CARREGAR DA COLUNA NORMALIZADA PRIMEIRO, depois do JSON como fallback
            isManuallyOpen: settingsData.is_manually_open !== null ? settingsData.is_manually_open : (valueJson.isManuallyOpen ?? true),
            deliveryTimeMin: valueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: valueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: valueJson.pickupTimeMin ?? 40,
            pickupTimeMax: valueJson.pickupTimeMax ?? 50,
            adminPassword: valueJson.adminPassword || 'admin123',
            // 🖨️  PRINTNODE: Tentar carregar da coluna normalizada PRIMEIRO, depois do JSON como fallback
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
          }
        });

        console.log('✅ [LOAD-SUPABASE] Store atualizado com SUCESSO');
        console.log('🖨️  [LOAD-SUPABASE] PrintNode carregado: ID=', settingsData.printnode_printer_id, ', Mode=', settingsData.print_mode);
        console.log('� [LOAD-SUPABASE] ════════════════════════════════════════');
      }
    } catch (error) {
      console.error('❌ [LOAD-SUPABASE] Exceção ao carregar settings:', error);
    }
  },

  updateSettings: async (newSettings) => {
    try {
      // 1️⃣ ATUALIZAR ESTADO LOCAL PRIMEIRO
      set((state) => ({
        settings: { ...state.settings, ...newSettings },
      }));
      
      // 2️⃣ PEGAR ESTADO ATUALIZADO
      const { settings: currentSettings } = get();
      
      console.log('💾 [UPDATE-SETTINGS] ════════════════════════════════════════');
      console.log('💾 [UPDATE-SETTINGS] INICIANDO SALVAMENTO NO SUPABASE');
      console.log('💾 [UPDATE-SETTINGS] Schedule que será salvo:', currentSettings.schedule);

      // 3️⃣ PREPARAR DADOS - SEPARAR COLUNAS NORMALIZADAS do JSONB
      // ✅ CRÍTICO: Salvar JSONB em uma coluna separada para garantir persistência
      const jsonbValue = {
        name: currentSettings.name,
        phone: currentSettings.phone,
        address: currentSettings.address,
        slogan: currentSettings.slogan,
        schedule: currentSettings.schedule, // ✅ SCHEDULE COMPLETO NO JSONB
        isManuallyOpen: currentSettings.isManuallyOpen,
        deliveryTimeMin: currentSettings.deliveryTimeMin,
        deliveryTimeMax: currentSettings.deliveryTimeMax,
        pickupTimeMin: currentSettings.pickupTimeMin,
        pickupTimeMax: currentSettings.pickupTimeMax,
        orderAlertEnabled: currentSettings.orderAlertEnabled,
        sendOrderSummaryToWhatsApp: currentSettings.sendOrderSummaryToWhatsApp,
      };

      const updateData: any = {
        // ✅ JSONB completo com todos os dados complexos
        value: jsonbValue,
        // 🖨️  COLUNAS NORMALIZADAS PARA BUSCA/PERFORMANCE
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
        updated_at: new Date().toISOString(),
      };

      console.log('📤 [UPDATE-SETTINGS] JSONB value.schedule:', jsonbValue.schedule);
      console.log('🖨️  [UPDATE-SETTINGS] PrintNode Printer ID:', updateData.printnode_printer_id);

      // 4️⃣ FAZER UPDATE COM MERGE EXPLÍCITO PARA GARANTIR JSONB SALVA
      // ⚠️  IMPORTANTE: Usar || null em campos opcionais para evitar undefined
      const { data: updateResult, error: updateError } = await supabase
        .from('settings')
        .update({
          value: JSON.stringify(jsonbValue) !== '{}' ? jsonbValue : updateData.value,
          printnode_printer_id: updateData.printnode_printer_id,
          print_mode: updateData.print_mode,
          auto_print_pix: updateData.auto_print_pix,
          auto_print_card: updateData.auto_print_card,
          auto_print_cash: updateData.auto_print_cash,
          is_manually_open: updateData.is_manually_open,
          enable_scheduling: updateData.enable_scheduling,
          min_schedule_minutes: updateData.min_schedule_minutes,
          max_schedule_days: updateData.max_schedule_days,
          allow_scheduling_on_closed_days: updateData.allow_scheduling_on_closed_days,
          allow_scheduling_outside_business_hours: updateData.allow_scheduling_outside_business_hours,
          respect_business_hours_for_scheduling: updateData.respect_business_hours_for_scheduling,
          allow_same_day_scheduling_outside_hours: updateData.allow_same_day_scheduling_outside_hours,
          updated_at: updateData.updated_at,
        })
        .eq('id', 'store-settings')
        .select();

      if (updateError) {
        console.error('❌ [UPDATE-SETTINGS] ERRO NO UPDATE:', updateError);
        throw updateError;
      }

      // 5️⃣ VERIFICAR RESULTADO - MAS FAZER SELECT FRESH PARA GARANTIR
      // ⚠️  IMPORTANTE: O data do UPDATE pode ter valores antigos em cache
      // Fazer um SELECT simples para garantir que foi realmente salvo
      console.log('🔍 [UPDATE-SETTINGS] Fazendo SELECT fresh para GARANTIR persistência...');
      const { data: freshData, error: selectError } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'store-settings')
        .single();

      if (selectError || !freshData) {
        console.error('❌ [UPDATE-SETTINGS] ERRO no SELECT fresh:', selectError);
        throw selectError;
      }

      // 5️⃣ VERIFICAR RESULTADO COM DADOS FRESCOS
      const savedData = freshData as any;
      const savedValue = savedData.value || {};
      const savedSchedule = savedValue.schedule;
      
      console.log('✅ [UPDATE-SETTINGS] CONFIRMADO! Dados salvos (FRESH):');
      console.log('✅ [UPDATE-SETTINGS] Schedule.monday:', savedSchedule?.monday);
      console.log('✅ [UPDATE-SETTINGS] Schedule.thursday:', savedSchedule?.thursday);
      console.log('✅ [UPDATE-SETTINGS] is_manually_open:', savedData.is_manually_open);

      console.log('💾 [UPDATE-SETTINGS] ════════════════════════════════════════');
    } catch (error) {
      console.error('❌ [UPDATE-SETTINGS] EXCEÇÃO FATAL:', error);
      throw error;
    }
  },

  setSetting: (key, value) =>
    set((state) => ({
      settings: { ...state.settings, [key]: value },
    })),

  // ✅ NOVO: Carrega settings SÓ em memória, SEM resalvar no Supabase
  loadSettingsLocally: (newSettings) => {
    set((state) => ({
      settings: { ...state.settings, ...newSettings },
    }));
  },

  updateDaySchedule: (day, schedule) => {
    // ✅ CORREÇÃO: updateDaySchedule() SÓ atualiza estado local, NÃO salva no Supabase
    // O saveamento completo acontece em updateSettings() quando o admin clica "Salvar Alterações"
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
    
    console.log('🔍 [IS-STORE-OPEN] Iniciando verificação:', debugInfo);
    
    // ❌ Se manual close button foi clicado: SEMPRE fechado (sem exceções)
    if (settings.isManuallyOpen === false) {
      console.log('❌ LOJA FECHADA - Botão manual FECHADO pelo gerente');
      return false;
    }

    // ✅ Se manual open button foi clicado: AINDA RESPEITA OS HORÁRIOS CONFIGURADOS
    // O gerente pode abrir manualmente, mas os horários do menu (Seg-Dom) SEMPRE são respeitados
    // Isso garante que nenhum pedido seja feito fora do horário configurado
    
    const now = new Date();
    const currentDay = dayNames[now.getDay()];
    
    console.log('🔍 [IS-STORE-OPEN] Dia atual do sistema:', currentDay);

    const daySchedule = settings.schedule ? settings.schedule[currentDay] : null;

    // Se não tem schedule configurado para hoje
    if (!daySchedule) {
      console.log('❌ LOJA FECHADA - Schedule do dia', currentDay, 'não encontrado no settings.schedule:', {
        schedule: settings.schedule,
        diaRequisitado: currentDay,
      });
      return false;
    }

    console.log(`📅 [IS-STORE-OPEN] Schedule carregado para ${currentDay}:`, daySchedule);

    // ⚠️ CRÍTICO: Verificar se o dia está marcado como FECHADO
    if (daySchedule.isOpen === false) {
      console.log('❌ LOJA FECHADA - Dia', currentDay, 'está marcado como FECHADO (isOpen=false)');
      return false;
    }

    if (!daySchedule.openTime || !daySchedule.closeTime) {
      console.log('❌ LOJA FECHADA - Horários não configurados para hoje:', {
        openTime: daySchedule.openTime,
        closeTime: daySchedule.closeTime,
      });
      return false;
    }

    // ⏰ Calcular hora atual em minutos
    const currentHour = now.getHours();
    const currentMinute = now.getMinutes();
    const currentTime = currentHour * 60 + currentMinute;

    try {
      const [openHour, openMinute] = daySchedule.openTime.split(':').map(Number);
      const [closeHour, closeMinute] = daySchedule.closeTime.split(':').map(Number);
      
      const openTime = openHour * 60 + openMinute;
      let closeTime = closeHour * 60 + closeMinute;
      
      console.log('⏰ [IS-STORE-OPEN] Verificando horário:', {
        horaAtual: `${currentHour}:${String(currentMinute).padStart(2, '0')} (${currentTime} min)`,
        horaAbertura: `${daySchedule.openTime} (${openTime} min)`,
        horaFechamento: `${daySchedule.closeTime} (${closeTime} min)`,
      });
      
      // Handle closing time past midnight (e.g., 00:00 means midnight)
      if (closeTime <= openTime) {
        closeTime += 24 * 60; // Add 24 hours
        const adjustedCurrentTime = currentTime < openTime ? currentTime + 24 * 60 : currentTime;
        const isOpen = adjustedCurrentTime >= openTime && adjustedCurrentTime < closeTime;
        console.log('⏰ [IS-STORE-OPEN] Horário com midnight:', isOpen ? `✅ ABERTA (${daySchedule.openTime}-${daySchedule.closeTime})` : `❌ FECHADA (${daySchedule.openTime}-${daySchedule.closeTime}) - Hora atual: ${now.toLocaleTimeString('pt-BR')}`);
        return isOpen;
      }

      const isOpen = currentTime >= openTime && currentTime < closeTime;
      const status = isOpen ? `✅ ABERTA (${daySchedule.openTime}-${daySchedule.closeTime})` : `❌ FECHADA (${daySchedule.openTime}-${daySchedule.closeTime})`;
      console.log('⏰ [IS-STORE-OPEN]', status, '- Hora atual:', now.toLocaleTimeString('pt-BR'));
      return isOpen;
    } catch (error) {
      console.error('Erro ao calcular horário de funcionamento:', error);
      return false;
    }
  },

  syncSettingsToSupabase: async () => {
    try {
      const { settings } = get();

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

      const { error } = await supabase
        .from('settings')
        .update(updateData)
        .eq('id', 'store-settings');

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
