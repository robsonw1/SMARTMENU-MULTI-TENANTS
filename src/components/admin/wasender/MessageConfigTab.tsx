import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Upload, X, FileAudio, Image as ImageIcon, FileText } from 'lucide-react';
import { toast } from 'sonner';

interface MessageAttachment {
  name: string;
  type: 'audio' | 'image' | 'document';
  file: File;
  icon: string;
}

interface Message {
  sequence: number;
  text: string;
  attachments: MessageAttachment[];
}

interface MessageConfigTabProps {
  messages: Message[];
  onMessagesChange: (messages: Message[]) => void;
}

const ACCEPTED_FORMATS = {
  audio: ['.ogg', '.opus', '.mp3', '.m4a'],
  image: ['.jpg', '.jpeg', '.png', '.gif', '.webp'],
  document: ['.pdf', '.doc', '.docx', '.xls', '.xlsx'],
};

const FILE_SIZE_LIMIT = 5 * 1024 * 1024; // 5MB

export function MessageConfigTab({ messages, onMessagesChange }: MessageConfigTabProps) {
  const handleMessageChange = (sequence: number, text: string) => {
    const updated = [...messages];
    const idx = updated.findIndex((m) => m.sequence === sequence);
    if (idx !== -1) {
      updated[idx].text = text;
      onMessagesChange(updated);
    }
  };

  const handleFileUpload = (sequence: number, files: FileList | null) => {
    if (!files) return;

    const file = files[0];
    
    // Validate file size
    if (file.size > FILE_SIZE_LIMIT) {
      toast.error('Arquivo muito grande (máx 5MB)');
      return;
    }

    // Determine file type
    let fileType: 'audio' | 'image' | 'document' | null = null;
    if (file.type.startsWith('audio/') || file.name.endsWith('.ogg') || file.name.endsWith('.opus')) {
      fileType = 'audio';
    } else if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.type === 'application/pdf' || file.name.endsWith('.pdf')) {
      fileType = 'document';
    } else if (file.type.startsWith('application/')) {
      fileType = 'document';
    }

    if (!fileType) {
      toast.error('Formato não suportado');
      return;
    }

    const attachment: MessageAttachment = {
      name: file.name,
      type: fileType,
      file: file,
      icon: fileType === 'audio' ? '🎵' : fileType === 'image' ? '🖼️' : '📄',
    };

    const updated = [...messages];
    const idx = updated.findIndex((m) => m.sequence === sequence);
    if (idx !== -1) {
      // Remove if same type exists
      updated[idx].attachments = updated[idx].attachments.filter((a) => a.type !== fileType);
      updated[idx].attachments.push(attachment);
      onMessagesChange(updated);
      toast.success(`✅ ${fileType === 'audio' ? 'Áudio' : fileType === 'image' ? 'Imagem' : 'Documento'} adicionado`);
    }
  };

  const handleRemoveAttachment = (sequence: number, attachmentIndex: number) => {
    const updated = [...messages];
    const idx = updated.findIndex((m) => m.sequence === sequence);
    if (idx !== -1) {
      updated[idx].attachments.splice(attachmentIndex, 1);
      onMessagesChange(updated);
      toast.success('✅ Anexo removido');
    }
  };

  return (
    <div className="space-y-4">
      <Tabs defaultValue="msg1" className="w-full">
        <TabsList className="grid w-full grid-cols-5 mb-4">
          {messages.map((msg) => (
            <TabsTrigger key={msg.sequence} value={`msg${msg.sequence}`}>
              Mensagem {msg.sequence}
              {msg.text && <span className="ml-1 flex h-2 w-2 rounded-full bg-green-500" />}
            </TabsTrigger>
          ))}
        </TabsList>

        {messages.map((message) => (
          <TabsContent key={message.sequence} value={`msg${message.sequence}`}>
            <Card>
              <CardHeader>
                <CardTitle>
                  Mensagem {message.sequence}
                  {messages[message.sequence - 1]?.text && (
                    <Badge className="ml-2" variant="outline">
                      ✓ Preenchida
                    </Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Message Text */}
                <div>
                  <label className="text-sm font-medium">Texto da Mensagem</label>
                  <Textarea
                    placeholder={`Mensagem ${message.sequence}...`}
                    value={message.text}
                    onChange={(e) => handleMessageChange(message.sequence, e.target.value)}
                    rows={6}
                    className="mt-2"
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Máximo 4096 caracteres
                  </p>
                </div>

                {/* Attachments */}
                <div className="space-y-3">
                  <div className="text-sm font-medium">Anexos (Opcional)</div>

                  {/* Audio */}
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 cursor-pointer hover:border-primary transition">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <FileAudio className="w-4 h-4" />
                      <span className="text-sm">Áudio (.ogg, .opus, .mp3)</span>
                      <input
                        type="file"
                        accept=".ogg,.opus,.mp3,.m4a,audio/*"
                        onChange={(e) => handleFileUpload(message.sequence, e.target.files)}
                        className="hidden"
                      />
                    </label>

                    {message.attachments
                      .filter((a) => a.type === 'audio')
                      .map((att, idx) => (
                        <div key={idx} className="mt-2 flex items-center justify-between bg-blue-50 p-2 rounded">
                          <span className="text-sm">{att.icon} {att.name}</span>
                          <button
                            onClick={() => handleRemoveAttachment(message.sequence, message.attachments.indexOf(att))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Image */}
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 cursor-pointer hover:border-primary transition">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <ImageIcon className="w-4 h-4" />
                      <span className="text-sm">Imagem (.jpg, .png, .gif)</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={(e) => handleFileUpload(message.sequence, e.target.files)}
                        className="hidden"
                      />
                    </label>

                    {message.attachments
                      .filter((a) => a.type === 'image')
                      .map((att, idx) => (
                        <div key={idx} className="mt-2 flex items-center justify-between bg-green-50 p-2 rounded">
                          <span className="text-sm">{att.icon} {att.name}</span>
                          <button
                            onClick={() => handleRemoveAttachment(message.sequence, message.attachments.indexOf(att))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>

                  {/* Document */}
                  <div className="border-2 border-dashed border-muted rounded-lg p-4 cursor-pointer hover:border-primary transition">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <FileText className="w-4 h-4" />
                      <span className="text-sm">Documento (.pdf, .doc)</span>
                      <input
                        type="file"
                        accept=".pdf,.doc,.docx,.xls,.xlsx"
                        onChange={(e) => handleFileUpload(message.sequence, e.target.files)}
                        className="hidden"
                      />
                    </label>

                    {message.attachments
                      .filter((a) => a.type === 'document')
                      .map((att, idx) => (
                        <div key={idx} className="mt-2 flex items-center justify-between bg-amber-50 p-2 rounded">
                          <span className="text-sm">{att.icon} {att.name}</span>
                          <button
                            onClick={() => handleRemoveAttachment(message.sequence, message.attachments.indexOf(att))}
                            className="text-red-500 hover:text-red-700"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}
