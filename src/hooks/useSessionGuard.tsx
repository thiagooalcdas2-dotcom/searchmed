import { useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "./useAuth";
import { toast } from "sonner";

const DEVICE_KEY = "anamnesis_device_id";
const REGISTERED_KEY = "anamnesis_session_registered_for";

function getDeviceId(): string {
  let id = localStorage.getItem(DEVICE_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_KEY, id);
  }
  return id;
}

export const useSessionGuard = () => {
  const { user, signOut } = useAuth();
  const intervalRef = useRef<number | null>(null);

  useEffect(() => {
    if (!user) {
      if (intervalRef.current) window.clearInterval(intervalRef.current);
      intervalRef.current = null;
      return;
    }

    const deviceId = getDeviceId();
    let cancelled = false;

    const call = async (action: "register" | "ping") => {
      const { data, error } = await supabase.functions.invoke("session-heartbeat", {
        body: { action, device_id: deviceId },
      });
      if (cancelled) return;
      if (error) return;
      const status = (data as any)?.status;
      if (status === "revoked") {
        toast.error("Sua sessão foi encerrada (login em outro dispositivo).");
        await signOut();
      } else if (status === "blocked") {
        toast.error(`Conta bloqueada${(data as any)?.reason ? `: ${(data as any).reason}` : ""}`);
        await signOut();
      }
    };

    // Registra apenas uma vez por user nesta aba
    const registeredFor = sessionStorage.getItem(REGISTERED_KEY);
    if (registeredFor !== user.id) {
      sessionStorage.setItem(REGISTERED_KEY, user.id);
      call("register");
    } else {
      call("ping");
    }

    intervalRef.current = window.setInterval(() => call("ping"), 30000);
    return () => {
      cancelled = true;
      if (intervalRef.current) window.clearInterval(intervalRef.current);
    };
  }, [user, signOut]);
};