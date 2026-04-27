import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Ban, ShieldCheck, LogOut, RefreshCw, UserPlus, Loader2, ShieldAlert } from "lucide-react";
import { Label } from "@/components/ui/label";

type SessionRow = {
  id: string;
  user_id: string;
  device_id: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
  last_seen_at: string;
  revoked_at: string | null;
  revoked_reason: string | null;
};
type Profile = { id: string; full_name: string | null; crm: string | null };
type Block = { user_id: string; reason: string | null; blocked_at: string };
type RoleRow = { user_id: string; role: string };

export const SessionsPanel = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, p, b, r] = await Promise.all([
      supabase.from("user_sessions").select("*").order("last_seen_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id, full_name, crm"),
      supabase.from("account_blocks").select("user_id, reason, blocked_at"),
      supabase.from("user_roles").select("user_id, role"),
    ]);
    setSessions((s.data as any) || []);
    setProfiles((p.data as any) || []);
    setBlocks((b.data as any) || []);
    setRoles((r.data as any) || []);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const profileOf = (uid: string) => profiles.find((p) => p.id === uid);
  const isBlocked = (uid: string) => blocks.some((b) => b.user_id === uid);
  const isAdminUser = (uid: string) => roles.some((r) => r.user_id === uid && r.role === "admin");

  const createUser = async () => {
    if (!newEmail || !newPassword) return toast.error("Preencha e-mail e senha");
    if (newPassword.length < 6) return toast.error("Senha precisa ter pelo menos 6 caracteres");
    setCreating(true);
    const { data, error } = await supabase.functions.invoke("admin-create-user", {
      body: { email: newEmail.trim().toLowerCase(), password: newPassword, full_name: newName.trim() || null },
    });
    setCreating(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Falha ao criar conta");
    }
    toast.success(`Conta criada: ${newEmail}`);
    setNewEmail(""); setNewPassword(""); setNewName("");
    load();
  };

  const revokeSession = async (id: string) => {
    const sess = sessions.find((s) => s.id === id);
    if (sess && isAdminUser(sess.user_id)) return toast.error("Sessões de admin não podem ser encerradas");
    const { error } = await supabase.from("user_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "admin_revoked" })
      .eq("id", id);
    if (error) return toast.error(error.message);
    toast.success("Sessão encerrada");
    load();
  };

  const revokeAllForUser = async (uid: string) => {
    if (isAdminUser(uid)) return toast.error("Sessões de admin não podem ser encerradas");
    const { error } = await supabase.from("user_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "admin_revoked" })
      .eq("user_id", uid).is("revoked_at", null);
    if (error) return toast.error(error.message);
    toast.success("Todas as sessões do usuário foram encerradas");
    load();
  };

  const blockUser = async (uid: string) => {
    if (isAdminUser(uid)) return toast.error("Contas de admin não podem ser bloqueadas");
    const reason = prompt("Motivo do bloqueio (opcional):") || null;
    const { data: me } = await supabase.auth.getUser();
    const { error } = await supabase.from("account_blocks").upsert({
      user_id: uid, reason, blocked_by: me.user?.id,
    });
    if (error) return toast.error(error.message);
    await supabase.from("user_sessions")
      .update({ revoked_at: new Date().toISOString(), revoked_reason: "blocked" })
      .eq("user_id", uid).is("revoked_at", null);
    toast.success("Conta bloqueada e sessões encerradas");
    load();
  };

  const unblockUser = async (uid: string) => {
    const { error } = await supabase.from("account_blocks").delete().eq("user_id", uid);
    if (error) return toast.error(error.message);
    toast.success("Conta desbloqueada");
    load();
  };

  const filtered = sessions.filter((s) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = profileOf(s.user_id);
    return (
      p?.full_name?.toLowerCase().includes(q) ||
      p?.crm?.toLowerCase().includes(q) ||
      s.ip_address?.toLowerCase().includes(q) ||
      s.user_agent?.toLowerCase().includes(q) ||
      s.user_id.includes(q)
    );
  });

  const active = filtered.filter((s) => !s.revoked_at);
  const history = filtered;

  // Agrupa contas com >1 sessão ativa (não deveria acontecer com guard, mas ajuda detectar abuso)
  const byUser = new Map<string, number>();
  active.forEach((s) => byUser.set(s.user_id, (byUser.get(s.user_id) || 0) + 1));

  return (
    <Card className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-display text-2xl">Sessões e acessos</h2>
        <div className="flex gap-2">
          <Input placeholder="Buscar nome, CRM, IP, device…" value={search} onChange={(e) => setSearch(e.target.value)} className="w-72" />
          <Button variant="outline" size="icon" onClick={load} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </div>
      </div>

      <Tabs defaultValue="active">
        <TabsList>
          <TabsTrigger value="active">Ativas ({active.length})</TabsTrigger>
          <TabsTrigger value="blocked">Bloqueadas ({blocks.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {active.map((s) => {
                  const p = profileOf(s.user_id);
                  const dup = (byUser.get(s.user_id) || 0) > 1;
                  return (
                    <TableRow key={s.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {p?.full_name || s.user_id.slice(0, 8)}
                          {dup && <Badge variant="destructive">multi-sessão</Badge>}
                          {isBlocked(s.user_id) && <Badge variant="destructive">bloqueado</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p?.crm || s.user_id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell className="font-mono text-xs">{s.ip_address || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={s.user_agent || ""}>
                        {s.user_agent || "—"}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{new Date(s.last_seen_at).toLocaleString("pt-BR")}</TableCell>
                      <TableCell className="text-right space-x-2">
                        <Button variant="outline" size="sm" onClick={() => revokeSession(s.id)}>
                          <LogOut className="h-3 w-3 mr-1" />Encerrar
                        </Button>
                        {isBlocked(s.user_id) ? (
                          <Button variant="outline" size="sm" onClick={() => unblockUser(s.user_id)}>
                            <ShieldCheck className="h-3 w-3 mr-1" />Desbloquear
                          </Button>
                        ) : (
                          <Button variant="destructive" size="sm" onClick={() => blockUser(s.user_id)}>
                            <Ban className="h-3 w-3 mr-1" />Bloquear conta
                          </Button>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {active.length === 0 && (
                  <TableRow><TableCell colSpan={6} className="text-center text-muted-foreground py-8">Nenhuma sessão ativa</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="blocked" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>Motivo</TableHead>
                <TableHead>Bloqueado em</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {blocks.map((b) => {
                const p = profileOf(b.user_id);
                return (
                  <TableRow key={b.user_id}>
                    <TableCell className="font-medium">{p?.full_name || b.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="text-muted-foreground">{b.reason || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(b.blocked_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => unblockUser(b.user_id)}>
                        <ShieldCheck className="h-3 w-3 mr-1" />Desbloquear
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {blocks.length === 0 && (
                <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground py-8">Nenhuma conta bloqueada</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="history" className="mt-4">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Usuário</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Dispositivo</TableHead>
                <TableHead>Login</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {history.slice(0, 200).map((s) => {
                const p = profileOf(s.user_id);
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{p?.full_name || s.user_id.slice(0, 8)}</TableCell>
                    <TableCell className="font-mono text-xs">{s.ip_address || "—"}</TableCell>
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={s.user_agent || ""}>{s.user_agent || "—"}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {s.revoked_at
                        ? <Badge variant="secondary">{s.revoked_reason || "encerrada"}</Badge>
                        : <Badge>ativa</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button variant="outline" size="sm" onClick={() => revokeAllForUser(s.user_id)}>
                        Encerrar todas
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>
      </Tabs>
    </Card>
  );
};