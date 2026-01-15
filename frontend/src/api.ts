const API_BASE = "";

// ─────────────────────────────────────────────────────────────
// User ID Management (persistent across sessions)
// ─────────────────────────────────────────────────────────────

const USER_ID_KEY = "karaokeando_user_id";

function generateUserId(): string {
  return (
    "pk_" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36)
  );
}

export function getUserId(): string {
  let id = localStorage.getItem(USER_ID_KEY);
  if (!id) {
    id = generateUserId();
    localStorage.setItem(USER_ID_KEY, id);
  }
  return id;
}

// ─────────────────────────────────────────────────────────────
// YouTube Search
// ─────────────────────────────────────────────────────────────

export interface YouTubeSearchResult {
  videoId: string;
  title: string;
  thumbnail: string;
  channelTitle: string;
}

export async function searchYouTube(
  query: string
): Promise<YouTubeSearchResult[]> {
  const res = await fetch(
    `${API_BASE}/api/youtube/search?q=${encodeURIComponent(query)}`
  );
  if (!res.ok) return [];
  return res.json();
}

export async function getVideoInfo(
  videoId: string
): Promise<YouTubeSearchResult> {
  const res = await fetch(
    `${API_BASE}/api/youtube/info?videoId=${encodeURIComponent(videoId)}`
  );
  if (!res.ok) {
    return {
      videoId,
      title: "",
      thumbnail: `https://i.ytimg.com/vi/${videoId}/mqdefault.jpg`,
      channelTitle: "",
    };
  }
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Room API
// ─────────────────────────────────────────────────────────────

export async function createRoom(): Promise<{ roomCode: string }> {
  const res = await fetch(`${API_BASE}/api/rooms`, { method: "POST" });
  return res.json();
}

export async function getState(roomCode: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/state`);
  return res.json();
}

export interface ParticipantInfo {
  id: string;
  name: string;
}

export async function getParticipants(
  roomCode: string
): Promise<{ participants: ParticipantInfo[] }> {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/participants`);
  return res.json();
}

export async function enqueue(
  roomCode: string,
  videoId: string,
  title: string,
  requestedBy: string,
  partner?: string,
  userId?: string,
  partnerId?: string
) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/enqueue`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      videoId,
      title,
      requestedBy,
      partner,
      userId,
      partnerId,
    }),
  });
  return res.json();
}

export async function nextSong(roomCode: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/next`, {
    method: "POST",
  });
  return res.json();
}

export async function finalizeSong(roomCode: string, requester: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/finalize`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ requester }),
  });
  return res.json();
}

export async function sendPlayerCommand(
  roomCode: string,
  action: "play" | "pause"
) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/player`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action }),
  });
  return res.json();
}

export async function updateUserName(
  roomCode: string,
  userId: string,
  newName: string
) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/update-name`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ userId, newName }),
  });
  return res.json();
}

export async function removeQueueItem(roomCode: string, itemId: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/queue/remove`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  return res.json();
}

export async function moveQueueItem(
  roomCode: string,
  itemId: string,
  direction: "up" | "down"
) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/queue/move`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId, direction }),
  });
  return res.json();
}

export async function queueItemToTop(roomCode: string, itemId: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/queue/to-top`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ itemId }),
  });
  return res.json();
}

// Called by TV when score overlay closes
export async function scoreDone(roomCode: string) {
  const res = await fetch(`${API_BASE}/api/rooms/${roomCode}/score-done`, {
    method: "POST",
  });
  return res.json();
}

// ─────────────────────────────────────────────────────────────
// Song Library API (global, shared by all users)
// ─────────────────────────────────────────────────────────────

export interface SavedSong {
  id: string;
  videoId: string;
  title: string;
  addedBy: string;
  savedAt: number;
}

export async function getSongLibrary(): Promise<SavedSong[]> {
  const res = await fetch(`${API_BASE}/api/songs`);
  return res.json();
}

