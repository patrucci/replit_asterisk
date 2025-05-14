import { useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useAuth } from "@/hooks/use-auth";
import { useToast } from "@/hooks/use-toast";
import { MainLayout } from "@/components/layout/main-layout";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { AlertTriangle, BellRing, Key, User, Brain, ExternalLink } from "lucide-react";
import { useTheme } from "@/components/theme-provider";

// Profile form schema
const profileFormSchema = z.object({
  name: z.string().min(3, "Nome deve ter pelo menos 3 caracteres"),
  email: z.string().email("Email inválido"),
  role: z.string().optional(),
});

type ProfileFormValues = z.infer<typeof profileFormSchema>;

// Password form schema
const passwordFormSchema = z.object({
  currentPassword: z.string().min(1, "Senha atual é obrigatória"),
  newPassword: z.string().min(6, "Nova senha deve ter pelo menos 6 caracteres"),
  confirmPassword: z.string().min(6, "Confirmação de senha é obrigatória"),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: "As senhas não conferem",
  path: ["confirmPassword"],
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;

// Notification settings schema
const notificationFormSchema = z.object({
  emailNotifications: z.boolean().default(true),
  smsNotifications: z.boolean().default(true),
  appointmentReminders: z.boolean().default(true),
  paymentReminders: z.boolean().default(true),
});

type NotificationFormValues = z.infer<typeof notificationFormSchema>;

export default function SettingsPage() {
  const { user } = useAuth();
  const { toast } = useToast();
  const { theme, setTheme } = useTheme();
  const [activeTab, setActiveTab] = useState("profile");

  // Profile form
  const profileForm = useForm<ProfileFormValues>({
    resolver: zodResolver(profileFormSchema),
    defaultValues: {
      name: user?.name || "",
      email: user?.email || "",
      role: user?.role || "",
    },
  });

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  // Notification form
  const notificationForm = useForm<NotificationFormValues>({
    resolver: zodResolver(notificationFormSchema),
    defaultValues: {
      emailNotifications: true,
      smsNotifications: true,
      appointmentReminders: true,
      paymentReminders: true,
    },
  });

  // Profile update mutation
  const profileMutation = useMutation({
    mutationFn: async (data: ProfileFormValues) => {
      // This would be a real API endpoint in production
      const res = await apiRequest("PUT", `/api/user/${user?.id}`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Perfil atualizado",
        description: "Suas informações foram atualizadas com sucesso.",
      });
      queryClient.invalidateQueries({ queryKey: ["/api/user"] });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar perfil",
        description: "Não foi possível atualizar suas informações. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Password update mutation
  const passwordMutation = useMutation({
    mutationFn: async (data: PasswordFormValues) => {
      // This would be a real API endpoint in production
      const res = await apiRequest("PUT", `/api/user/${user?.id}/password`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Senha atualizada",
        description: "Sua senha foi atualizada com sucesso.",
      });
      passwordForm.reset({
        currentPassword: "",
        newPassword: "",
        confirmPassword: "",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar senha",
        description: "Não foi possível atualizar sua senha. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  // Notification settings mutation
  const notificationMutation = useMutation({
    mutationFn: async (data: NotificationFormValues) => {
      // This would be a real API endpoint in production
      const res = await apiRequest("PUT", `/api/user/${user?.id}/notifications`, data);
      return await res.json();
    },
    onSuccess: () => {
      toast({
        title: "Notificações atualizadas",
        description: "Suas preferências de notificação foram atualizadas com sucesso.",
      });
    },
    onError: () => {
      toast({
        title: "Erro ao atualizar notificações",
        description: "Não foi possível atualizar suas preferências de notificação. Tente novamente.",
        variant: "destructive",
      });
    },
  });

  const onProfileSubmit = (data: ProfileFormValues) => {
    profileMutation.mutate(data);
  };

  const onPasswordSubmit = (data: PasswordFormValues) => {
    passwordMutation.mutate(data);
  };

  const onNotificationSubmit = (data: NotificationFormValues) => {
    notificationMutation.mutate(data);
  };

  return (
    <MainLayout>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-neutral-800">Configurações</h2>
        <p className="text-sm text-neutral-500">Gerencie suas preferências e informações da conta.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <Card>
            <CardContent className="p-0">
              <div className="grid grid-cols-1 h-auto w-full">
                <Button 
                  variant={activeTab === "profile" ? "default" : "ghost"}
                  onClick={() => setActiveTab("profile")}
                  className="justify-start rounded-none text-left px-4 py-3 border-b"
                >
                  <User className="h-4 w-4 mr-2" />
                  Perfil
                </Button>
                <Button 
                  variant={activeTab === "security" ? "default" : "ghost"}
                  onClick={() => setActiveTab("security")}
                  className="justify-start rounded-none text-left px-4 py-3 border-b"
                >
                  <Key className="h-4 w-4 mr-2" />
                  Segurança
                </Button>
                <Button 
                  variant={activeTab === "notifications" ? "default" : "ghost"}
                  onClick={() => setActiveTab("notifications")}
                  className="justify-start rounded-none text-left px-4 py-3 border-b"
                >
                  <BellRing className="h-4 w-4 mr-2" />
                  Notificações
                </Button>
                <Button 
                  variant={activeTab === "theme" ? "default" : "ghost"}
                  onClick={() => setActiveTab("theme")}
                  className="justify-start rounded-none text-left px-4 py-3 border-b"
                >
                  <AlertTriangle className="h-4 w-4 mr-2" />
                  Tema
                </Button>
                <a href="/settings/api">
                  <Button 
                    variant="ghost"
                    className="justify-start rounded-none text-left px-4 py-3 w-full"
                  >
                    <Brain className="h-4 w-4 mr-2" />
                    Configuração de IA <ExternalLink className="ml-2 h-3 w-3" />
                  </Button>
                </a>
              </div>
            </CardContent>
          </Card>
          
          <Card className="mt-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm text-neutral-800">Plano</CardTitle>
            </CardHeader>
            <CardContent>
              <div>
                <p className="text-sm font-medium text-neutral-800 mb-1">Plano Pro</p>
                <div className="w-full h-2 bg-neutral-200 rounded-full">
                  <div className="h-2 bg-primary rounded-full" style={{ width: '65%' }}></div>
                </div>
                <p className="text-xs text-neutral-500 mt-1">70 de 100 clientes</p>
                <Button className="mt-4 w-full" size="sm">
                  Atualizar Plano
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Main content */}
        <div className="lg:col-span-2">
          {activeTab === "profile" && (
            <Card>
              <CardHeader>
                <CardTitle>Informações do Perfil</CardTitle>
                <CardDescription>
                  Atualize suas informações pessoais e profissionais.
                </CardDescription>
              </CardHeader>
              <Form {...profileForm}>
                <form onSubmit={profileForm.handleSubmit(onProfileSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={profileForm.control}
                      name="name"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nome Completo</FormLabel>
                          <FormControl>
                            <Input placeholder="Seu nome completo" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="email"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Email</FormLabel>
                          <FormControl>
                            <Input placeholder="seu.email@exemplo.com" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={profileForm.control}
                      name="role"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Função/Profissão</FormLabel>
                          <FormControl>
                            <Input placeholder="Ex: Advogado, Nutricionista, Consultor" {...field} />
                          </FormControl>
                          <FormDescription>
                            Sua área de atuação profissional.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={profileMutation.isPending}
                    >
                      {profileMutation.isPending ? "Salvando..." : "Salvar alterações"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
          )}

          {activeTab === "security" && (
            <Card>
              <CardHeader>
                <CardTitle>Segurança da Conta</CardTitle>
                <CardDescription>
                  Altere sua senha e gerencie as configurações de segurança.
                </CardDescription>
              </CardHeader>
              <Form {...passwordForm}>
                <form onSubmit={passwordForm.handleSubmit(onPasswordSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={passwordForm.control}
                      name="currentPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Senha Atual</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="newPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormDescription>
                            A senha deve ter pelo menos 6 caracteres.
                          </FormDescription>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={passwordForm.control}
                      name="confirmPassword"
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel>Confirmar Nova Senha</FormLabel>
                          <FormControl>
                            <Input type="password" placeholder="••••••••" {...field} />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={passwordMutation.isPending}
                    >
                      {passwordMutation.isPending ? "Alterando..." : "Alterar senha"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
          )}

          {activeTab === "notifications" && (
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Notificação</CardTitle>
                <CardDescription>
                  Escolha como e quando deseja receber notificações.
                </CardDescription>
              </CardHeader>
              <Form {...notificationForm}>
                <form onSubmit={notificationForm.handleSubmit(onNotificationSubmit)}>
                  <CardContent className="space-y-4">
                    <FormField
                      control={notificationForm.control}
                      name="emailNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Notificações por Email</FormLabel>
                            <FormDescription>
                              Receber atualizações importantes por email.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationForm.control}
                      name="smsNotifications"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Notificações por SMS</FormLabel>
                            <FormDescription>
                              Receber alertas por mensagem de texto.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationForm.control}
                      name="appointmentReminders"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Lembretes de Agendamentos</FormLabel>
                            <FormDescription>
                              Receber lembretes de compromissos agendados.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={notificationForm.control}
                      name="paymentReminders"
                      render={({ field }) => (
                        <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                          <div className="space-y-0.5">
                            <FormLabel className="text-base">Lembretes de Pagamentos</FormLabel>
                            <FormDescription>
                              Receber lembretes de pagamentos pendentes.
                            </FormDescription>
                          </div>
                          <FormControl>
                            <Switch
                              checked={field.value}
                              onCheckedChange={field.onChange}
                            />
                          </FormControl>
                        </FormItem>
                      )}
                    />
                  </CardContent>
                  <CardFooter>
                    <Button 
                      type="submit" 
                      disabled={notificationMutation.isPending}
                    >
                      {notificationMutation.isPending ? "Salvando..." : "Salvar preferências"}
                    </Button>
                  </CardFooter>
                </form>
              </Form>
            </Card>
          )}

          {activeTab === "theme" && (
            <Card>
              <CardHeader>
                <CardTitle>Preferências de Tema</CardTitle>
                <CardDescription>
                  Personalize a aparência do ProConnect CRM.
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <h3 className="text-sm font-medium">Tema</h3>
                  <div className="grid grid-cols-3 gap-2">
                    <Button
                      variant={theme === "light" ? "default" : "outline"}
                      onClick={() => setTheme("light")}
                      className="justify-start"
                    >
                      <Sun className="h-4 w-4 mr-2" />
                      Claro
                    </Button>
                    <Button
                      variant={theme === "dark" ? "default" : "outline"}
                      onClick={() => setTheme("dark")}
                      className="justify-start"
                    >
                      <Moon className="h-4 w-4 mr-2" />
                      Escuro
                    </Button>
                    <Button
                      variant={theme === "system" ? "default" : "outline"}
                      onClick={() => setTheme("system")}
                      className="justify-start"
                    >
                      <Laptop className="h-4 w-4 mr-2" />
                      Sistema
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </MainLayout>
  );
}

// Icons that couldn't be imported from lucide-react directly
function Sun(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="5" />
      <line x1="12" x2="12" y1="1" y2="3" />
      <line x1="12" x2="12" y1="21" y2="23" />
      <line x1="4.22" x2="5.64" y1="4.22" y2="5.64" />
      <line x1="18.36" x2="19.78" y1="18.36" y2="19.78" />
      <line x1="1" x2="3" y1="12" y2="12" />
      <line x1="21" x2="23" y1="12" y2="12" />
      <line x1="4.22" x2="5.64" y1="19.78" y2="18.36" />
      <line x1="18.36" x2="19.78" y1="5.64" y2="4.22" />
    </svg>
  );
}

function Moon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}

function Laptop(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M20 16V7a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9m16 0H4m16 0 1.28 2.55a1 1 0 0 1-.9 1.45H3.62a1 1 0 0 1-.9-1.45L4 16" />
    </svg>
  );
}