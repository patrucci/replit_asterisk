import { QueryClientProvider } from "@tanstack/react-query";
import { Switch, Route } from "wouter";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "./components/theme-provider";
import NotFound from "@/pages/not-found";
import { AuthProvider } from "./hooks/use-auth";
import { ProtectedRoute } from "./lib/protected-route";

// Pages
import AuthPage from "@/pages/auth-page";
import DashboardPage from "@/pages/dashboard-page";
import ClientsPage from "@/pages/clients-page";
import SchedulePage from "@/pages/schedule-page";
import PaymentsPage from "@/pages/payments-page";
import MessagesPage from "@/pages/messages-page";
import SettingsPage from "@/pages/settings-page";
import AsteriskConfigPage from "@/pages/asterisk-config-page";
import AsteriskAIPage from "@/pages/asterisk-ai-page";
import QueuesPage from "@/pages/queues-page";
import QueueDashboardPage from "@/pages/queue-dashboard-page";
import QueueRealtimePage from "@/pages/queue-realtime-page";
import QueueConfigPage from "@/pages/queue-config-page";
import SoftphonePage from "@/pages/softphone-page";

function Router() {
  return (
    <Switch>
      <Route path="/auth" component={AuthPage} />
      <ProtectedRoute path="/" component={DashboardPage} />
      <ProtectedRoute path="/clients" component={ClientsPage} />
      <ProtectedRoute path="/schedule" component={SchedulePage} />
      <ProtectedRoute path="/payments" component={PaymentsPage} />
      <ProtectedRoute path="/messages" component={MessagesPage} />
      <ProtectedRoute path="/settings" component={SettingsPage} />
      <ProtectedRoute path="/asterisk-config" component={AsteriskConfigPage} />
      <ProtectedRoute path="/asterisk-ai" component={AsteriskAIPage} />
      <ProtectedRoute path="/queues" component={QueuesPage} />
      <ProtectedRoute path="/queue-dashboard" component={QueueDashboardPage} />
      <ProtectedRoute path="/queue-realtime" component={QueueRealtimePage} />
      <ProtectedRoute path="/queue-config" component={QueueConfigPage} />
      <ProtectedRoute path="/softphone" component={SoftphonePage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThemeProvider defaultTheme="light" storageKey="proconnect-theme">
          <TooltipProvider>
            <Toaster />
            <Router />
          </TooltipProvider>
        </ThemeProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

export default App;
