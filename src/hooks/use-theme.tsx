import { useEffect, useState } from 'react';
import { useSettingsStore } from '@/store/useSettingsStore';

type Theme = 'light' | 'dark';

export function useTheme() {
  const defaultTenantTheme = useSettingsStore((s) => s.settings.default_theme || 'dark');
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      // ✅ PRIORIDADE 1: Preferência do cliente (localStorage)
      const stored = localStorage.getItem('theme') as Theme | null;
      if (stored) return stored;
      
      // ✅ PRIORIDADE 2: Tema padrão do tenant
      if (defaultTenantTheme) return defaultTenantTheme;
      
      // ✅ PRIORIDADE 3: Dark mode como fallback final
      return 'dark';
    }
    return defaultTenantTheme || 'dark';
  });

  // ✅ NOVO (07/04/2026): Reagir quando settings carregam do BD
  // Se settings.default_theme muda (carrega do BD), aplicar se cliente não tem preferência
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme') as Theme | null;
      // Só aplicar se cliente NÃO tem preferência no localStorage
      if (!stored && defaultTenantTheme) {
        console.log(`🎨 [USE-THEME] Settings carregadas! Aplicando tema padrão do tenant: ${defaultTenantTheme}`);
        setTheme(defaultTenantTheme);
      }
    }
  }, [defaultTenantTheme]);

  useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove('light', 'dark');
    root.classList.add(theme);
    localStorage.setItem('theme', theme);
  }, [theme]);

  const toggleTheme = () => {
    setTheme(prev => prev === 'light' ? 'dark' : 'light');
  };

  return { theme, setTheme, toggleTheme };
}
