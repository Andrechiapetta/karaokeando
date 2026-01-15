# Karaokêando 🎤

Karaokê social em tempo real – crie salas, adicione músicas do YouTube, e dispute o ranking com seus amigos!

## Estrutura

```
karaokeando/
├── backend/    # API Node.js + TypeScript (Fastify + WebSocket)
└── frontend/   # Frontend React + Vite + TypeScript
```

## Quick Start (macOS / zsh)

### 1. Backend

```zsh
cd karaokeando/backend
npm install
npm run dev
```

O servidor sobe em `http://localhost:8787`.

### 2. Frontend (em outro terminal)

```zsh
cd karaokeando/frontend
npm install
npm run dev
```

Abre `http://localhost:3000` no navegador.

## Fluxo básico

1. **Host** acessa `/` e clica em **"Criar nova sala"** → vai para `/room/XXXXX/tv` (modo TV).
2. **Convidados** escaneiam o QR ou digitam o código da sala, entram pelo celular em `/room/XXXXX`.
3. Pelo celular:
   - Aba **"+ Música"**: colar link do YouTube para adicionar à fila.
   - Aba **"Fila"**: ver próximas músicas.
   - Aba **"Assistir"**: ver o vídeo (mudo) e clicar **"Finalizar e Pontuar"** quando a música acabar.
   - Aba **"Ranking"**: ver pontuação acumulada.
4. A TV exibe o vídeo com som e mostra a pontuação em tela cheia quando alguém finaliza.

## Features

- ✅ Salas com código de 5 caracteres
- ✅ Fila de músicas em tempo real (WebSocket)
- ✅ Player YouTube (TV com som / celular mudo)
- ✅ Botão "Finalizar e Pontuar" (cooldown de 10s anti-spam)
- ✅ Ranking acumulado por sala
- ✅ Pontuação estilo festa (biased pra notas altas 🎉)

## Requisitos

- Node.js 20+
- npm 10+
