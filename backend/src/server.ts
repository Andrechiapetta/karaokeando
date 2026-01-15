import Fastify from "fastify";
import cors from "@fastify/cors";
import websocket from "@fastify/websocket";
import type { WebSocket } from "ws";
import { exec } from "child_process";
import { promisify } from "util";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { trackEvent, analytics } from "./analytics.js";

const execAsync = promisify(exec);

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

interface Singer {
  id: string; // Unique user ID
  name: string; // Display name
}

interface QueueItem {
  id: string;
  videoId: string;
  title: string;
  requestedBy: string;
  singers: Singer[]; // All singers with their IDs
}

interface SavedSong {
  id: string;
  videoId: string;
  title: string;
  addedBy: string;
  savedAt: number;
}

interface RankingEntry {
  name: string;
  score: number;
}

interface DuetRankingEntry {
  singerIds: [string, string]; // Sorted IDs for consistent lookup
  names: [string, string]; // Display names
  score: number;
  count: number; // Number of songs sung together
}

interface RoomState {
  code: string;
  createdAt: number;
  nowPlaying: QueueItem | null;
  queue: QueueItem[];
  ranking: Record<string, RankingEntry | number>; // odUserId -> { name, score } OR old format name -> score
  duetRanking?: Record<string, DuetRankingEntry>; // "id1|id2" -> { names, score, count }
  lastFinalizeMs: number;
  showingScore: boolean; // true while TV is showing score overlay
}

interface RoomConnections {
  tv: Set<WebSocket>;
  mobile: Set<WebSocket>;
  participants: Map<WebSocket, { id: string; name: string }>; // socket -> user info
  recentParticipants: Map<string, { name: string; lastSeen: number }>; // odUserId -> info
}

// ─────────────────────────────────────────────────────────────
// Persistent Storage (JSON file)
// ─────────────────────────────────────────────────────────────

// Use the backend directory for data storage (works with both tsx and compiled)
const DATA_DIR = join(process.cwd(), "data");
const LIBRARY_FILE = join(DATA_DIR, "song-library.json");

// Ensure data directory exists on startup
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
  console.log(`📁 Created data directory: ${DATA_DIR}`);
}

function loadSongLibrary(): SavedSong[] {
  try {
    if (existsSync(LIBRARY_FILE)) {
      const data = readFileSync(LIBRARY_FILE, "utf-8");
      const songs = JSON.parse(data);
      console.log(`📚 Loaded ${songs.length} songs from: ${LIBRARY_FILE}`);
      return songs;
    }
    console.log(`📚 No library file found, starting fresh`);
  } catch (err) {
    console.error("Error loading song library:", err);
  }
  return [];
}

function saveSongLibrary(songs: SavedSong[]): void {
  try {
    writeFileSync(LIBRARY_FILE, JSON.stringify(songs, null, 2));
    console.log(`💾 Saved ${songs.length} songs to library`);
  } catch (err) {
    console.error("Error saving song library:", err);
  }
}

// ─────────────────────────────────────────────────────────────
// State (in-memory for rooms, persistent for library)
// ─────────────────────────────────────────────────────────────

const rooms = new Map<string, RoomState>();
const connections = new Map<string, RoomConnections>();
// Global song library (loaded from file, saved on changes)
const songLibrary: SavedSong[] = loadSongLibrary();

// ─────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────

function makeRoomCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += alphabet[Math.floor(Math.random() * alphabet.length)];
  }
  return code;
}

function randomId(): string {
  return Math.random().toString(36).slice(2, 10);
}

// Create a normalized duet key from two user IDs (sorted alphabetically)
function makeDuetKey(id1: string, id2: string): string {
  return [id1, id2].sort().join("|");
}

function biasedPartyScore(): number {
  const r = Math.random() * 100;
  if (r < 3) return 45 + Math.floor(Math.random() * 15); // 45-59
  if (r < 12) return 60 + Math.floor(Math.random() * 15); // 60-74
  if (r < 40) return 75 + Math.floor(Math.random() * 15); // 75-89
  return 90 + Math.floor(Math.random() * 11); // 90-100
}

