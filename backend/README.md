# Karaokêando Backend 🎤

Backend **Node.js + TypeScript** (Fastify + WebSocket) para o sistema de karaokê social.

## 🚀 Rodar (desenvolvimento)

```bash
cd karaokeando/backend
npm install
npm run dev
```

Servidor disponível em `http://localhost:8787`

## 📁 Estrutura

```
backend/
├── src/
│   ├── server.ts      # Servidor Fastify + WebSocket + Rotas
│   └── analytics.ts   # Sistema de tracking de eventos
│
├── data/              # Dados persistidos (JSON)
│   ├── song-library.json   # Biblioteca de músicas
│   └── analytics.json      # Eventos de analytics
│
└── app/               # (Reservado para módulos futuros)
```

## 🔌 API Endpoints

### Salas

| Método | Rota                            | Descrição              |
| ------ | ------------------------------- | ---------------------- |
| POST   | `/api/rooms`                    | Criar nova sala        |
| GET    | `/api/rooms/:code/state`        | Estado atual da sala   |
| GET    | `/api/rooms/:code/participants` | Lista de participantes |

### Fila de Músicas

| Método | Rota                              | Descrição                 |
| ------ | --------------------------------- | ------------------------- |
| POST   | `/api/rooms/:code/enqueue`        | Adicionar música à fila   |
| POST   | `/api/rooms/:code/next`           | Pular para próxima música |
| POST   | `/api/rooms/:code/finalize`       | Finalizar e pontuar       |
| DELETE | `/api/rooms/:code/queue/:id`      | Remover da fila           |
| POST   | `/api/rooms/:code/queue/:id/move` | Mover na fila             |
| POST   | `/api/rooms/:code/queue/:id/top`  | Mover para o topo         |

### Biblioteca

| Método | Rota               | Descrição             |
| ------ | ------------------ | --------------------- |
| GET    | `/api/library`     | Listar músicas salvas |
| DELETE | `/api/library/:id` | Remover música        |
| GET    | `/api/library/top` | Músicas mais tocadas  |

### Busca

| Método | Rota                     | Descrição         |
| ------ | ------------------------ | ----------------- |
| GET    | `/api/youtube/search?q=` | Buscar no YouTube |

### Usuários

| Método | Rota                           | Descrição                 |
| ------ | ------------------------------ | ------------------------- |
| POST   | `/api/rooms/:code/update-name` | Atualizar nome do usuário |

### WebSocket

| Rota                                                         | Descrição           |
| ------------------------------------------------------------ | ------------------- |
| `ws://localhost:8787/ws/:code?mode=tv`                       | Conexão modo TV     |
| `ws://localhost:8787/ws/:code?mode=mobile&name=X&odUserId=Y` | Conexão modo Mobile |

## 📡 Eventos WebSocket

### Cliente → Servidor

```typescript
{ type: "HELLO", name: string, odUserId: string }  // Identificação
{ type: "PLAYER_COMMAND", command: "play" | "pause" }  // Controle player
```

### Servidor → Cliente

```typescript
{ type: "STATE", state: RoomState }  // Estado completo
{ type: "PARTICIPANTS", participants: [...] }  // Lista de participantes
{ type: "FINALIZED", singer: string, score: number, title: string }  // Música finalizada
{ type: "SCORE_DONE" }  // Overlay de score terminou
{ type: "PLAYER_COMMAND", command: "play" | "pause" }  // Comando do player
```

## 🗄️ Estrutura de Dados (Atual)

### RoomState

```typescript
interface RoomState {
  code: string;
  createdAt: number;
  nowPlaying: QueueItem | null;
  queue: QueueItem[];
  ranking: Record<string, RankingEntry>;
  duetRanking: Record<string, DuetRankingEntry>;
  showingScore: boolean;
}
```

### QueueItem

```typescript
interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  requestedBy: string;
  singers: { id: string; name: string }[];
}
```

## 🗃️ Migração para PostgreSQL (Planejado)

### Instalação do Prisma

```bash
npm install prisma @prisma/client
npx prisma init
```

### Schema (Planejado)

```prisma
model User {
  id        String   @id @default(uuid())
  name      String
  email     String?  @unique
  createdAt DateTime @default(now())
  scores    Score[]
}

model Room {
  id        String   @id @default(uuid())
  code      String   @unique
  createdAt DateTime @default(now())
  sessions  Session[]
}

model Session {
  id        String   @id @default(uuid())
  roomId    String
  room      Room     @relation(fields: [roomId], references: [id])
  startedAt DateTime @default(now())
  endedAt   DateTime?
  scores    Score[]
}

model Song {
  id        String   @id @default(uuid())
  videoId   String   @unique
  title     String
  playCount Int      @default(0)
  addedBy   String
  createdAt DateTime @default(now())
}

model Score {
  id        String   @id @default(uuid())
  userId    String
  user      User     @relation(fields: [userId], references: [id])
  sessionId String
  session   Session  @relation(fields: [sessionId], references: [id])
  songTitle String
  score     Int
  isDuet    Boolean  @default(false)
  partnerId String?
  createdAt DateTime @default(now())
}
```

## 🔧 Variáveis de Ambiente

```env
# Servidor
PORT=8787

# Banco de dados (quando implementado)
DATABASE_URL=postgresql://user:password@localhost:5432/karaokeando

# Dashboard
DASHBOARD_KEY=sua-chave-admin
```

## 📦 Dependências

### Produção

- `fastify` - Framework HTTP rápido
- `@fastify/cors` - CORS middleware
- `@fastify/websocket` - Suporte WebSocket
- _(Em breve)_ `@prisma/client` - Cliente do banco

### Desenvolvimento

- `tsx` - Executor TypeScript
- `typescript` - Compilador

## 🏥 Health Check

```bash
curl http://localhost:8787/health
# {"status":"ok"}
```

---

Parte do projeto [Karaokêando](../README.md)
