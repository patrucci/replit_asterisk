import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useAuth } from "@/hooks/use-auth";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { useMobile } from "@/hooks/use-mobile";
import {
  LayoutDashboard,
  Users,
  Calendar,
  CreditCard,
  MessageSquare,
  Settings,
  X,
  Menu,
  Phone,
} from "lucide-react";

interface SidebarProps {
  className?: string;
}

export function Sidebar({ className }: SidebarProps) {
  const [location] = useLocation();
  const { user, logoutMutation } = useAuth();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const isMobile = useMobile();

  // Close sidebar when navigating on mobile
  useEffect(() => {
    if (isMobile && isMobileOpen) {
      setIsMobileOpen(false);
    }
  }, [location, isMobile]);

  const navItems = [
    { path: "/", label: "Dashboard", icon: <LayoutDashboard className="h-5 w-5 mr-3" /> },
    { path: "/clients", label: "Clientes", icon: <Users className="h-5 w-5 mr-3" /> },
    { path: "/schedule", label: "Agenda", icon: <Calendar className="h-5 w-5 mr-3" /> },
    { path: "/payments", label: "Pagamentos", icon: <CreditCard className="h-5 w-5 mr-3" /> },
    { path: "/messages", label: "Mensagens", icon: <MessageSquare className="h-5 w-5 mr-3" /> },
    { path: "/asterisk-config", label: "Asterisk", icon: <Phone className="h-5 w-5 mr-3" /> },
    { path: "/settings", label: "Configurações", icon: <Settings className="h-5 w-5 mr-3" /> },
  ];

  // Generate user initials for avatar
  const userInitials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : user?.username?.substring(0, 2).toUpperCase() || "UN";

  return (
    <>
      {/* Mobile menu button */}
      <div className="lg:hidden fixed top-0 left-0 z-20 m-4">
        <Button
          variant="outline"
          size="icon"
          onClick={() => setIsMobileOpen(true)}
          className="rounded-full"
        >
          <Menu className="h-5 w-5" />
        </Button>
      </div>

      {/* Mobile backdrop */}
      {isMobileOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-30 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 w-64 bg-white shadow-lg z-40 flex flex-col transform transition-transform duration-300 ease-in-out",
          isMobile && !isMobileOpen ? "-translate-x-full" : "translate-x-0",
          "lg:translate-x-0",
          className
        )}
      >
        <div className="flex flex-col h-full">
          {/* Logo section */}
          <div className="flex items-center justify-between px-4 py-5 border-b border-neutral-200">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-md bg-primary flex items-center justify-center">
                <span className="text-white font-bold text-lg">P</span>
              </div>
              <span className="text-lg font-semibold text-neutral-800">ProConnect</span>
            </div>
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setIsMobileOpen(false)}
            >
              <X className="h-5 w-5" />
            </Button>
          </div>

          {/* User section */}
          <div className="px-4 py-3 border-b border-neutral-200">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-full bg-primary-light text-white flex items-center justify-center font-medium">
                {userInitials}
              </div>
              <div>
                <p className="text-sm font-medium">{user?.name || user?.username}</p>
                <p className="text-xs text-neutral-500">{user?.role || "Profissional"}</p>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 overflow-y-auto pt-2 pb-4">
            <ul>
              {navItems.map((item) => (
                <li key={item.path}>
                  <Button
                    variant="ghost"
                    asChild
                    className={cn(
                      "w-full justify-start px-4 py-3 text-sm font-medium rounded-r-lg transition-colors",
                      location === item.path
                        ? "bg-primary/10 text-primary border-l-4 border-primary"
                        : "text-neutral-700 hover:bg-neutral-100"
                    )}
                  >
                    <Link href={item.path}>
                      <div className="flex items-center">
                        {item.icon}
                        {item.label}
                      </div>
                    </Link>
                  </Button>
                </li>
              ))}
            </ul>
          </nav>

          {/* Bottom section */}
          <div className="p-4 border-t border-neutral-200">
            <div className="bg-primary/10 rounded-lg p-3">
              <p className="text-sm font-medium text-neutral-800 mb-1">Plano Pro</p>
              <div className="w-full h-2 bg-neutral-200 rounded-full">
                <div className="h-2 bg-primary rounded-full" style={{ width: "65%" }}></div>
              </div>
              <p className="text-xs text-neutral-500 mt-1">70 de 100 clientes</p>
              <Button
                variant="default"
                size="sm"
                className="mt-2 w-full text-xs"
                onClick={() => logoutMutation.mutate()}
              >
                {logoutMutation.isPending ? "Saindo..." : "Sair do Sistema"}
              </Button>
            </div>
          </div>
        </div>
      </aside>
    </>
  );
}
