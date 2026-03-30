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

        // Tentar obter sessão atual
        const {
          data: { session },
          error: sessionError,
        } = await supabase.auth.getSession();

        if (sessionError) throw sessionError;

        if (session?.user) {
          // Buscar tenant_id do admin_users
          const { data: adminUser, error: adminError } = await (supabase as any)
            .from('admin_users')
            .select('tenant_id')
            .eq('id', session.user.id)
            .single();

          if (adminError) {
            console.error('Error fetching admin user:', adminError);
            setAuthState(prev => ({
              ...prev,
              user: session.user,
              tenantId: null,
              error: 'Usuário não é admin',
            }));
            return;
          }

          setAuthState({
            user: session.user,
            tenantId: (adminUser as any)?.tenant_id,
            isLoading: false,
            error: null,
          });
        } else {
          setAuthState(prev => ({
            ...prev,
            user: null,
            tenantId: null,
            isLoading: false,
          }));
        }
      } catch (err) {
        console.error('Session restore error:', err);
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
      } else if (event === 'SIGNED_OUT') {
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
          // Buscar tenant_id
          const { data: adminUser, error: adminError } = await (supabase as any)
            .from('admin_users')
            .select('tenant_id')
            .eq('id', data.user.id)
            .single();

          if (adminError) {
            throw new Error('Usuário não é admin de nenhuma loja');
          }

          setAuthState({
            user: data.user,
            tenantId: (adminUser as any).tenant_id,
            isLoading: false,
            error: null,
          });

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