export async function saveSong(
  videoId: string,
  title: string,
  addedBy: string
): Promise<{ ok: boolean; song?: SavedSong; alreadySaved?: boolean }> {
  const res = await fetch(`${API_BASE}/api/songs`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ videoId, title, addedBy }),
  });
  return res.json();
}

export async function deleteSong(songId: string) {
  const res = await fetch(`${API_BASE}/api/songs/${songId}`, {
    method: "DELETE",
  });
  return res.json();
}

export function connectWS(
  roomCode: string,
  role: "tv" | "mobile",
  name: string,
  onMessage: (msg: unknown) => void,
  userId?: string
): WebSocket {
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const url = `${protocol}//${window.location.host}/ws/${roomCode}`;
  console.log("[WS] Connecting to", url);
  const ws = new WebSocket(url);

  ws.onopen = () => {
    console.log("[WS] Connected, sending HELLO");
    ws.send(JSON.stringify({ type: "HELLO", role, name, userId }));
  };

  ws.onmessage = event => {
    try {
      const msg = JSON.parse(event.data);
      console.log("[WS] Received", msg.type, msg);
      onMessage(msg);
    } catch {
      // ignore
    }
  };

  ws.onerror = err => {
    console.error("[WS] Error", err);
  };

  ws.onclose = e => {
    console.log("[WS] Closed", e.code, e.reason);
  };

  return ws;
}

// ─────────────────────────────────────────────────────────────
// Analytics API
// ─────────────────────────────────────────────────────────────

export interface TopSong {
  videoId: string;
  title: string;
  playCount: number;
}

export async function getTopSongs(
  limit = 20,
  period?: string
): Promise<TopSong[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (period) params.set("period", period);
  const res = await fetch(`${API_BASE}/api/analytics/top-songs?${params}`);
  if (!res.ok) return [];
  const data = await res.json();
  return data.topSongs || [];
}

export interface AnalyticsSummary {
  totalRooms: number;
  totalSongsPlayed: number;
  totalUsers: number;
  roomsToday: number;
  roomsThisWeek: number;
  roomsThisMonth: number;
  songsToday: number;
  songsThisWeek: number;
  songsThisMonth: number;
  avgSongsPerRoom: number;
  topSongs: TopSong[];
  roomsLastWeek: number;
  songsLastWeek: number;
  roomsGrowth: number;
  songsGrowth: number;
}

export interface DailyStats {
  date: string;
  rooms: number;
  songs: number;
  users: number;
}

export interface TopUser {
  name: string;
  songCount: number;
}

export interface PeakHour {
  hour: number;
  count: number;
}

export interface DetailedAnalytics {
  summary: AnalyticsSummary;
  dailyStats: DailyStats[];
  topSongs: TopSong[];
  topUsers: TopUser[];
  peakHours: PeakHour[];
}

export interface ActiveRoom {
  code: string;
  createdAt: number;
  queueLength: number;
  nowPlaying: string | null;
  participantsCount: number;
}

export async function getAnalyticsSummary(
  adminKey: string
): Promise<AnalyticsSummary | null> {
  const res = await fetch(`${API_BASE}/api/analytics/summary?key=${adminKey}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getDetailedAnalytics(
  adminKey: string,
  period?: string
): Promise<DetailedAnalytics | null> {
  const params = new URLSearchParams({ key: adminKey });
  if (period) params.set("period", period);
  const res = await fetch(`${API_BASE}/api/analytics/detailed?${params}`);
  if (!res.ok) return null;
  return res.json();
}

export async function getDailyStats(
  adminKey: string,
  days = 30
): Promise<DailyStats[]> {
  const res = await fetch(
    `${API_BASE}/api/analytics/daily?key=${adminKey}&days=${days}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.dailyStats || [];
}

export async function getActiveRooms(adminKey: string): Promise<ActiveRoom[]> {
  const res = await fetch(
    `${API_BASE}/api/analytics/active-rooms?key=${adminKey}`
  );
  if (!res.ok) return [];
  const data = await res.json();
  return data.activeRooms || [];
}
