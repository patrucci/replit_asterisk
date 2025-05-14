import { useEffect, useState } from "react";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";

import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { AlertTriangle, CheckCircle, Key, Loader2 } from "lucide-react";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

// Esquema para o formulário
const apiSettingsFormSchema = z.object({
  openaiApiKey: z.string().optional().or(z.literal("")),
  anthropicApiKey: z.string().optional().or(z.literal("")),
  useOpenAI: z.boolean().default(true),
  useAnthropic: z.boolean().default(false),
  openaiModel: z.string().default("gpt-4o"),
  anthropicModel: z.string().default("claude-3-7-sonnet-20250219"),
});

type ApiSettingsFormValues = z.infer<typeof apiSettingsFormSchema>;

export default function ApiSettingsPage() {
  const { toast } = useToast();
  const { user } = useAuth();
  const [testingOpenAI, setTestingOpenAI] = useState(false);
  const [testingAnthropic, setTestingAnthropic] = useState(false);
  const [openAITestResult, setOpenAITestResult] = useState<{ success: boolean; message: string } | null>(null);
  const [anthropicTestResult, setAnthropicTestResult] = useState<{ success: boolean; message: string } | null>(null);

  // Buscar configurações existentes
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings/api"],
    queryFn: async () => {
      const res = await apiRequest("GET", "/api/settings/api");
      return await res.json();
    },
  });

  // Criar formulário
  const form = useForm<ApiSettingsFormValues>({
    resolver: zodResolver(apiSettingsFormSchema),
    defaultValues: {
      openaiApiKey: "",
      anthropicApiKey: "",
      useOpenAI: true,
      useAnthropic: false,
      openaiModel: "gpt-4o",
      anthropicModel: "claude-3-7-sonnet-20250219",
    },
  });

  // Atualizar valores do formulário quando os dados são carregados
  useEffect(() => {
    if (settings) {
      form.reset({
        openaiApiKey: settings.openaiApiKey ? "" : "", // Não exibir a chave real
        anthropicApiKey: settings.anthropicApiKey ? "" : "", // Não exibir a chave real
        useOpenAI: settings.useOpenAI,
        useAnthropic: settings.useAnthropic,
        openaiModel: settings.openaiModel || "gpt-4o",
        anthropicModel: settings.anthropicModel || "claude-3-7-sonnet-20250219",
      });
    }
  }, [settings, form]);

  // Atualizar configurações
  const updateMutation = useMutation({
    mutationFn: async (data: ApiSettingsFormValues) => {
      const res = await apiRequest("PUT", "/api/settings/api", data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Configurações atualizadas",
        description: "As configurações de API foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/settings/api"] });
    },
    onError: (error: Error) => {
      toast({
        title: "Erro ao atualizar configurações",
        description: error.message || "Não foi possível atualizar as configurações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Testar conexão com OpenAI
  const testOpenAIMutation = useMutation({
    mutationFn: async () => {
      setOpenAITestResult(null);
      setTestingOpenAI(true);
      const res = await apiRequest("POST", "/api/settings/api/test/openai");
      return await res.json();
    },
    onSuccess: (data) => {
      setOpenAITestResult(data);
      toast({
        title: data.success ? "Conexão bem-sucedida" : "Falha na conexão",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      setOpenAITestResult({ success: false, message: error.message });
      toast({
        title: "Erro ao testar conexão",
        description: error.message || "Não foi possível testar a conexão com a API da OpenAI.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingOpenAI(false);
    }
  });

  // Testar conexão com Anthropic
  const testAnthropicMutation = useMutation({
    mutationFn: async () => {
      setAnthropicTestResult(null);
      setTestingAnthropic(true);
      const res = await apiRequest("POST", "/api/settings/api/test/anthropic");
      return await res.json();
    },
    onSuccess: (data) => {
      setAnthropicTestResult(data);
      toast({
        title: data.success ? "Conexão bem-sucedida" : "Falha na conexão",
        description: data.message,
        variant: data.success ? "default" : "destructive",
      });
    },
    onError: (error: Error) => {
      setAnthropicTestResult({ success: false, message: error.message });
      toast({
        title: "Erro ao testar conexão",
        description: error.message || "Não foi possível testar a conexão com a API da Anthropic.",
        variant: "destructive",
      });
    },
    onSettled: () => {
      setTestingAnthropic(false);
    }
  });

  // Enviar formulário
  const onSubmit = (data: ApiSettingsFormValues) => {
    // Se a chave estiver vazia, não enviá-la
    const payload = { ...data };
    if (!payload.openaiApiKey) delete payload.openaiApiKey;
    if (!payload.anthropicApiKey) delete payload.anthropicApiKey;
    
    updateMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-border" />
      </div>
    );
  }

  return (
    <div className="container py-6">
      <h1 className="text-3xl font-bold mb-6">Configurações de API</h1>
      
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>Configurações de Inteligência Artificial</CardTitle>
          <CardDescription>
            Configure as chaves de API para acessar os serviços de IA do OpenAI e Anthropic
          </CardDescription>
        </CardHeader>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <CardContent className="space-y-6">
              <div className="grid md:grid-cols-2 gap-6">
                {/* OpenAI Section */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">OpenAI</h3>
                    <FormField
                      control={form.control}
                      name="useOpenAI"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            {field.value ? "Ativado" : "Desativado"}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="openaiApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave da API OpenAI</FormLabel>
                        <div className="flex space-x-2">
                          <FormControl>
                            <Input
                              placeholder={settings?.hasOpenaiApiKey ? "••••••••" : "sk-..."}
                              {...field}
                              type="password"
                              disabled={!form.watch("useOpenAI")}
                            />
                          </FormControl>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline"
                            onClick={() => testOpenAIMutation.mutate()}
                            disabled={testingOpenAI || !settings?.hasOpenaiApiKey && !field.value || !form.watch("useOpenAI")}
                          >
                            {testingOpenAI ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Testar
                          </Button>
                        </div>
                        {openAITestResult && (
                          <div className="mt-2">
                            <Alert variant={openAITestResult.success ? "default" : "destructive"}>
                              <div className="flex items-center">
                                {openAITestResult.success 
                                  ? <CheckCircle className="h-4 w-4 mr-2" /> 
                                  : <AlertTriangle className="h-4 w-4 mr-2" />}
                                <AlertTitle className="text-sm">{openAITestResult.message}</AlertTitle>
                              </div>
                            </Alert>
                          </div>
                        )}
                        <FormDescription>
                          {settings?.hasOpenaiApiKey 
                            ? "A chave de API está configurada. Deixe em branco para manter a mesma chave." 
                            : "Insira sua chave da API OpenAI para usar os recursos de IA."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="openaiModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={!form.watch("useOpenAI")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="gpt-4o">GPT-4o (Recomendado)</SelectItem>
                            <SelectItem value="gpt-4-turbo">GPT-4 Turbo</SelectItem>
                            <SelectItem value="gpt-3.5-turbo">GPT-3.5 Turbo</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          O modelo GPT-4o é o mais avançado e recomendado para melhor desempenho.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                {/* Anthropic Section */}
                <div className="space-y-4 border p-4 rounded-lg">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-semibold">Anthropic Claude</h3>
                    <FormField
                      control={form.control}
                      name="useAnthropic"
                      render={({ field }) => (
                        <FormItem className="flex items-center space-x-2">
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                          <FormLabel className="cursor-pointer">
                            {field.value ? "Ativado" : "Desativado"}
                          </FormLabel>
                        </FormItem>
                      )}
                    />
                  </div>
                  
                  <FormField
                    control={form.control}
                    name="anthropicApiKey"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Chave da API Anthropic</FormLabel>
                        <div className="flex space-x-2">
                          <FormControl>
                            <Input
                              placeholder={settings?.hasAnthropicApiKey ? "••••••••" : "sk_ant-..."}
                              {...field}
                              type="password"
                              disabled={!form.watch("useAnthropic")}
                            />
                          </FormControl>
                          <Button 
                            type="button" 
                            size="sm" 
                            variant="outline"
                            onClick={() => testAnthropicMutation.mutate()}
                            disabled={testingAnthropic || !settings?.hasAnthropicApiKey && !field.value || !form.watch("useAnthropic")}
                          >
                            {testingAnthropic ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                            Testar
                          </Button>
                        </div>
                        {anthropicTestResult && (
                          <div className="mt-2">
                            <Alert variant={anthropicTestResult.success ? "default" : "destructive"}>
                              <div className="flex items-center">
                                {anthropicTestResult.success 
                                  ? <CheckCircle className="h-4 w-4 mr-2" /> 
                                  : <AlertTriangle className="h-4 w-4 mr-2" />}
                                <AlertTitle className="text-sm">{anthropicTestResult.message}</AlertTitle>
                              </div>
                            </Alert>
                          </div>
                        )}
                        <FormDescription>
                          {settings?.hasAnthropicApiKey 
                            ? "A chave de API está configurada. Deixe em branco para manter a mesma chave." 
                            : "Insira sua chave da API Anthropic para usar os recursos de IA da Claude."}
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="anthropicModel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Modelo</FormLabel>
                        <Select
                          onValueChange={field.onChange}
                          defaultValue={field.value}
                          disabled={!form.watch("useAnthropic")}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Selecione um modelo" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="claude-3-7-sonnet-20250219">Claude 3.7 Sonnet (Recomendado)</SelectItem>
                            <SelectItem value="claude-3-opus-20240229">Claude 3 Opus</SelectItem>
                            <SelectItem value="claude-3-sonnet-20240229">Claude 3 Sonnet</SelectItem>
                            <SelectItem value="claude-3-haiku-20240307">Claude 3 Haiku</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormDescription>
                          O Claude 3.7 Sonnet é o modelo mais recente e oferece melhor relação custo-benefício.
                        </FormDescription>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              </div>
              
              <Alert>
                <Key className="h-4 w-4 mr-2" />
                <AlertTitle>Segurança das chaves de API</AlertTitle>
                <AlertDescription>
                  Suas chaves de API são armazenadas de forma segura e nunca são compartilhadas. 
                  Você será cobrado diretamente pela OpenAI ou Anthropic conforme o uso dos serviços.
                </AlertDescription>
              </Alert>
            </CardContent>
            
            <CardFooter className="flex justify-end">
              <Button 
                type="submit" 
                disabled={updateMutation.isPending}
              >
                {updateMutation.isPending && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                Salvar configurações
              </Button>
            </CardFooter>
          </form>
        </Form>
      </Card>
    </div>
  );
}