import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";

interface FacebookChannelCredentialsFormProps {
  credentials: {
    pageId?: string;
    pageAccessToken?: string;
    appSecret?: string;
  };
  onChange: (key: string, value: string) => void;
}

export function FacebookChannelCredentialsForm({ credentials, onChange }: FacebookChannelCredentialsFormProps) {
  return (
    <>
      <FormItem>
        <FormLabel>ID da Página</FormLabel>
        <FormControl>
          <Input 
            placeholder="ID da página do Facebook"
            onChange={(e) => onChange("pageId", e.target.value)}
            value={credentials.pageId || ""}
          />
        </FormControl>
        <FormDescription>
          ID da página do Facebook que será conectada ao chatbot
        </FormDescription>
      </FormItem>
      
      <FormItem>
        <FormLabel>Token de Acesso da Página</FormLabel>
        <FormControl>
          <Input 
            placeholder="Token de acesso da página"
            type="password"
            onChange={(e) => onChange("pageAccessToken", e.target.value)}
            value={credentials.pageAccessToken || ""}
          />
        </FormControl>
        <FormDescription>
          Token de acesso da página do Facebook para integração com a API do Messenger
        </FormDescription>
      </FormItem>
      
      <FormItem>
        <FormLabel>Segredo do Aplicativo</FormLabel>
        <FormControl>
          <Input 
            placeholder="Segredo do aplicativo"
            type="password"
            onChange={(e) => onChange("appSecret", e.target.value)}
            value={credentials.appSecret || ""}
          />
        </FormControl>
        <FormDescription>
          Segredo do aplicativo Facebook usado para verificar as mensagens recebidas
        </FormDescription>
      </FormItem>
    </>
  );
}