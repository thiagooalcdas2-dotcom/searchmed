import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Search, Users, MessageSquare, UserCheck, Settings, ArrowLeft } from "lucide-react";
import { UserProfileDialog } from "@/components/hub/UserProfileDialog";
import { ChatPanel } from "@/components/hub/ChatPanel";
import { toast } from "sonner";

type PublicUser = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };
type FriendRow = { id: string; requester_id: string; addressee_id: string; status: string };
type Conv = { peer: PublicUser; lastAt: string; unread: number; preview: string };

const Hub = () => {
  const { user } = useAuth();
  const [tab, setTab] = useState("conversas");
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [q, setQ] = useState("");
  const [friends, setFriends] = useState<{ accepted: FriendRow[]; incoming: FriendRow[]; outgoing: FriendRow[] }>({ accepted: [], incoming: [], outgoing: [] });
  const [profileMap, setProfileMap] = useState<Record<string, PublicUser>>({});
  const [convs, setConvs] = useState<Conv[]>([]);
  const [openProfile, setOpenProfile] = useState<string | null>(null);
  const [chatPeer, setChatPeer] = useState<string | null>(null);
  const [dmPrivacy, setDmPrivacy] = useState<"all" | "friends">("all");

  const reloadFriends = async () => {
    if (!user) return;
    const { data } = await supabase.from("friendships").select("*")
      .or(`requester_id.eq.${user.id},addressee_id.eq.${user.id}`);
    const rows = (data as FriendRow[]) || [];
    const accepted = rows.filter((r) => r.status === "accepted");
    const incoming = rows.filter((r) => r.status === "pending" && r.addressee_id === user.id);
    const outgoing = rows.filter((r) => r.status === "pending" && r.requester_id === user.id);
    setFriends({ accepted, incoming, outgoing });

    const ids = Array.from(new Set(rows.flatMap((r) => [r.requester_id, r.addressee_id]).filter((x) => x !== user.id)));
    if (ids.length) {
      const profs = await Promise.all(ids.map((id) => supabase.rpc("get_public_profile", { _user_id: id }).maybeSingle()));
      const map: Record<string, PublicUser> = {};
      profs.forEach((r) => { const p: any = r.data; if (p) map[p.id] = p; });
      setProfileMap((prev) => ({ ...prev, ...map }));
    }
  };

  const reloadConvs = async () => {
    if (!user) return;
    const { data } = await supabase.from("direct_messages").select("*")
      .or(`sender_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order("created_at", { ascending: false }).limit(200);
    const map = new Map<string, Conv>();
    const ids = new Set<string>();
    for (const m of (data as any[]) || []) {
      const peerId = m.sender_id === user.id ? m.recipient_id : m.sender_id;
      ids.add(peerId);
      if (!map.has(peerId)) {
        map.set(peerId, { peer: { id: peerId, full_name: null, username: null, avatar_url: null }, lastAt: m.created_at, preview: m.content, unread: 0 });
      }
      const c = map.get(peerId)!;
      if (m.recipient_id === user.id && !m.read_at) c.unread += 1;
    }
    if (ids.size) {
      const profs = await Promise.all(Array.from(ids).map((id) => supabase.rpc("get_public_profile", { _user_id: id }).maybeSingle()));
      profs.forEach((r) => { const p: any = r.data; if (p && map.has(p.id)) map.get(p.id)!.peer = p; });
    }
    setConvs(Array.from(map.values()).sort((a, b) => b.lastAt.localeCompare(a.lastAt)));
  };

  useEffect(() => {
    if (!user) return;
    reloadFriends();
    reloadConvs();
    supabase.from("profiles").select("dm_privacy").eq("id", user.id).maybeSingle().then(({ data }) => {
      if (data?.dm_privacy === "friends" || data?.dm_privacy === "all") setDmPrivacy(data.dm_privacy as any);
    });
    supabase.rpc("recompute_user_badges", { _user_id: user.id });

    const ch = supabase.channel(`hub-${user.id}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "friendships" }, () => reloadFriends())
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, () => reloadConvs())
      .subscribe();
    return () => { supabase.removeChannel(ch); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    const t = setTimeout(async () => {
      const { data } = await supabase.rpc("search_public_users", { _q: q, _limit: 50 });
      setUsers((data as PublicUser[]) || []);
    }, 200);
    return () => clearTimeout(t);
  }, [q]);

  const updatePrivacy = async (val: "all" | "friends") => {
    setDmPrivacy(val);
    if (!user) return;
    await supabase.from("profiles").update({ dm_privacy: val }).eq("id", user.id);
    toast.success("Preferência salva");
  };

  const openChat = (id: string) => { setChatPeer(id); setTab("conversas"); };

  const initials = (u: PublicUser) => (u.full_name || u.username || "?").slice(0, 2).toUpperCase();

  const friendIds = useMemo(() => new Set(friends.accepted.map((f) => (f.requester_id === user?.id ? f.addressee_id : f.requester_id))), [friends.accepted, user]);

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <header className="mb-6">
        <h1 className="font-display text-3xl">Hub</h1>
        <p className="text-muted-foreground text-sm">Converse, conecte-se e veja conquistas dos colegas.</p>
      </header>

      <div className="grid lg:grid-cols-[360px_1fr] gap-4">
        <Card className="bg-card border-border overflow-hidden">
          <Tabs value={tab} onValueChange={setTab} className="w-full">
            <TabsList className="grid grid-cols-4 w-full rounded-none bg-secondary/40">
              <TabsTrigger value="conversas"><MessageSquare className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="amigos"><UserCheck className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="descobrir"><Users className="h-4 w-4" /></TabsTrigger>
              <TabsTrigger value="config"><Settings className="h-4 w-4" /></TabsTrigger>
            </TabsList>

            <TabsContent value="conversas" className="m-0 max-h-[70vh] overflow-y-auto">
              {convs.length === 0 ? (
                <div className="p-6 text-sm text-muted-foreground text-center">Nenhuma conversa ainda. Vá em "Descobrir" para iniciar uma.</div>
              ) : convs.map((c) => (
                <button key={c.peer.id} onClick={() => setChatPeer(c.peer.id)}
                  className={`w-full text-left flex items-center gap-3 p-3 hover:bg-secondary/40 border-b border-border ${chatPeer === c.peer.id ? "bg-secondary/60" : ""}`}>
                  <Avatar className="h-10 w-10"><AvatarImage src={c.peer.avatar_url || undefined} /><AvatarFallback className="bg-electric/20 text-electric text-xs">{initials(c.peer)}</AvatarFallback></Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-medium truncate">{c.peer.full_name || "Usuário"}</div>
                      {c.unread > 0 && <span className="text-[10px] bg-electric text-electric-foreground rounded-full px-1.5 py-0.5">{c.unread}</span>}
                    </div>
                    <div className="text-xs text-muted-foreground truncate">{c.preview}</div>
                  </div>
                </button>
              ))}
            </TabsContent>

            <TabsContent value="amigos" className="m-0 p-3 space-y-4 max-h-[70vh] overflow-y-auto">
              {friends.incoming.length > 0 && (
                <section>
                  <div className="text-xs uppercase text-muted-foreground mb-2">Pedidos recebidos</div>
                  <div className="space-y-2">
                    {friends.incoming.map((f) => {
                      const p = profileMap[f.requester_id];
                      if (!p) return null;
                      return (
                        <div key={f.id} className="flex items-center gap-3">
                          <button onClick={() => setOpenProfile(p.id)} className="flex items-center gap-3 flex-1 text-left">
                            <Avatar className="h-9 w-9"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback className="bg-electric/20 text-electric text-xs">{initials(p)}</AvatarFallback></Avatar>
                            <div className="text-sm">{p.full_name}</div>
                          </button>
                          <Button size="sm" onClick={async () => { await supabase.from("friendships").update({ status: "accepted" }).eq("id", f.id); reloadFriends(); }}>Aceitar</Button>
                          <Button size="sm" variant="outline" onClick={async () => { await supabase.from("friendships").delete().eq("id", f.id); reloadFriends(); }}>Recusar</Button>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
              <section>
                <div className="text-xs uppercase text-muted-foreground mb-2">Amigos ({friends.accepted.length})</div>
                {friends.accepted.length === 0 ? <div className="text-sm text-muted-foreground">Você ainda não tem amigos.</div> :
                  <div className="space-y-1">
                    {friends.accepted.map((f) => {
                      const peerId = f.requester_id === user?.id ? f.addressee_id : f.requester_id;
                      const p = profileMap[peerId]; if (!p) return null;
                      return (
                        <div key={f.id} className="flex items-center gap-2">
                          <button onClick={() => setOpenProfile(p.id)} className="flex items-center gap-3 flex-1 text-left p-1 rounded hover:bg-secondary/40">
                            <Avatar className="h-8 w-8"><AvatarImage src={p.avatar_url || undefined} /><AvatarFallback className="bg-electric/20 text-electric text-xs">{initials(p)}</AvatarFallback></Avatar>
                            <div className="text-sm">{p.full_name}</div>
                          </button>
                          <Button size="sm" variant="ghost" onClick={() => setChatPeer(p.id)}><MessageSquare className="h-4 w-4" /></Button>
                        </div>
                      );
                    })}
                  </div>}
              </section>
              {friends.outgoing.length > 0 && (
                <section>
                  <div className="text-xs uppercase text-muted-foreground mb-2">Pedidos enviados</div>
                  <div className="space-y-1">
                    {friends.outgoing.map((f) => {
                      const p = profileMap[f.addressee_id]; if (!p) return null;
                      return <div key={f.id} className="flex items-center gap-3 text-sm text-muted-foreground"><Avatar className="h-7 w-7"><AvatarFallback className="text-xs">{initials(p)}</AvatarFallback></Avatar>{p.full_name} · pendente</div>;
                    })}
                  </div>
                </section>
              )}
            </TabsContent>

            <TabsContent value="descobrir" className="m-0 p-3 space-y-3 max-h-[70vh] overflow-y-auto">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar usuários…" className="pl-9" />
              </div>
              {users.map((u) => (
                <div key={u.id} className="flex items-center gap-3 p-2 rounded hover:bg-secondary/40">
                  <button onClick={() => setOpenProfile(u.id)} className="flex items-center gap-3 flex-1 text-left">
                    <Avatar className="h-9 w-9"><AvatarImage src={u.avatar_url || undefined} /><AvatarFallback className="bg-electric/20 text-electric text-xs">{initials(u)}</AvatarFallback></Avatar>
                    <div>
                      <div className="text-sm font-medium">{u.full_name || "—"}</div>
                      {u.username && <div className="text-xs text-muted-foreground">@{u.username}</div>}
                    </div>
                  </button>
                  {friendIds.has(u.id) && <span className="text-[10px] text-electric border border-electric/30 rounded-full px-2 py-0.5">amigo</span>}
                </div>
              ))}
              {users.length === 0 && <div className="text-sm text-muted-foreground text-center py-6">Nenhum usuário encontrado.</div>}
            </TabsContent>

            <TabsContent value="config" className="m-0 p-4 space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-sm">Receber DMs apenas de amigos</Label>
                  <p className="text-xs text-muted-foreground">Bloqueia mensagens de quem não está na sua lista.</p>
                </div>
                <Switch checked={dmPrivacy === "friends"} onCheckedChange={(v) => updatePrivacy(v ? "friends" : "all")} />
              </div>
            </TabsContent>
          </Tabs>
        </Card>

        <Card className="bg-card border-border min-h-[70vh] flex flex-col overflow-hidden">
          {chatPeer ? (
            <ChatPanel peerId={chatPeer} onBack={() => setChatPeer(null)} onOpenProfile={(id) => setOpenProfile(id)} />
          ) : (
            <div className="flex-1 flex items-center justify-center text-center p-10">
              <div>
                <div className="mx-auto h-16 w-16 rounded-2xl bg-electric/15 text-electric flex items-center justify-center shadow-electric mb-4"><MessageSquare className="h-8 w-8" /></div>
                <h2 className="font-display text-xl mb-1">Selecione uma conversa</h2>
                <p className="text-sm text-muted-foreground">Ou descubra novos colegas para iniciar um papo.</p>
              </div>
            </div>
          )}
        </Card>
      </div>

      <UserProfileDialog userId={openProfile} open={!!openProfile} onOpenChange={(o) => !o && setOpenProfile(null)} onOpenChat={(id) => { setOpenProfile(null); setChatPeer(id); }} />
    </div>
  );
};

export default Hub;
