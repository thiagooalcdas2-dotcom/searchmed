import { useEffect, useRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import { ChevronDown, X, Send, Loader2, Trash2, Settings, Upload, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "sonner";
import logo from "@/assets/medquest-logo.png";

type Msg = { role: "user" | "assistant"; content: string };

const STORAGE_KEY = "medquest-assistant-msgs";
const OPEN_KEY = "medquest-assistant-open";
const LOGO_KEY = "medquest-assistant-logo";
const LOGO_CFG_KEY = "medquest-assistant-logo-cfg";
const CHAT_URL = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/medquest-chat`;

const WELCOME: Msg = {
  role: "assistant",
  content: "Olá! 👋 Sou o assistente do **MedQuest**. Posso explicar como usar a plataforma (Banco, Simulados, Hub, Ranking…) ou responder qualquer outra dúvida que você tiver. O que posso ajudar?",
};

type LogoCfg = { scale: number; x: number; y: number };
const DEFAULT_CFG: LogoCfg = { scale: 100, x: 0, y: 0 };

export const MedQuestAssistant = () => {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Msg[]>([WELCOME]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [customLogo, setCustomLogo] = useState<string | null>(null);
  const [logoCfg, setLogoCfg] = useState<LogoCfg>(DEFAULT_CFG);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as Msg[];
        if (Array.isArray(parsed) && parsed.length > 0) setMessages(parsed);
      }
      setOpen(localStorage.getItem(OPEN_KEY) === "1");
      const savedLogo = localStorage.getItem(LOGO_KEY);
      if (savedLogo) setCustomLogo(savedLogo);
      const savedCfg = localStorage.getItem(LOGO_CFG_KEY);
      if (savedCfg) setLogoCfg({ ...DEFAULT_CFG, ...JSON.parse(savedCfg) });
    } catch {}
  }, []);

  useEffect(() => {
    try { localStorage.setItem(LOGO_CFG_KEY, JSON.stringify(logoCfg)); } catch {}
  }, [logoCfg]);

  const onUpload = (file: File) => {
    if (!file.type.startsWith("image/")) { toast.error("Selecione uma imagem."); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error("Imagem muito grande (máx 2MB)."); return; }
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || "");
      setCustomLogo(dataUrl);
      try { localStorage.setItem(LOGO_KEY, dataUrl); } catch { toast.error("Não foi possível salvar a imagem."); }
    };
    reader.readAsDataURL(file);
  };

  const resetLogo = () => {
    setCustomLogo(null);
    setLogoCfg(DEFAULT_CFG);
    try { localStorage.removeItem(LOGO_KEY); } catch {}
  };

  const logoSrc = customLogo || logo;
  const logoStyle: React.CSSProperties = {
    transform: `translate(${logoCfg.x}%, ${logoCfg.y}%) scale(${logoCfg.scale / 100})`,
    transformOrigin: "center",
  };

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(messages.slice(-30))); } catch {}
  }, [messages]);

  useEffect(() => {
    try { localStorage.setItem(OPEN_KEY, open ? "1" : "0"); } catch {}
  }, [open]);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [messages, loading, open]);

  const clearChat = () => {
    setMessages([WELCOME]);
  };

  const send = async () => {
    const text = input.trim();
    if (!text || loading) return;
    const userMsg: Msg = { role: "user", content: text };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput("");
    setLoading(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch(CHAT_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({ messages: next.map(({ role, content }) => ({ role, content })) }),
        signal: controller.signal,
      });

      if (resp.status === 429) { toast.error("Muitas requisições. Aguarde um instante."); setLoading(false); return; }
      if (resp.status === 402) { toast.error("Créditos de IA esgotados."); setLoading(false); return; }
      if (!resp.ok || !resp.body) { toast.error("Erro ao falar com a IA."); setLoading(false); return; }

      // append empty assistant message we'll fill incrementally
      setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

      const reader = resp.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let done = false;
      let acc = "";

      while (!done) {
        const { value, done: d } = await reader.read();
        if (d) break;
        buffer += decoder.decode(value, { stream: true });
        let nl: number;
        while ((nl = buffer.indexOf("\n")) !== -1) {
          let line = buffer.slice(0, nl);
          buffer = buffer.slice(nl + 1);
          if (line.endsWith("\r")) line = line.slice(0, -1);
          if (!line || line.startsWith(":")) continue;
          if (!line.startsWith("data: ")) continue;
          const json = line.slice(6).trim();
          if (json === "[DONE]") { done = true; break; }
          try {
            const parsed = JSON.parse(json);
            const delta = parsed.choices?.[0]?.delta?.content;
            if (delta) {
              acc += delta;
              setMessages((prev) => {
                const copy = [...prev];
                const last = copy[copy.length - 1];
                if (last?.role === "assistant") copy[copy.length - 1] = { ...last, content: acc };
                return copy;
              });
            }
          } catch {
            buffer = line + "\n" + buffer;
            break;
          }
        }
      }
    } catch (e: any) {
      if (e?.name !== "AbortError") toast.error("Erro de conexão com a IA.");
    } finally {
      setLoading(false);
      abortRef.current = null;
    }
  };

  const onKey = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  };

  return (
    <>
      {/* Floating button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Abrir assistente MedQuest"
          className="fixed bottom-6 right-6 z-40 h-14 w-14 rounded-full bg-electric/10 border border-electric/40 shadow-glow hover:scale-105 transition-transform overflow-hidden flex items-center justify-center backdrop-blur"
        >
          <img src={logo} alt="MedQuest AI" className="h-12 w-12 object-contain" />
          <span className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-electric animate-pulse" />
        </button>
      )}

      {/* Panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-40 w-[min(380px,calc(100vw-2rem))] h-[min(560px,calc(100vh-3rem))] flex flex-col rounded-2xl border border-border bg-card shadow-2xl overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-200">
          <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border bg-secondary/40">
            <img src={logo} alt="" className="h-8 w-8 rounded-lg object-contain" />
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold leading-tight">MedQuest AI</div>
              <div className="text-[11px] text-muted-foreground">Sempre online</div>
            </div>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={clearChat} title="Limpar conversa">
              <Trash2 className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => setOpen(false)} title="Minimizar">
              <ChevronDown className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => { setOpen(false); }} title="Fechar">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-background">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm ${m.role === "user"
                  ? "bg-electric text-electric-foreground rounded-br-sm"
                  : "bg-secondary text-foreground rounded-bl-sm"}`}>
                  {m.role === "assistant" ? (
                    <div className="prose prose-sm prose-invert max-w-none [&_p]:my-1 [&_ul]:my-1 [&_ol]:my-1 [&_code]:text-xs">
                      <ReactMarkdown>{m.content || "…"}</ReactMarkdown>
                    </div>
                  ) : (
                    <div className="whitespace-pre-wrap">{m.content}</div>
                  )}
                </div>
              </div>
            ))}
            {loading && messages[messages.length - 1]?.role === "user" && (
              <div className="flex justify-start">
                <div className="bg-secondary rounded-2xl rounded-bl-sm px-3 py-2 text-sm">
                  <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                </div>
              </div>
            )}
            <div ref={endRef} />
          </div>

          <form onSubmit={(e) => { e.preventDefault(); send(); }} className="p-2 border-t border-border bg-card flex items-end gap-2">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={onKey}
              placeholder="Pergunte qualquer coisa…"
              rows={1}
              className="min-h-[40px] max-h-32 resize-none text-sm"
            />
            <Button type="submit" size="icon" disabled={loading || !input.trim()} className="bg-electric text-electric-foreground hover:bg-electric/90 shrink-0">
              <Send className="h-4 w-4" />
            </Button>
          </form>
        </div>
      )}
    </>
  );
};

export default MedQuestAssistant;