function getRoomState(room: RoomState) {
  // Convert ranking to format for frontend: userId -> { name, score }
  // This keeps users with same name separate
  const rankingForFrontend: Record<string, { name: string; score: number }> =
    {};
  for (const [odUserId, entry] of Object.entries(room.ranking)) {
    // Handle both old format (name -> number) and new format (userId -> { name, score })
    if (typeof entry === "number") {
      // Old format: userId is actually the name, entry is the score
      rankingForFrontend[odUserId] = { name: odUserId, score: entry };
    } else {
      // New format: entry is { name, score }
      rankingForFrontend[odUserId] = { name: entry.name, score: entry.score };
    }
  }

  // Convert duet ranking to array format for frontend
  const duetRankingArray = Object.values(room.duetRanking || {}).map(entry => ({
    names: entry.names,
    score: entry.score,
    count: entry.count,
  }));

  return {
    roomCode: room.code,
    nowPlaying: room.nowPlaying
      ? {
          id: room.nowPlaying.id,
          videoId: room.nowPlaying.videoId,
          title: room.nowPlaying.title,
          requestedBy: room.nowPlaying.requestedBy,
          singers: room.nowPlaying.singers,
        }
      : null,
    queue: room.queue.map(item => ({
      id: item.id,
      videoId: item.videoId,
      title: item.title,
      requestedBy: item.requestedBy,
      singers: item.singers,
    })),
    ranking: rankingForFrontend,
    duetRanking: duetRankingArray,
    showingScore: room.showingScore,
  };
}

function broadcast(roomCode: string, msg: object) {
  const conns = connections.get(roomCode);
  if (!conns) return;
  const payload = JSON.stringify(msg);
  const dead: WebSocket[] = [];
  for (const ws of [...conns.tv, ...conns.mobile]) {
    try {
      if (ws.readyState === 1) ws.send(payload);
      else dead.push(ws);
    } catch {
      dead.push(ws);
    }
  }
  for (const ws of dead) {
    conns.tv.delete(ws);
    conns.mobile.delete(ws);
  }
}

interface ParticipantInfo {
  id: string;
  name: string;
}

function getParticipantsList(roomCode: string): ParticipantInfo[] {
  const conns = connections.get(roomCode);
  if (!conns) return [];

  const participantsMap = new Map<string, string>(); // id -> name
  const now = Date.now();
  const ONE_HOUR = 60 * 60 * 1000;

  // Add online participants
  for (const info of conns.participants.values()) {
    if (info && info.id) {
      participantsMap.set(info.id, info.name);
    }
  }

  // Add recently offline participants (< 1 hour)
  for (const [odUserId, info] of conns.recentParticipants) {
    if (now - info.lastSeen < ONE_HOUR) {
      if (!participantsMap.has(odUserId)) {
        participantsMap.set(odUserId, info.name);
      }
    } else {
      conns.recentParticipants.delete(odUserId);
    }
  }

  return Array.from(participantsMap.entries()).map(([id, name]) => ({
    id,
    name,
  }));
}

function getParticipantsNamesList(roomCode: string): string[] {
  return getParticipantsList(roomCode).map(p => p.name);
}

function broadcastParticipants(roomCode: string) {
  const participants = getParticipantsList(roomCode);
  console.log(
    `[WS] Broadcasting participants for ${roomCode}:`,
    participants.map(p => p.name)
  );
  broadcast(roomCode, {
    type: "PARTICIPANTS",
    participants,
  });
}

// ─────────────────────────────────────────────────────────────────
// Fastify App
// ─────────────────────────────────────────────────────────────

const app = Fastify({ logger: { level: "warn" } });

await app.register(cors, { origin: true });
await app.register(websocket);

// Health
app.get("/health", async () => ({ status: "ok" }));

// Create room
app.post("/api/rooms", async () => {
  let code = makeRoomCode();
  while (rooms.has(code)) code = makeRoomCode();
  rooms.set(code, {
    code,
    createdAt: Date.now(),
    nowPlaying: null,
    queue: [],
    ranking: {},
    duetRanking: {},
    lastFinalizeMs: 0,
    showingScore: false,
  });
  connections.set(code, {
    tv: new Set(),
    mobile: new Set(),
    participants: new Map(),
    recentParticipants: new Map(),
  });

  // Track analytics
  trackEvent("room_created", code);

  return { roomCode: code };
});

