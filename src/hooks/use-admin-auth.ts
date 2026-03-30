import { useCallback, useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface AdminAuthState {
  user: any;
  tenantId: string | null;
  isLoading: boolean;
  error: string | null;
}

export const useAdminAuth = () => {
  const [authState, setAuthState] = useState<AdminAuthState>({
    user: null,
    tenantId: null,
    isLoading: true,
    error: null,
  });

  // Restaurar sessão ao montar
  useEffect(() => {
    const restoreSession = async () => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true }));

        // ✅ STEP 1: Verificar sessionStorage PRIMEIRO (mais rápido)
        const cachedUserId = sessionStorage.getItem('sb-auth-user-id');
        const cachedTenantId = sessionStorage.getItem('sb-auth-tenant-id');
        
        if (cachedUserId && cachedTenantId) {
          console.log('[useAdminAuth] ✅ Restaurando de sessionStorage:', { cachedUserId, cachedTenantId });
          setAuthState({
            user: { id: cachedUserId },
            tenantId: cachedTenantId,
            isLoading: false,
            error: null,
          });
          return;
        }

        // ✅ STEP 2: Se sessionStorage vazio, tentar restaurar do Supabase Auth
        console.log('[useAdminAuth] ⏳ sessionStorage vazio, tentando restaurar do Supabase Auth...');
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();

        if (sessionError) {
          throw new Error(`Session error: ${sessionError.message}`);
        }

        if (!session?.user?.id) {
          console.log('[useAdminAuth] ❌ Nenhuma sessão ativa no Supabase Auth');
          setAuthState({
            user: null,
            tenantId: null,
            isLoading: false,
            error: null,
          });
          return;
        }

        // ✅ STEP 3: Sessão existe no Supabase! Buscar tenant_id
        console.log('[useAdminAuth] ✅ Sessão ativa encontrada, buscando tenant_id...');
        const { data: adminUser, error: adminError } = await (supabase as any)
          .from('admin_users')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();

        if (adminError) {
          throw new Error(`User não é admin: ${adminError.message}`);
        }

        const tenantId = (adminUser as any)?.tenant_id;
        if (!tenantId) {
          throw new Error('Admin user não tem tenant_id atribuído');
        }

        // ✅ SUCESSO! Salvar em sessionStorage e retornar estado autenticado
        sessionStorage.setItem('sb-auth-user-id', session.user.id);
        sessionStorage.setItem('sb-auth-tenant-id', tenantId);

        console.log('[useAdminAuth] ✅ Restaurado do Supabase Auth:', { userId: session.user.id, tenantId });
        setAuthState({
          user: session.user,
          tenantId,
          isLoading: false,
          error: null,
        });
      } catch (err) {
        console.error('[useAdminAuth] ❌ Erro ao restaurar sessão:', err);
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: err instanceof Error ? err.message : 'Erro ao restaurar sessão',
        }));
      }
    };

    restoreSession();

    // Escutar mudanças de autenticação
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        const { data: adminUser } = await (supabase as any)
          .from('admin_users')
          .select('tenant_id')
          .eq('id', session.user.id)
          .single();

        setAuthState({
          user: session.user,
          tenantId: (adminUser as any)?.tenant_id || null,
          isLoading: false,
          error: null,
        });
        
        // ✅ NOVO (30/03/2026): Salvar em sessionStorage
        if ((adminUser as any)?.tenant_id) {
          sessionStorage.setItem('sb-auth-user-id', session.user.id);
          sessionStorage.setItem('sb-auth-tenant-id', (adminUser as any).tenant_id);
        }
      } else if (event === 'SIGNED_OUT') {
        // Limpar sessionStorage ao desautenticar
        sessionStorage.removeItem('sb-auth-user-id');
        sessionStorage.removeItem('sb-auth-tenant-id');
        
        setAuthState({
          user: null,
          tenantId: null,
          isLoading: false,
          error: null,
        });
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      try {
        setAuthState(prev => ({ ...prev, isLoading: true, error: null }));

        const { data, error } = await supabase.auth.signInWithPassword({
          email: email.toLowerCase().trim(),
          password: password.trim(),
        });

        if (error) {
          setAuthState(prev => ({
            ...prev,
            isLoading: false,
            error: error.message,
          }));
          toast.error(error.message);
          return false;
        }

        if (data.user) {
          // Buscar tenant_id - adicionar retry graceful
          let retryCount = 0;
          const MAX_RETRIES = 3;
          let adminUser = null;
          let adminError = null;

          while (retryCount < MAX_RETRIES) {
            retryCount++;
            const result = await (supabase as any)
              .from('admin_users')
              .select('tenant_id, id, email')
              .eq('id', data.user.id)
              .single();

            if (!result.error) {
              adminUser = result.data;
              break;
            }

            adminError = result.error;
            console.warn(`[LOGIN] Tentativa ${retryCount}/${MAX_RETRIES} falhou:`, adminError?.message);

            if (retryCount < MAX_RETRIES) {
              // Esperar 300ms antes de retry
              await new Promise(resolve => setTimeout(resolve, 300));
            }
          }

          if (adminError || !adminUser?.tenant_id) {
            const errorMsg = adminError?.message || 'Tenant não encontrado';
            console.error('[LOGIN] ❌ Erro final ao buscar admin_users:', {
              userId: data.user.id,
              error: errorMsg,
              adminUser,
            });
            throw new Error(`Acesso negado: ${errorMsg}. Por favor, contacte suporte.`);
          }

          setAuthState({
            user: data.user,
            tenantId: adminUser.tenant_id,
            isLoading: false,
            error: null,
          });
          
          // ✅ Salvar em sessionStorage para usos posteriores
          sessionStorage.setItem('sb-auth-user-id', data.user.id);
          sessionStorage.setItem('sb-auth-tenant-id', adminUser.tenant_id);

          toast.success('Login realizado com sucesso!');
          return true;
        }

        return false;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao fazer login';
        setAuthState(prev => ({
          ...prev,
          isLoading: false,
          error: message,
        }));
        toast.error(message);
        return false;
      }
    },
    []
  );

  const logout = useCallback(async () => {
    try {
      setAuthState(prev => ({ ...prev, isLoading: true }));
      const { error } = await supabase.auth.signOut();

      if (error) throw error;
      
      // ✅ NOVO (30/03/2026): Limpar sessionStorage ao logout
      sessionStorage.removeItem('sb-auth-user-id');
      sessionStorage.removeItem('sb-auth-tenant-id');

      setAuthState({
        user: null,
        tenantId: null,
        isLoading: false,
        error: null,
      });
      toast.success('Desconectado com sucesso');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Erro ao desconectar';
      setAuthState(prev => ({
        ...prev,
        isLoading: false,
        error: message,
      }));
      toast.error(message);
    }
  }, []);

  const changePassword = useCallback(
    async (newPassword: string) => {
      try {
        const { error } = await supabase.auth.updateUser({
          password: newPassword,
        });

        if (error) throw error;
        toast.success('Senha alterada com sucesso!');
        return true;
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Erro ao alterar senha';
        toast.error(message);
        return false;
      }
    },
    []
  );

  return {
    ...authState,
    login,
    logout,
    changePassword,
  };
};
