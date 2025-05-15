import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Loader2, X } from "lucide-react";
import { 
  Card, CardContent, CardFooter, CardHeader, CardTitle 
} from "@/components/ui/card";

export interface UnifiedNode {
  id: number;
  flowId: number;
  nodeType: string;
  name: string;
  data: any;
  position: { x: number; y: number };
  supportedChannels?: string[];
}

interface NodeEditorProps {
  node: UnifiedNode;
  onClose: () => void;
  onSave: (editedNode: { 
    id: number, 
    name: string, 
    data: any, 
    supportedChannels?: string[]
  }) => void;
  isLoading?: boolean;
}

export interface AvailableChannel {
  id: string;
  name: string;
}

const availableChannels: AvailableChannel[] = [
  { id: 'all', name: 'Todos os canais' },
  { id: 'voice', name: 'Telefonia' },
  { id: 'whatsapp', name: 'WhatsApp' },
  { id: 'telegram', name: 'Telegram' },
  { id: 'facebook', name: 'Facebook' },
  { id: 'instagram', name: 'Instagram' },
  { id: 'web', name: 'Web' }
];

export const NodeEditor: React.FC<NodeEditorProps> = ({
  node,
  onClose,
  onSave,
  isLoading = false
}) => {
  const [name, setName] = useState<string>(node.name);
  const [data, setData] = useState<any>(node.data || {});
  const [supportedChannels, setSupportedChannels] = useState<string[]>(
    node.supportedChannels || ['all']
  );

  useEffect(() => {
    // Inicializa campos específicos por tipo, se estiverem vazios
    let initialData = { ...node.data };
    
    switch(node.nodeType) {
      case 'message':
        if (!initialData.message) {
          setData({
            ...initialData,
            message: 'Digite a mensagem aqui'
          });
        }
        break;
      case 'input':
        if (!initialData.prompt) {
          setData({
            ...initialData,
            prompt: 'O que você gostaria de saber?',
            timeout: initialData.timeout || 30
          });
        }
        break;
      case 'condition':
        if (!initialData.condition) {
          setData({
            ...initialData,
            condition: 'context.lastMessage == "sim"',
            description: initialData.description || 'Verifica se a última mensagem é "sim"'
          });
        }
        break;
      // ... outros casos
    }
  }, [node]);

  const handleFieldChange = (field: string, value: any) => {
    setData({
      ...data,
      [field]: value
    });
  };

  const toggleChannel = (channelId: string) => {
    // Se está selecionando 'all'
    if (channelId === 'all') {
      if (supportedChannels.includes('all')) {
        // Caso já tenha 'all' selecionado, não faz nada
        return;
      } else {
        // Caso contrário, limpa todos e seleciona apenas 'all'
        setSupportedChannels(['all']);
      }
    } else {
      // Se está selecionando um canal específico
      if (supportedChannels.includes('all')) {
        // Se tinha 'all' selecionado, troca por apenas este canal
        setSupportedChannels([channelId]);
      } else if (supportedChannels.includes(channelId)) {
        // Se o canal já estava selecionado, remove
        const newChannels = supportedChannels.filter(c => c !== channelId);
        // Se ficou vazio, seleciona 'all'
        setSupportedChannels(newChannels.length === 0 ? ['all'] : newChannels);
      } else {
        // Adiciona o canal aos já selecionados
        setSupportedChannels([...supportedChannels, channelId]);
      }
    }
  };

  const handleSave = () => {
    if (!name.trim()) {
      // TODO: mostrar erro
      return;
    }

    onSave({
      id: node.id,
      name,
      data,
      supportedChannels
    });
  };

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-xl">Configurar Componente</CardTitle>
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="h-4 w-4" />
        </Button>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        {/* Nome do componente */}
        <div className="space-y-2">
          <Label htmlFor="nodeName">Nome do Componente</Label>
          <Input
            id="nodeName"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* Campos específicos para cada tipo de nó */}
        {node.nodeType === 'message' && (
          <div className="space-y-2">
            <Label htmlFor="messageText">Mensagem</Label>
            <Input
              id="messageText"
              value={data.message || ''}
              onChange={(e) => handleFieldChange('message', e.target.value)}
            />
            {/* Campo adicional para voz em mensagens de voz */}
            {data.voice !== undefined && (
              <>
                <Label htmlFor="voiceType" className="mt-2">Tipo de Voz</Label>
                <select
                  id="voiceType"
                  className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                  value={data.voice || 'female1'}
                  onChange={(e) => handleFieldChange('voice', e.target.value)}
                >
                  <option value="female1">Feminina 1</option>
                  <option value="female2">Feminina 2</option>
                  <option value="male1">Masculina 1</option>
                  <option value="male2">Masculina 2</option>
                </select>
              </>
            )}
          </div>
        )}

        {node.nodeType === 'input' && (
          <div className="space-y-2">
            <Label htmlFor="promptText">Solicitação</Label>
            <Input
              id="promptText"
              value={data.prompt || ''}
              onChange={(e) => handleFieldChange('prompt', e.target.value)}
            />
            <Label htmlFor="timeoutValue" className="mt-2">Timeout (segundos)</Label>
            <Input
              id="timeoutValue"
              type="number"
              value={data.timeout || 30}
              onChange={(e) => handleFieldChange('timeout', parseInt(e.target.value))}
            />
            {/* Campos adicionais para entrada telefônica */}
            {data.maxDigits !== undefined && (
              <>
                <Label htmlFor="maxDigits" className="mt-2">Número máximo de dígitos</Label>
                <Input
                  id="maxDigits"
                  type="number"
                  value={data.maxDigits || 1}
                  onChange={(e) => handleFieldChange('maxDigits', parseInt(e.target.value))}
                />
              </>
            )}
          </div>
        )}

        {node.nodeType === 'condition' && (
          <div className="space-y-2">
            <Label htmlFor="conditionExpr">Expressão da Condição</Label>
            <Input
              id="conditionExpr"
              value={data.condition || ''}
              onChange={(e) => handleFieldChange('condition', e.target.value)}
            />
            <Label htmlFor="conditionDescription" className="mt-2">Descrição</Label>
            <Input
              id="conditionDescription"
              value={data.description || ''}
              onChange={(e) => handleFieldChange('description', e.target.value)}
            />
          </div>
        )}

        {(node.nodeType === 'api_request' || node.nodeType === 'api_integration') && (
          <div className="space-y-2">
            <Label htmlFor="apiUrl">URL da API</Label>
            <Input
              id="apiUrl"
              value={data.url || ''}
              onChange={(e) => handleFieldChange('url', e.target.value)}
            />
            <Label htmlFor="apiMethod" className="mt-2">Método</Label>
            <select
              id="apiMethod"
              className="flex h-9 w-full rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
              value={data.method || 'GET'}
              onChange={(e) => handleFieldChange('method', e.target.value)}
            >
              <option value="GET">GET</option>
              <option value="POST">POST</option>
              <option value="PUT">PUT</option>
              <option value="DELETE">DELETE</option>
            </select>
            <Label htmlFor="apiHeaders" className="mt-2">Headers (JSON)</Label>
            <Input
              id="apiHeaders"
              value={JSON.stringify(data.headers || {})}
              onChange={(e) => {
                try {
                  const headers = JSON.parse(e.target.value);
                  handleFieldChange('headers', headers);
                } catch (err) {
                  // Permite digitação inválida durante a edição
                }
              }}
            />
          </div>
        )}

        {/* Canais suportados */}
        <div className="space-y-2 pt-2 border-t mt-4">
          <Label>Canais Suportados</Label>
          <div className="grid grid-cols-2 gap-2 pt-1">
            {availableChannels.map(channel => (
              <div 
                key={channel.id}
                className="flex items-center space-x-2"
              >
                <Checkbox 
                  id={`channel-${channel.id}`}
                  checked={supportedChannels.includes(channel.id)}
                  onCheckedChange={() => toggleChannel(channel.id)}
                  disabled={
                    channel.id !== 'all' && 
                    supportedChannels.includes('all')
                  }
                />
                <Label 
                  htmlFor={`channel-${channel.id}`}
                  className="text-xs cursor-pointer"
                >
                  {channel.name}
                </Label>
              </div>
            ))}
          </div>
        </div>
      </CardContent>
      <CardFooter className="flex justify-between">
        <Button variant="outline" onClick={onClose}>
          Cancelar
        </Button>
        <Button 
          onClick={handleSave}
          disabled={isLoading}
        >
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" className="mr-2 h-4 w-4" viewBox="0 0 16 16">
              <path d="M13.854 3.646a.5.5 0 0 1 0 .708l-7 7a.5.5 0 0 1-.708 0l-3.5-3.5a.5.5 0 1 1 .708-.708L6.5 10.293l6.646-6.647a.5.5 0 0 1 .708 0z"/>
            </svg>
          )}
          Salvar
        </Button>
      </CardFooter>
    </Card>
  );
};