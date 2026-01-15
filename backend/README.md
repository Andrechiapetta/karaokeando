# PartyKaraoke Backend

Backend em **Node.js + TypeScript** (Fastify + WebSocket) para salas de karaokê.

## Rodar (dev)

```zsh
cd partykaraoke/backend
npm install
npm run dev
```

O servidor sobe em `http://localhost:8787`.

## Health check

```zsh
curl -s http://localhost:8787/health
```

## Endpoints principais

| Método | Rota                      | Descrição                    |
| ------ | ------------------------- | ---------------------------- |
| POST   | /api/rooms                | Cria sala (retorna roomCode) |
| GET    | /api/rooms/:code/state    | Estado atual da sala         |
| POST   | /api/rooms/:code/enqueue  | Adiciona música à fila       |
| POST   | /api/rooms/:code/next     | Pula para próxima música     |
| POST   | /api/rooms/:code/finalize | Finaliza e dá pontuação      |
| WS     | /ws/:code                 | WebSocket realtime           |
