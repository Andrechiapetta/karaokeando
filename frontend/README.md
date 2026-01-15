# Karaokêando Frontend

Frontend **React + Vite + TypeScript** para salas de karaokê.

## Rodar (dev)

```zsh
cd karaokeando/frontend
npm install
npm run dev
```

Abre em `http://localhost:3000`.

## Páginas

- `/` – Home: criar sala (host) ou entrar em sala existente
- `/room/:code/tv` – Modo TV (com som, para projetar na TV)
- `/room/:code` – Modo Mobile (vídeo mudo, fila, ranking, adicionar música, finalizar)
