import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";

interface LinkedInChannelCredentialsFormProps {
  credentials: {
    linkedinPageId?: string;
    clientId?: string;
    clientSecret?: string;
    accessToken?: string;
  };
  onChange: (key: string, value: string) => void;
}

export function LinkedInChannelCredentialsForm({ credentials, onChange }: LinkedInChannelCredentialsFormProps) {
  return (
    <>
      <FormItem>
        <FormLabel>ID da Página LinkedIn</FormLabel>
        <FormControl>
          <Input 
            placeholder="ID da página do LinkedIn"
            onChange={(e) => onChange("linkedinPageId", e.target.value)}
            value={credentials.linkedinPageId || ""}
          />
        </FormControl>
        <FormDescription>
          ID da página do LinkedIn que será conectada ao chatbot
        </FormDescription>
      </FormItem>
      
      <FormItem>
        <FormLabel>ID do Cliente</FormLabel>
        <FormControl>
          <Input 
            placeholder="ID do cliente da aplicação LinkedIn"
            onChange={(e) => onChange("clientId", e.target.value)}
            value={credentials.clientId || ""}
          />
        </FormControl>
        <FormDescription>
          ID do cliente da aplicação registrada no LinkedIn Developer
        </FormDescription>
      </FormItem>
      
      <FormItem>
        <FormLabel>Segredo do Cliente</FormLabel>
        <FormControl>
          <Input 
            placeholder="Segredo do cliente"
            type="password"
            onChange={(e) => onChange("clientSecret", e.target.value)}
            value={credentials.clientSecret || ""}
          />
        </FormControl>
        <FormDescription>
          Segredo do cliente da aplicação registrada no LinkedIn Developer
        </FormDescription>
      </FormItem>
      
      <FormItem>
        <FormLabel>Token de Acesso</FormLabel>
        <FormControl>
          <Input 
            placeholder="Token de acesso"
            type="password"
            onChange={(e) => onChange("accessToken", e.target.value)}
            value={credentials.accessToken || ""}
          />
        </FormControl>
        <FormDescription>
          Token de acesso para a API do LinkedIn
        </FormDescription>
      </FormItem>
    </>
  );
}