// Get state
app.get<{ Params: { roomCode: string } }>(
  "/api/rooms/:roomCode/state",
  async (req, reply) => {
    const room = rooms.get(req.params.roomCode);
    if (!room) return reply.code(404).send({ error: "room_not_found" });
    return getRoomState(room);
  }
);

// Get participants in room (for duet selection)
// Returns online users + recently offline (< 1 hour)
app.get<{ Params: { roomCode: string } }>(
  "/api/rooms/:roomCode/participants",
  async (req, reply) => {
    const conns = connections.get(req.params.roomCode);
    if (!conns) return reply.code(404).send({ error: "room_not_found" });

    const participants = getParticipantsList(req.params.roomCode);
    return { participants };
  }
);

// Enqueue
app.post<{
  Params: { roomCode: string };
  Body: {
    videoId: string;
    title?: string;
    requestedBy?: string;
    partner?: string;
    userId?: string;
    partnerId?: string;
  };
}>("/api/rooms/:roomCode/enqueue", async (req, reply) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) return reply.code(404).send({ error: "room_not_found" });

  const videoId = (req.body.videoId || "").trim();
  const title = (req.body.title || "").trim() || "(sem título)";
  const requestedBy = (req.body.requestedBy || "").trim() || "Convidado";
  const partner = (req.body.partner || "").trim();
  const odUserId = (req.body.userId || "").trim() || `anon_${randomId()}`;
  const partnerId = (req.body.partnerId || "").trim();

  if (!videoId) return reply.code(400).send({ error: "missing_videoId" });

  // Build singers array with IDs
  const singers: Singer[] = [{ id: odUserId, name: requestedBy }];
  if (partner && partner !== requestedBy && partnerId) {
    singers.push({ id: partnerId, name: partner });
  }

  const item: QueueItem = {
    id: randomId(),
    videoId,
    title,
    requestedBy,
    singers,
  };
  room.queue.push(item);

  // Auto-save to global library if not already there
  if (!songLibrary.some(s => s.videoId === videoId)) {
    songLibrary.push({
      id: randomId(),
      videoId,
      title,
      addedBy: requestedBy,
      savedAt: Date.now(),
    });
    saveSongLibrary(songLibrary);
  }

  broadcast(room.code, { type: "STATE", state: getRoomState(room) });

  // Track analytics
  trackEvent("song_enqueued", room.code, {
    videoId,
    title,
    requestedBy,
    singers: singers.map(s => s.name),
  });

  return { ok: true, itemId: item.id };
});

// Next song
app.post<{ Params: { roomCode: string } }>(
  "/api/rooms/:roomCode/next",
  async (req, reply) => {
    const room = rooms.get(req.params.roomCode);
    if (!room) return reply.code(404).send({ error: "room_not_found" });

    room.nowPlaying = room.queue.shift() || null;
    broadcast(room.code, { type: "STATE", state: getRoomState(room) });

    // Track analytics
    if (room.nowPlaying) {
      trackEvent("song_started", room.code, {
        videoId: room.nowPlaying.videoId,
        title: room.nowPlaying.title,
        singers: room.nowPlaying.singers,
      });
    }

    // Auto-play after a delay to give TV time to create the player
    if (room.nowPlaying) {
      const code = room.code;
      setTimeout(() => {
        const conns = connections.get(code);
        if (conns) {
          const payload = JSON.stringify({
            type: "PLAYER_COMMAND",
            action: "play",
          });
          for (const ws of conns.tv) {
            try {
              if (ws.readyState === 1) ws.send(payload);
            } catch {
              // ignore
            }
          }
        }
      }, 800);
    }

    return { ok: true };
  }
);

