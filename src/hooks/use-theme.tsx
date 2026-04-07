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
