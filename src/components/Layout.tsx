import { NavLink, Outlet, useNavigate, useLocation } from "react-router-dom";
import { useEffect, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { Button } from "@/components/ui/button";
import { Stethoscope, BookOpen, Brain, BarChart3, Library, LogOut, Sparkles, Shield, Repeat, Menu, Users } from "lucide-react";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const navItems = [
  { to: "/app", label: "Início", icon: Stethoscope, end: true },
  { to: "/app/banco", label: "Banco de Questões", icon: Library },
  { to: "/app/simulado", label: "Simulados", icon: BookOpen },
  { to: "/app/enamed", label: "ENAMED & Residência", icon: Sparkles },
  { to: "/app/revisar", label: "Caderno de erros", icon: Repeat },
  { to: "/app/hub", label: "Hub", icon: Users },
  { to: "/app/desempenho", label: "Meu Desempenho", icon: BarChart3 },
];

const Layout = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  const location = useLocation();
  const [mobileOpen, setMobileOpen] = useState(false);
  useSessionGuard();

  // fecha o menu mobile ao navegar
  useEffect(() => { setMobileOpen(false); }, [location.pathname]);

  const NavList = ({ onNav }: { onNav?: () => void }) => (
    <nav className="flex flex-col gap-1 flex-1">
      {navItems.map((it) => (
        <NavLink key={it.to} to={it.to} end={it.end} onClick={onNav}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all ${isActive
              ? "bg-secondary text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`
          }>
          <it.icon className="h-4 w-4" />
          {it.label}
        </NavLink>
      ))}
      {isAdmin && (
        <NavLink to="/app/admin" onClick={onNav}
          className={({ isActive }) =>
            `flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-all mt-4 border-t border-border pt-4 ${isActive
              ? "bg-secondary text-foreground shadow-soft"
              : "text-muted-foreground hover:text-foreground hover:bg-secondary/50"}`
          }>
          <Shield className="h-4 w-4" />
          Admin
        </NavLink>
      )}
    </nav>
  );

  const Brand = () => (
    <div className="flex items-center gap-2">
      <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
        <Brain className="h-5 w-5 text-primary-foreground" />
      </div>
      <div>
        <div className="font-display text-lg leading-none">HealthQuest</div>
        <div className="text-xs text-muted-foreground">Medical Question Lab</div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar p-5 sticky top-0 h-screen">
        <div className="mb-10"><Brand /></div>
        <NavList />
        <div className="border-t border-border pt-4 space-y-2">
          <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>

      {/* Top bar mobile com menu hamburguer */}
      <header className="md:hidden fixed top-0 inset-x-0 z-40 flex items-center justify-between gap-3 px-4 py-3 border-b border-border bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
        <Brand />
        <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
          <SheetTrigger asChild>
            <Button variant="ghost" size="icon" aria-label="Abrir menu">
              <Menu className="h-5 w-5" />
            </Button>
          </SheetTrigger>
          <SheetContent side="left" className="w-72 p-5 bg-sidebar flex flex-col">
            <div className="mb-8 mt-2"><Brand /></div>
            <NavList onNav={() => setMobileOpen(false)} />
            <div className="border-t border-border pt-4 space-y-2">
              <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
              <Button variant="ghost" size="sm" className="w-full justify-start"
                onClick={async () => { setMobileOpen(false); await signOut(); navigate("/"); }}>
                <LogOut className="h-4 w-4 mr-2" /> Sair
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </header>

      <main className="flex-1 min-h-screen">
        {/* offset para a topbar mobile */}
        <div className="md:hidden h-14" />
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;