// Queue management (host controls)
app.post<{
  Params: { roomCode: string };
  Body: { itemId: string };
}>("/api/rooms/:roomCode/queue/remove", async (req, reply) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) return reply.code(404).send({ error: "room_not_found" });

  const itemId = (req.body.itemId || "").trim();
  if (!itemId) return reply.code(400).send({ error: "missing_itemId" });

  const before = room.queue.length;
  room.queue = room.queue.filter(i => i.id !== itemId);
  if (room.queue.length === before) {
    return reply.code(404).send({ error: "not_found" });
  }

  broadcast(room.code, { type: "STATE", state: getRoomState(room) });
  return { ok: true };
});

app.post<{
  Params: { roomCode: string };
  Body: { itemId: string; direction: "up" | "down" };
}>("/api/rooms/:roomCode/queue/move", async (req, reply) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) return reply.code(404).send({ error: "room_not_found" });

  const itemId = (req.body.itemId || "").trim();
  const direction = req.body.direction;
  if (!itemId) return reply.code(400).send({ error: "missing_itemId" });
  if (direction !== "up" && direction !== "down") {
    return reply.code(400).send({ error: "invalid_direction" });
  }

  const idx = room.queue.findIndex(i => i.id === itemId);
  if (idx === -1) return reply.code(404).send({ error: "not_found" });

  const newIdx = direction === "up" ? idx - 1 : idx + 1;
  if (newIdx < 0 || newIdx >= room.queue.length) return { ok: true };

  const tmp = room.queue[idx];
  room.queue[idx] = room.queue[newIdx];
  room.queue[newIdx] = tmp;

  broadcast(room.code, { type: "STATE", state: getRoomState(room) });
  return { ok: true };
});

app.post<{
  Params: { roomCode: string };
  Body: { itemId: string };
}>("/api/rooms/:roomCode/queue/to-top", async (req, reply) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) return reply.code(404).send({ error: "room_not_found" });

  const itemId = (req.body.itemId || "").trim();
  if (!itemId) return reply.code(400).send({ error: "missing_itemId" });

  const idx = room.queue.findIndex(i => i.id === itemId);
  if (idx === -1) return reply.code(404).send({ error: "not_found" });
  if (idx === 0) return { ok: true };

  const [item] = room.queue.splice(idx, 1);
  room.queue.unshift(item);

  broadcast(room.code, { type: "STATE", state: getRoomState(room) });
  return { ok: true };
});

// Finalize (party-friendly, minimal cooldown)
app.post<{ Params: { roomCode: string }; Body: { requester?: string } }>(
  "/api/rooms/:roomCode/finalize",
  async (req, reply) => {
    const room = rooms.get(req.params.roomCode);
    if (!room) return reply.code(404).send({ error: "room_not_found" });

    const requester = (req.body.requester || "").trim() || "Convidado";
    const now = Date.now();

    // 10s cooldown (party spam protection)
    if (now - room.lastFinalizeMs < 10_000) {
      return reply.code(429).send({ error: "cooldown", cooldownMs: 10_000 });
    }
    room.lastFinalizeMs = now;

    if (!room.nowPlaying) {
      return reply.code(400).send({ error: "nothing_playing" });
    }

    // Get all singers (supports duets) - now with IDs
    const singers: Singer[] = room.nowPlaying.singers || [
      { id: `anon_${randomId()}`, name: room.nowPlaying.requestedBy },
    ];
    const score = biasedPartyScore();

    // Give points to ALL singers (individual ranking)
    for (const singer of singers) {
      const existingEntry = room.ranking[singer.id];
      if (!existingEntry || typeof existingEntry === "number") {
        room.ranking[singer.id] = { name: singer.name, score: 0 };
      }
      (room.ranking[singer.id] as RankingEntry).score += score;
      // Update name in case it changed
      (room.ranking[singer.id] as RankingEntry).name = singer.name;
    }

    // If it's a duet, update duet ranking
    if (singers.length === 2) {
      // Initialize duetRanking if it doesn't exist (old room)
      if (!room.duetRanking) {
        room.duetRanking = {};
      }
      const duetKey = makeDuetKey(singers[0].id, singers[1].id);
      if (!room.duetRanking[duetKey]) {
        // Sort names alphabetically for consistent display
        const sortedNames = [singers[0].name, singers[1].name].sort() as [
          string,
          string
        ];
        const sortedIds = [singers[0].id, singers[1].id].sort() as [
          string,
          string
        ];
        room.duetRanking[duetKey] = {
          singerIds: sortedIds,
          names: sortedNames,
          score: 0,
          count: 0,
        };
      }
      room.duetRanking[duetKey].score += score;
      room.duetRanking[duetKey].count += 1;
      // Update names in case they changed
      const sortedNames = [singers[0].name, singers[1].name].sort() as [
        string,
        string
      ];
      room.duetRanking[duetKey].names = sortedNames;
    }

    // Format singer names for display (e.g., "Dede e Ana")
    const singerNames = singers.map(s => s.name);
    const singerDisplay =
      singerNames.length > 1
        ? singerNames.slice(0, -1).join(", ") +
          " e " +
          singerNames[singerNames.length - 1]
        : singerNames[0];

    // Set showingScore flag - TV will clear it when done
    room.showingScore = true;

    broadcast(room.code, {
      type: "FINALIZED",
      by: requester,
      singer: singerDisplay,
      singers: singerNames, // Array of singer names for display
      score,
      videoId: room.nowPlaying.videoId,
      title: room.nowPlaying.title,
    });

    // Track analytics (save before nulling nowPlaying)
    const finalizedVideoId = room.nowPlaying.videoId;
    const finalizedTitle = room.nowPlaying.title;

    // NÃO auto-avança para próxima - espera alguém apertar "Começar"
    room.nowPlaying = null;
    broadcast(room.code, { type: "STATE", state: getRoomState(room) });

    // Track analytics
    trackEvent("song_finalized", req.params.roomCode, {
      videoId: finalizedVideoId,
      title: finalizedTitle,
      score,
      singers: singerNames,
    });

    return { ok: true, score };
  }
);

