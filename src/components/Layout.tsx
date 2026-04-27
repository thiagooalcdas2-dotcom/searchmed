import { NavLink, Outlet, useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useIsAdmin } from "@/hooks/useRole";
import { useSessionGuard } from "@/hooks/useSessionGuard";
import { Button } from "@/components/ui/button";
import { Stethoscope, BookOpen, Brain, BarChart3, Library, LogOut, Sparkles, Shield, Repeat } from "lucide-react";

const navItems = [
  { to: "/app", label: "Início", icon: Stethoscope, end: true },
  { to: "/app/banco", label: "Banco de Questões", icon: Library },
  { to: "/app/simulado", label: "Simulados", icon: BookOpen },
  { to: "/app/enamed", label: "ENAMED & Residência", icon: Sparkles },
  { to: "/app/revisar", label: "Caderno de erros", icon: Repeat },
  { to: "/app/desempenho", label: "Meu Desempenho", icon: BarChart3 },
];

const Layout = () => {
  const { user, signOut } = useAuth();
  const { isAdmin } = useIsAdmin();
  const navigate = useNavigate();
  useSessionGuard();

  return (
    <div className="min-h-screen flex">
      <aside className="hidden md:flex w-64 flex-col border-r border-border bg-sidebar p-5 sticky top-0 h-screen">
        <div className="flex items-center gap-2 mb-10">
          <div className="h-9 w-9 rounded-lg bg-gradient-primary flex items-center justify-center shadow-glow">
            <Brain className="h-5 w-5 text-primary-foreground" />
          </div>
          <div>
            <div className="font-display text-lg leading-none">Anamnesis</div>
            <div className="text-xs text-muted-foreground">Medical Question Lab</div>
          </div>
        </div>
        <nav className="flex flex-col gap-1 flex-1">
          {navItems.map((it) => (
            <NavLink key={it.to} to={it.to} end={it.end}
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
            <NavLink to="/app/admin"
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
        <div className="border-t border-border pt-4 space-y-2">
          <div className="text-xs text-muted-foreground truncate px-1">{user?.email}</div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={async () => { await signOut(); navigate("/"); }}>
            <LogOut className="h-4 w-4 mr-2" /> Sair
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-h-screen">
        <Outlet />
      </main>
    </div>
  );
};

export default Layout;