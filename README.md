# Karaokêando 🎤

Sistema de karaokê social em tempo real. Crie salas, adicione músicas do YouTube, cante sozinho ou em dupla, e dispute o ranking com seus amigos!

## 📋 Visão Geral

O Karaokêando é uma aplicação web que transforma qualquer TV em um karaokê de festa. O host projeta a tela da TV, e os convidados usam seus celulares para adicionar músicas, escolher parceiros de dueto e acompanhar o ranking.

### Como funciona

1. **Host** cria uma sala e projeta a TV (`/room/XXXXX/tv`)
2. **Convidados** entram pelo celular escaneando QR code ou digitando o código
3. Pelo celular: buscam músicas, adicionam à fila, escolhem cantar solo ou em dupla
4. A TV exibe o vídeo com som, fila e ranking em tempo real
5. Ao finalizar, o sistema gera uma pontuação e atualiza o ranking

## 🏗️ Arquitetura

```
karaokeando/
├── backend/          # API Node.js + TypeScript
│   ├── src/
│   │   ├── server.ts    # Servidor Fastify + WebSocket
│   │   └── analytics.ts # Tracking de eventos
│   └── data/            # Dados persistidos (JSON → PostgreSQL)
│
├── frontend/         # React + Vite + TypeScript
│   ├── src/
│   │   ├── pages/       # Home, RoomTV, RoomMobile, Dashboard
│   │   ├── components/  # ScoreOverlay, etc.
│   │   ├── score/       # Sistema de pontuação
│   │   └── api.ts       # Cliente API + WebSocket
│   └── public/          # Assets estáticos
│
└── database/         # (Em breve) PostgreSQL + Prisma
```

## 🚀 Quick Start

### Pré-requisitos

- Node.js 20+
- npm 10+
- (Em breve) PostgreSQL 15+

### 1. Backend

```bash
cd karaokeando/backend
npm install
npm run dev
```

Servidor rodando em `http://localhost:8787`

### 2. Frontend

```bash
cd karaokeando/frontend
npm install
npm run dev
```

Aplicação em `http://localhost:3000`

## ✨ Funcionalidades

### Implementadas ✅

- **Salas em tempo real** - Código de 5 caracteres, WebSocket para sync instantâneo
- **Busca de músicas** - Integração com YouTube via yt-dlp
- **Fila compartilhada** - Todos veem a mesma fila em tempo real
- **Solo ou Dueto** - Escolha cantar sozinho ou com um parceiro da sala
- **Ranking individual** - Pontuação acumulada por participante
- **Ranking de duplas** - Ranking separado para duetos
- **Biblioteca de músicas** - Músicas adicionadas ficam salvas para todos
- **Mais tocadas** - Lista das músicas mais populares
- **Dashboard admin** - Painel de analytics e gestão
- **Identificação persistente** - ID único por dispositivo, nome salvo

### Roadmap 🚧

- [ ] **Banco de dados PostgreSQL** - Persistência robusta
- [ ] **Sistema de usuários** - Cadastro, login, perfil
- [ ] **Histórico de sessões** - Ver festas anteriores
- [ ] **Favoritos pessoais** - Cada usuário salva suas músicas
- [ ] **Conquistas/Badges** - Gamificação
- [ ] **Temas visuais** - Personalização da sala

## 🛠️ Stack Tecnológica

### Backend

| Tecnologia              | Uso                   |
| ----------------------- | --------------------- |
| Node.js                 | Runtime               |
| TypeScript              | Tipagem               |
| Fastify                 | Framework HTTP        |
| @fastify/websocket      | Comunicação real-time |
| yt-dlp                  | Busca no YouTube      |
| _(Em breve)_ Prisma     | ORM                   |
| _(Em breve)_ PostgreSQL | Banco de dados        |

### Frontend

| Tecnologia   | Uso        |
| ------------ | ---------- |
| React 18     | UI Library |
| TypeScript   | Tipagem    |
| Vite         | Build tool |
| React Router | Navegação  |

## 📁 Estrutura de Dados (Atual)

Atualmente os dados são persistidos em JSON:

```
backend/data/
├── song-library.json   # Biblioteca de músicas salvas
└── analytics.json      # Eventos de analytics
```

### Migração para PostgreSQL (Planejado)

```
database/
├── prisma/
│   └── schema.prisma   # Schema do banco
├── migrations/         # Histórico de migrations
└── seed.ts            # Dados iniciais
```

**Entidades planejadas:**

- `User` - Usuários cadastrados
- `Room` - Salas de karaokê
- `Session` - Sessões/festas
- `Song` - Músicas da biblioteca
- `QueueItem` - Itens na fila
- `Score` - Pontuações
- `DuetScore` - Pontuações de duplas

## 🔧 Variáveis de Ambiente

Criar arquivo `.env` na raiz do backend:

```env
# Servidor
PORT=8787

# (Em breve) Banco de dados
DATABASE_URL=postgresql://user:password@localhost:5432/karaokeando

# (Em breve) Autenticação
JWT_SECRET=sua-chave-secreta
```

## 📱 Rotas da Aplicação

| Rota             | Descrição                           |
| ---------------- | ----------------------------------- |
| `/`              | Home - Criar ou entrar em sala      |
| `/room/:code`    | Modo Mobile - Controle pelo celular |
| `/room/:code/tv` | Modo TV - Exibição principal        |
| `/dashboard`     | Painel administrativo               |

## 🤝 Contribuindo

1. Fork o projeto
2. Crie uma branch (`git checkout -b feature/nova-funcionalidade`)
3. Commit suas mudanças (`git commit -m 'Adiciona nova funcionalidade'`)
4. Push para a branch (`git push origin feature/nova-funcionalidade`)
5. Abra um Pull Request

## 📄 Licença

Este projeto está sob a licença MIT. Veja o arquivo [LICENSE](LICENSE) para mais detalhes.

---

Feito com 🎤 e ❤️