// Update user name (when user changes their display name)
app.post<{
  Params: { roomCode: string };
  Body: { userId: string; newName: string };
}>("/api/rooms/:roomCode/update-name", async (req, reply) => {
  const room = rooms.get(req.params.roomCode);
  if (!room) return reply.code(404).send({ error: "room_not_found" });

  const { userId, newName } = req.body;
  if (!userId || !newName) {
    return reply.code(400).send({ error: "missing_userId_or_newName" });
  }

  const trimmedName = newName.trim();
  if (!trimmedName) {
    return reply.code(400).send({ error: "empty_name" });
  }

  // Check for duplicate name in room
  const existingParticipants = getParticipantsList(req.params.roomCode);
  const duplicateName = existingParticipants.find(
    p => p.name.toLowerCase() === trimmedName.toLowerCase() && p.id !== userId
  );
  if (duplicateName) {
    return reply.code(400).send({
      error: "duplicate_name",
      message: `O nome "${trimmedName}" já está sendo usado nesta sala.`,
    });
  }

  // Update in ranking
  if (room.ranking[userId] && typeof room.ranking[userId] !== "number") {
    (room.ranking[userId] as RankingEntry).name = trimmedName;
  }

  // Update in duet ranking
  if (room.duetRanking) {
    for (const entry of Object.values(room.duetRanking)) {
      const idx = entry.singerIds.indexOf(userId);
      if (idx !== -1) {
        entry.names[idx] = trimmedName;
      }
    }
  }

  // Update in queue
  for (const item of room.queue) {
    for (const singer of item.singers) {
      if (singer.id === userId) {
        singer.name = trimmedName;
      }
    }
    // Also update requestedBy if it matches
    if (item.singers.some(s => s.id === userId)) {
      item.requestedBy = item.singers.map(s => s.name).join(" e ");
    }
  }

  // Update in nowPlaying
  if (room.nowPlaying) {
    for (const singer of room.nowPlaying.singers) {
      if (singer.id === userId) {
        singer.name = trimmedName;
      }
    }
    if (room.nowPlaying.singers.some(s => s.id === userId)) {
      room.nowPlaying.requestedBy = room.nowPlaying.singers
        .map(s => s.name)
        .join(" e ");
    }
  }

  // Update in participants map
  const conns = connections.get(req.params.roomCode);
  if (conns) {
    for (const [socket, info] of conns.participants) {
      if (info.id === userId) {
        conns.participants.set(socket, { id: userId, name: trimmedName });
      }
    }
    // Update in recentParticipants
    if (conns.recentParticipants.has(userId)) {
      const existing = conns.recentParticipants.get(userId)!;
      conns.recentParticipants.set(userId, { ...existing, name: trimmedName });
    }
    // Broadcast updated participants
    broadcastParticipants(req.params.roomCode);
  }

  // Broadcast updated state
  broadcast(room.code, { type: "STATE", state: getRoomState(room) });

  return { ok: true };
});

