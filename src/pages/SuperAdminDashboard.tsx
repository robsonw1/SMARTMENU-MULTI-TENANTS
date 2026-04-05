import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogFooter,
} from '@/components/ui/alert-dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useTenantsRealtime, type Tenant } from '@/hooks/use-tenants-realtime';
import { useTenantManagement } from '@/hooks/use-tenant-management';
import {
  Store,
  Plus,
  Search,
  LogOut,
  MoreVertical,
  Edit2,
  Trash2,
  Power,
  Moon,
  Sun,
  Eye,
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { useSettingsStore } from '@/store/useSettingsStore';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const SuperAdminDashboard = () => {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const settings = useSettingsStore((s) => s.settings);
  const { tenants, isLoading: tenantsLoading } = useTenantsRealtime();
  const { getTenantDetails, deleteTenant, suspendTenant, activateTenant, isLoading } = useTenantManagement();

  const [search, setSearch] = useState('');
  const [selectedTenant, setSelectedTenant] = useState<Tenant | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [tenantDetails, setTenantDetails] = useState<any>(null);

  // Filtrar tenants por busca
  const filteredTenants = useMemo(() => {
    return tenants.filter(
      (t) =>
        t.name.toLowerCase().includes(search.toLowerCase()) ||
        t.slug.toLowerCase().includes(search.toLowerCase())
    );
  }, [tenants, search]);

  // Abrir detalhes
  const handleOpenDetails = async (tenant: Tenant) => {
    setSelectedTenant(tenant);
    const details = await getTenantDetails(tenant.id);
    setTenantDetails(details);
    setDetailsOpen(true);
  };

  // Ações
  const handleDelete = async (tenantId: string) => {
    const success = await deleteTenant(tenantId);
    if (success) {
      setDeleteConfirm(null);
    }
  };

  const handleSuspend = async (tenantId: string) => {
    await suspendTenant(tenantId);
    setDetailsOpen(false);
  };

  const handleActivate = async (tenantId: string) => {
    await activateTenant(tenantId);
    setDetailsOpen(false);
  };

  const handleLogout = async () => {
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-card border-b">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <img
              src={settings?.store_logo_url || require('@/assets/logo.jpg')}
              alt={settings?.name || 'Super Admin'}
              className="w-10 h-10 rounded-full object-cover border-2 border-primary"
            />
            <div>
              <h1 className="font-heading font-bold text-lg">Super Admin</h1>
              <p className="text-xs text-muted-foreground">Gerenciar Lojas</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTheme}
              className="text-muted-foreground hover:text-foreground"
            >
              {theme === 'light' ? <Moon className="w-4 h-4" /> : <Sun className="w-4 h-4" />}
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={() => navigate('/register-tenant')}
              className="bg-orange-600 hover:bg-orange-700"
            >
              <Plus className="w-4 h-4 mr-2" />
              Criar Loja
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="gap-2">
              <LogOut className="w-4 h-4" />
              Sair
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Total de Lojas</p>
                <p className="text-3xl font-bold">{tenants.length}</p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Lojas Ativas</p>
                <p className="text-3xl font-bold text-green-600">
                  {tenantDetails?.settings?.is_active ? tenants.length : 0}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Criadas Hoje</p>
                <p className="text-3xl font-bold">
                  {tenants.filter((t) => new Date(t.created_at).toDateString() === new Date().toDateString()).length}
                </p>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <p className="text-sm text-muted-foreground mb-2">Com WhatsApp</p>
                <p className="text-3xl font-bold text-blue-600">
                  {tenants.filter((t) => t.whatsapp_notifications_enabled).length}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Tabela */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5" />
                Lojas Cadastradas
              </div>
              <div className="w-64">
                <div className="relative">
                  <Search className="absolute left-2 top-2.5 w-4 h-4 text-muted-foreground" />
                  <Input
                    placeholder="Buscar loja..."
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="pl-8"
                  />
                </div>
              </div>
            </CardTitle>
          </CardHeader>

          <CardContent>
            {tenantsLoading ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Carregando lojas...</p>
              </div>
            ) : filteredTenants.length === 0 ? (
              <div className="flex items-center justify-center h-32">
                <p className="text-muted-foreground">Nenhuma loja encontrada</p>
              </div>
            ) : (
              <ScrollArea>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Slug</TableHead>
                      <TableHead>Data Cadastro</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>WhatsApp</TableHead>
                      <TableHead className="text-right">Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredTenants.map((tenant) => (
                      <TableRow key={tenant.id} className="hover:bg-muted/50">
                        <TableCell className="font-medium">{tenant.name}</TableCell>
                        <TableCell>
                          <code className="bg-muted px-2 py-1 rounded text-sm">{tenant.slug}</code>
                        </TableCell>
                        <TableCell>
                          {format(new Date(tenant.created_at), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
                            🟢 Ativo
                          </Badge>
                        </TableCell>
                        <TableCell>
                          {tenant.whatsapp_notifications_enabled ? (
                            <Badge className="bg-blue-50 text-blue-700 border-blue-200">✓ Habilitado</Badge>
                          ) : (
                            <Badge variant="outline">○ Desabilitado</Badge>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm" disabled={isLoading}>
                                <MoreVertical className="w-4 h-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuLabel>Ações</DropdownMenuLabel>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleOpenDetails(tenant)}>
                                <Eye className="w-4 h-4 mr-2" />
                                Visualizar
                              </DropdownMenuItem>
                              <DropdownMenuItem>
                                <Edit2 className="w-4 h-4 mr-2" />
                                Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              <DropdownMenuItem onClick={() => handleSuspend(tenant.id)} className="text-yellow-600">
                                <Power className="w-4 h-4 mr-2" />
                                Suspender
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => setDeleteConfirm(tenant.id)}
                                className="text-red-600"
                              >
                                <Trash2 className="w-4 h-4 mr-2" />
                                Deletar
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Detalhes Modal */}
      <Dialog open={detailsOpen} onOpenChange={setDetailsOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{selectedTenant?.name} - Detalhes</DialogTitle>
          </DialogHeader>

          {tenantDetails && (
            <ScrollArea className="h-96">
              <div className="space-y-4 pr-4">
                <div>
                  <Label>Slug</Label>
                  <p className="font-mono text-sm">{selectedTenant?.slug}</p>
                </div>

                <div>
                  <Label>URL</Label>
                  <p className="text-sm break-all">
                    https://{selectedTenant?.slug}.app.aezap.site
                  </p>
                </div>

                <div>
                  <Label>Criado em</Label>
                  <p className="text-sm">
                    {format(new Date(selectedTenant?.created_at || ''), 'dd/MM/yyyy HH:mm', { locale: ptBR })}
                  </p>
                </div>

                <div className="border-t pt-4">
                  <Label className="font-semibold">Configurações</Label>
                  <div className="space-y-3 mt-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Ativo</span>
                      <Badge variant={tenantDetails?.settings?.is_active ? 'default' : 'outline'}>
                        {tenantDetails?.settings?.is_active ? '✓ Sim' : '○ Não'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">WhatsApp</span>
                      <Badge variant={tenantDetails?.settings?.whatsapp_notifications_enabled ? 'default' : 'outline'}>
                        {tenantDetails?.settings?.whatsapp_notifications_enabled ? '✓ Sim' : '○ Não'}
                      </Badge>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-sm">Fidelização</span>
                      <Badge variant={tenantDetails?.settings?.loyalty_enabled ? 'default' : 'outline'}>
                        {tenantDetails?.settings?.loyalty_enabled ? '✓ Sim' : '○ Não'}
                      </Badge>
                    </div>
                  </div>
                </div>
              </div>
            </ScrollArea>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDetailsOpen(false)}>
              Fechar
            </Button>
            {selectedTenant && (
              <Button
                variant="destructive"
                onClick={() => {
                  setDeleteConfirm(selectedTenant.id);
                  setDetailsOpen(false);
                }}
              >
                Deletar Loja
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteConfirm} onOpenChange={() => setDeleteConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deletar Loja?</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja deletar esta loja? Todos os dados serão perdidos permanentemente.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteConfirm && handleDelete(deleteConfirm)}
              className="bg-red-600 hover:bg-red-700"
            >
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default SuperAdminDashboard;
