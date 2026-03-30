import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import type { Tenant } from './use-tenants-realtime';

export const useTenantManagement = () => {
  const [isLoading, setIsLoading] = useState(false);

  const getTenantDetails = async (tenantId: string) => {
    try {
      const { data: tenant } = await supabase
        .from('tenants')
        .select('*')
        .eq('id', tenantId)
        .single();

      const { data: settings } = await supabase
        .from('tenant_settings')
        .select('*')
        .eq('tenant_id', tenantId)
        .single();

      return { tenant, settings };
    } catch (err) {
      console.error('Erro ao buscar detalhes:', err);
      return { tenant: null, settings: null };
    }
  };

  const deleteTenant = async (tenantId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('tenants')
        .delete()
        .eq('id', tenantId);

      if (error) {
        toast.error(`Erro ao deletar: ${error.message}`);
        return false;
      }

      toast.success('Loja deletada com sucesso');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao deletar loja');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const suspendTenant = async (tenantId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('tenant_settings')
        .update({ is_active: false })
        .eq('tenant_id', tenantId);

      if (error) {
        toast.error(`Erro ao suspender: ${error.message}`);
        return false;
      }

      toast.success('Loja suspensa');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao suspender');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const activateTenant = async (tenantId: string): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('tenant_settings')
        .update({ is_active: true })
        .eq('tenant_id', tenantId);

      if (error) {
        toast.error(`Erro ao ativar: ${error.message}`);
        return false;
      }

      toast.success('Loja ativada');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao ativar');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  const updateTenantSettings = async (tenantId: string, settings: any): Promise<boolean> => {
    try {
      setIsLoading(true);

      const { error } = await supabase
        .from('tenant_settings')
        .update(settings)
        .eq('tenant_id', tenantId);

      if (error) {
        toast.error(`Erro ao atualizar: ${error.message}`);
        return false;
      }

      toast.success('Configurações atualizadas');
      return true;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erro ao atualizar');
      return false;
    } finally {
      setIsLoading(false);
    }
  };

  return {
    getTenantDetails,
    deleteTenant,
    suspendTenant,
    activateTenant,
    updateTenantSettings,
    isLoading,
  };
};
