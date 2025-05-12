import { ReactNode, useState } from "react";
import { useLocation } from "wouter";
import { Sidebar } from "./sidebar";
import { Bell, Grid, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";

interface MainLayoutProps {
  children: ReactNode;
}

const pageTitle: Record<string, string> = {
  "/": "Dashboard",
  "/clients": "Clientes",
  "/schedule": "Agenda",
  "/payments": "Pagamentos",
  "/messages": "Mensagens",
  "/settings": "Configurações",
};

export function MainLayout({ children }: MainLayoutProps) {
  const [location] = useLocation();
  const { user } = useAuth();
  
  // Generate user initials for avatar
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.username?.substring(0, 2).toUpperCase() || "UN";

  const firstName = user?.name?.split(" ")[0] || user?.username || "Usuário";
  const title = pageTitle[location] || "ProConnect CRM";

  return (
    <div className="flex h-screen overflow-hidden bg-neutral-50">
      <Sidebar />
      
      {/* Main content */}
      <main className="flex-1 relative lg:ml-64 transition-all duration-300">
        {/* Top navbar */}
        <header className="bg-white shadow-sm z-10 relative">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between h-16">
              <div className="flex items-center">
                <h1 className="text-xl font-semibold text-neutral-800">{title}</h1>
              </div>
              
              <div className="flex items-center">
                <Button variant="ghost" size="icon" className="relative">
                  <Bell className="h-5 w-5 text-neutral-500" />
                  <span className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary flex items-center justify-center text-[10px] text-white">3</span>
                </Button>
                
                <Button variant="ghost" size="icon" className="ml-2">
                  <Grid className="h-5 w-5 text-neutral-500" />
                </Button>
                
                <div className="ml-3">
                  <Button variant="ghost" size="icon" className="rounded-full w-8 h-8 bg-primary-light text-white">
                    {userInitials}
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </header>
        
        {/* Page content */}
        <div className="py-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {/* Welcome section - only on dashboard */}
            {location === "/" && (
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-neutral-800">Olá, {firstName}!</h2>
                <p className="text-sm text-neutral-500">Bem-vindo de volta ao seu escritório virtual.</p>
              </div>
            )}
            
            {/* Main content */}
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
