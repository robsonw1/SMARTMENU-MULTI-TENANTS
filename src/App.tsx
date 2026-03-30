import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { useEffect } from "react";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { useScheduleSync } from "@/hooks/use-schedule-sync";
// ✅ Hooks removidos da raiz (evita lock stealing no login):
// - useRealtimeSync → Index (cliente vê catálogo)
// - useAdminRealtimeSync → AdminDashboard (admin vê pedidos)
// - useSettingsRealtimeSync → AdminDashboard (admin edita settings)
// - useSettingsInitialLoad → AdminDashboard (admin carrega settings)
// - useSettingsUpdateListener → AdminDashboard (admin monitora updates)
import { useHostInfo } from "@/hooks/use-host-info";
import { initTenantResolver } from "@/lib/tenant-resolver";
import { useLoyaltySettingsStore } from "@/store/useLoyaltySettingsStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { PWAInstallBanner } from "@/components/PWAInstallBanner";
import Index from "./pages/Index";
import AdminLogin from "./pages/AdminLogin";
import AdminDashboard from "./pages/AdminDashboard";
import SuperAdminDashboard from "./pages/SuperAdminDashboard";
import PasswordReset from "./pages/PasswordReset";
import CadastroPage from "./pages/CadastroPage";
import RegisterTenantPage from "./pages/RegisterTenantPage";
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// Componente wrapper para usar hooks
const AppContent = () => {
  const { type: hostType } = useHostInfo();
  
  // ✅ NOVO (30/03/2026): Inicializar resolver de tenant_id
  // Isso resolve tenant_id UMA VEZ ao inicializar o app
  // Depois todos os hooks/components usam o cache (SEM fetch adicional)
  useEffect(() => {
    console.log('🚀 [APP-INIT] Inicializando tenant resolver...');
    initTenantResolver().then((tenantId) => {
      if (tenantId) {
        console.log(`✅ [APP-INIT] Tenant resolver inicializado: ${tenantId}`);
      } else {
        console.warn('⚠️ [APP-INIT] Não foi possível resolver tenant_id');
      }
    });
  }, []);
  
  // ✅ useScheduleSync() é seguro aqui (não usa auth)
  useScheduleSync();
  const { loadSettings } = useLoyaltySettingsStore();

  // Carregar configurações de fidelização ao iniciar
  useEffect(() => {
    loadSettings();
  }, [loadSettings]);

  // 🎯 Renderização condicional baseada no subdomain
  if (hostType === 'admin') {
    // admin-app.aezap.site → Super Admin Dashboard (gerencia todas as lojas)
    return (
      <Routes>
        <Route path="/" element={<SuperAdminDashboard />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/register-tenant" element={<RegisterTenantPage />} />
        <Route path="/admin" element={<SuperAdminDashboard />} />
        <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  if (hostType === 'tenant') {
    // {tenant-slug}-app.aezap.site → App do cliente
    return (
      <Routes>
        <Route path="/" element={<Index />} />
        <Route path="/cadastro" element={<CadastroPage />} />
        <Route path="/admin" element={<AdminLogin />} />
        <Route path="/admin/recuperar-senha" element={<PasswordReset />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    );
  }

  // hostType === 'landing' → app.aezap.site ou localhost
  return (
    <Routes>
      <Route path="/" element={<Index />} />
      <Route path="/cadastro" element={<CadastroPage />} />
      <Route path="/admin" element={<AdminLogin />} />
      <Route path="/admin/recuperar-senha" element={<PasswordReset />} />
      <Route path="/admin/dashboard" element={<AdminDashboard />} />
      {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <PWAInstallBanner />
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
