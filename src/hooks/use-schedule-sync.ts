import { useEffect } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

/**
 * Hook que verifica schedule na inicialização
 * Se o schedule está incompleto (< 7 dias), carrega em memória sem sobrescrever Supabase
 * ✅ CORREÇÃO: Usa loadSettingsLocally() em vez de updateSettings() para NÃO 
 *    sobrescrever os horários que o admin configurou no Supabase
 */
export function useScheduleSync() {
  const settings = useSettingsStore((s) => s.settings);
  const loadSettingsLocally = useSettingsStore((s) => s.loadSettingsLocally);

  useEffect(() => {
    const checkAndFixSchedule = () => {
      const schedule = settings.schedule;
      
      if (!schedule) {
        console.warn('⚠️  [SCHEDULE-SYNC] Schedule não encontrado');
        return;
      }

      const allDays = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
      const presentDays = Object.keys(schedule) as (keyof typeof schedule)[];
      const missingDays = allDays.filter(day => !presentDays.includes(day as any));

      console.log('🔍 [SCHEDULE-SYNC] Verificando schedule:', {
        totalDias: presentDays.length,
        diasPresentes: presentDays,
        diasFaltando: missingDays,
      });

      if (missingDays.length > 0) {
        console.warn(`⚠️  [SCHEDULE-SYNC] Schedule incompleto! Faltam ${missingDays.length} dias:`, missingDays);
        
        // Corrigir o schedule com os days faltantes (SÓ em memória, SEM salvar no Supabase)
        const correctedSchedule = { ...schedule };
        
        const defaultDaySchedule = {
          isOpen: true,
          openTime: '18:00',
          closeTime: '23:00',
        };

        const specialDefaults: Record<string, any> = {
          monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' }, // Segunda fechada por padrão
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' }, // Sábado abre mais cedo, fecha depois
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },   // Domingo abre mais cedo
        };

        // Preencher dias faltantes
        for (const day of missingDays) {
          const dayKey = day as keyof typeof correctedSchedule;
          correctedSchedule[dayKey] = specialDefaults[day] || defaultDaySchedule;
          console.log(`✅ [SCHEDULE-SYNC] Adicionando ${day}:`, correctedSchedule[dayKey]);
        }

        // ✅ CORREÇÃO: Usar loadSettingsLocally() em vez de updateSettings()
        // Isso carrega os dados em memória SEM sobrescrever o Supabase
        console.log('💾 [SCHEDULE-SYNC] Carregando schedule CORRIGIDO em memória (SEM salvar no Supabase):', correctedSchedule);
        loadSettingsLocally({
          schedule: correctedSchedule as any,
        });

        console.log('✅ [SCHEDULE-SYNC] Schedule corrigido em memória com sucesso!');
      } else {
        console.log('✅ [SCHEDULE-SYNC] Schedule PERFEITO - todos os 7 dias presentes');
      }
    };

    checkAndFixSchedule();
  }, []);
}
