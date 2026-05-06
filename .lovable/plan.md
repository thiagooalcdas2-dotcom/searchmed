# Assistente IA flutuante (MedQuest AI)

Adicionar um chat de IA conversacional acessível de qualquer página autenticada, em formato de bolinha flutuante no canto inferior direito, com a logo do MedQuest como avatar.

## Comportamento

- **Bolinha flutuante** fixa no canto inferior direito (`bottom-6 right-6`), exibindo a logo do MedQuest dentro de um botão circular com sombra/glow electric.
- **Clique na bolinha** abre um painel de chat (≈380px largura × 560px altura) ancorado no canto inferior direito.
- **Setinha (chevron)** no header do painel minimiza de volta para a bolinha. Botão "X" também disponível para fechar.
- Estado (aberto/minimizado) persiste em `localStorage` para não reabrir sozinho a cada navegação.
- **Disponível em todas as rotas `/app/*`** (montado dentro de `Layout.tsx`), exceto `/auth` e landing.
- Não fica na frente de modais críticos: usar `z-40` (modais shadcn usam `z-50`).

## Funcionalidade da IA

- Conversa **livre e ilimitada de tópico** — responde qualquer pergunta (curso, dúvidas gerais, vida, etc.).
- System prompt curto: "Você é o assistente do MedQuest, plataforma de questões médicas. Ajude o usuário com dúvidas sobre a plataforma (Banco de questões, Simulado, Enamed, Desempenho, Revisar, Hub social, Ranking, Badges) e também responda livremente qualquer outra pergunta. Responda em português, de forma clara e amigável. Use markdown quando útil."
- **Streaming token-a-token** via SSE para resposta fluida.
- Histórico da conversa mantido em memória do componente + localStorage (últimas ~30 mensagens) para contexto contínuo na sessão.
- Botão "Limpar conversa" no header.
- Renderização com `react-markdown` (já ausente — adicionar dependência).

## Arquitetura técnica

### Backend — nova edge function `medquest-chat`
- `supabase/functions/medquest-chat/index.ts` com CORS + streaming SSE.
- Modelo: `google/gemini-3-flash-preview` (default, rápido e barato).
- Recebe `{ messages: [{role, content}] }`, injeta system prompt no servidor.
- Trata 429 (rate limit) e 402 (créditos) devolvendo JSON de erro.
- Configurar `verify_jwt = false` em `supabase/config.toml` (chat assistente público para usuários logados na app).

### Frontend
- `src/components/ai/MedQuestAssistant.tsx` — componente único contendo:
  - Botão flutuante (FAB) com a logo.
  - Painel expansível (animação slide+fade com Tailwind).
  - Lista de mensagens com auto-scroll, bubbles estilo chat (user à direita electric, assistant à esquerda secondary).
  - Input + botão enviar; Enter envia, Shift+Enter quebra linha.
  - Indicador "digitando…" enquanto stream não começa.
  - Parser SSE linha-a-linha (depth-tracking não necessário, é OpenAI-compat).
- `src/assets/medquest-logo.png` — copiar a logo enviada (`user-uploads://image-3.png`) para usar no FAB e como avatar do assistente.
- Montar `<MedQuestAssistant />` em `src/components/Layout.tsx` ao final do JSX (fora do `<Outlet/>`), para aparecer em toda a área autenticada.

### Dependências
- `bun add react-markdown` (renderização markdown das respostas).

## Estrutura visual

```text
┌─────────────────────────────┐
│ [logo] MedQuest AI    ⌄  ✕  │  ← header (chevron minimiza)
├─────────────────────────────┤
│  ai: Olá! Como posso ajudar?│
│                user: ...    │
│  ai: ...                    │
│                             │
├─────────────────────────────┤
│ [ Pergunte algo…    ] [➤]   │
└─────────────────────────────┘
                          ⊙ ← FAB minimizado (logo)
```

## Arquivos
- **Criar**: `supabase/functions/medquest-chat/index.ts`, `src/components/ai/MedQuestAssistant.tsx`, `src/assets/medquest-logo.png`
- **Editar**: `src/components/Layout.tsx`, `supabase/config.toml`, `package.json` (via bun add)