// Clear showingScore flag (called by TV when score overlay closes)
app.post<{ Params: { roomCode: string } }>(
  "/api/rooms/:roomCode/score-done",
  async (req, reply) => {
    const room = rooms.get(req.params.roomCode);
    if (!room) return reply.code(404).send({ error: "room_not_found" });

    room.showingScore = false;
    broadcast(room.code, { type: "STATE", state: getRoomState(room) });

    return { ok: true };
  }
);

// Remote play control (mobile -> TV)
app.post<{ Params: { roomCode: string }; Body: { action: string } }>(
  "/api/rooms/:roomCode/player",
  async (req, reply) => {
    const room = rooms.get(req.params.roomCode);
    if (!room) return reply.code(404).send({ error: "room_not_found" });

    const action = req.body.action; // 'play' | 'pause'
    if (!["play", "pause"].includes(action)) {
      return reply.code(400).send({ error: "invalid_action" });
    }

    // Broadcast to TV clients only
    const conns = connections.get(room.code);
    if (conns) {
      const payload = JSON.stringify({ type: "PLAYER_COMMAND", action });
      for (const ws of conns.tv) {
        try {
          if (ws.readyState === 1) ws.send(payload);
        } catch {
          // ignore
        }
      }
    }

    return { ok: true, action };
  }
);

// ─────────────────────────────────────────────────────────────
// YouTube Search API (using yt-dlp like PiKaraoke)
// ─────────────────────────────────────────────────────────────

interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

// Search YouTube using yt-dlp (same method as PiKaraoke)
async function searchWithYtDlp(query: string): Promise<YouTubeSearchResult[]> {
  const numResults = 10;
  // Format exactly like PiKaraoke: ytsearch10:"query"
  // Escape shell special characters
  const safeQuery = query.replace(/[`$\\]/g, "\\$&").replace(/"/g, '\\"');
  const cmd = `yt-dlp -j --no-playlist --flat-playlist "ytsearch${numResults}:${safeQuery}"`;

  console.log("Running yt-dlp search:", cmd);

  try {
    const { stdout } = await execAsync(cmd, { timeout: 30000 }); // 30s timeout

    const results: YouTubeSearchResult[] = [];
    for (const line of stdout.split("\n")) {
      if (line.trim().length < 2) continue;
      try {
        const j = JSON.parse(line);
        if (!j.id) continue;
        results.push({
          videoId: j.id,
          title: j.title || "(sem título)",
          thumbnail: `https://i.ytimg.com/vi/${j.id}/mqdefault.jpg`,
          channelTitle: j.channel || j.uploader || "",
        });
      } catch {
        // skip invalid JSON lines
      }
    }

    console.log(`yt-dlp found ${results.length} results`);
    return results;
  } catch (err) {
    console.error("yt-dlp search error:", err);
    return [];
  }
}

// Search YouTube
app.get<{ Querystring: { q: string } }>(
  "/api/youtube/search",
  async (req, reply) => {
    const query = (req.query.q || "").trim();
    if (!query) return reply.code(400).send({ error: "missing_query" });

    try {
      // ALWAYS add "karaoke" to the search (like PiKaraoke does)
      const searchTerm = query + " karaoke";

      const results = await searchWithYtDlp(searchTerm);
      return results;
    } catch (error) {
      console.error("YouTube search error:", error);
      return reply.code(500).send({ error: "search_failed" });
    }
  }
);

