import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  created_at: string;
  updated_at: string;
  whatsapp_notifications_enabled: boolean;
  timezone: string;
  mercadopago_access_token: string | null;
  mercadopago_refresh_token: string | null;
  mercadopago_user_id: string | null;
  mercadopago_merchant_account_id: string | null;
  mercadopago_connected_at: string | null;
  mercadopago_token_expires_at: string | null;
  mercadopago_oauth_state: string | null;
}

interface RealtimePayload {
  eventType: 'INSERT' | 'UPDATE' | 'DELETE';
  new: Record<string, unknown>;
  old: Record<string, unknown>;
}

export const useTenantsRealtime = () => {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Buscar tenants inicialmente
  const fetchTenants = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data, error: err } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (err) {
        setError(err.message);
        return;
      }

      setTenants((data as unknown as Tenant[]) || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao carregar lojas';
      setError(message);
      toast.error(message);
    } finally {
      setIsLoading(false);
    }
  };

  // Setup realtime subscription
  useEffect(() => {
    fetchTenants();

    const channel = supabase
      .channel('tenants-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tenants',
        },
        (payload: RealtimePayload) => {
          console.log('🔄 Tenants realtime update:', payload);

          if (payload.eventType === 'INSERT') {
            const newTenant = payload.new as unknown as Tenant;
            setTenants((prev) => [newTenant, ...prev]);
            toast.success('Nova loja cadastrada! 🎉');
          } else if (payload.eventType === 'UPDATE') {
            const updatedTenant = payload.new as unknown as Tenant;
            setTenants((prev) =>
              prev.map((t) => (t.id === updatedTenant.id ? updatedTenant : t))
            );
          } else if (payload.eventType === 'DELETE') {
            const deletedId = (payload.old as unknown as Tenant).id;
            setTenants((prev) => prev.filter((t) => t.id !== deletedId));
            toast.success('Loja deletada');
          }
        }
      )
      .subscribe();

    return () => {
      channel.unsubscribe();
    };
  }, []);

  return {
    tenants,
    isLoading,
    error,
    refetch: fetchTenants,
  };
};
