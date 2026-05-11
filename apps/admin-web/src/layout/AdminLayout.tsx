import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth0 } from "@auth0/auth0-react";
import { useState } from "react";
import {
  LayoutDashboard,
  Users,
  Package,
  Menu as MenuIcon,
  Moon,
  Sun,
  LogOut,
  ShieldCheck,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { usePermissions } from "@/auth/usePermissions";

interface NavItem {
  to: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: boolean;
}

export function AdminLayout() {
  const { user, logout } = useAuth0();
  const { canReadCustomers, canReadProducts, role } = usePermissions();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [dark, setDark] = useState(() =>
    typeof document !== "undefined"
      ? document.documentElement.classList.contains("dark")
      : false,
  );
  const navigate = useNavigate();

  const toggleDark = () => {
    const next = !dark;
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
    setDark(next);
  };

  // Filtragem da navegação por permissão (estratégia menu-level)
  const items: NavItem[] = [
    { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: true },
    { to: "/customers", label: "Customers", icon: Users,           show: canReadCustomers },
    { to: "/products",  label: "Products",  icon: Package,         show: canReadProducts  },
  ];

  const sidebar = (
    <aside
      className={cn(
        "flex h-full w-64 flex-col border-r bg-card",
        "md:translate-x-0",
      )}
    >
      <div className="flex h-16 items-center gap-2 border-b px-6">
        <ShieldCheck className="h-6 w-6 text-primary" />
        <span className="text-lg font-semibold">Auth0 Admin</span>
      </div>

      <nav className="flex-1 space-y-1 p-3">
        {items.filter((i) => i.show).map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={() => setMobileOpen(false)}
            className={({ isActive }) =>
              cn(
                "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "text-muted-foreground hover:bg-accent hover:text-accent-foreground",
              )
            }
          >
            <item.icon className="h-4 w-4" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="border-t p-3 text-xs text-muted-foreground">
        <div className="flex items-center justify-between">
          <span>Role:</span>
          <Badge variant={role === "admin" ? "default" : "secondary"}>
            {role}
          </Badge>
        </div>
      </div>
    </aside>
  );

  return (
    <div className="flex min-h-screen flex-col bg-background">
      {/* ─── Top bar ─── */}
      <header className="sticky top-0 z-40 flex h-16 items-center gap-4 border-b bg-background px-4 md:px-6">
        <Button
          variant="ghost"
          size="icon"
          className="md:hidden"
          onClick={() => setMobileOpen((v) => !v)}
          aria-label="Toggle menu"
        >
          <MenuIcon className="h-5 w-5" />
        </Button>

        <Link to="/dashboard" className="flex items-center gap-2 md:hidden">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <span className="font-semibold">Auth0 Admin</span>
        </Link>

        <div className="ml-auto flex items-center gap-2">
          <Button variant="ghost" size="icon" onClick={toggleDark} aria-label="Toggle theme">
            {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                  {user?.email?.[0]?.toUpperCase() ?? "?"}
                </div>
                <span className="hidden text-sm md:inline">{user?.email}</span>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel>
                <div className="flex flex-col">
                  <span className="font-semibold">{user?.name}</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {user?.email}
                  </span>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => navigate("/dashboard")}
                className="cursor-pointer"
              >
                <LayoutDashboard /> Dashboard
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() =>
                  logout({ logoutParams: { returnTo: window.location.origin } })
                }
                className="cursor-pointer text-destructive focus:text-destructive"
              >
                <LogOut /> Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      {/* ─── Body: sidebar + content ─── */}
      <div className="flex flex-1">
        {/* Sidebar desktop */}
        <div className="hidden md:flex">{sidebar}</div>

        {/* Sidebar mobile (drawer simples sem dependência extra) */}
        {mobileOpen && (
          <div className="fixed inset-0 z-50 md:hidden">
            <div
              className="absolute inset-0 bg-black/60"
              onClick={() => setMobileOpen(false)}
              aria-hidden
            />
            <div className="absolute left-0 top-0 h-full w-64 animate-in slide-in-from-left">
              {sidebar}
            </div>
          </div>
        )}

        {/* Conteúdo */}
        <main className="flex-1 overflow-y-auto p-4 md:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
