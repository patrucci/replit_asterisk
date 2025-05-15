import { Input } from "@/components/ui/input";
import { FormItem, FormLabel, FormControl, FormDescription } from "@/components/ui/form";

interface InstagramChannelCredentialsFormProps {
  credentials: {
    instagramAccountId?: string;
    accessToken?: string;
  };
  onChange: (key: string, value: string) => void;
}

export function InstagramChannelCredentialsForm({ credentials, onChange }: InstagramChannelCredentialsFormProps) {
  return (
    <>
      <FormItem>
        <FormLabel>ID da Conta do Instagram</FormLabel>
        <FormControl>
          <Input 
            placeholder="ID da conta do Instagram"
            onChange={(e) => onChange("instagramAccountId", e.target.value)}
            value={credentials.instagramAccountId || ""}
          />
        </FormControl>
        <FormDescription>
          ID da conta do Instagram que será conectada ao chatbot
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
          Token de acesso para a API do Instagram
        </FormDescription>
      </FormItem>
    </>
  );
}