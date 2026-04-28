import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Ban, ShieldCheck, LogOut, RefreshCw, UserPlus, Loader2, ShieldAlert, Eye, EyeOff, KeyRound, Copy } from "lucide-react";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";

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
type CredRow = { user_id: string; email: string; password: string };

const formatDevice = (ua: string | null | undefined): string => {
  if (!ua) return "—";
  const s = ua;
  // Browser
  let browser = "Navegador";
  const edge = s.match(/Edg\/([\d.]+)/);
  const opera = s.match(/OPR\/([\d.]+)/);
  const chrome = s.match(/Chrome\/([\d.]+)/);
  const firefox = s.match(/Firefox\/([\d.]+)/);
  const safari = s.match(/Version\/([\d.]+).*Safari/);
  if (edge) browser = `Edge ${edge[1].split(".")[0]}`;
  else if (opera) browser = `Opera ${opera[1].split(".")[0]}`;
  else if (firefox) browser = `Firefox ${firefox[1].split(".")[0]}`;
  else if (chrome) browser = `Chrome ${chrome[1].split(".")[0]}`;
  else if (safari) browser = `Safari ${safari[1].split(".")[0]}`;
  // OS
  let os = "";
  if (/Windows NT 10/.test(s)) os = "Windows 10/11";
  else if (/Windows NT 6\.3/.test(s)) os = "Windows 8.1";
  else if (/Windows NT 6\.1/.test(s)) os = "Windows 7";
  else if (/Windows/.test(s)) os = "Windows";
  else if (/Android ([\d.]+)/.test(s)) os = `Android ${s.match(/Android ([\d.]+)/)![1]}`;
  else if (/iPhone|iPad|iOS/.test(s)) os = "iOS";
  else if (/Mac OS X ([\d_\.]+)/.test(s)) os = `macOS ${s.match(/Mac OS X ([\d_\.]+)/)![1].replace(/_/g, ".")}`;
  else if (/Linux/.test(s)) os = "Linux";
  // Tipo
  const isMobile = /Mobile|Android|iPhone|iPad/.test(s);
  const type = isMobile ? "Mobile" : "Desktop";
  return [browser, os, type].filter(Boolean).join(" · ");
};