// Get video info from YouTube (for when user pastes a link)
app.get<{ Querystring: { videoId: string } }>(
  "/api/youtube/info",
  async (req, reply) => {
    const videoId = (req.query.videoId || "").trim();
    if (!videoId) return reply.code(400).send({ error: "missing_videoId" });

    try {
      // Use yt-dlp to get video title
      const cmd = `yt-dlp -j --no-playlist "https://www.youtube.com/watch?v=${videoId}"`;
      console.log("Getting video info:", cmd);

      const { stdout } = await execAsync(cmd, { timeout: 15000 });
      const info = JSON.parse(stdout);

      return {
        videoId,
        title: info.title || "",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: info.channel || info.uploader || "",
      };
    } catch (err) {
      console.error("Error getting video info:", err);
      // Return basic info even if yt-dlp fails
      return {
        videoId,
        title: "",
        thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
        channelTitle: "",
      };
    }
  }
);

// ─────────────────────────────────────────────────────────────
// Song Library API (global, shared by all users)
// ─────────────────────────────────────────────────────────────

// List all songs in library
app.get("/api/songs", async () => {
  // Return sorted by most recently added
  return [...songLibrary].sort((a, b) => b.savedAt - a.savedAt);
});

// Save a song to library
app.post<{
  Body: { videoId: string; title?: string; addedBy?: string };
}>("/api/songs", async (req, reply) => {
  const videoId = (req.body.videoId || "").trim();
  const title = (req.body.title || "").trim() || "(sem título)";
  const addedBy = (req.body.addedBy || "").trim() || "Anônimo";

  if (!videoId) return reply.code(400).send({ error: "missing_videoId" });

  // Avoid duplicates
  if (songLibrary.some(s => s.videoId === videoId)) {
    return { ok: true, alreadySaved: true };
  }

  const song: SavedSong = {
    id: randomId(),
    videoId,
    title,
    addedBy,
    savedAt: Date.now(),
  };
  songLibrary.push(song);
  saveSongLibrary(songLibrary);
  return { ok: true, song };
});

// Delete a song from library
app.delete<{ Params: { songId: string } }>(
  "/api/songs/:songId",
  async (req, reply) => {
    const songId = req.params.songId;

    const idx = songLibrary.findIndex(s => s.id === songId);
    if (idx === -1) return reply.code(404).send({ error: "not_found" });

    songLibrary.splice(idx, 1);
    saveSongLibrary(songLibrary);
    return { ok: true };
  }
);

// ─────────────────────────────────────────────────────────────
// Analytics Endpoints
// ─────────────────────────────────────────────────────────────

const ANALYTICS_ADMIN_KEY = process.env.ANALYTICS_ADMIN_KEY || "admin123";

// Public: Top songs (everyone can see)
app.get<{ Querystring: { limit?: string; period?: string } }>(
  "/api/analytics/top-songs",
  async req => {
    const limit = parseInt(req.query.limit || "20", 10);
    const period = req.query.period as
      | "today"
      | "7d"
      | "30d"
      | "all"
      | undefined;
    return {
      topSongs: analytics.getTopSongs(limit, period ? { period } : undefined),
    };
  }
);

