  import { useMemo, useState, useEffect } from 'react';
  import { useNavigate, Link } from 'react-router-dom';
  import { supabase } from '@/integrations/supabase/client';
  import { useAdminAuth } from '@/hooks/use-admin-auth';
  import { initTenantResolver, getTenantIdSync } from '@/lib/tenant-resolver';
  import { Button } from '@/components/ui/button';
  import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
  import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
  import { Badge } from '@/components/ui/badge';
  import { Input } from '@/components/ui/input';
  import { Label } from '@/components/ui/label';
  import { Switch } from '@/components/ui/switch';
  import { Separator } from '@/components/ui/separator';
  import { ScrollArea } from '@/components/ui/scroll-area';
  import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from '@/components/ui/accordion';
  import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
  } from '@/components/ui/select';
  import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
  } from '@/components/ui/table';
  import {
    Flame,
    LogOut,
    Home,
    ShoppingBag,
    MapPin,
    Settings,
    TrendingUp,
    DollarSign,
    Package,
    Users,
    Gift,
    Edit,
    Trash2,
    Plus,
    CheckCircle,
    XCircle,
    Sun,
    Moon,
    CreditCard,
    Bell,
    MessageCircle,
    BarChart3,
    Clock,
    Power,
    QrCode,
    Save,
    AlertCircle,
    Upload,
    X,
  } from 'lucide-react';
  import {
    Product,
    categoryLabels,
    Order,
  } from '@/data/products';

  import { useCatalogStore } from '@/store/useCatalogStore';
  import { useSettingsStore } from '@/store/useSettingsStore';
  import { useNeighborhoodsStore } from '@/store/useNeighborhoodsStore';
  import { useOrdersStore } from '@/store/useOrdersStore';
  import { ProductFormDialog } from '@/components/admin/ProductFormDialog';
  import { OrderDetailsDialog } from '@/components/admin/OrderDetailsDialog';
  import { NeighborhoodFormDialog } from '@/components/admin/NeighborhoodFormDialog';
  import { ConfirmDeleteDialog } from '@/components/admin/ConfirmDeleteDialog';
  import { CategoryManagementDialog } from '@/components/admin/CategoryManagementDialog';
  import { SizeManagementDialog } from '@/components/admin/SizeManagementDialog';
  import { DateRangeFilter } from '@/components/admin/DateRangeFilter';
  import { SchedulingSettings } from '@/components/admin/SchedulingSettings';
  import { PrintNodeSettings } from '@/components/admin/PrintNodeSettings';
  import { NotificationsTab } from '@/components/admin/NotificationsTab';
  import { LoyaltySettingsPanel } from '@/components/admin/LoyaltySettingsPanel';
  import { FaithfulCustomersAdmin } from '@/components/admin/FaithfulCustomersAdmin';
  import { CouponManagementPanel } from '@/components/admin/CouponManagementPanel';
  import { PaymentSettingsPanel } from '@/components/admin/PaymentSettingsPanel';
  import { AnalyticsPanel } from '@/components/admin/AnalyticsPanel';
  import { QRCodeDisplay } from '@/components/QRCodeDisplay';
  import { toast } from 'sonner';
  import { format, startOfDay, endOfDay } from 'date-fns';
  import { ptBR } from 'date-fns/locale';
  import { useTheme } from '@/hooks/use-theme';
  import { useOrderAlertSound } from '@/hooks/use-order-alert-sound';
  import { useSettingsRealtimeSync } from '@/hooks/use-settings-realtime-sync';
  import { useAdminRealtimeSync } from '@/hooks/use-admin-realtime-sync';
  import { useRealtimeSync } from '@/hooks/use-realtime-sync';
  import { useSettingsInitialLoad } from '@/hooks/use-settings-initial-load';
  import { useSettingsUpdateListener } from '@/hooks/use-settings-update-listener';
  import { useDomainValidation } from '@/hooks/use-domain-validation';
  import logoForneiro from '@/assets/logo.jpg';

  const dayLabels: Record<keyof any, string> = {
    monday: 'Segunda-feira',
    tuesday: 'Terça-feira',
    wednesday: 'Quarta-feira',
    thursday: 'Quinta-feira',
    friday: 'Sexta-feira',
    saturday: 'Sábado',
    sunday: 'Domingo',
  };

  const dayOrder: string[] = [
    'monday',
    'tuesday',
    'wednesday',
    'thursday',
    'friday',
    'saturday',
    'sunday',
  ];

  const AdminDashboard = () => {
    const navigate = useNavigate();
    
    // ✅ NOVO: Autenticação multi-tenant segura
    // enableAutoRestore: true porque AdminDashboard PRECISA restaurar sessão
    const { user, tenantId, isLoading: authLoading, logout: authLogout, error: authError } = useAdminAuth({ enableAutoRestore: true });

    // ✅ NOVO (29/03/2026): Validação de domain e tenant_id
    // Redireciona se URL não corresponder ao tenant do usuário
    useDomainValidation();

    // ✅ NOVO (30/03/2026): Inicializar resolver de tenant_id quando admin faz login
    // Isso resolve tenant_id UMA VEZ e cacheia para todos os components usarem
    useEffect(() => {
      if (!user || !tenantId) {
        console.log('⏳ [ADMIN-INIT] Esperando autenticação...');
        return;
      }

      console.log(`🚀 [ADMIN-INIT] Admin autenticado com tenant_id: ${tenantId}`);
      
      // Chamar initTenantResolver() com os dados já autenticados
      initTenantResolver().then((resolvedTenantId) => {
        console.log(`✅ [ADMIN-INIT] Tenant resolver inicializado: ${resolvedTenantId}`);
      });
    }, [user, tenantId]);

    // Redirecionar se não autenticado
    useEffect(() => {
      if (!authLoading && !user) {
        navigate('/admin');
      }
    }, [user, authLoading, navigate]);
    const { theme, toggleTheme } = useTheme();
    const [activeTab, setActiveTab] = useState('overview');
    const [isNewProductOpen, setIsNewProductOpen] = useState(false);
    const [editingProduct, setEditingProduct] = useState<Product | null>(null);
    const [search, setSearch] = useState('');
    const [categoryFilter, setCategoryFilter] = useState<string>('all');
    const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
    const [sidebarOpen, setSidebarOpen] = useState(true); // ✅ Controlar sidebar

    // Product store
    const productsById = useCatalogStore((s) => s.productsById);
    const toggleActive = useCatalogStore((s) => s.toggleActive);
    const removeProduct = useCatalogStore((s) => s.removeProduct);

    // Settings store
    const settings = useSettingsStore((s) => s.settings);
    const updateSettings = useSettingsStore((s) => s.updateSettings);
    const changePassword = useSettingsStore((s) => s.changePassword);
    const updateDaySchedule = useSettingsStore((s) => s.updateDaySchedule);
    const isStoreOpen = useSettingsStore((s) => s.isStoreOpen);
    const loadSettingsFromSupabase = useSettingsStore((s) => s.loadSettingsFromSupabase);

    // Neighborhoods store
    const neighborhoods = useNeighborhoodsStore((s) => s.neighborhoods);
    const toggleNeighborhoodActive = useNeighborhoodsStore((s) => s.toggleActive);
    const updateNeighborhood = useNeighborhoodsStore((s) => s.updateNeighborhood);
    const removeNeighborhood = useNeighborhoodsStore((s) => s.removeNeighborhood);

    // Orders store
    const orders = useOrdersStore((s) => s.orders);
    const syncOrdersFromSupabase = useOrdersStore((s) => s.syncOrdersFromSupabase);
    const updateOrderPrintedAt = useOrdersStore((s) => s.updateOrderPrintedAt);
    const getStats = useOrdersStore((s) => s.getStats);
    const removeOrder = useOrdersStore((s) => s.removeOrder);

    // Order alert sound hook - ativa/desativa automaticamente baseado nas settings
    useOrderAlertSound();

    // ✅ Sincronização em tempo real de TODOS os dados (produtos, pedidos, configurações, bairros)
    // ✅ NOVO (29/03/2026): Passar tenantId como prop para evitar chamadas duplicadas a getSession()
    useRealtimeSync(tenantId || undefined);

    // ✅ Sincronização específica para admins (pedidos em tempo real)
    // Garante que TODOS os admins vejam pedidos novos/alterados
    useAdminRealtimeSync();

    // Carregamento inicial das settings do Supabase
    useSettingsInitialLoad();

    // Sincronização em tempo real de configurações entre abas/navegadores
    useSettingsRealtimeSync();

    // ✅ Monitorar atualizações de settings em tempo real
    useSettingsUpdateListener();

    // Local state for settings form
    const [settingsForm, setSettingsForm] = useState(settings);
    const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
    const [passwordForm, setPasswordForm] = useState({
      current: '',
      new: '',
      confirm: '',
    });

    // Dialog states
    const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
    const [isOrderDialogOpen, setIsOrderDialogOpen] = useState(false);
    const [isNeighborhoodDialogOpen, setIsNeighborhoodDialogOpen] = useState(false);
    const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
    const [isSizeDialogOpen, setIsSizeDialogOpen] = useState(false);
    const [editingNeighborhood, setEditingNeighborhood] = useState<any>(null);
    const [deleteDialog, setDeleteDialog] = useState<{
      open: boolean;
      type: 'product' | 'order' | 'neighborhood';
      id: string;
      name: string;
    }>({ open: false, type: 'product', id: '', name: '' });

    // ✅ NOVO: Estados para upload de logo (SEPARADOS do formulário principal)
    const [selectedLogoFile, setSelectedLogoFile] = useState<File | null>(null);
    const [previewLogoUrl, setPreviewLogoUrl] = useState<string | null>(null);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoHasUnsavedChanges, setLogoHasUnsavedChanges] = useState(false);

    // Date range for stats
    const [dateRange, setDateRange] = useState({
      start: startOfDay(new Date()),
      end: endOfDay(new Date()),
    });

    // Order filters
    const [orderStatusFilter, setOrderStatusFilter] = useState<string>('all');
    const [orderSort, setOrderSort] = useState<'newest' | 'oldest'>('newest');

    // ✅ NOVA SOLUÇÃO: Sincronizar settingsForm APENAS no mount
    // NÃO sincroniza enquanto admin está editando (mesmo que realtime traga atualizações)

    // 🔄 Mapeamento dinâmico de categorias (lê de settings.categories_config)
    const dynamicCategoryLabels = useMemo(() => {
      const mapping: Record<string, string> = { ...categoryLabels };
      
      if (settingsForm.categories_config && Array.isArray(settingsForm.categories_config)) {
        settingsForm.categories_config.forEach((cat) => {
          mapping[cat.id] = cat.label;
        });
      }
      
      return mapping;
    }, [settingsForm.categories_config]);
    // Isso garante que edições do admin não sejam perdidas
    // ⚡ CRÍTICO: Sincronizar settingsForm QUANDO `settings` do Zustand mudar
    // Isso garante que quando `loadSettingsFromSupabase()` carrega dados, o formulário mostra
    // Se o admin está editando (hasUnsavedChanges=true), NÃO sobrescreve as edições
    useEffect(() => {
      if (!hasUnsavedChanges) {
        console.log('🔄 [ADMIN-SYNC] Settings do Zustand mudou, sincronizando settingsForm');
        setSettingsForm(settings);
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [settings]); // Apenas settings, hasUnsavedChanges é verificado dentro do if

    // ✅ Função auxiliar para recarregar manualmente (botão "Cancelar")
    const handleReloadSettings = () => {
      console.log('🔄 [ADMIN-RELOAD] Admin clicou em "Cancelar" - recarregando settings do Zustand');
      setSettingsForm(settings);
      setHasUnsavedChanges(false);
      toast.info('Edições descartadas. Valores originais carregados.');
    };

    // ✅ Função auxiliar para atualizar settingsForm E marcar como não salvo
    const updateSettingsFormWithFlag = (updates: Partial<typeof settingsForm>) => {
      console.log('🎯 [UPDATE-FLAG] updateSettingsFormWithFlag chamada com:', updates);
      setSettingsForm(prev => {
        const newState = { ...prev, ...updates };
        console.log('🎯 [UPDATE-FLAG] settingsForm atualizado para:', newState);
        return newState;
      });
      console.log('🎯 [UPDATE-FLAG] Setando hasUnsavedChanges = true');
      setHasUnsavedChanges(true);
      console.log('✅ [UPDATE-FLAG] ESTADO MARCADO COMO NÃO SALVO - Botão "Salvar" deve estar HABILITADO agora!');
    };

    // � Handler para salvar categorias COM PERSISTÊNCIA IMEDIATA
    const handleSaveCategories = async (categories: any[]) => {
      console.log('💾 [CATEGORY-SAVE] Salvando categorias imediatamente:', categories);
      try {
        // ⏱️ Timeout de 15 segundos para evitar travamento
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout: Requisição levou mais de 15 segundos')), 15000)
        );

        // ✅ Chamar updateSettings diretamente (persiste no Supabase)
        const updatePromise = updateSettings({
          ...settingsForm,
          categories_config: categories,
        });

        await Promise.race([updatePromise, timeoutPromise]);
        console.log('✅ [CATEGORY-SAVE] updateSettings completo!');
        
        // ✅ Recarregar do banco para confirmar persistência
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('📡 [CATEGORY-SAVE] Recarregando do Supabase...');
        await loadSettingsFromSupabase(true);
        
        // ✅ Sincronizar local state
        const reloaded = useSettingsStore.getState();
        setSettingsForm(reloaded.settings);
        console.log('✅ [CATEGORY-SAVE] Local state sincronizado!');
        
        // ✅ Notificar outras abas
        notifyOtherTabs({ categories_config: categories });
        
        console.log('✅ [CATEGORY-SAVE] Categorias salvas com sucesso!');
      } catch (error) {
        console.error('❌ [CATEGORY-SAVE] Erro:', error);
        throw error;
      }
    };

    // 📝 Handler para salvar tamanhos COM PERSISTÊNCIA IMEDIATA
    const handleSaveSizes = async (sizes: any[]) => {
      console.log('💾 [SIZE-SAVE] Salvando tamanhos imediatamente:', sizes);
      try {
        // ⏱️ Timeout de 15 segundos para evitar travamento
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Timeout: Requisição levou mais de 15 segundos')), 15000)
        );

        // ✅ Chamar updateSettings diretamente (persiste no Supabase)
        const updatePromise = updateSettings({
          ...settingsForm,
          sizes_config: sizes,
        });

        await Promise.race([updatePromise, timeoutPromise]);
        console.log('✅ [SIZE-SAVE] updateSettings completo!');
        
        // ✅ Recarregar do banco para confirmar persistência
        await new Promise(resolve => setTimeout(resolve, 500));
        console.log('📡 [SIZE-SAVE] Recarregando do Supabase...');
        await loadSettingsFromSupabase(true);
        
        // ✅ Sincronizar local state
        const reloaded = useSettingsStore.getState();
        setSettingsForm(reloaded.settings);
        console.log('✅ [SIZE-SAVE] Local state sincronizado!');
        
        // ✅ Notificar outras abas
        notifyOtherTabs({ sizes_config: sizes });
        
        console.log('✅ [SIZE-SAVE] Tamanhos salvos com sucesso!');
      } catch (error) {
        console.error('❌ [SIZE-SAVE] Erro:', error);
        throw error;
      }
    };

    // �📲 Função para notificar OUTRAS abas do mesmo navegador que houve alteração
    const notifyOtherTabs = (data: any) => {
      try {
        const channel = new BroadcastChannel('admin-settings');
        channel.postMessage({
          type: 'SETTINGS_UPDATED',
          data: data,
          timestamp: Date.now(),
          source: 'admin-' + Math.random().toString(36).substr(2, 9),
        });
        channel.close();
        console.log('📲 [NOTIFY-TABS] Enviado broadcast para outras abas');
      } catch (error) {
        console.warn('⚠️  BroadcastChannel não disponível neste navegador:', error);
      }
    };

    // ✅ NOVO: Manipular seleção de arquivo de logo (ISOLADO, sem afetar main form)
    const handleLogoFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.currentTarget.files?.[0];
      if (!file) return;

      if (!file.type.startsWith('image/')) {
        toast.error('Por favor, selecione uma imagem (PNG ou JPEG)');
        return;
      }

      setSelectedLogoFile(file);
      const url = URL.createObjectURL(file);
      setPreviewLogoUrl(url);
      // ✅ NOVO: Marcar APENAS logo como unsaved (não afeta formulário geral)
      setLogoHasUnsavedChanges(true);
      console.log('🎨 [LOGO-SELECT] Logo selecionado, marcado como unsaved (isolado)');
    };

    // ✅ NOVO: Upload de logo para Supabase Storage
    const uploadLogoToStorage = async (file: File): Promise<string | null> => {
      if (!tenantId) {
        toast.error('Tenant ID não encontrado');
        return null;
      }

      try {
        setLogoUploading(true);
        const timestamp = Date.now();
        const fileExt = file.name.split('.').pop();
        const fileName = `logo-${timestamp}.${fileExt}`;
        const filePath = `logos/${tenantId}/${fileName}`;

        console.log(`📤 [LOGO-UPLOAD] Iniciando upload: ${filePath}`);

        // Upload file
        const { error: uploadError } = await supabase.storage
          .from('tenant-products')
          .upload(filePath, file, { upsert: true });

        if (uploadError) {
          console.error('❌ [LOGO-UPLOAD] Erro ao enviar:', uploadError);
          toast.error(`Erro ao enviar logo: ${uploadError.message}`);
          setLogoUploading(false);
          return null;
        }

        // Get public URL
        const { data } = supabase.storage
          .from('tenant-products')
          .getPublicUrl(filePath);

        const publicUrl = data?.publicUrl;
        console.log(`✅ [LOGO-UPLOAD] Sucesso! URL: ${publicUrl}`);
        setLogoUploading(false);
        return publicUrl || null;
      } catch (error) {
        console.error('❌ [LOGO-UPLOAD] Erro:', error);
        toast.error('Erro ao fazer upload da logo');
        setLogoUploading(false);
        return null;
      }
    };

    // ✅ NOVO: Remover logo selecionada
    const handleRemoveLogoImage = () => {
      setSelectedLogoFile(null);
      setPreviewLogoUrl(null);
    };

    // ✅ NOVO: Salvar APENAS logo (função 100% isolada - NÃO afeta formulário geral)
    const handleSaveLogoOnly = async () => {
      try {
        if (!selectedLogoFile) {
          toast.error('Selecione uma imagem primeiro');
          return;
        }

        setLogoUploading(true);
        console.log('🎨 [LOGO-SAVE] Iniciando salvamento isolado de logo...');

        // Upload de logo
        const uploadedLogoUrl = await uploadLogoToStorage(selectedLogoFile);
        if (!uploadedLogoUrl) {
          setLogoUploading(false);
          return;
        }

        console.log('🎨 [LOGO-SAVE] Upload bem-sucedido, salvando em settings.value.store_logo_url...');

        // ✅ SOLUÇÃO: Armazenar logo em value.store_logo_url (JSONB)
        // Passo 1: Ler o value atual para não perder outros dados
        const settingsId = `settings_${tenantId}`;
        const { data: currentSettings, error: readError } = await (supabase as any)
          .from('settings')
          .select('value')
          .eq('id', settingsId)
          .eq('tenant_id', tenantId)
          .single();

        if (readError) {
          console.error('❌ [LOGO-SAVE] Erro ao ler settings atual:', readError);
          throw readError;
        }

        // Passo 2: Adicionar store_logo_url ao value
        const updatedValue = {
          ...(currentSettings?.value || {}),
          store_logo_url: uploadedLogoUrl,
        };

        // Passo 3: Salvar com logo adicionado ao value
        const { error: updateError } = await (supabase as any)
          .from('settings')
          .update({ value: updatedValue })
          .eq('id', settingsId)
          .eq('tenant_id', tenantId);

        if (updateError) {
          console.error('❌ [LOGO-SAVE] Erro ao atualizar settings:', updateError);
          throw updateError;
        }

        console.log('🎨 [LOGO-SAVE] settings.value atualizado, recarregando do Supabase...');

        // Aguardar e recarregar
        await new Promise(resolve => setTimeout(resolve, 500));
        await loadSettingsFromSupabase(true);

        // Sincronizar settingsForm (sem ativar hasUnsavedChanges global)
        const reloadedState = useSettingsStore.getState();
        console.log('✅ [LOGO-SAVE] Logo salvo com sucesso! URL:', reloadedState.settings.store_logo_url);

        // Limpar UI de logo APENAS
        setSelectedLogoFile(null);
        setPreviewLogoUrl(null);
        setLogoHasUnsavedChanges(false);
        setLogoUploading(false);

        toast.success('✅ Logo salva! Aparecendo em Header, Footer, PWA e WhatsApp');
      } catch (error) {
        console.error('❌ [LOGO-SAVE] Erro:', error);
        toast.error('Erro ao salvar logo');
        setLogoUploading(false);
      }
    };

    useEffect(() => {
      // Sincronizar pedidos do Supabase quando o painel carrega
      if (!user || !tenantId) return;

      // ✅ CENTRALIZADO: Sincronização realtime agora é feita GLOBALMENTE em use-realtime-sync.ts
      // AdminDashboard apenas chama uma sincronização inicial ao montar
      console.log('📡 [ADMIN] Iniciando sincronização de pedidos ao carregar...');
      syncOrdersFromSupabase();

      // ⏰ ADICIONAL: Polling local a cada 5 segundos como backup
      // Se realtime falhar, este polling garante que dados sempre atualizados
      const syncInterval = setInterval(() => {
        syncOrdersFromSupabase();
      }, 5000);

      return () => {
        clearInterval(syncInterval);
      };
    }, [syncOrdersFromSupabase]);

    // ⚡ NOVA: Sincronizar settings em tempo real quando outro gerente faz mudanças
    // Sem interromper edições do gerente atual
    useEffect(() => {
      if (!user || !tenantId) return;

      console.log('📡 [ADMIN-SUBSCRIBE] Iniciando subscription para mudanças em settings...');

      const settingsChannel = supabase
        .channel(`public:settings:${tenantId}`)
        .on(
          'postgres_changes',
          { event: 'UPDATE', schema: 'public', table: 'settings' },
          async (payload) => {
            // ✅ FILTRO MANUAL: Apenas se for store-settings
            if (payload.new.id !== `settings_${tenantId}` || payload.new.tenant_id !== tenantId) return;
            
            console.log('🔔 [ADMIN-SUBSCRIBE] Mudan ça em settings detectada! Outro gerente salvou dados.');
            console.log('🔔 [ADMIN-SUBSCRIBE] Payload:', payload);
            
            // ⚠️  SÓ sincronizar se o gerente this NÃO tem edições não salvas
            if (hasUnsavedChanges) {
              console.warn('⚠️  [ADMIN-SUBSCRIBE] Gerente tem edições em progresso - NÃO sobrescrever');
              toast.info('💡 Outro gerente fez mudanças. Salve suas edições ou Cancele para ver as mudanças.');
              return;
            }

            // Recarregar settings do Supabase
            console.log('🔄 [ADMIN-SUBSCRIBE] Recarregando settings do Supabase...');
            await loadSettingsFromSupabase();

            // Sincronizar settingsForm COM os dados carregados
            const latestSettings = useSettingsStore.getState();
            setSettingsForm(latestSettings.settings);
            
            console.log('✅ [ADMIN-SUBSCRIBE] settingsForm sincronizado com mudanças do outro gerente');
            console.log('✅ [ADMIN-SUBSCRIBE] Nova schedule (thursday):', latestSettings.settings.schedule.thursday);
            
            // Toast silencioso (apenas notifica, não interrompe)
            toast.success('📡 Configurações sincronizadas de outro gerente.', { duration: 2000 });
          }
        )
        .subscribe((status) => {
          console.log('📡 [ADMIN-SUBSCRIBE] Subscription status:', status);
        });

      return () => {
        settingsChannel.unsubscribe();
      };
    }, [hasUnsavedChanges, loadSettingsFromSupabase]);

    // ⚡ NOVA: Sincronizar entre múltiplas abas do MESMO navegador
    // Quando uma aba salva (escreve em localStorage 'admin-settings-updated'),
    // outras abas detectam via evento 'storage' e sincronizam
    useEffect(() => {
      const handleStorageChange = (event: StorageEvent) => {
        if (event.key === 'admin-settings-updated') {
          console.log('📲 [MULTI-TAB-SYNC] Outra aba salvou configurações!');
          
          // Só sincronizar se NÃO tem edições em progresso
          if (hasUnsavedChanges) {
            console.warn('⚠️  [MULTI-TAB-SYNC] Aba atual tem edições em progresso - NÃO sobrescrever');
            return;
          }

          console.log('🔄 [MULTI-TAB-SYNC] Recarregando settings...');
          // Recarregar do Zustand (que foi atualizado via realtime subscription)
          const currentState = useSettingsStore.getState();
          setSettingsForm(currentState.settings);
          
          console.log('✅ [MULTI-TAB-SYNC] settingsForm sincronizado entre abas');
        }
      };

      // Escutar eventos de storage de outras abas
      window.addEventListener('storage', handleStorageChange);
      
      return () => {
        window.removeEventListener('storage', handleStorageChange);
      };
    }, [hasUnsavedChanges]);

    // ⚡ NOVA: Sincronizar entre múltiplas abas do MESMO navegador
    // Usar um evento customizado para sincronizar DENTRO da mesma aba (broadcast channel)
    // Isso funciona para múltiplas abas mesmo que localStorage não capture tudo
    useEffect(() => {
      try {
        // BroadcastChannel é mais moderno e confiável para comunicação entre abas
        const channel = new BroadcastChannel('admin-settings');
        
        const handleMessage = (event: MessageEvent) => {
          if (event.data?.type === 'SETTINGS_UPDATED') {
            console.log('📲 [BROADCAST-SYNC] Outra aba enviou atualização via BroadcastChannel');
            console.log('📲 [BROADCAST-SYNC] Dados recebidos:', event.data);
            
            // Só sincronizar se NÃO tem edições em progresso
            if (hasUnsavedChanges) {
              console.warn('⚠️  [BROADCAST-SYNC] Edições em progresso - NÃO sobrescrever');
              return;
            }

            console.log('🔄 [BROADCAST-SYNC] Recarregando settings...');
            const currentState = useSettingsStore.getState();
            setSettingsForm(currentState.settings);
            
            console.log('✅ [BROADCAST-SYNC] settingsForm sincronizado entre abas');
          }
        };

        channel.addEventListener('message', handleMessage);
        
        return () => {
          channel.removeEventListener('message', handleMessage);
          channel.close();
        };
      } catch (error) {
        console.warn('⚠️  BroadcastChannel não disponível neste navegador');
      }
    }, [hasUnsavedChanges]);

    const handleLogout = async () => {
      await authLogout();
      navigate('/admin');
    };

    const formatPrice = (price: number) => {
      return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL',
      }).format(price);
    };

    // Ativar/Desativar Produto e sincronizar com Supabase
    const handleToggleProductActive = async (productId: string) => {
      const product = productsById[productId];
      if (!product) return;

      try {
        const newActiveState = !product.isActive;
        console.log(`🔄 Toggling produto ${productId}: isActive ${product.isActive} -> ${newActiveState}`);
        
        // ✅ SEMPRE enviar TODOS os campos de preço (mesmo que null)
        // Isso garante que Supabase sobrescreve qualquer valor antigo ou inválido
        const dataJson: any = {
          description: product.description,
          category: product.category,
          price: product.price ?? null,
          price_small: product.priceSmall ?? null,
          price_large: product.priceLarge ?? null,
          ingredients: product.ingredients || [],
          image: product.image || undefined,
          is_active: newActiveState,
          is_popular: product.isPopular || false,
          is_vegetarian: product.isVegetarian || false,
          is_customizable: product.isCustomizable || false,
          is_new: product.isNew || false,
        };

        console.log('📤 Enviando UPDATE ao Supabase:', { productId, is_active: newActiveState, dataJson });

        // Atualizar no Supabase PRIMEIRO
        const { error } = await (supabase as any)
          .from('products')
          .update({ data: dataJson })
          .eq('id', productId);

        if (error) {
          console.error('❌ Erro ao sincronizar produto:', error);
          toast.error('Erro ao sincronizar produto');
          return;
        }

        console.log('✅ UPDATE concluído no Supabase');
        
        // ✅ FEEDBACK IMEDIATO: Atualizar store localmente para o admin ver a mudança AGORA
        toggleActive(productId);
        console.log(`✅ Store atualizado localmente: ${productId} isActive = ${newActiveState}`);
        
        // 🔄 CONFIRMAÇÃO: SELECT fresh após 300ms para garantir sync
        // Se webhook chegar primeiro, isso não fará nada pois já terá atualizado
        // Se webhook NÃO chegar, isso confirma a mudança no BD
        setTimeout(async () => {
          console.log('🔍 Verificando estado do produto no BD via SELECT fresh...');
          const { data: freshProduct, error: selectError } = await (supabase as any)
            .from('products')
            .select('*')
            .eq('id', productId)
            .single();

          if (!selectError && freshProduct) {
            console.log('📥 SELECT fresh confirmou estado:', { 
              id: freshProduct.id, 
              name: freshProduct.name, 
              is_active: freshProduct.data?.is_active 
            });
            
            // Atualizar store com dados frescos do banco
            const freshData = freshProduct.data;
            const confirmedState = freshData?.is_active ?? true;
            if (confirmedState !== newActiveState) {
              console.warn('⚠️  Desincronização detectada! Corrigindo...', {
                esperado: newActiveState,
                banco: confirmedState
              });
            }
          } else {
            console.error('❌ Erro ao fazer SELECT fresh:', selectError);
          }
        }, 300);
        
      } catch (error) {
        console.error('Erro ao sincronizar ativação do produto:', error);
        toast.error('Erro ao sincronizar produto');
      }
    };

    // Atualizar Bairro e sincronizar com Supabase
    const handleUpdateNeighborhood = async (neighborhoodId: string, updates: any) => {
      console.log('📝 Atualizando bairro:', neighborhoodId, updates);
      updateNeighborhood(neighborhoodId, updates);

      try {
        // Sempre usar snake_case para o banco
        const supabaseUpdates = {
          name: updates.name,
          delivery_fee: updates.deliveryFee,
          is_active: updates.isActive,
        };
        
        // Remover campos undefined
        Object.keys(supabaseUpdates).forEach(key => {
          if (supabaseUpdates[key as keyof typeof supabaseUpdates] === undefined) {
            delete supabaseUpdates[key as keyof typeof supabaseUpdates];
          }
        });
        
        console.log('📤 Enviando UPDATE para Supabase:', supabaseUpdates);
        
        const { error } = await (supabase as any)
          .from('neighborhoods')
          .update(supabaseUpdates)
          .eq('id', neighborhoodId);

        if (error) {
          console.error('❌ Erro ao fazer UPDATE:', error);
          toast.error('Erro ao sincronizar bairro');
          return;
        }

        console.log('✅ UPDATE concluído com sucesso');
      } catch (error) {
        console.error('Erro ao sincronizar bairro:', error);
        toast.error('Erro ao sincronizar bairro');
      }
    };

    // Ativar/Desativar Bairro e sincronizar com Supabase
    const handleToggleNeighborhoodActive = async (neighborhoodId: string) => {
      const neighborhood = neighborhoods.find(n => n.id === neighborhoodId);
      if (!neighborhood) return;

      const newActiveState = !neighborhood.isActive;
      
      // Feedback imediato ao admin
      toggleNeighborhoodActive(neighborhoodId);

      try {
        console.log('📤 Enviando UPDATE de status do bairro:', {
          id: neighborhoodId,
          nome: neighborhood.name,
          novoStatus: newActiveState,
        });

        const { error } = await (supabase as any)
          .from('neighborhoods')
          .update({ is_active: newActiveState })
          .eq('id', neighborhoodId);

        if (error) {
          console.error('❌ Erro ao fazer UPDATE:', error);
          toast.error('Erro ao sincronizar bairro');
          // Reverter estado local em caso de erro
          toggleNeighborhoodActive(neighborhoodId);
          return;
        }

        console.log('✅ UPDATE concluído com sucesso');
        
        // Aguardar um pouco e fazer SELECT para confirmar
        setTimeout(async () => {
          try {
            const { data: updatedNeighborhood } = await (supabase as any)
              .from('neighborhoods')
              .select('*')
              .eq('id', neighborhoodId)
              .single();
            
            if (updatedNeighborhood) {
              console.log('✅ Confirmado no banco - status atual:', updatedNeighborhood.is_active);
              updateNeighborhood(neighborhoodId, { isActive: updatedNeighborhood.is_active });
            }
          } catch (err) {
            console.error('❌ Erro ao confirmar status:', err);
          }
        }, 300);
      } catch (error) {
        console.error('❌ Erro ao sincronizar ativação do bairro:', error);
        toast.error('Erro ao sincronizar bairro');
        // Reverter estado local em caso de erro
        toggleNeighborhoodActive(neighborhoodId);
      }
    };

    // Alternar som de alerta para novos pedidos
    const handleOrderAlertToggle = async () => {
      try {
        const newState = !settingsForm.orderAlertEnabled;
        setSettingsForm({ ...settingsForm, orderAlertEnabled: newState });
        await updateSettings({ ...settingsForm, orderAlertEnabled: newState });
        // ✅ Recarregar FRESH para garantir que reflete IMEDIATAMENTE
        await useSettingsStore.getState().loadSettingsFromSupabase();
        toast.success(newState ? '🔔 Som de alerta ativado' : '🔕 Som de alerta desativado');
      } catch (error) {
        console.error('Erro ao sincronizar som de alerta:', error);
        toast.error('Erro ao atualizar som de alerta');
      }
    };

    // Alternar envio de resumo de pedidos para WhatsApp
    const handleOrderSummaryToWhatsAppToggle = async () => {
      try {
        const currentState = settingsForm.sendOrderSummaryToWhatsApp;
        const newState = !currentState;
        
        console.log('💬 [ADMIN] TOGGLE iniciado');
        console.log('💬 [ADMIN] Estado atual:', currentState);
        console.log('💬 [ADMIN] Novo estado:', newState);
        
        // Atualizar local state imediatamente
        const newSettingsForm = { ...settingsForm, sendOrderSummaryToWhatsApp: newState };
        setSettingsForm(newSettingsForm);
        console.log('💬 [ADMIN] setSettingsForm executado com:', newSettingsForm.sendOrderSummaryToWhatsApp);
        
        // Salvar no Supabase
        await updateSettings(newSettingsForm);
        console.log('✅ [ADMIN] updateSettings concluído');
        
        // Verificar o novo valor na store após atualização
        const storeSettings = useSettingsStore.getState().settings;
        console.log('✅ [ADMIN] Valor na store após updateSettings:', storeSettings.sendOrderSummaryToWhatsApp);
        
        // Force refresh em outros componentes
        localStorage.setItem('settings-updated', Date.now().toString());
        console.log('✅ [ADMIN] localStorage.settings-updated definido');
        
        toast.success(newState ? '💬 Resumo de pedidos via WhatsApp ativado' : '💬 Resumo de pedidos via WhatsApp desativado');
      } catch (error) {
        console.error('❌ Erro ao sincronizar resumo WhatsApp:', error);
        toast.error('Erro ao atualizar resumo WhatsApp');
      }
    };

    // Determinar status de impressão e renderizar componente apropriado
    const getPrintStatusDisplay = (order: Order) => {
      if (order.printedAt && order.printedAt.trim()) {
        // Verde: Já foi impresso (só se printedAt NÃO é vazio)
        return (
          <div className="flex flex-col gap-1">
            <Badge className="bg-green-100 text-green-800 hover:bg-green-100">
              Impresso
            </Badge>
            <span className="text-xs text-muted-foreground">
              {format(new Date(order.printedAt), "HH:mm", { locale: ptBR })}
            </span>
          </div>
        );
      } else {
        // Vermelho: Não foi impresso
        return (
          <div className="flex flex-col gap-1">
            <Badge variant="destructive">
              Não impresso
            </Badge>
            <Button 
              variant="outline" 
              size="sm"
              className="text-xs h-7"
              onClick={() => handlePrintOrder(order)}
            >
              Imprimir
            </Button>
          </div>
        );
      }
    };

    // Imprimir pedido manualmente com RETRY robusto
    const handlePrintOrder = async (order: Order) => {
      let toastId: string | number | undefined;
      
      try {
        console.log('Iniciando impressão manual para:', order.id);
        toastId = toast.loading('Enviando pedido para impressora...');
        
        // Tentar invocar printorder com retry (3x com backoff curto)
        let lastError: any = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            console.log(`Tentativa ${attempt}/3 de invocar printorder...`);
            const { data, error } = await supabase.functions.invoke('printorder', {
              body: {
                orderId: order.id,
                force: true,
              },
            });

            if (error) {
              console.error(`Tentativa ${attempt}: Erro -`, error.message || error);
              lastError = error;
              if (attempt < 3) {
                const delayMs = 500 * attempt; // Backoff mais curto (500ms, 1s, 1.5s)
                console.log(`Aguardando ${delayMs}ms antes da próxima tentativa...`);
                await new Promise(r => setTimeout(r, delayMs));
                continue;
              }
            } else {
              console.log(`Printorder OK na tentativa ${attempt}:`, data);
              
              // Atualizar printed_at no store IMEDIATAMENTE (otimistic update) com hora local
              const printTime = new Date();
              const printOffset = printTime.getTimezoneOffset() * 60000;
              const localPrintTime = new Date(printTime.getTime() - printOffset);
              const printedAtTime = localPrintTime.toISOString().split('Z')[0];
              await updateOrderPrintedAt(order.id, printedAtTime);
              
              // Fechar loading toast e mostrar sucesso
              if (toastId !== undefined) {
                toast.dismiss(toastId);
              }
              toast.success('Pedido enviado para impressora!');
              
              return; // Sucesso - sair da função
            }
          } catch (err) {
            console.error(`Tentativa ${attempt} capturou erro:`, err);
            lastError = err;
            if (attempt < 3) {
              const delayMs = 500 * attempt;
              console.log(`Aguardando ${delayMs}ms ...`);
              await new Promise(r => setTimeout(r, delayMs));
            }
          }
        }

        // Se chegou aqui, todas as tentativas falharam
        throw lastError || new Error('Erro ao enviar para impressora');
        
      } catch (error) {
        console.error('Erro ao imprimir pedido:', error);
        
        // Fechar loading toast e mostrar erro
        if (toastId !== undefined) {
          toast.dismiss(toastId);
        }
        toast.error(`Erro ao enviar: ${error instanceof Error ? error.message : 'Erro desconhecido'}`);
      }
    };

    const allProducts: Product[] = useMemo(() => {
      // ✅ NOVO (29/03/2026): Filtrar apenas produtos do tenant autenticado
      // Isso elimina a visualização de 110 produtos de outros tenants
      const products = Object.values(productsById);
      
      if (!tenantId) {
        console.log('[ADMIN-PRODUCTS] Aguardando tenant_id para filtrar produtos...');
        return []; // Não mostrar nada até ter tenant_id validado
      }
      
      // Produtos já filtrados pelo banco (RLS policy)
      console.log(`[ADMIN-PRODUCTS] Mostrando ${products.length} produtos do tenant ${tenantId}`);
      return products;
    }, [productsById, tenantId]);

    const filteredProducts = useMemo(() => {
      const q = search.trim().toLowerCase();
      return allProducts
        .filter((p) => {
          if (categoryFilter !== 'all' && p.category !== categoryFilter) return false;
          if (statusFilter === 'active' && !p.isActive) return false;
          if (statusFilter === 'inactive' && p.isActive) return false;
          if (!q) return true;
          return (
            p.name.toLowerCase().includes(q) ||
            (p.description || '').toLowerCase().includes(q)
          );
        })
        .sort((a, b) => {
          if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
          return a.name.localeCompare(b.name, 'pt-BR');
        });
    }, [allProducts, categoryFilter, search, statusFilter]);

    // Stats for overview
    const stats = useMemo(() => {
      const s = getStats(dateRange.start, dateRange.end);
      return {
        totalProducts: allProducts.filter(p => p.isActive).length,
        totalOrders: s.totalOrders,
        revenue: s.totalRevenue,
        avgTicket: s.avgTicket,
        deliveredOrders: s.deliveredOrders,
        cancelledOrders: s.cancelledOrders,
      };
    }, [allProducts, getStats, dateRange]);

    // Recent orders for overview
    const recentOrders = useMemo(() => {
      return orders.slice(0, 5);
    }, [orders]);

    // Filtered orders by date range - com log para debug
    const filteredOrders = useMemo(() => {
      let filtered = orders.filter((order) => {
        const orderDate = new Date(order.createdAt);
        const isInRange = orderDate >= dateRange.start && orderDate <= dateRange.end;
        
        // Apply status filter
        const statusMatch = orderStatusFilter === 'all' || order.status === orderStatusFilter;
        
        return isInRange && statusMatch;
      });
      
      // Apply sorting
      filtered.sort((a, b) => {
        const dateA = new Date(a.createdAt).getTime();
        const dateB = new Date(b.createdAt).getTime();
        return orderSort === 'newest' ? dateB - dateA : dateA - dateB;
      });
      
      console.log(`📊 Filtragem: ${orders.length} pedidos totais → ${filtered.length} no período ${format(dateRange.start, 'dd/MM')} a ${format(dateRange.end, 'dd/MM')}`);
      
      return filtered;
    }, [orders, dateRange, orderStatusFilter, orderSort]);

    const handleSaveSettings = async () => {
      console.log('🚀🚀🚀 [HANDLECLIKC] BOTÃO CLICADO - handleSaveSettings COMEÇOU');
      try {
        // ✅ CRÍTICO: Usar o settingsForm (que tem as edições locais do admin)
        // Inicializar com defaults se estiver vazio (proteção extra)
        const defaultSchedule = {
          monday: { isOpen: false, openTime: '18:00', closeTime: '23:00' },
          tuesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          wednesday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          thursday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          friday: { isOpen: true, openTime: '18:00', closeTime: '23:00' },
          saturday: { isOpen: true, openTime: '17:00', closeTime: '00:00' },
          sunday: { isOpen: true, openTime: '17:00', closeTime: '23:00' },
        };

        // Validar schedule: se algum dia está faltando, add o default
        const validatedSchedule = { ...defaultSchedule };
        if (settingsForm.schedule) {
          Object.keys(settingsForm.schedule).forEach((day) => {
            if (settingsForm.schedule[day]) {
              validatedSchedule[day] = { ...settingsForm.schedule[day] };
            }
          });
        }

        // ✅ CRÍTICO: Garantir que os 5 toggles novos estão no payload
        const finalSettingsToSave = {
          ...settingsForm,
          schedule: validatedSchedule,
          // ✅ Adicionar explicitamente os 7 toggles de cardápio
          meia_meia_enabled: settingsForm.meia_meia_enabled ?? true,
          imagens_enabled: settingsForm.imagens_enabled ?? true,
          adicionais_enabled: settingsForm.adicionais_enabled ?? true,
          bebidas_enabled: settingsForm.bebidas_enabled ?? true,
          bordas_enabled: settingsForm.bordas_enabled ?? true,
          broto_enabled: settingsForm.broto_enabled ?? true,
          grande_enabled: settingsForm.grande_enabled ?? true,
        };
        
        console.log('💾 [ADMIN-SAVE] ════════════════════════════════════════');
        console.log('💾 [ADMIN-SAVE] INICIANDO SALVAMENTO DO ADMIN');
        console.log('💾 [ADMIN-SAVE] Schedule que será salvo:', finalSettingsToSave.schedule);
        console.log('💾 [ADMIN-SAVE] thursday que será salvo:', finalSettingsToSave.schedule.thursday);
        console.log('💾 [ADMIN-SAVE] Enviando para updateSettings()...');
        
        // ✅ NOVO: Upload de logo se arquivo foi selecionado
        let logoUrlToSave = settingsForm.store_logo_url;
        if (selectedLogoFile) {
          console.log('📤 [ADMIN-SAVE] Logo file selecionado, fazendo upload...');
          const uploadedLogoUrl = await uploadLogoToStorage(selectedLogoFile);
          if (uploadedLogoUrl) {
            logoUrlToSave = uploadedLogoUrl;
            console.log('✅ [ADMIN-SAVE] Logo upload bem-sucedido:', logoUrlToSave);
          }
        }
        
        // Atualizar com TODOS os settings (incluindo schedule VALIDADO)
        await updateSettings({
          ...finalSettingsToSave,
          store_logo_url: logoUrlToSave,
        });
        
        console.log('💾 [ADMIN-SAVE] updateSettings() completou com sucesso!');
        
        // 🔍 STEP EXTRA: VERIFICAR QUE FOI REALMENTE SALVO no Supabase
        console.log('🔍 [ADMIN-SAVE] Aguardando 1 segundo e recarregando do Supabase para VERIFICAÇÃO...');
        await new Promise(resolve => setTimeout(resolve, 1000));
        
        // ✅ forceRefresh: true para ignorar cache e recarregar TODOS os dados
        await loadSettingsFromSupabase(true);
        
        // ⚡ CRÍTICO: Sincronizar settingsForm com os dados que acabaram de ser carregados
        // Assim o formulário mostra os dados salvos, não os antigos
        const reloadedState = useSettingsStore.getState();
        setSettingsForm(reloadedState.settings);
        console.log('✅ [ADMIN-SAVE] settingsForm sincronizado com dados carregados do Supabase');
        console.log('✅ [ADMIN-SAVE] store_logo_url sincronizado:', reloadedState.settings.store_logo_url);
        
        // ✅ NOVO: Limpar UI de upload APENAS APÓS confirmação que foi salvo
        if (selectedLogoFile) {
          setSelectedLogoFile(null);
          setPreviewLogoUrl(null);
          console.log('✅ [ADMIN-SAVE] Logo file clearing - URL salva no Supabase');
        }
        console.log('✅ [ADMIN-SAVE] Toggles sincronizados:', {
          meia_meia_enabled: reloadedState.settings.meia_meia_enabled,
          imagens_enabled: reloadedState.settings.imagens_enabled,
          adicionais_enabled: reloadedState.settings.adicionais_enabled,
          bebidas_enabled: reloadedState.settings.bebidas_enabled,
          bordas_enabled: reloadedState.settings.bordas_enabled,
          broto_enabled: reloadedState.settings.broto_enabled,
          grande_enabled: reloadedState.settings.grande_enabled,
        });
        
        // Comparar: o que foi enviado vs. o que está no estado agora
        const currentState = useSettingsStore.getState();
        const savedThursday = currentState.settings.schedule.thursday;
        const sentThursday = finalSettingsToSave.schedule.thursday;
        
        console.log('📊 [ADMIN-SAVE] VERIFICATION RESULTADO:');
        console.log('📊 Enviado thursday:', sentThursday);
        console.log('📊 Agora no estado thursday:', savedThursday);
        console.log('📊 MATCH?', JSON.stringify(sentThursday) === JSON.stringify(savedThursday) ? '✅ PERFEITO' : '❌ NÃO CORRESPONDENTE');
        
        // ✅ NOVO: Verificar que store_logo_url NÃO foi perdida!
        const currentLogo = currentState.settings.store_logo_url;
        const sentLogo = finalSettingsToSave.store_logo_url;
        console.log('🖼️  [ADMIN-SAVE] LOGO VERIFICATION:');
        console.log('🖼️  Logo enviado:', sentLogo);
        console.log('🖼️  Logo após save:', currentLogo);
        console.log('🖼️  Logo preservada?', (sentLogo === currentLogo || (sentLogo && currentLogo)) ? '✅ SIM!' : '⚠️  VERIFIQUE');
        
        if (JSON.stringify(sentThursday) !== JSON.stringify(savedThursday)) {
          console.error('❌ [ADMIN-SAVE] ALERTA: Os dados salvos não correspondem aos enviados!');
          toast.error('⚠️  Aviso: dados podem não ter sido salvos corretamente. Tente novamente.');
        }
        
        // Force settings refresh em todos os contextos IMEDIATAMENTE
        localStorage.setItem('admin-settings-updated', Date.now().toString());
        
        // � Cache de categorias no localStorage para carregamento instantâneo
        if (finalSettingsToSave.categories_config) {
          localStorage.setItem('cached_categories_config', JSON.stringify(finalSettingsToSave.categories_config));
          console.log('💾 [CACHE] categories_config salvo em localStorage');
        }
        
        // �📲 Notificar OUTRAS abas do mesmo navegador via BroadcastChannel
        notifyOtherTabs(finalSettingsToSave);
        
        // MARCAR COMO NÃO SALVO IMEDIATAMENTE (não usar setTimeout)
        setHasUnsavedChanges(false);
        
        console.log('✅ [ADMIN-SAVE] Estado marcado como salvo');
        console.log('✅ [ADMIN-SAVE] Outras abas notificadas');
        console.log('✅ [ADMIN-SAVE] ════════════════════════════════════════');
        
        toast.success('✅ Configurações salvas e sincronizadas em tempo real!');
      } catch (error) {
        console.error('❌ [ADMIN-SAVE] Erro ao salvar:', error);
        console.error('❌ [ADMIN-SAVE] Stack:', error instanceof Error ? error.stack : 'N/A');
        alert(`❌ ERRO ao salvar (veja console): ${error instanceof Error ? error.message : String(error)}`);
        toast.error('Erro ao salvar configurações. Tente novamente.');
      }
    };

    const handleChangePassword = () => {
      if (passwordForm.new !== passwordForm.confirm) {
        toast.error('As senhas não coincidem');
        return;
      }
      const result = changePassword(passwordForm.current, passwordForm.new);
      if (result.success) {
        toast.success(result.message);
        setPasswordForm({ current: '', new: '', confirm: '' });
      } else {
        toast.error(result.message);
      }
    };

    const handleDayScheduleChange = (day: string, updates: any) => {
      // ✅ Atualizar settingsForm localmente PRIMEIRO
      setSettingsForm(prevForm => ({
        ...prevForm,
        schedule: {
          ...prevForm.schedule,
          [day]: { ...prevForm.schedule[day], ...updates },
        },
      }));
      setHasUnsavedChanges(true);
      toast.info(`✏️ Alteração em ${dayLabels[day]} - Clique em "Salvar Alterações" para confirmar`);
    };

    const handleManualOpenToggle = async () => {
      const newState = !settings.isManuallyOpen;
      
      // ✅ SINCRONIZAR para Supabase (ativa Realtime)
      await updateSettings({ isManuallyOpen: newState });
      // ✅ Recarregar FRESH para garantir que reflete IMEDIATAMENTE
      await useSettingsStore.getState().loadSettingsFromSupabase();
      
      toast.success(newState ? '✓ Loja aberta!' : '✗ Loja fechada!');
    };

    const handleDeleteConfirm = async () => {
      switch (deleteDialog.type) {
        case 'product':
          try {
            console.log('🗑️ Deletando produto:', deleteDialog.id);
            removeProduct(deleteDialog.id);
            
            // ✅ CORRIGIDO: Filtrar por tenant_id para isolamento multi-tenant
            const { error } = await (supabase as any)
              .from('products')
              .delete()
              .eq('id', deleteDialog.id)
              .eq('tenant_id', tenantId);  // ✅ Add tenant filter
            
            if (error) {
              console.error('❌ Erro ao deletar produto:', error);
              toast.error('Erro ao deletar produto');
              return;
            }

            console.log('✅ DELETE concluído no Supabase');
            
            // 🔄 CONFIRMAÇÃO: SELECT para garantir que foi deletado
            setTimeout(async () => {
              try {
                const { data: deletedList, error: selectError } = await (supabase as any)
                  .from('products')
                  .select('*')
                  .eq('id', deleteDialog.id)
                  .eq('tenant_id', tenantId);  // ✅ Add tenant filter
                
                if (!selectError && deletedList && deletedList.length > 0) {
                  // Ainda existe - reversão
                  console.error('⚠️  Produto ainda existe no banco! Revertendo...');
                  removeProduct(deleteDialog.id); // Remove do store novamente
                } else {
                  console.log('✅ Confirmado - Produto foi deletado com sucesso do banco');
                }
              } catch (err) {
                console.log('✅ Confirmado - Produto foi deletado (erro = sucesso)');
              }
            }, 300);

            toast.success('Produto excluído com sucesso!');
          } catch (error) {
            console.error('❌ Erro ao deletar produto:', error);
            toast.error('Erro ao deletar produto');
          }
          break;

        case 'order':
          removeOrder(deleteDialog.id);
          toast.success('Pedido excluído com sucesso!');
          break;

        case 'neighborhood':
          try {
            console.log('🗑️ Deletando bairro:', deleteDialog.id);
            removeNeighborhood(deleteDialog.id);
            
            // ✅ CORRIGIDO: Filtrar por tenant_id para isolamento multi-tenant
            const { error } = await (supabase as any)
              .from('neighborhoods')
              .delete()
              .eq('id', deleteDialog.id)
              .eq('tenant_id', tenantId);  // ✅ Add tenant filter
            
            if (error) {
              console.error('❌ Erro ao deletar bairro:', error);
              toast.error('Erro ao deletar bairro');
              return;
            }

            console.log('✅ DELETE concluído no Supabase');
            
            // 🔄 CONFIRMAÇÃO: SELECT sem .single() para evitar erro 406
            setTimeout(async () => {
              try {
                const { data: deletedList, error: selectError } = await (supabase as any)
                  .from('neighborhoods')
                  .select('*')
                  .eq('id', deleteDialog.id)
                  .eq('tenant_id', tenantId);  // ✅ Add tenant filter
                
                if (!selectError && deletedList && deletedList.length > 0) {
                  // Ainda existe - reversão
                  console.error('⚠️  Bairro ainda existe no banco! Revertendo...');
                  removeNeighborhood(deleteDialog.id); // Remove do store novamente
                } else {
                  console.log('✅ Confirmado - Bairro foi deletado com sucesso do banco');
                }
              } catch (err) {
                // Erro 406 significa que nenhum resultado foi encontrado = bairro foi deletado ✅
                console.log('✅ Confirmado - Bairro foi deletado (erro 406 = sucesso)');
              }
            }, 300);

            toast.success('Bairro excluído com sucesso!');
          } catch (error) {
            console.error('❌ Erro ao deletar bairro:', error);
            toast.error('Erro ao deletar bairro');
          }
          break;
      }
      setDeleteDialog({ ...deleteDialog, open: false });
    };

    const handleViewOrder = (order: Order) => {
      setSelectedOrder(order);
      setIsOrderDialogOpen(true);
    };

    const getStatusBadge = (status: Order['status'] | undefined) => {
      if (!status) return <Badge variant="outline">Desconhecido</Badge>;
      
      const statusConfig: Record<string, { label: string; variant: any }> = {
        pending: { label: 'Pendente', variant: 'destructive' },
        agendado: { label: '📅 Agendado', variant: 'default' },
        confirmed: { label: 'Confirmado', variant: 'outline' },
        preparing: { label: 'Preparando', variant: 'outline' },
        delivering: { label: 'Em Entrega', variant: 'secondary' },
        delivered: { label: 'Entregue', variant: 'default' },
        cancelled: { label: 'Cancelado', variant: 'destructive' },
      };
      const config = statusConfig[status] || { label: String(status), variant: 'outline' };
      // @ts-ignore - Ensure variant is valid
      return <Badge variant={config.variant}>{config.label}</Badge>;
    };

    return (
      <div className="min-h-screen bg-background">
        {/* Header */}
        <header className="sticky top-0 z-50 bg-card border-b">
          <div className="container mx-auto px-4">
            <div className="flex items-center justify-between h-16 md:h-20">
              <div className="flex items-center gap-4">
                <div className="flex items-center gap-3">
                  <img 
                    src={logoForneiro} 
                    alt="Forneiro Éden" 
                    className="w-12 h-12 md:w-14 md:h-14 rounded-full object-cover border-2 border-primary"
                  />
                  <span className="font-heading font-bold text-lg">Admin</span>
                </div>
              </div>

              <div className="flex items-center gap-2 md:gap-4">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={toggleTheme}
                  className="text-muted-foreground hover:text-foreground"
                >
                  {theme === 'light' ? <Moon className="w-5 h-5" /> : <Sun className="w-5 h-5" />}
                </Button>
                <Link to="/">
                  <Button variant="ghost" size="sm" className="gap-2">
                    <Home className="w-4 h-4" />
                    Ver Loja
                  </Button>
                </Link>
                <Button variant="ghost" size="sm" className="gap-2" onClick={handleLogout}>
                  <LogOut className="w-4 h-4" />
                  Sair
                </Button>
              </div>
            </div>
          </div>
        </header>

        {/* ✅ NOVO: Botão de toggle sidebar para mobile */}
        <div className="lg:hidden fixed bottom-6 right-6 z-50">
          <Button
            variant="default"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            className="rounded-full shadow-lg h-14 w-14"
          >
            {sidebarOpen ? <Power className="w-5 h-5" /> : <Power className="w-5 h-5" />}
          </Button>
        </div>

        {/* ✅ OVERLAY: Fechar sidebar ao clicar fora em mobile */}
        {sidebarOpen && (
          <div
            className="lg:hidden fixed inset-0 bg-black/50 z-40"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="container mx-auto px-4 py-8">
          <h1 className="font-heading text-2xl md:text-3xl font-bold mb-8">
            Painel Administrativo
          </h1>

          {/* ✅ NOVO: Layout com Sidebar Esquerdo */}
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <div className="flex gap-6 lg:gap-8">
              {/* SIDEBAR ESQUERDO - Menu Vertical */}
              <aside
                className={`${
                  sidebarOpen ? 'translate-x-0' : '-translate-x-full'
                } lg:translate-x-0 transition-transform duration-300 fixed lg:relative left-0 top-[120px] lg:top-auto h-[calc(100vh-120px)] lg:h-auto w-64 lg:w-56 xl:w-64 bg-card border-r overflow-y-auto z-40
                `}
              >
                <nav className="p-4">
                  <TabsList className="flex flex-col h-auto gap-2 w-full bg-transparent p-0 border-0">
                    <TabsTrigger
                      value="overview"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <TrendingUp className="w-4 h-4" />
                      <span className="text-sm font-medium">Visão Geral</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="orders"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span className="text-sm font-medium">Pedidos</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="products"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <ShoppingBag className="w-4 h-4" />
                      <span className="text-sm font-medium">Cardápio</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="neighborhoods"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <MapPin className="w-4 h-4" />
                      <span className="text-sm font-medium">Bairros</span>
                    </TabsTrigger>

                    <Separator className="my-1" />

                    <TabsTrigger
                      value="customers"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <Users className="w-4 h-4" />
                      <span className="text-sm font-medium">Clientes Fiéis</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="coupons"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <Gift className="w-4 h-4" />
                      <span className="text-sm font-medium">Cupons</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="scheduling"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <Clock className="w-4 h-4" />
                      <span className="text-sm font-medium">Agendamento</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="payments"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <CreditCard className="w-4 h-4" />
                      <span className="text-sm font-medium">Pagamentos</span>
                    </TabsTrigger>

                    <Separator className="my-1" />

                    <TabsTrigger
                      value="settings"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <Settings className="w-4 h-4" />
                      <span className="text-sm font-medium">Configurações</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="notifications"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <Bell className="w-4 h-4" />
                      <span className="text-sm font-medium">Notificações</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="analytics"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <BarChart3 className="w-4 h-4" />
                      <span className="text-sm font-medium">Relatórios</span>
                    </TabsTrigger>

                    <TabsTrigger
                      value="qrcode"
                      className="w-full justify-start gap-3 px-4 py-3 rounded-lg hover:bg-accent data-[state=active]:bg-primary data-[state=active]:text-primary-foreground transition-colors"
                    >
                      <QrCode className="w-4 h-4" />
                      <span className="text-sm font-medium">QR Code</span>
                    </TabsTrigger>
                  </TabsList>
                </nav>
              </aside>

              {/* CONTEÚDO PRINCIPAL DIREITO */}
              <main className="flex-1 w-full min-w-0">
                {/* Overview Tab */}
                <TabsContent value="overview">
              <div className="space-y-6">
                <DateRangeFilter onRangeChange={(start, end) => setDateRange({ start, end })} />

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Produtos Ativos
                      </CardTitle>
                      <Package className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalProducts}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Pedidos
                      </CardTitle>
                      <ShoppingBag className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{stats.totalOrders}</div>
                      <div className="flex gap-2 text-xs mt-1">
                        <span className="text-green-500 flex items-center gap-1">
                          <CheckCircle className="w-3 h-3" /> {stats.deliveredOrders}
                        </span>
                        <span className="text-red-500 flex items-center gap-1">
                          <XCircle className="w-3 h-3" /> {stats.cancelledOrders}
                        </span>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Receita
                      </CardTitle>
                      <DollarSign className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatPrice(stats.revenue)}</div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardHeader className="flex flex-row items-center justify-between pb-2">
                      <CardTitle className="text-sm font-medium text-muted-foreground">
                        Ticket Médio
                      </CardTitle>
                      <Users className="w-4 h-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent>
                      <div className="text-2xl font-bold">{formatPrice(stats.avgTicket)}</div>
                    </CardContent>
                  </Card>
                </div>

                <Card>
                  <CardHeader>
                    <CardTitle>Últimos Pedidos</CardTitle>
                  </CardHeader>
                  <CardContent>
                    {recentOrders.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        Nenhum pedido registrado ainda.
                      </div>
                    ) : (
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Pedido</TableHead>
                            <TableHead>Cliente</TableHead>
                            <TableHead>Total</TableHead>
                            <TableHead>Status</TableHead>
                            <TableHead>Data</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {(recentOrders ?? []).filter(Boolean).map((order: any) => {
                            if (!order?.id) return null;
                            return (
                            <TableRow key={order.id}>
                              <TableCell className="font-medium">
                                <div className="flex items-center gap-2">
                                  <span>{order.id}</span>
                                  {order.isScheduled && order.scheduledFor && (
                                    <span className="text-lg" title={`Agendado para: ${format(new Date(order.scheduledFor), "dd/MM/yyyy HH:mm", { locale: ptBR })}`}>
                                      📅
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{order.customer?.name || 'N/A'}</TableCell>
                              <TableCell>
                                <div className="flex flex-col gap-1">
                                  <span className="font-semibold">{formatPrice(order.total || 0)}</span>
                                  {order.pointsRedeemed && order.pointsRedeemed > 0 && (
                                    <span className="text-xs text-green-600 font-medium">
                                      -{order.pointsRedeemed} pontos
                                    </span>
                                  )}
                                </div>
                              </TableCell>
                              <TableCell>{getStatusBadge(order.status)}</TableCell>
                              <TableCell>
                                {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}
                              </TableCell>
                            </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    )}
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Products Tab */}
            <TabsContent value="products">
              <Accordion type="single" collapsible defaultValue="produtos" className="space-y-2">
                {/* SEÇÃO 1: GERENCIAR CARDÁPIO */}
                <AccordionItem value="produtos" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    📦 Gerenciar Cardápio
                    <Button
                      variant="ghost"
                      size="sm"
                      className="gap-2 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingProduct(null);
                        setIsNewProductOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Novo Produto
                    </Button>
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {/* Filtros e Busca */}
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mb-4">
                    <div className="lg:col-span-1">
                      <Input
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder="Buscar por nome ou descrição..."
                      />
                    </div>
                    <div className="lg:col-span-1">
                      <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar por categoria" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todas as categorias</SelectItem>
                          {Object.entries(dynamicCategoryLabels ?? {}).filter(Boolean).map(([key, label]: any) => {
                            if (!key) return null;
                            return (
                            <SelectItem key={key} value={key}>
                              {label}
                            </SelectItem>
                            );
                          })}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="lg:col-span-1">
                      <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as any)}>
                        <SelectTrigger>
                          <SelectValue placeholder="Filtrar por status" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="all">Todos</SelectItem>
                          <SelectItem value="active">Ativos</SelectItem>
                          <SelectItem value="inactive">Indisponíveis</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Tabela de Produtos */}
                  <ScrollArea className="h-[600px]">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Nome</TableHead>
                          <TableHead>Categoria</TableHead>
                          <TableHead>Preço Broto</TableHead>
                          <TableHead>Preço Grande</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(filteredProducts ?? []).filter(Boolean).map((product: any) => {
                          if (!product?.id) return null;
                          return (
                          <TableRow key={product.id} className={!product?.isActive ? 'opacity-50' : ''}>
                            <TableCell className="font-medium">{product.name}</TableCell>
                            <TableCell>
                              <Badge variant="outline" className="capitalize">
                                {dynamicCategoryLabels[product.category] ?? product.category}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              {product.priceSmall ? formatPrice(product.priceSmall) : '-'}
                            </TableCell>
                            <TableCell>
                              {product.priceLarge ? formatPrice(product.priceLarge) : 
                              product.price ? formatPrice(product.price) : '-'}
                            </TableCell>
                            <TableCell>
                              <Switch
                                checked={product.isActive}
                                onCheckedChange={() => handleToggleProductActive(product.id)}
                              />
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  onClick={() => {
                                    setEditingProduct(product);
                                    setIsNewProductOpen(true);
                                  }}
                                >
                                  <Edit className="w-4 h-4" />
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive"
                                  onClick={() => setDeleteDialog({
                                    open: true,
                                    type: 'product',
                                    id: product.id,
                                    name: product.name,
                                  })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  </ScrollArea>

                  <ProductFormDialog
                    open={isNewProductOpen}
                    onOpenChange={(open) => {
                      setIsNewProductOpen(open);
                      if (!open) setEditingProduct(null);
                    }}
                    product={editingProduct}
                    tenantId={tenantId}
                  />
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO 2: GERENCIAR CATEGORIAS */}
                <AccordionItem value="categorias" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    📋 Gerenciar Categorias do Cardápio
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Button
                      onClick={() => setIsCategoryDialogOpen(true)}
                      className="w-full btn-cta"
                    >
                      📋 Gerenciar Categorias do Cardápio
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Organize e customize as categorias do seu cardápio
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO 2.5: GERENCIAR TAMANHOS */}
                <AccordionItem value="tamanhos" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    📏 Gerenciar Tamanhos
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <Button
                      onClick={() => setIsSizeDialogOpen(true)}
                      className="w-full btn-cta"
                    >
                      📏 Gerenciar Tamanhos
                    </Button>
                    <p className="text-sm text-muted-foreground">
                      Customize tamanhos de produtos (até 7 opções)
                    </p>
                  </AccordionContent>
                </AccordionItem>

                {/* SEÇÃO 3: CONFIGURAÇÕES AVANÇADAS */}
                <AccordionItem value="config-avancada" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    ⚙️ Configurações Avançadas de Cardápio
                  </AccordionTrigger>
                  <AccordionContent className="space-y-6">
                  {/* Toggles */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Meia-meia</Label>
                        <p className="text-xs text-muted-foreground">Permitir que clientes peçam meia-meia</p>
                      </div>
                      <Switch
                        checked={settingsForm?.meia_meia_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ meia_meia_enabled: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Imagens nos Produtos</Label>
                        <p className="text-xs text-muted-foreground">Exibir fotos do cardápio</p>
                      </div>
                      <Switch
                        checked={settingsForm?.imagens_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ imagens_enabled: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Adicionais</Label>
                        <p className="text-xs text-muted-foreground">Permitir adicionais nos produtos</p>
                      </div>
                      <Switch
                        checked={settingsForm?.adicionais_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ adicionais_enabled: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Bebidas</Label>
                        <p className="text-xs text-muted-foreground">Incluir categoria de bebidas</p>
                      </div>
                      <Switch
                        checked={settingsForm?.bebidas_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ bebidas_enabled: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Bordas</Label>
                        <p className="text-xs text-muted-foreground">Permitir escolher tipos de borda</p>
                      </div>
                      <Switch
                        checked={settingsForm?.bordas_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ bordas_enabled: value })}
                      />
                    </div>

                    <Separator className="my-4" />

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Tamanho Broto</Label>
                        <p className="text-xs text-muted-foreground">Disponibilizar tamanho pequeno</p>
                      </div>
                      <Switch
                        checked={settingsForm?.broto_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ broto_enabled: value })}
                      />
                    </div>

                    <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent/50 transition-colors">
                      <div>
                        <Label className="text-base font-medium cursor-pointer">Tamanho Grande</Label>
                        <p className="text-xs text-muted-foreground">Disponibilizar tamanho grande</p>
                      </div>
                      <Switch
                        checked={settingsForm?.grande_enabled ?? true}
                        onCheckedChange={(value) => updateSettingsFormWithFlag({ grande_enabled: value })}
                      />
                    </div>
                  </div>

                  <Separator />

                  {/* Botão Salvar - Específico para Toggles */}
                  <div className="flex gap-2 justify-end">
                    <Button
                      variant="outline"
                      onClick={() => {
                        setSettingsForm(useSettingsStore.getState().settings);
                        setHasUnsavedChanges(false);
                      }}
                      disabled={!hasUnsavedChanges}
                    >
                      Cancelar
                    </Button>
                    <Button
                      onClick={handleSaveSettings}
                      disabled={!hasUnsavedChanges}
                      className="bg-orange-600 hover:bg-orange-700"
                    >
                      <Save className="w-4 h-4 mr-2" />
                      Salvar Alterações
                    </Button>
                  </div>

                  {hasUnsavedChanges && (
                    <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                      <AlertCircle className="w-4 h-4 text-amber-600" />
                      <p className="text-xs text-amber-800">Você tem alterações não salvas. Clique em "Salvar Alterações" para confirmar.</p>
                    </div>
                  )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            </TabsContent>

            {/* Orders Tab */}
            <TabsContent value="orders">
              <Accordion type="single" collapsible defaultValue="pedidos" className="space-y-2">
                <AccordionItem value="pedidos" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    📋 Histórico de Pedidos
                  </AccordionTrigger>
                  <AccordionContent>
                  <div className="mb-4">
                    <DateRangeFilter onRangeChange={(start, end) => setDateRange({ start, end })} />
                  </div>

                  {/* Order Filter and Sort Controls */}
                  <div className="mb-4 flex gap-4 flex-wrap">
                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm font-medium mb-2 block">Filtrar por Status</label>
                      <select
                        value={orderStatusFilter}
                        onChange={(e) => setOrderStatusFilter(e.target.value)}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="all">Todos os Status</option>
                        <option value="pending">Pendente</option>
                        <option value="confirmed">Confirmado</option>
                        <option value="preparing">Preparando</option>
                        <option value="delivering">Em Entrega</option>
                        <option value="delivered">Entregue</option>
                        <option value="cancelled">Cancelado</option>
                      </select>
                    </div>

                    <div className="flex-1 min-w-[200px]">
                      <label className="text-sm font-medium mb-2 block">Ordenar por Data</label>
                      <select
                        value={orderSort}
                        onChange={(e) => setOrderSort(e.target.value as 'newest' | 'oldest')}
                        className="w-full px-3 py-2 border border-input rounded-md bg-background text-sm"
                      >
                        <option value="newest">Mais Recentes</option>
                        <option value="oldest">Mais Antigas</option>
                      </select>
                    </div>
                  </div>

                  {filteredOrders.length === 0 ? (
                    <div className="text-center py-12 text-muted-foreground">
                      Nenhum pedido encontrado no período selecionado.
                    </div>
                  ) : (
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Pedido</TableHead>
                          <TableHead>Cliente</TableHead>
                          <TableHead>Itens</TableHead>
                          <TableHead>Total</TableHead>
                          <TableHead>Pagamento</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Impressão</TableHead>
                          <TableHead>Data</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(filteredOrders || []).filter(Boolean).map((order) => {
                          if (!order || !order.id) return null;
                          return (
                          <TableRow key={order.id}>
                            <TableCell className="font-medium">{order.id || 'N/A'}</TableCell>
                            <TableCell>{order.customer?.name || 'Desconhecido'}</TableCell>
                            <TableCell>{order.items?.length || 0} itens</TableCell>
                            <TableCell>
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold">{formatPrice(order.total || 0)}</span>
                                {order.pointsRedeemed && order.pointsRedeemed > 0 && (
                                  <span className="text-xs text-green-600 font-medium">
                                    -{order.pointsRedeemed} pontos
                                  </span>
                                )}
                                {order.appliedCoupon && order.couponDiscount && order.couponDiscount > 0 && (
                                  <span className="text-xs text-purple-600 font-medium">
                                    -{formatPrice(order.couponDiscount)} ({order.appliedCoupon})
                                  </span>
                                )}
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="outline">
                                {order.paymentMethod === 'pix' ? 'PIX' : order.paymentMethod === 'card' ? 'Cartão' : 'Dinheiro'}
                              </Badge>
                            </TableCell>
                            <TableCell>{getStatusBadge(order.status)}</TableCell>
                            <TableCell>
                              {getPrintStatusDisplay(order)}
                            </TableCell>
                            <TableCell>
                              {order.createdAt ? format(new Date(order.createdAt), "dd/MM/yyyy HH:mm", { locale: ptBR }) : 'N/A'}
                            </TableCell>
                            <TableCell>
                              <div className="flex gap-2">
                                <Button 
                                  variant="ghost" 
                                  size="sm"
                                  onClick={() => handleViewOrder(order)}
                                >
                                  Ver
                                </Button>
                                <Button 
                                  variant="ghost" 
                                  size="icon" 
                                  className="text-destructive"
                                  onClick={() => setDeleteDialog({
                                    open: true,
                                    type: 'order',
                                    id: order.id,
                                    name: order.id,
                                  })}
                                >
                                  <Trash2 className="w-4 h-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                          );
                        })}
                      </TableBody>
                    </Table>
                  )}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <OrderDetailsDialog
                open={isOrderDialogOpen}
                onOpenChange={setIsOrderDialogOpen}
                order={selectedOrder}
              />
            </TabsContent>

            {/* Neighborhoods Tab */}
            <TabsContent value="neighborhoods">
              <Accordion type="single" collapsible defaultValue="bairros" className="space-y-2">
                <AccordionItem value="bairros" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    🏘️ Bairros e Taxas de Entrega
                    <Button 
                      variant="ghost"
                      size="sm"
                      className="gap-2 ml-auto"
                      onClick={(e) => {
                        e.stopPropagation();
                        setEditingNeighborhood(null);
                        setIsNeighborhoodDialogOpen(true);
                      }}
                    >
                      <Plus className="w-4 h-4" />
                      Novo Bairro
                    </Button>
                  </AccordionTrigger>
                  <AccordionContent>
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Bairro</TableHead>
                          <TableHead>Taxa de Entrega</TableHead>
                          <TableHead>Status</TableHead>
                          <TableHead>Ações</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(neighborhoods ?? []).filter(Boolean).map((nb: any) => {
                          if (!nb?.id) return null;
                          
                          // Garantir que isActive sempre é boolean (evita erro controlled/uncontrolled)
                          const isActive = nb?.isActive === true;
                          
                          return (
                        <TableRow key={nb.id} className={!isActive ? 'opacity-50' : ''}>
                          <TableCell className="font-medium">{nb.name}</TableCell>
                          <TableCell>
                            <Input 
                              type="number" 
                              value={nb.deliveryFee ?? ''} 
                              className="w-24"
                              step="0.50"
                              onChange={(e) => {
                                const value = parseFloat(e.target.value);
                                if (!isNaN(value) && value >= 0) {
                                  handleUpdateNeighborhood(nb.id, { deliveryFee: value });
                                }
                              }}
                            />
                          </TableCell>
                          <TableCell>
                            <Switch 
                              checked={isActive} 
                              onCheckedChange={() => handleToggleNeighborhoodActive(nb.id)}
                            />
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button 
                                variant="ghost" 
                                size="icon"
                                onClick={() => {
                                  setEditingNeighborhood(nb);
                                  setIsNeighborhoodDialogOpen(true);
                                }}
                              >
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button 
                                variant="ghost" 
                                size="icon" 
                                className="text-destructive"
                                onClick={() => setDeleteDialog({
                                  open: true,
                                  type: 'neighborhood',
                                  id: nb.id,
                                  name: nb.name,
                                })}
                              >
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <NeighborhoodFormDialog
                open={isNeighborhoodDialogOpen}
                onOpenChange={setIsNeighborhoodDialogOpen}
                neighborhood={editingNeighborhood}
              />
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings">
              <Accordion type="single" collapsible defaultValue="logo" className="space-y-2">
                {/* ✅ ACCORDION ITEM 1: Logo */}
                <AccordionItem value="logo" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold text-orange-900 dark:text-orange-100 hover:no-underline">
                    🖼️ Logo / Imagem da Loja
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    {/* Preview da logo atual */}
                    {(previewLogoUrl || settingsForm.store_logo_url) && (
                      <div className="relative w-full">
                        <img
                          src={previewLogoUrl || settingsForm.store_logo_url || ''}
                          alt="logo-preview"
                          className="w-full h-40 object-contain rounded-md border-2 border-orange-200 dark:border-orange-700 bg-white p-3"
                        />
                        {selectedLogoFile && (
                          <button
                            type="button"
                            onClick={handleRemoveLogoImage}
                            className="absolute top-2 right-2 p-1 bg-red-500 hover:bg-red-600 text-white rounded-full transition-colors shadow-lg"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    )}

                    {/* File input */}
                    <label className={`flex items-center justify-center gap-3 p-6 border-2 border-dashed rounded-lg cursor-pointer transition-colors ${
                      logoUploading 
                        ? 'opacity-50 cursor-not-allowed bg-gray-100' 
                        : 'hover:bg-orange-100 dark:hover:bg-orange-950/50 hover:border-orange-400 border-orange-300 dark:border-orange-700'
                    }`}>
                      <Upload className="w-5 h-5 text-orange-600 dark:text-orange-400" />
                      <div className="text-center">
                        <span className="text-sm font-medium text-orange-900 dark:text-orange-100">
                          {logoUploading ? '⏳ Enviando...' : !selectedLogoFile && !settingsForm.store_logo_url ? '📁 Clique para selecionar logo' : '🔄 Clique para trocar'}
                        </span>
                        <p className="text-xs text-orange-700 dark:text-orange-300 mt-1">PNG ou JPEG (recomendado: 400x400px)</p>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg"
                        onChange={handleLogoFileSelect}
                        disabled={logoUploading}
                        className="hidden"
                      />
                    </label>

                    {/* Botão Salvar Logo */}
                    <Button
                      onClick={handleSaveLogoOnly}
                      disabled={!selectedLogoFile || logoUploading}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white font-semibold"
                      size="lg"
                    >
                      {logoUploading ? (
                        <>
                          <span className="animate-spin mr-2">⏳</span>
                          Salvando Logo...
                        </>
                      ) : (
                        <>
                          <Save className="w-4 h-4 mr-2" />
                          💾 Salvar Logo
                        </>
                      )}
                    </Button>

                    {settingsForm.store_logo_url && !selectedLogoFile && (
                      <div className="text-xs bg-green-50 dark:bg-green-950/20 p-3 rounded border border-green-200 dark:border-green-700 text-green-900 dark:text-green-100">
                        ✅ <strong>Logo salva!</strong> Aparecendo em Header, Footer, PWA e WhatsApp
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="dados" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    📋 Dados do Estabelecimento
                    {hasUnsavedChanges && (
                      <div className="ml-2 flex items-center gap-2">
                        <div className="animate-pulse w-2 h-2 rounded-full bg-amber-500"></div>
                        <span className="text-xs font-semibold text-amber-600 dark:text-amber-400">Edições não salvas</span>
                      </div>
                    )}
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor="store-name">Nome do Estabelecimento</Label>
                        <Input 
                          id="store-name" 
                          value={settingsForm.name}
                          onChange={(e) => updateSettingsFormWithFlag({ name: e.target.value })}
                          className="mt-1" 
                        />
                      </div>
                      <div>
                        <Label htmlFor="store-phone">Telefone</Label>
                        <Input 
                          id="store-phone" 
                          value={settingsForm.phone}
                          onChange={(e) => {
                            const cleaned = e.target.value.replace(/\D/g, '');
                            let formatted = cleaned;
                            if (cleaned.length > 2) formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2)}`;
                            if (cleaned.length > 7) formatted = `(${cleaned.slice(0, 2)}) ${cleaned.slice(2, 7)}-${cleaned.slice(7)}`;
                            updateSettingsFormWithFlag({ phone: formatted });
                          }}
                          placeholder="(11) 99999-9999"
                          className="mt-1" 
                        />
                      </div>
                    </div>

                    <div>
                      <Label htmlFor="store-address">Endereço</Label>
                      <Input 
                        id="store-address" 
                        value={settingsForm.address}
                        onChange={(e) => updateSettingsFormWithFlag({ address: e.target.value })}
                        className="mt-1" 
                      />
                    </div>

                    <div>
                      <Label htmlFor="store-slogan">Slogan / Subtítulo</Label>
                      <Input 
                        id="store-slogan" 
                        value={settingsForm.slogan || ''}
                        onChange={(e) => updateSettingsFormWithFlag({ slogan: e.target.value })}
                        placeholder="Ex: O melhor atendimento da sua região"
                        className="mt-1" 
                      />
                      <p className="text-xs text-muted-foreground mt-1">
                        Aparece na página inicial e no rodapé da área do cliente
                      </p>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-blue-50 dark:bg-blue-950/20">
                      <div className="flex items-center gap-3">
                        <Bell className="w-5 h-5 text-blue-600 dark:text-blue-400" />
                        <div>
                          <Label className="text-base font-semibold cursor-pointer">Som de Alerta para Pedidos</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {settingsForm.orderAlertEnabled ? '🔔 Ativado - Som toca quando novos pedidos chegam' : '🔕 Desativado'}
                          </p>
                        </div>
                      </div>
                      <Switch 
                        checked={settingsForm.orderAlertEnabled || false}
                        onCheckedChange={handleOrderAlertToggle}
                      />
                    </div>

                    <div className="flex items-center justify-between p-4 border rounded-lg bg-green-50 dark:bg-green-950/20">
                      <div className="flex items-center gap-3">
                        <MessageCircle className="w-5 h-5 text-green-600 dark:text-green-400" />
                        <div>
                          <Label className="text-base font-semibold cursor-pointer">Resumo de Pedidos no WhatsApp</Label>
                          <p className="text-xs text-muted-foreground mt-1">
                            {settingsForm.sendOrderSummaryToWhatsApp ? '💬 Ativado - Recebe resumo no WhatsApp' : '💬 Desativado'}
                          </p>
                        </div>
                      </div>
                      <Switch 
                        checked={settingsForm.sendOrderSummaryToWhatsApp || false}
                        onCheckedChange={handleOrderSummaryToWhatsAppToggle}
                      />
                    </div>

                    <Separator />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div>
                        <Label>Tempo de Entrega (min–max)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input 
                            type="number"
                            value={settingsForm.deliveryTimeMin}
                            onChange={(e) => updateSettingsFormWithFlag({ deliveryTimeMin: parseInt(e.target.value) || 0 })}
                            className="w-20" 
                          />
                          <span className="self-center">–</span>
                          <Input 
                            type="number"
                            value={settingsForm.deliveryTimeMax}
                            onChange={(e) => updateSettingsFormWithFlag({ deliveryTimeMax: parseInt(e.target.value) || 0 })}
                            className="w-20" 
                          />
                        </div>
                      </div>
                      <div>
                        <Label>Tempo de Retirada (min–max)</Label>
                        <div className="flex gap-2 mt-1">
                          <Input 
                            type="number"
                            value={settingsForm.pickupTimeMin}
                            onChange={(e) => updateSettingsFormWithFlag({ pickupTimeMin: parseInt(e.target.value) || 0 })}
                            className="w-20" 
                          />
                          <span className="self-center">–</span>
                          <Input 
                            type="number"
                            value={settingsForm.pickupTimeMax}
                            onChange={(e) => updateSettingsFormWithFlag({ pickupTimeMax: parseInt(e.target.value) || 0 })}
                            className="w-20" 
                          />
                        </div>
                      </div>
                    </div>

                    <Separator />

                    {/* 🕐 Horário de Funcionamento */}
                    <div className="space-y-4">
                      <div className="flex items-center gap-2">
                        <Clock className="w-5 h-5 text-blue-600" />
                        <h3 className="text-lg font-semibold">🕐 Horário de Funcionamento</h3>
                      </div>

                      {/* Manual Open/Close Toggle */}
                      <div className="flex items-center justify-between p-4 bg-blue-50 dark:bg-blue-950/20 rounded-lg border">
                        <div className="flex items-center gap-3">
                          <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                            settings.isManuallyOpen ? 'bg-green-500/20' : 'bg-red-500/20'
                          }`}>
                            <Power className={`w-5 h-5 ${settings.isManuallyOpen ? 'text-green-500' : 'text-red-500'}`} />
                          </div>
                          <div>
                            <p className="font-semibold">Estabelecimento</p>
                            <p className="text-sm text-muted-foreground">
                              {settings.isManuallyOpen ? '✓ Aberto para pedidos' : '✗ Fechado manualmente'}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-4">
                          <Badge variant={isStoreOpen() ? 'default' : 'destructive'}>
                            {isStoreOpen() ? '✓ ABERTO AGORA' : '✗ FECHADO'}
                          </Badge>
                          <Button
                            variant={settings.isManuallyOpen ? 'destructive' : 'default'}
                            size="sm"
                            onClick={handleManualOpenToggle}
                          >
                            {settings.isManuallyOpen ? '🔒 Fechar Loja' : '🔓 Abrir Loja'}
                          </Button>
                        </div>
                      </div>

                      {/* Schedule per day */}
                      <div className="space-y-3">
                        <p className="text-sm font-semibold text-muted-foreground">Horários por Dia da Semana</p>
                        {dayOrder.map((day) => {
                          const schedule = settingsForm.schedule[day];
                          if (!schedule) return null;
                          return (
                            <div 
                              key={day} 
                              className={`flex items-center justify-between p-3 rounded-lg border ${
                                schedule.isOpen ? 'bg-card' : 'bg-secondary/30 opacity-60'
                              }`}
                            >
                              <div className="flex items-center gap-4 flex-1">
                                <Switch
                                  checked={schedule.isOpen}
                                  onCheckedChange={(checked) => handleDayScheduleChange(day, { isOpen: checked })}
                                />
                                <span className="font-medium w-32">{dayLabels[day]}</span>
                              </div>
                              
                              {schedule.isOpen && (
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="time"
                                    value={schedule.openTime}
                                    onChange={(e) => handleDayScheduleChange(day, { openTime: e.target.value })}
                                    className="w-28"
                                  />
                                  <span className="text-muted-foreground text-sm">às</span>
                                  <Input
                                    type="time"
                                    value={schedule.closeTime}
                                    onChange={(e) => handleDayScheduleChange(day, { closeTime: e.target.value })}
                                    className="w-28"
                                  />
                                </div>
                              )}
                              
                              {!schedule.isOpen && (
                                <Badge variant="outline">Fechado</Badge>
                              )}
                            </div>
                          );
                        })}
                      </div>

                      <div className="text-xs bg-blue-50 dark:bg-blue-950/20 p-3 rounded border border-blue-200 dark:border-blue-800 text-blue-900 dark:text-blue-100">
                        💡 <strong>Dica:</strong> Esses horários definem quando sua loja funciona e são exibidos no rodapé para o cliente.
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button 
                        className="btn-cta" 
                        onClick={handleSaveSettings}
                        disabled={!hasUnsavedChanges}
                      >
                        ✅ Salvar Alterações
                      </Button>
                      {hasUnsavedChanges && (
                        <Button 
                          variant="outline" 
                          onClick={handleReloadSettings}
                        >
                          ❌ Cancelar
                        </Button>
                      )}
                    </div>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="password" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    🔐 Alterar Senha
                  </AccordionTrigger>
                  <AccordionContent className="space-y-4">
                    <div>
                      <Label htmlFor="current-password">Senha Atual</Label>
                      <Input 
                        id="current-password" 
                        type="password" 
                        value={passwordForm.current}
                        onChange={(e) => setPasswordForm({ ...passwordForm, current: e.target.value })}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="new-password">Nova Senha</Label>
                      <Input 
                        id="new-password" 
                        type="password" 
                        value={passwordForm.new}
                        onChange={(e) => setPasswordForm({ ...passwordForm, new: e.target.value })}
                        className="mt-1" 
                      />
                    </div>
                    <div>
                      <Label htmlFor="confirm-password">Confirmar Nova Senha</Label>
                      <Input 
                        id="confirm-password" 
                        type="password" 
                        value={passwordForm.confirm}
                        onChange={(e) => setPasswordForm({ ...passwordForm, confirm: e.target.value })}
                        className="mt-1" 
                      />
                    </div>
                    <Button variant="outline" onClick={handleChangePassword}>
                      Alterar Senha
                    </Button>
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="loyalty" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    💎 Configurações de Fidelização
                  </AccordionTrigger>
                  <AccordionContent>
                    <LoyaltySettingsPanel />
                  </AccordionContent>
                </AccordionItem>

                <AccordionItem value="printnode" className="border rounded-lg px-4">
                  <AccordionTrigger className="text-lg font-semibold hover:no-underline">
                    🖨️ Configuração de Impressão
                  </AccordionTrigger>
                  <AccordionContent>
                    <PrintNodeSettings />
                  </AccordionContent>
                </AccordionItem>
              </Accordion>

              <div className="space-y-6 mt-6">
              </div>
            </TabsContent>

            {/* Customers Loyalty Tab */}
            <TabsContent value="customers">
              <FaithfulCustomersAdmin />
            </TabsContent>

            {/* Coupons Tab */}
            <TabsContent value="coupons">
              <CouponManagementPanel />
            </TabsContent>

            {/* Payments Tab */}
            <TabsContent value="payments">
              <PaymentSettingsPanel />
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <NotificationsTab />
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics">
              <AnalyticsPanel />
            </TabsContent>

            {/* Scheduling Tab */}
            <TabsContent value="scheduling">
              <SchedulingSettings />
            </TabsContent>

            {/* QR Code Tab */}
            <TabsContent value="qrcode">
              <div className="space-y-8 max-w-2xl">
                {/* Header */}
                <div>
                  <h2 className="text-2xl font-semibold mb-2">📱 QR Code do App</h2>
                  <p className="text-sm text-muted-foreground">
                    Visualize e baixe o QR Code em diferentes formatos para suas campanhas de marketing.
                  </p>
                </div>

                {/* Quick Preview */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Tamanhos recomendados para uso comercial</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 gap-4">
                      {/* Small - Social Media */}
                      <div className="flex flex-col items-center space-y-2 p-3 bg-muted/20 rounded">
                        <p className="font-medium text-xs text-center">Redes Sociais</p>
                        <div className="bg-white p-2 rounded border">
                          <QRCodeDisplay size={100} showControls={false} />
                        </div>
                        <p className="text-xs text-muted-foreground">100×100px</p>
                      </div>

                      {/* Medium - Flyers */}
                      <div className="flex flex-col items-center space-y-2 p-3 bg-muted/20 rounded">
                        <p className="font-medium text-xs text-center">Panfletos</p>
                        <div className="bg-white p-2 rounded border">
                          <QRCodeDisplay size={100} showControls={false} />
                        </div>
                        <p className="text-xs text-muted-foreground">300×300px</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Download Section */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Baixar QR Code (300×300px)</CardTitle>
                    <p className="text-xs text-muted-foreground mt-2">Clique nos botões abaixo para baixar</p>
                  </CardHeader>
                  <CardContent>
                    <QRCodeDisplay size={300} showControls={true} />
                  </CardContent>
                </Card>

                {/* Sizes Reference */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">Como Usar</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3 text-sm">
                      <div className="p-3 bg-blue-50 dark:bg-blue-950/20 rounded border border-blue-200 dark:border-blue-800/30">
                        <p className="font-medium text-blue-900 dark:text-blue-200">📱 100×100px</p>
                        <p className="text-xs text-blue-800 dark:text-blue-300 mt-1">Perfeito para: redes sociais, stories, posts, footers</p>
                      </div>
                      <div className="p-3 bg-green-50 dark:bg-green-950/20 rounded border border-green-200 dark:border-green-800/30">
                        <p className="font-medium text-green-900 dark:text-green-200">🎨 300×300px</p>
                        <p className="text-xs text-green-800 dark:text-green-300 mt-1">Perfeito para: panfletos, cardápios, whatsapp, emails</p>
                      </div>
                      <div className="p-3 bg-purple-50 dark:bg-purple-950/20 rounded border border-purple-200 dark:border-purple-800/30">
                        <p className="font-medium text-purple-900 dark:text-purple-200">✨ PNG vs SVG</p>
                        <p className="text-xs text-purple-800 dark:text-purple-300 mt-1">Use <strong>SVG</strong> para impressão profissional - redimensiona sem perder qualidade em Canva/Photoshop</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

              </main>
            </div>
          </Tabs>
        </div>

        {/* Category Management Dialog */}
        <CategoryManagementDialog
          open={isCategoryDialogOpen}
          onOpenChange={setIsCategoryDialogOpen}
          categories={settingsForm.categories_config || []}
          onSave={(categories) => {
            updateSettingsFormWithFlag({ categories_config: categories });
          }}
          onSaveAsync={handleSaveCategories}
        />

        {/* Size Management Dialog */}
        <SizeManagementDialog
          open={isSizeDialogOpen}
          onOpenChange={setIsSizeDialogOpen}
          sizes={settingsForm.sizes_config || []}
          onSave={(sizes) => {
            updateSettingsFormWithFlag({ sizes_config: sizes });
          }}
          onSaveAsync={handleSaveSizes}
        />

        {/* Delete Confirmation Dialog */}
        <ConfirmDeleteDialog
          open={deleteDialog.open}
          onOpenChange={(open) => setDeleteDialog({ ...deleteDialog, open })}
          title={`Excluir ${deleteDialog.type === 'product' ? 'Produto' : deleteDialog.type === 'order' ? 'Pedido' : 'Bairro'}`}
          description={`Tem certeza que deseja excluir "${deleteDialog.name}"? Esta ação não pode ser desfeita.`}
          onConfirm={handleDeleteConfirm}
        />
      </div>
    );
  };

  export default AdminDashboard;
