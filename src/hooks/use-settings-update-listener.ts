import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';
import { useSecureTenantId } from '@/hooks/use-secure-tenant-id';
import { supabase } from '@/integrations/supabase/client';

/**
 * Hook que monitora mudanças de settings pelo admin (via localStorage)
 * E força atualização dos dados no cliente em tempo real
 */
export function useSettingsUpdateListener() {
  const { tenantId } = useSecureTenantId();
  const loadSettingsLocally = useSettingsStore((s) => s.loadSettingsLocally);

  useEffect(() => {
    if (!tenantId) return;

    const handleSettingsUpdate = async () => {
      console.log('🔔 [CLIENT-LISTENER] Admin atualizou settings! Recarregando dados do Supabase...');
      
      try {
        const settingsId = `settings_${tenantId}`;
        
        // Forçar busca dos dados ATUALIZADOS do Supabase (sem cache)
        const { data, error } = await (supabase as any)
          .from('settings')
          .select('*')
          .eq('id', settingsId)
          .eq('tenant_id', tenantId)
          .single();

        if (error) {
          console.error('❌ [CLIENT-LISTENER] Erro ao recarregar settings:', error);
          return;
        }

        if (data) {
          const settingsData = data as any;
          const valueJson = settingsData.value || {};
          
          const updatedSchedule = valueJson.schedule || {
            monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
            tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
            saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
            sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
          };

          console.log('✅ [CLIENT-LISTENER] Horários recarregados do Supabase:', {
            monday: updatedSchedule.monday,
            tuesday: updatedSchedule.tuesday,
            wednesday: updatedSchedule.wednesday,
            thursday: updatedSchedule.thursday,
            friday: updatedSchedule.friday,
            saturday: updatedSchedule.saturday,
            sunday: updatedSchedule.sunday,
          });

          // Atualizar o store com os novos dados
          // ✅ NOVO: Usar loadSettingsLocally (SÓ em memória, SEM resalvar)
          loadSettingsLocally({
            name: valueJson.name || 'AEZap smartmenu',
            phone: valueJson.phone || '(11) 99999-9999',
            address: valueJson.address || 'Rua das neves, 123 - Centro',
            slogan: valueJson.slogan || 'smartmenu',
            schedule: updatedSchedule, // ✅ SCHEDULE ATUALIZADO
            isManuallyOpen: settingsData.is_manually_open ?? true,
            deliveryTimeMin: valueJson.deliveryTimeMin ?? 60,
            deliveryTimeMax: valueJson.deliveryTimeMax ?? 70,
            pickupTimeMin: valueJson.pickupTimeMin ?? 40,
            pickupTimeMax: valueJson.pickupTimeMax ?? 50,
            orderAlertEnabled: valueJson.orderAlertEnabled ?? true,
            sendOrderSummaryToWhatsApp: valueJson.sendOrderSummaryToWhatsApp ?? false,
            printnode_printer_id: settingsData.printnode_printer_id || null,
            print_mode: settingsData.print_mode || 'auto',
            auto_print_pix: settingsData.auto_print_pix ?? false,
            auto_print_card: settingsData.auto_print_card ?? false,
            auto_print_cash: settingsData.auto_print_cash ?? false,
            enableScheduling: settingsData.enable_scheduling ?? false,
            minScheduleMinutes: settingsData.min_schedule_minutes ?? 30,
            maxScheduleDays: settingsData.max_schedule_days ?? 7,
            allowSchedulingOnClosedDays: settingsData.allow_scheduling_on_closed_days ?? false,
            allowSchedulingOutsideBusinessHours: settingsData.allow_scheduling_outside_business_hours ?? false,
            respectBusinessHoursForScheduling: settingsData.respect_business_hours_for_scheduling ?? true,
            allowSameDaySchedulingOutsideHours: settingsData.allow_same_day_scheduling_outside_hours ?? false,
          });

          console.log('✅ [CLIENT-LISTENER] Settings re-sincronizadas com sucesso! Cliente agora vê os novos horários.');
        }
      } catch (error) {
        console.error('❌ [CLIENT-LISTENER] Erro ao sincronizar settings:', error);
      }
    };

    // Monitorar mudanças no localStorage (quando admin salva)
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key === 'settings-updated') {
        console.log('💾 [CLIENT-LISTENER] Evento storage detectado - Admin atualizou settings');
        handleSettingsUpdate();
      }
    };

    window.addEventListener('storage', handleStorageChange);

    // Verificador periódico para a mesma aba
    const checkInterval = setInterval(() => {
      const lastUpdate = localStorage.getItem('settings-updated');
      if (lastUpdate) {
        const lastUpdateTime = parseInt(lastUpdate);
        const now = Date.now();
        const timeDiff = now - lastUpdateTime;
        
        // Se foi atualizado nos últimos 2 segundos, recarregar IMEDIATAMENTE
        if (timeDiff < 2000 && timeDiff >= 0) {
          console.log(`⏱️ [CLIENT-LISTENER] Mudança recente detectada (${timeDiff}ms ago) - Sincronizando AGORA...`);
          handleSettingsUpdate();
        }
      }
    }, 500); // Verificar a cada 500ms (mais rápido)

    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(checkInterval);
    };
  }, [loadSettingsLocally]);
}