// Private: Full summary (add auth later when you have accounts)
app.get<{ Querystring: { key?: string } }>(
  "/api/analytics/summary",
  async (req, reply) => {
    if (req.query.key !== ANALYTICS_ADMIN_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    return analytics.getSummary();
  }
);

// Private: Detailed analytics with all data for dashboard
app.get<{ Querystring: { key?: string; period?: string; days?: string } }>(
  "/api/analytics/detailed",
  async (req, reply) => {
    if (req.query.key !== ANALYTICS_ADMIN_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const period = req.query.period as
      | "today"
      | "7d"
      | "30d"
      | "all"
      | undefined;
    return analytics.getDetailedAnalytics(period ? { period } : undefined);
  }
);

// Private: Daily stats for charts
app.get<{ Querystring: { key?: string; days?: string } }>(
  "/api/analytics/daily",
  async (req, reply) => {
    if (req.query.key !== ANALYTICS_ADMIN_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    const days = parseInt(req.query.days || "30", 10);
    return { dailyStats: analytics.getDailyStats(days) };
  }
);

// Private: Active rooms (rooms with activity in last hour)
app.get<{ Querystring: { key?: string } }>(
  "/api/analytics/active-rooms",
  async (req, reply) => {
    if (req.query.key !== ANALYTICS_ADMIN_KEY) {
      return reply.code(401).send({ error: "unauthorized" });
    }
    // Get actual active rooms from memory
    const activeRoomCodes = Array.from(rooms.keys());
    const activeRoomDetails = activeRoomCodes.map(code => {
      const room = rooms.get(code)!;
      const conns = connections.get(code);
      return {
        code,
        createdAt: room.createdAt,
        queueLength: room.queue.length,
        nowPlaying: room.nowPlaying?.title || null,
        participantsCount: conns ? conns.participants.size : 0,
      };
    });
    return { activeRooms: activeRoomDetails };
  }
);

// WebSocket
app.get<{ Params: { roomCode: string } }>(
  "/ws/:roomCode",
  { websocket: true },
  (socket, req) => {
    const roomCode = req.params.roomCode;
    const room = rooms.get(roomCode);
    let role: "tv" | "mobile" = "mobile";
    let name = "";
    let odUserId = "";

    if (!room) {
      socket.send(JSON.stringify({ type: "ERROR", error: "room_not_found" }));
      socket.close();
      return;
    }

    socket.on("message", raw => {
      try {
        const msg = JSON.parse(raw.toString());
        if (msg.type === "HELLO") {
          role = msg.role === "tv" ? "tv" : "mobile";
          name = msg.name || "";
          odUserId = msg.userId || `anon_${randomId()}`;
          const conns = connections.get(roomCode)!;

          // Check for duplicate name in room (only for mobile, not TV)
          if (role === "mobile" && name) {
            const existingParticipants = getParticipantsList(roomCode);
            const duplicateName = existingParticipants.find(
              p =>
                p.name.toLowerCase() === name.toLowerCase() && p.id !== odUserId
            );
            if (duplicateName) {
              socket.send(
                JSON.stringify({
                  type: "ERROR",
                  error: "duplicate_name",
                  message: `O nome "${name}" já está sendo usado nesta sala. Por favor, escolha outro nome.`,
                })
              );
              socket.close();
              return;
            }
          }

          if (role === "tv") {
            conns.tv.add(socket);
          } else {
            conns.mobile.add(socket);
            // Track participant with ID for duet selection
            if (name && odUserId) {
              conns.participants.set(socket, { id: odUserId, name });
              // Remove from recentParticipants since they're online now
              conns.recentParticipants.delete(odUserId);
              // Broadcast updated participants list to all clients
              broadcastParticipants(roomCode);
              // Track analytics
              trackEvent("user_joined", roomCode, {
                userName: name,
                odUserId,
                role,
              });
            }
          }
          socket.send(
            JSON.stringify({ type: "HELLO", roomCode, role, name, odUserId })
          );
          socket.send(
            JSON.stringify({ type: "STATE", state: getRoomState(room) })
          );
          // Send current participants list to this new client
          socket.send(
            JSON.stringify({
              type: "PARTICIPANTS",
              participants: getParticipantsList(roomCode),
            })
          );
        } else {
          socket.send(JSON.stringify({ type: "ACK" }));
        }
      } catch {
        // ignore
      }
    });

    socket.on("close", () => {
      const conns = connections.get(roomCode);
      if (conns) {
        // Get info before removing from participants
        const participantInfo = conns.participants.get(socket);

        conns.tv.delete(socket);
        conns.mobile.delete(socket);
        conns.participants.delete(socket);

        // Add to recentParticipants with current timestamp (for offline < 1h feature)
        if (participantInfo) {
          conns.recentParticipants.set(participantInfo.id, {
            name: participantInfo.name,
            lastSeen: Date.now(),
          });
          // Broadcast updated participants list
          broadcastParticipants(roomCode);
          // Track analytics
          trackEvent("user_left", roomCode, {
            userName: participantInfo.name,
            odUserId: participantInfo.id,
          });
        }
      }
    });
  }
);

// Start
const PORT = parseInt(process.env.PORT || "8787", 10);
app.listen({ port: PORT, host: "0.0.0.0" }, err => {
  if (err) {
    app.log.error(err);
    process.exit(1);
  }
  console.log(`🎤 Karaokêando backend running on http://localhost:${PORT}`);
});
