import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Upload, Plus, Trash2, Download } from 'lucide-react';
import { toast } from 'sonner';
import Papa from 'papaparse';

interface Contact {
  phone: string;
  name: string;
  source: 'manual' | 'csv' | 'excel';
}

interface ContactListTabProps {
  contacts: Contact[];
  onContactsChange: (contacts: Contact[]) => void;
}

export function ContactListTab({ contacts, onContactsChange }: ContactListTabProps) {
  const [newPhone, setNewPhone] = useState('');
  const [newName, setNewName] = useState('');
  const [fileInput, setFileInput] = useState<File | null>(null);

  const handleAddManual = () => {
    if (!newPhone.trim()) {
      toast.error('Digite o número do contato');
      return;
    }

    const phoneClean = newPhone.replace(/\D/g, '');
    if (phoneClean.length < 10) {
      toast.error('Número inválido (mínimo 10 dígitos)');
      return;
    }

    if (contacts.some((c) => c.phone === phoneClean)) {
      toast.error('Este contato já foi adicionado');
      return;
    }

    const newContact: Contact = {
      phone: phoneClean,
      name: newName || 'Contato',
      source: 'manual',
    };

    onContactsChange([...contacts, newContact]);
    setNewPhone('');
    setNewName('');
    toast.success('✅ Contato adicionado');
  };

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setFileInput(file);

    if (file.type === 'text/csv' || file.name.endsWith('.csv')) {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          try {
            const parsed = results.data as any[];
            const newContacts: Contact[] = [];

            parsed.forEach((row) => {
              const phone = row.phone || row.Telefone || row.número || row.phone;
              const name = row.name || row.Nome || row.name || 'Contato';

              if (phone) {
                const phoneClean = phone.toString().replace(/\D/g, '');
                if (phoneClean.length >= 10) {
                  if (!contacts.some((c) => c.phone === phoneClean)) {
                    newContacts.push({
                      phone: phoneClean,
                      name: name.toString(),
                      source: 'csv',
                    });
                  }
                }
              }
            });

            onContactsChange([...contacts, ...newContacts]);
            toast.success(`✅ ${newContacts.length} contatos importados do CSV`);
          } catch (err) {
            toast.error('Erro ao processar CSV');
          }
        },
        error: () => {
          toast.error('Erro ao ler arquivo CSV');
        },
      });
    } else {
      toast.error('Use arquivo CSV ou XLSX');
    }
  };

  const handleRemoveContact = (phone: string) => {
    onContactsChange(contacts.filter((c) => c.phone !== phone));
    toast.success('✅ Contato removido');
  };

  const handleDownloadTemplate = () => {
    const template = 'Telefone,Nome\n5511912345678,João Silva\n5521987654321,Maria Santos';
    const element = document.createElement('a');
    element.setAttribute('href', `data:text/csv;charset=utf-8,${encodeURIComponent(template)}`);
    element.setAttribute('download', 'template_contatos.csv');
    element.style.display = 'none';
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    toast.success('✅ Template baixado');
  };

  return (
    <div className="space-y-6">
      {/* Upload Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Upload className="w-5 h-5" />
            Importar Contatos
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Fazer upload de CSV ou XLSX</Label>
            <div className="mt-2 flex gap-2">
              <Input
                type="file"
                accept=".csv,.xlsx"
                onChange={handleFileUpload}
                className="flex-1"
              />
              <Button variant="outline" onClick={handleDownloadTemplate} size="sm">
                <Download className="w-4 h-4 mr-1" />
                Template
              </Button>
            </div>
            <p className="text-xs text-muted-foreground mt-2">
              CSV/XLSX com colunas: Telefone, Nome
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Manual Add Section */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Plus className="w-5 h-5" />
            Adicionar Contato Manual
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
            <div>
              <Label>Telefone</Label>
              <Input
                placeholder="11 9 1234-5678"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                className="mt-1"
              />
            </div>
            <div>
              <Label>Nome</Label>
              <Input
                placeholder="João Silva"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                className="mt-1"
              />
            </div>
            <div className="flex items-end">
              <Button onClick={handleAddManual} className="w-full">
                Adicionar
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Contacts List */}
      <Card>
        <CardHeader>
          <CardTitle>
            Contatos Adicionados ({contacts.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {contacts.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              Nenhum contato adicionado ainda
            </p>
          ) : (
            <div className="border rounded-lg overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Telefone</TableHead>
                    <TableHead>Nome</TableHead>
                    <TableHead>Fonte</TableHead>
                    <TableHead className="w-10">Ação</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {contacts.map((contact, idx) => (
                    <TableRow key={idx}>
                      <TableCell className="font-mono">+55 {contact.phone}</TableCell>
                      <TableCell>{contact.name}</TableCell>
                      <TableCell className="text-xs">
                        {contact.source === 'manual' && '👤 Manual'}
                        {contact.source === 'csv' && '📄 CSV'}
                        {contact.source === 'excel' && '📊 Excel'}
                      </TableCell>
                      <TableCell>
                        <button
                          onClick={() => handleRemoveContact(contact.phone)}
                          className="text-red-500 hover:text-red-700"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
