/**
 * Analytics Module
 *
 * Interface abstrata para analytics. Atualmente salva em JSONL (arquivo),
 * mas preparado para migrar para PostgreSQL quando tivermos banco.
 *
 * Para migrar para Postgres depois:
 * 1. Implementar PostgresAnalyticsStore que implementa AnalyticsStore
 * 2. Trocar a instância exportada no final do arquivo
 */

import { appendFileSync, readFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

// ─────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────

export type AnalyticsEventType =
  | "room_created"
  | "user_joined"
  | "user_left"
  | "song_enqueued"
  | "song_started"
  | "song_finalized"
  | "room_closed";

export interface AnalyticsEvent {
  event: AnalyticsEventType;
  ts: number; // timestamp em ms
  roomCode?: string;
  data?: Record<string, unknown>;
}

export interface TopSong {
  videoId: string;
  title: string;
  playCount: number;
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
  // Comparativos
  roomsLastWeek: number;
  songsLastWeek: number;
  roomsGrowth: number; // percentual
  songsGrowth: number;
}

export interface DailyStats {
  date: string; // YYYY-MM-DD
  rooms: number;
  songs: number;
  users: number;
}

export interface PeriodFilter {
  start?: number; // timestamp
  end?: number;
  period?: "today" | "7d" | "30d" | "all";
}

export interface DetailedAnalytics {
  summary: AnalyticsSummary;
  dailyStats: DailyStats[];
  topSongs: TopSong[];
  topUsers: { name: string; songCount: number }[];
  peakHours: { hour: number; count: number }[];
}

// ─────────────────────────────────────────────────────────────
// Interface (para facilitar troca para Postgres depois)
// ─────────────────────────────────────────────────────────────

export interface AnalyticsStore {
  track(event: AnalyticsEvent): void;
  getTopSongs(limit?: number, filter?: PeriodFilter): TopSong[];
  getSummary(): AnalyticsSummary;
  getEvents(filter?: { event?: AnalyticsEventType; since?: number }): AnalyticsEvent[];
  getDetailedAnalytics(filter?: PeriodFilter): DetailedAnalytics;
  getDailyStats(days?: number): DailyStats[];
  getActiveRooms(): string[];
}

// ─────────────────────────────────────────────────────────────
// JSONL Implementation (arquivo local)
// ─────────────────────────────────────────────────────────────

const DATA_DIR = join(process.cwd(), "data");
const ANALYTICS_FILE = join(DATA_DIR, "analytics.jsonl");

// Ensure data directory exists
if (!existsSync(DATA_DIR)) {
  mkdirSync(DATA_DIR, { recursive: true });
}

class JSONLAnalyticsStore implements AnalyticsStore {
  private cache: AnalyticsEvent[] | null = null;
  private cacheTime = 0;
  private readonly CACHE_TTL = 60_000; // 1 minuto

  track(event: AnalyticsEvent): void {
    const line = JSON.stringify(event) + "\n";
    try {
      appendFileSync(ANALYTICS_FILE, line);
      // Invalidate cache
      this.cache = null;
    } catch (err) {
      console.error("[Analytics] Error writing event:", err);
    }
  }

  private loadEvents(): AnalyticsEvent[] {
    const now = Date.now();
    if (this.cache && now - this.cacheTime < this.CACHE_TTL) {
      return this.cache;
    }

    try {
      if (!existsSync(ANALYTICS_FILE)) {
        this.cache = [];
        this.cacheTime = now;
        return [];
      }

      const content = readFileSync(ANALYTICS_FILE, "utf-8");
      const events: AnalyticsEvent[] = [];

      for (const line of content.split("\n")) {
        if (line.trim()) {
          try {
            events.push(JSON.parse(line));
          } catch {
            // Skip malformed lines
          }
        }
      }

      this.cache = events;
      this.cacheTime = now;
      return events;
    } catch (err) {
      console.error("[Analytics] Error reading events:", err);
      return [];
    }
  }

  getEvents(filter?: { event?: AnalyticsEventType; since?: number }): AnalyticsEvent[] {
    let events = this.loadEvents();

    if (filter?.event) {
      events = events.filter(e => e.event === filter.event);
    }
    if (filter?.since) {
      const since = filter.since;
      events = events.filter(e => e.ts >= since);
    }

    return events;
  }

  getTopSongs(limit = 20, filter?: PeriodFilter): TopSong[] {
    let events = this.loadEvents();
    
    // Apply period filter
    if (filter) {
      const { start, end } = this.getPeriodBounds(filter);
      if (start) events = events.filter(e => e.ts >= start);
      if (end) events = events.filter(e => e.ts <= end);
    }
    
    const songCounts = new Map<string, { title: string; count: number }>();

    for (const e of events) {
      if (e.event === "song_finalized" && e.data?.videoId) {
        const videoId = e.data.videoId as string;
        const title = (e.data.title as string) || "Sem título";
        const existing = songCounts.get(videoId);
        if (existing) {
          existing.count++;
        } else {
          songCounts.set(videoId, { title, count: 1 });
        }
      }
    }

    const sorted = Array.from(songCounts.entries())
      .map(([videoId, { title, count }]) => ({ videoId, title, playCount: count }))
      .sort((a, b) => b.playCount - a.playCount)
      .slice(0, limit);

    return sorted;
  }

  private getPeriodBounds(filter: PeriodFilter): { start?: number; end?: number } {
    if (filter.start || filter.end) {
      return { start: filter.start, end: filter.end };
    }
    
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    
    switch (filter.period) {
      case "today":
        return { start: todayStart, end: now };
      case "7d":
        return { start: now - 7 * 24 * 60 * 60 * 1000, end: now };
      case "30d":
        return { start: now - 30 * 24 * 60 * 60 * 1000, end: now };
      case "all":
      default:
        return {};
    }
  }

  getSummary(): AnalyticsSummary {
    const events = this.loadEvents();
    const now = Date.now();
    const todayStart = new Date().setHours(0, 0, 0, 0);
    const weekStart = now - 7 * 24 * 60 * 60 * 1000;
    const monthStart = now - 30 * 24 * 60 * 60 * 1000;
    const lastWeekStart = now - 14 * 24 * 60 * 60 * 1000;

    const rooms = new Set<string>();
    const users = new Set<string>();
    let totalSongs = 0;
    let songsToday = 0;
    let songsThisWeek = 0;
    let songsThisMonth = 0;
    let songsLastWeek = 0;
    
    const roomsCreatedToday = new Set<string>();
    const roomsCreatedWeek = new Set<string>();
    const roomsCreatedMonth = new Set<string>();
    const roomsCreatedLastWeek = new Set<string>();

    for (const e of events) {
      if (e.roomCode) {
        rooms.add(e.roomCode);
      }

      if (e.event === "room_created" && e.roomCode) {
        if (e.ts >= todayStart) {
          roomsCreatedToday.add(e.roomCode);
        }
        if (e.ts >= weekStart) {
          roomsCreatedWeek.add(e.roomCode);
        }
        if (e.ts >= monthStart) {
          roomsCreatedMonth.add(e.roomCode);
        }
        if (e.ts >= lastWeekStart && e.ts < weekStart) {
          roomsCreatedLastWeek.add(e.roomCode);
        }
      }

      if (e.event === "user_joined" && e.data?.userName) {
        users.add(`${e.roomCode}:${e.data.userName}`);
      }

      if (e.event === "song_finalized") {
        totalSongs++;
        if (e.ts >= todayStart) songsToday++;
        if (e.ts >= weekStart) songsThisWeek++;
        if (e.ts >= monthStart) songsThisMonth++;
        if (e.ts >= lastWeekStart && e.ts < weekStart) songsLastWeek++;
      }
    }

    const roomsThisWeek = roomsCreatedWeek.size;
    const roomsLastWeek = roomsCreatedLastWeek.size;
    
    // Calculate growth percentages
    const roomsGrowth = roomsLastWeek > 0 
      ? Math.round(((roomsThisWeek - roomsLastWeek) / roomsLastWeek) * 100)
      : roomsThisWeek > 0 ? 100 : 0;
    const songsGrowth = songsLastWeek > 0
      ? Math.round(((songsThisWeek - songsLastWeek) / songsLastWeek) * 100)
      : songsThisWeek > 0 ? 100 : 0;

    return {
      totalRooms: rooms.size,
      totalSongsPlayed: totalSongs,
      totalUsers: users.size,
      roomsToday: roomsCreatedToday.size,
      roomsThisWeek,
      roomsThisMonth: roomsCreatedMonth.size,
      songsToday,
      songsThisWeek,
      songsThisMonth,
      avgSongsPerRoom: rooms.size > 0 ? Math.round(totalSongs / rooms.size) : 0,
      topSongs: this.getTopSongs(10),
      roomsLastWeek,
      songsLastWeek,
      roomsGrowth,
      songsGrowth,
    };
  }

  getDailyStats(days = 30): DailyStats[] {
    const events = this.loadEvents();
    const now = Date.now();
    const startDate = now - days * 24 * 60 * 60 * 1000;
    
    const dailyMap = new Map<string, { rooms: Set<string>; songs: number; users: Set<string> }>();
    
    // Initialize all days
    for (let i = 0; i < days; i++) {
      const date = new Date(now - i * 24 * 60 * 60 * 1000);
      const dateStr = date.toISOString().split("T")[0];
      dailyMap.set(dateStr, { rooms: new Set(), songs: 0, users: new Set() });
    }
    
    for (const e of events) {
      if (e.ts < startDate) continue;
      
      const dateStr = new Date(e.ts).toISOString().split("T")[0];
      let day = dailyMap.get(dateStr);
      if (!day) {
        day = { rooms: new Set(), songs: 0, users: new Set() };
        dailyMap.set(dateStr, day);
      }
      
      if (e.event === "room_created" && e.roomCode) {
        day.rooms.add(e.roomCode);
      }
      if (e.event === "song_finalized") {
        day.songs++;
      }
      if (e.event === "user_joined" && e.data?.userName) {
        day.users.add(e.data.userName as string);
      }
    }
    
    return Array.from(dailyMap.entries())
      .map(([date, data]) => ({
        date,
        rooms: data.rooms.size,
        songs: data.songs,
        users: data.users.size,
      }))
      .sort((a, b) => a.date.localeCompare(b.date));
  }

  getActiveRooms(): string[] {
    // This would need integration with the rooms Map from server.ts
    // For now, return rooms created in the last hour as "possibly active"
    const events = this.loadEvents();
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    
    const recentRooms = new Set<string>();
    for (const e of events) {
      if (e.ts >= oneHourAgo && e.roomCode) {
        recentRooms.add(e.roomCode);
      }
    }
    
    return Array.from(recentRooms);
  }

  getDetailedAnalytics(filter?: PeriodFilter): DetailedAnalytics {
    let events = this.loadEvents();
    
    if (filter) {
      const { start, end } = this.getPeriodBounds(filter);
      if (start) events = events.filter(e => e.ts >= start);
      if (end) events = events.filter(e => e.ts <= end);
    }
    
    // Top users by songs sung
    const userSongCounts = new Map<string, number>();
    for (const e of events) {
      if (e.event === "song_finalized" && e.data?.requestedBy) {
        const user = e.data.requestedBy as string;
        userSongCounts.set(user, (userSongCounts.get(user) || 0) + 1);
      }
    }
    const topUsers = Array.from(userSongCounts.entries())
      .map(([name, songCount]) => ({ name, songCount }))
      .sort((a, b) => b.songCount - a.songCount)
      .slice(0, 10);
    
    // Peak hours
    const hourCounts = new Map<number, number>();
    for (const e of events) {
      if (e.event === "song_finalized") {
        const hour = new Date(e.ts).getHours();
        hourCounts.set(hour, (hourCounts.get(hour) || 0) + 1);
      }
    }
    const peakHours = Array.from(hourCounts.entries())
      .map(([hour, count]) => ({ hour, count }))
      .sort((a, b) => a.hour - b.hour);
    
    return {
      summary: this.getSummary(),
      dailyStats: this.getDailyStats(30),
      topSongs: this.getTopSongs(20, filter),
      topUsers,
      peakHours,
    };
  }
}

// ─────────────────────────────────────────────────────────────
// Postgres Implementation (placeholder para depois)
// ─────────────────────────────────────────────────────────────

// class PostgresAnalyticsStore implements AnalyticsStore {
//   constructor(private pool: Pool) {}
//
//   async track(event: AnalyticsEvent): Promise<void> {
//     await this.pool.query(
//       `INSERT INTO analytics_events (event, ts, room_code, data)
//        VALUES ($1, $2, $3, $4)`,
//       [event.event, new Date(event.ts), event.roomCode, event.data]
//     );
//   }
//
//   async getTopSongs(limit = 20): Promise<TopSong[]> {
//     const result = await this.pool.query(`
//       SELECT data->>'videoId' as video_id, data->>'title' as title, COUNT(*) as play_count
//       FROM analytics_events
//       WHERE event = 'song_finalized'
//       GROUP BY data->>'videoId', data->>'title'
//       ORDER BY play_count DESC
//       LIMIT $1
//     `, [limit]);
//     return result.rows.map(r => ({
//       videoId: r.video_id,
//       title: r.title,
//       playCount: parseInt(r.play_count),
//     }));
//   }
//
//   // ... outros métodos
// }

// ─────────────────────────────────────────────────────────────
// Export singleton (trocar aqui quando migrar para Postgres)
// ─────────────────────────────────────────────────────────────

export const analytics: AnalyticsStore = new JSONLAnalyticsStore();

// Helper functions para facilitar uso
export function trackEvent(
  event: AnalyticsEventType,
  roomCode?: string,
  data?: Record<string, unknown>
): void {
  analytics.track({
    event,
    ts: Date.now(),
    roomCode,
    data,
  });
}
