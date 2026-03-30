/**
 * Script de diagnóstico e sincronização de settings
 * Execute no console do navegador para forçar sincronização
 */

(window as any).__diagnosticSettings = {
  /**
   * Limpar cache local e recarregar do Supabase
   */
  async clearCacheAndReload() {
    console.log('🧹 Limpando cache local...');
    localStorage.removeItem('forneiro-eden-settings');
    console.log('✅ Cache limpo! Recarregando página...');
    window.location.reload();
  },

  /**
   * Mostrar configurações atuais do localStorage
   */
  showLocalStorage() {
    const settings = localStorage.getItem('forneiro-eden-settings');
    if (settings) {
      const parsed = JSON.parse(settings);
      console.log('📦 LocalStorage Settings:', parsed.state);
    } else {
      console.log('❌ Nenhuma configuração em localStorage');
    }
  },

  /**
   * Forçar sincronização em tempo real
   */
  async forceSync() {
    console.log('🔄 Forçando sincronização...');
    // Disparar um evento customizado
    window.dispatchEvent(new CustomEvent('force-settings-sync'));
    console.log('✅ Sincronização solicitada');
  },

  /**
   * Testar conexão com Supabase
   */
  async testSupabaseConnection() {
    try {
      console.log('🔌 Testando conexão com Supabase...');
      
      // Importar Supabase dinamicamente
      const supabaseModule = await import('@/integrations/supabase/client');
      const supabase = supabaseModule.supabase;

      // ✅ NOTA: Para diagnóstico, usar ID genérico
      // Em produção, isso deve usar settings_${tenantId}
      // Testar SELECT
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'store-settings')
        .single();

      if (error) {
        console.error('❌ Erro ao conectar:', error);
        return;
      }

      console.log('✅ Conexão OK!');
          const settingsData = data as any;
          console.log('📥 Dados do Supabase:', {
        enable_scheduling: settingsData.enable_scheduling,
        min_schedule_minutes: settingsData.min_schedule_minutes,
        max_schedule_days: settingsData.max_schedule_days,
        allow_scheduling_on_closed_days: settingsData.allow_scheduling_on_closed_days,
      });
    } catch (error) {
      console.error('❌ Erro ao testar:', error);
    }
  },

  /**
   * Mostrar todos os comandos disponíveis
   */
  help() {
    console.log(`
🎯 Comandos disponíveis para diagnóstico:

1. __diagnosticSettings.clearCacheAndReload()
   - Limpa o localStorage e recarrega a página do zero

2. __diagnosticSettings.showLocalStorage()
   - Mostra as configurações salvas no localStorage

3. __diagnosticSettings.forceSync()
   - Força sincronização em tempo real

4. __diagnosticSettings.testSupabaseConnection()
   - Testa conexão com Supabase e mostra dados atualizados

5. __diagnosticSettings.help()
   - Mostra este menu de ajuda

💡 DICA: Se agendamento não sincroniza, execute:
   __diagnosticSettings.clearCacheAndReload()
    `);
  },
};

console.log('✅ Módulo de diagnóstico carregado!');
console.log('💡 Digite: __diagnosticSettings.help()');
