import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useSecureTenantId } from '@/hooks/use-secure-tenant-id';

interface WhatsAppInstance {
  id: string;
  establishment_name: string;
  evolution_instance_name: string;
  is_connected: boolean;
  created_at: string;
}

export const useWhatsAppInstanceSync = () => {
  const { tenantId } = useSecureTenantId();
  const [instances, setInstances] = useState<WhatsAppInstance[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Monitorar status de conexão de instâncias
  useEffect(() => {
    // ✅ Não executar se não tem tenantId autenticado
    if (!tenantId) {
      console.log('[WHATSAPP-SYNC] Aguardando autenticação...');
      return;
    }

    const interval = setInterval(async () => {
      try {
        // ✅ Buscar instâncias não conectadas FILTRADAS POR TENANT
        const { data: unconnectedInstances, error } = await (supabase as any)
          .from('whatsapp_instances')
          .select('*')
          .eq('tenant_id', tenantId)  // ← ADD TENANT FILTER
          .eq('is_connected', false)
          .order('created_at', { ascending: false });

        if (error) throw error;

        // Verificar status de cada instância na Evolution API
        if (unconnectedInstances && unconnectedInstances.length > 0) {
          for (const instance of unconnectedInstances) {
            try {
              const evolutionUrl = await supabase.functions.invoke(
                'check-whatsapp-connection',
                {
                  body: {
                    instance_name: (instance as any).evolution_instance_name,
                  },
                }
              );

              // Se connected, atualizar no banco
              if (evolutionUrl?.data?.is_connected) {
                await (supabase as any)
                  .from('whatsapp_instances')
                  .update({
                    is_connected: true,
                    last_connection_at: new Date().toISOString(),
                  })
                  .eq('id', instance.id);

                toast.success(`✅ ${(instance as any).establishment_name} conectado!`);
              }
            } catch (err) {
              console.log(`Instance ${(instance as any).evolution_instance_name} still connecting...`);
            }
          }
        }
      } catch (err) {
        console.error('Error checking instance status:', err);
      }
    }, 5000); // Verificar a cada 5 segundos

    return () => clearInterval(interval);
  }, [tenantId]);  // ← Add tenantId as dependency

  return { instances, isLoading };
};
