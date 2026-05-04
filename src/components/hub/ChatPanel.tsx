import { useEffect, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Send, Loader2, ArrowLeft } from "lucide-react";
import { toast } from "sonner";

type Msg = { id: string; sender_id: string; recipient_id: string; content: string; created_at: string; read_at: string | null };
type PeerProfile = { id: string; full_name: string | null; username: string | null; avatar_url: string | null };

export const ChatPanel = ({ peerId, onBack, onOpenProfile }: { peerId: string; onBack?: () => void; onOpenProfile: (id: string) => void }) => {
  const { user } = useAuth();
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [peer, setPeer] = useState<PeerProfile | null>(null);
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    (async () => {
      const [{ data: m }, { data: p }] = await Promise.all([
        supabase.from("direct_messages").select("*")
          .or(`and(sender_id.eq.${user.id},recipient_id.eq.${peerId}),and(sender_id.eq.${peerId},recipient_id.eq.${user.id})`)
          .order("created_at", { ascending: true }).limit(200),
        supabase.rpc("get_public_profile", { _user_id: peerId }).maybeSingle(),
      ]);
      setMsgs((m as Msg[]) || []);
      setPeer(p as any);
      setLoading(false);
      // marca recebidas como lidas
      await supabase.from("direct_messages").update({ read_at: new Date().toISOString() })
        .eq("sender_id", peerId).eq("recipient_id", user.id).is("read_at", null);
    })();

    const ch = supabase.channel(`dm-${user.id}-${peerId}`)
      .on("postgres_changes", { event: "INSERT", schema: "public", table: "direct_messages" }, (payload) => {
        const r = payload.new as Msg;
        const mine = (r.sender_id === user.id && r.recipient_id === peerId) || (r.sender_id === peerId && r.recipient_id === user.id);
        if (mine) setMsgs((prev) => [...prev, r]);
      })
      .subscribe();
    return () => { supabase.removeChannel(ch); };
  }, [user, peerId]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs.length]);

  const send = async () => {
    if (!user || !text.trim()) return;
    setSending(true);
    const { error } = await supabase.from("direct_messages").insert({ sender_id: user.id, recipient_id: peerId, content: text.trim() });
    setSending(false);
    if (error) return toast.error(error.message);
    setText("");
  };

  const initials = (peer?.full_name || peer?.username || "?").slice(0, 2).toUpperCase();

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-3 p-3 border-b border-border">
        {onBack && <Button variant="ghost" size="icon" onClick={onBack}><ArrowLeft className="h-4 w-4" /></Button>}
        <button onClick={() => onOpenProfile(peerId)} className="flex items-center gap-3 hover:opacity-80 transition flex-1 text-left">
          <Avatar className="h-9 w-9">
            <AvatarImage src={peer?.avatar_url || undefined} />
            <AvatarFallback className="bg-electric/20 text-electric text-xs">{initials}</AvatarFallback>
          </Avatar>
          <div>
            <div className="font-medium text-sm">{peer?.full_name || "Carregando…"}</div>
            {peer?.username && <div className="text-xs text-muted-foreground">@{peer.username}</div>}
          </div>
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2">
        {loading ? (
          <div className="flex justify-center pt-10"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
        ) : msgs.length === 0 ? (
          <div className="text-center text-sm text-muted-foreground pt-10">Inicie a conversa 👋</div>
        ) : msgs.map((m) => {
          const mine = m.sender_id === user?.id;
          return (
            <div key={m.id} className={`flex ${mine ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[75%] rounded-2xl px-3 py-2 text-sm ${mine ? "bg-electric text-electric-foreground rounded-br-sm" : "bg-secondary text-foreground rounded-bl-sm"}`}>
                {m.content}
                <div className={`text-[10px] mt-1 opacity-70 ${mine ? "text-right" : ""}`}>
                  {new Date(m.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </div>
              </div>
            </div>
          );
        })}
        <div ref={endRef} />
      </div>

      <form onSubmit={(e) => { e.preventDefault(); send(); }} className="flex gap-2 p-3 border-t border-border">
        <Input value={text} onChange={(e) => setText(e.target.value)} placeholder="Mensagem…" maxLength={4000} />
        <Button type="submit" disabled={sending || !text.trim()} className="bg-electric text-electric-foreground hover:bg-electric/90">
          <Send className="h-4 w-4" />
        </Button>
      </form>
    </div>
  );
};
