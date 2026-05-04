import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MessageCircle, UserPlus, Check, X, UserMinus, Loader2 } from "lucide-react";
import { BADGE_ICONS, BADGE_COLORS } from "./badges-icons";
import { toast } from "sonner";

type Props = {
  userId: string | null;
  open: boolean;
  onOpenChange: (o: boolean) => void;
  onOpenChat: (userId: string) => void;
};

type Profile = { id: string; full_name: string | null; username: string | null; avatar_url: string | null; bio: string | null; dm_privacy: string };
type UserBadge = { id: string; name: string; description: string | null; icon: string; color: string };
type FriendStatus = "none" | "pending_out" | "pending_in" | "accepted";

export const UserProfileDialog = ({ userId, open, onOpenChange, onOpenChat }: Props) => {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [badges, setBadges] = useState<UserBadge[]>([]);
  const [friend, setFriend] = useState<{ status: FriendStatus; rowId?: string }>({ status: "none" });
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open || !userId || !user) return;
    setLoading(true);
    (async () => {
      const [{ data: p }, { data: ub }, { data: fr }] = await Promise.all([
        supabase.rpc("get_public_profile", { _user_id: userId }).maybeSingle(),
        supabase.from("user_badges").select("badge:badges(id,name,description,icon,color)").eq("user_id", userId),
        supabase.from("friendships").select("id,requester_id,addressee_id,status")
          .or(`and(requester_id.eq.${user.id},addressee_id.eq.${userId}),and(requester_id.eq.${userId},addressee_id.eq.${user.id})`)
          .maybeSingle(),
      ]);
      setProfile(p as any);
      setBadges(((ub as any[]) || []).map((r) => r.badge).filter(Boolean));
      if (!fr) setFriend({ status: "none" });
      else if (fr.status === "accepted") setFriend({ status: "accepted", rowId: fr.id });
      else if (fr.requester_id === user.id) setFriend({ status: "pending_out", rowId: fr.id });
      else setFriend({ status: "pending_in", rowId: fr.id });
      setLoading(false);
    })();
  }, [open, userId, user]);

  const sendRequest = async () => {
    if (!user || !userId) return;
    setBusy(true);
    const { error } = await supabase.from("friendships").insert({ requester_id: user.id, addressee_id: userId });
    setBusy(false);
    if (error) return toast.error(error.message);
    setFriend({ status: "pending_out" });
    toast.success("Pedido enviado");
  };
  const accept = async () => {
    if (!friend.rowId) return;
    setBusy(true);
    await supabase.from("friendships").update({ status: "accepted" }).eq("id", friend.rowId);
    setBusy(false);
    setFriend({ status: "accepted", rowId: friend.rowId });
    toast.success("Amizade aceita!");
  };
  const remove = async () => {
    if (!friend.rowId) return;
    setBusy(true);
    await supabase.from("friendships").delete().eq("id", friend.rowId);
    setBusy(false);
    setFriend({ status: "none" });
  };

  const initials = (profile?.full_name || profile?.username || "?").slice(0, 2).toUpperCase();
  const isMe = user?.id === userId;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-0 overflow-hidden bg-card border-border">
        <div className="h-20 bg-gradient-to-r from-electric/40 via-primary/30 to-electric/20" />
        <div className="px-6 pb-6 -mt-10">
          <Avatar className="h-20 w-20 ring-4 ring-card">
            <AvatarImage src={profile?.avatar_url || undefined} />
            <AvatarFallback className="bg-electric/20 text-electric font-display text-xl">{initials}</AvatarFallback>
          </Avatar>
          <DialogHeader className="mt-3">
            <DialogTitle className="text-2xl font-display">{profile?.full_name || "Sem nome"}</DialogTitle>
            {profile?.username && <div className="text-sm text-muted-foreground">@{profile.username}</div>}
          </DialogHeader>

          {profile?.bio && <p className="text-sm text-foreground/80 mt-3">{profile.bio}</p>}

          <div className="mt-4">
            <div className="text-xs uppercase text-muted-foreground tracking-wider mb-2">Conquistas</div>
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : badges.length === 0 ? (
              <div className="text-sm text-muted-foreground">Nenhuma conquista ainda.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {badges.map((b) => {
                  const Icon = BADGE_ICONS[b.icon] || BADGE_ICONS.Award;
                  return (
                    <Badge key={b.id} variant="outline" className={`gap-1 ${BADGE_COLORS[b.color] || BADGE_COLORS.electric}`} title={b.description || ""}>
                      <Icon className="h-3 w-3" /> {b.name}
                    </Badge>
                  );
                })}
              </div>
            )}
          </div>

          {!isMe && (
            <div className="mt-5 flex flex-wrap gap-2">
              <Button onClick={() => userId && onOpenChat(userId)} className="bg-electric text-electric-foreground hover:bg-electric/90 shadow-glow">
                <MessageCircle className="h-4 w-4 mr-2" /> Mensagem
              </Button>
              {friend.status === "none" && (
                <Button variant="outline" onClick={sendRequest} disabled={busy}>
                  <UserPlus className="h-4 w-4 mr-2" /> Adicionar
                </Button>
              )}
              {friend.status === "pending_out" && (
                <Button variant="outline" disabled>Pedido enviado</Button>
              )}
              {friend.status === "pending_in" && (
                <>
                  <Button onClick={accept} disabled={busy}><Check className="h-4 w-4 mr-2" />Aceitar</Button>
                  <Button variant="outline" onClick={remove} disabled={busy}><X className="h-4 w-4 mr-2" />Recusar</Button>
                </>
              )}
              {friend.status === "accepted" && (
                <Button variant="outline" onClick={remove} disabled={busy}><UserMinus className="h-4 w-4 mr-2" />Desfazer amizade</Button>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