export const SessionsPanel = () => {
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [blocks, setBlocks] = useState<Block[]>([]);
  const [roles, setRoles] = useState<RoleRow[]>([]);
  const [creds, setCreds] = useState<CredRow[]>([]);
  const [emailsMap, setEmailsMap] = useState<Record<string, string>>({});
  const [showPw, setShowPw] = useState<Record<string, boolean>>({});
  const [resetTarget, setResetTarget] = useState<{ user_id: string; email: string } | null>(null);
  const [resetPw, setResetPw] = useState("");
  const [resetting, setResetting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newName, setNewName] = useState("");
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setLoading(true);
    const [s, p, b, r, c] = await Promise.all([
      supabase.from("user_sessions").select("*").order("last_seen_at", { ascending: false }).limit(500),
      supabase.from("profiles").select("id, full_name, crm"),
      supabase.from("account_blocks").select("user_id, reason, blocked_at"),
      supabase.from("user_roles").select("user_id, role"),
      supabase.from("admin_credentials").select("user_id, email, password"),
    ]);
    setSessions((s.data as any) || []);
    setProfiles((p.data as any) || []);
    setBlocks((b.data as any) || []);
    setRoles((r.data as any) || []);
    setCreds((c.data as any) || []);
    // busca e-mails de todos usuários (fallback para contas antigas)
    try {
      const { data: em } = await supabase.functions.invoke("admin-list-emails", { body: {} });
      if (em && (em as any).emails) setEmailsMap((em as any).emails);
    } catch { /* silencioso */ }
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const profileOf = (uid: string) => profiles.find((p) => p.id === uid);
  const isBlocked = (uid: string) => blocks.some((b) => b.user_id === uid);
  const isAdminUser = (uid: string) => roles.some((r) => r.user_id === uid && r.role === "admin");
  const credOf = (uid: string) => creds.find((c) => c.user_id === uid);
  const emailOf = (uid: string) => credOf(uid)?.email || emailsMap[uid] || "";

  const copy = async (text: string, label: string) => {
    try { await navigator.clipboard.writeText(text); toast.success(`${label} copiado`); }
    catch { toast.error("Falha ao copiar"); }
  };

  const doReset = async () => {
    if (!resetTarget) return;
    if (resetPw.length < 6) return toast.error("Senha precisa de pelo menos 6 caracteres");
    setResetting(true);
    const { data, error } = await supabase.functions.invoke("admin-reset-password", {
      body: { user_id: resetTarget.user_id, new_password: resetPw },
    });
    setResetting(false);
    if (error || (data as any)?.error) {
      return toast.error((data as any)?.error || error?.message || "Falha ao redefinir");
    }
    toast.success("Senha redefinida");
    setResetTarget(null); setResetPw("");
    load();
  };

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

  const matchesSearch = (uid: string, s?: SessionRow) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    const p = profileOf(uid);
    return (
      p?.full_name?.toLowerCase().includes(q) ||
      p?.crm?.toLowerCase().includes(q) ||
      emailOf(uid).toLowerCase().includes(q) ||
      s?.ip_address?.toLowerCase().includes(q) ||
      s?.user_agent?.toLowerCase().includes(q) ||
      uid.includes(q)
    );
  };

  // Histórico = todas as sessões registradas
  const history = sessions.filter((s) => matchesSearch(s.user_id, s));

  // Ativas = 1 linha por conta cadastrada (profile), com a sessão ativa mais recente (se existir)
  const activeSessionsByUser = new Map<string, SessionRow>();
  sessions
    .filter((s) => !s.revoked_at)
    .forEach((s) => {
      const cur = activeSessionsByUser.get(s.user_id);
      if (!cur || new Date(s.last_seen_at) > new Date(cur.last_seen_at)) {
        activeSessionsByUser.set(s.user_id, s);
      }
    });

  const activeAccounts = profiles
    .filter((p) => matchesSearch(p.id, activeSessionsByUser.get(p.id)))
    .map((p) => ({ profile: p, session: activeSessionsByUser.get(p.id) || null }));

  const CredCell = ({ uid }: { uid: string }) => {
    const cred = credOf(uid);
    const email = emailOf(uid);
    const admin = isAdminUser(uid);
    const visible = !!showPw[uid];
    return (
      <div className="space-y-1 min-w-[220px]">
        <div className="flex items-center gap-1.5">
          <span className="text-xs font-mono truncate max-w-[200px]" title={email}>{email || "—"}</span>
          {email && (
            <button type="button" onClick={() => copy(email, "Login")} className="text-muted-foreground hover:text-foreground">
              <Copy className="h-3 w-3" />
            </button>
          )}
        </div>
        {admin ? (
          <span className="text-[11px] text-muted-foreground">senha protegida</span>
        ) : (
          <div className="flex items-center gap-1.5">
            {cred ? (
              <>
                <span className="text-xs font-mono tracking-tight">
                  {visible ? cred.password : "••••••••"}
                </span>
                <button type="button" onClick={() => setShowPw((s) => ({ ...s, [uid]: !s[uid] }))} className="text-muted-foreground hover:text-foreground">
                  {visible ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                </button>
                {visible && (
                  <button type="button" onClick={() => copy(cred.password, "Senha")} className="text-muted-foreground hover:text-foreground">
                    <Copy className="h-3 w-3" />
                  </button>
                )}
              </>
            ) : (
              <span className="text-[11px] text-muted-foreground italic">redefinir p/ visualizar</span>
            )}
            <button
              type="button"
              onClick={() => { setResetTarget({ user_id: uid, email }); setResetPw(""); }}
              className="text-muted-foreground hover:text-primary ml-auto"
              title="Redefinir senha"
            >
              <KeyRound className="h-3 w-3" />
            </button>
          </div>
        )}
      </div>
    );
  };

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
          <TabsTrigger value="active">Ativas ({activeAccounts.length})</TabsTrigger>
          <TabsTrigger value="blocked">Bloqueadas ({blocks.length})</TabsTrigger>
          <TabsTrigger value="history">Histórico</TabsTrigger>
          <TabsTrigger value="create">Adicionar conta</TabsTrigger>
        </TabsList>

        <TabsContent value="active" className="mt-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Usuário</TableHead>
                  <TableHead>Credenciais</TableHead>
                  <TableHead>IP</TableHead>
                  <TableHead>Dispositivo</TableHead>
                  <TableHead>Login</TableHead>
                  <TableHead>Última atividade</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {activeAccounts.map(({ profile: p, session: s }) => {
                  const online = !!s;
                  return (
                    <TableRow key={p.id}>
                      <TableCell>
                        <div className="font-medium flex items-center gap-2">
                          {p.full_name || p.id.slice(0, 8)}
                          {online ? <Badge>online</Badge> : <Badge variant="secondary">offline</Badge>}
                          {isBlocked(p.id) && <Badge variant="destructive">bloqueado</Badge>}
                          {isAdminUser(p.id) && <Badge className="bg-primary/20 text-primary border-primary/30"><ShieldAlert className="h-3 w-3 mr-1" />admin</Badge>}
                        </div>
                        <div className="text-xs text-muted-foreground">{p.crm || p.id.slice(0, 8)}</div>
                      </TableCell>
                      <TableCell><CredCell uid={p.id} /></TableCell>
                      <TableCell className="font-mono text-xs">{s?.ip_address || "—"}</TableCell>
                      <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={s?.user_agent || ""}>
                        {formatDevice(s?.user_agent)}
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s ? new Date(s.created_at).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">{s ? new Date(s.last_seen_at).toLocaleString("pt-BR") : "—"}</TableCell>
                      <TableCell className="text-right space-x-2">
                        {isAdminUser(p.id) ? (
                          <span className="text-xs text-muted-foreground">protegido</span>
                        ) : (
                          <>
                            {s && (
                              <Button variant="outline" size="sm" onClick={() => revokeSession(s.id)}>
                                <LogOut className="h-3 w-3 mr-1" />Encerrar
                              </Button>
                            )}
                            {isBlocked(p.id) ? (
                              <Button variant="outline" size="sm" onClick={() => unblockUser(p.id)}>
                                <ShieldCheck className="h-3 w-3 mr-1" />Desbloquear
                              </Button>
                            ) : (
                              <Button variant="destructive" size="sm" onClick={() => blockUser(p.id)}>
                                <Ban className="h-3 w-3 mr-1" />Bloquear conta
                              </Button>
                            )}
                          </>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
                {activeAccounts.length === 0 && (
                  <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">Nenhuma conta cadastrada</TableCell></TableRow>
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
                <TableHead>Credenciais</TableHead>
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
                    <TableCell><CredCell uid={b.user_id} /></TableCell>
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
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">Nenhuma conta bloqueada</TableCell></TableRow>
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
                    <TableCell className="max-w-xs truncate text-xs text-muted-foreground" title={s.user_agent || ""}>{formatDevice(s.user_agent)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleString("pt-BR")}</TableCell>
                    <TableCell>
                      {s.revoked_at
                        ? <Badge variant="secondary">{s.revoked_reason || "encerrada"}</Badge>
                        : <Badge>ativa</Badge>}
                    </TableCell>
                    <TableCell className="text-right">
                      {isAdminUser(s.user_id) ? (
                        <span className="text-xs text-muted-foreground">protegido</span>
                      ) : (
                        <Button variant="outline" size="sm" onClick={() => revokeAllForUser(s.user_id)}>
                          Encerrar todas
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TabsContent>

        <TabsContent value="create" className="mt-4">
          <Card className="p-6 max-w-xl">
            <div className="flex items-center gap-2 mb-4">
              <UserPlus className="h-5 w-5 text-primary" />
              <h3 className="font-display text-xl">Adicionar conta</h3>
            </div>
            <p className="text-sm text-muted-foreground mb-4">
              Crie acessos para alunos. As contas criadas aqui já entram <strong>confirmadas</strong> e
              recebem perfil <strong>básico</strong> (sem acesso ao painel admin).
            </p>
            <div className="space-y-3">
              <div>
                <Label>Nome completo (opcional)</Label>
                <Input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="João Silva" maxLength={120} />
              </div>
              <div>
                <Label>E-mail (login)</Label>
                <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} placeholder="joao12@gmail.com" maxLength={255} />
              </div>
              <div>
                <Label>Senha</Label>
                <Input type="text" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="mínimo 6 caracteres" maxLength={128} />
              </div>
              <Button onClick={createUser} disabled={creating} className="bg-gradient-primary text-primary-foreground">
                {creating ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Criando…</> : <><UserPlus className="h-4 w-4 mr-2" />Criar conta</>}
              </Button>
            </div>
          </Card>
        </TabsContent>
      </Tabs>

      <Dialog open={!!resetTarget} onOpenChange={(o) => { if (!o) { setResetTarget(null); setResetPw(""); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Redefinir senha</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="text-sm text-muted-foreground">
              Conta: <span className="font-mono">{resetTarget?.email || resetTarget?.user_id.slice(0, 8)}</span>
            </div>
            <div>
              <Label>Nova senha</Label>
              <Input type="text" value={resetPw} onChange={(e) => setResetPw(e.target.value)} placeholder="mínimo 6 caracteres" maxLength={128} autoFocus />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => { setResetTarget(null); setResetPw(""); }}>Cancelar</Button>
            <Button onClick={doReset} disabled={resetting} className="bg-gradient-primary text-primary-foreground">
              {resetting ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" />Salvando…</> : "Salvar nova senha"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
};