import { useState, useEffect, useCallback } from "react";
import {
  getDetailedAnalytics,
  getActiveRooms,
  type DetailedAnalytics,
  type ActiveRoom,
  type DailyStats,
} from "../api";
import "./Dashboard.css";

type Period = "today" | "7d" | "30d" | "all";

// Icon components
const IconMic = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"></path>
    <path d="M19 10v2a7 7 0 0 1-14 0v-2"></path>
    <line x1="12" y1="19" x2="12" y2="23"></line>
    <line x1="8" y1="23" x2="16" y2="23"></line>
  </svg>
);

const IconMusic = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M9 18V5l12-2v13"></path>
    <circle cx="6" cy="18" r="3"></circle>
    <circle cx="18" cy="16" r="3"></circle>
  </svg>
);

const IconUsers = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path>
    <circle cx="9" cy="7" r="4"></circle>
    <path d="M23 21v-2a4 4 0 0 0-3-3.87"></path>
    <path d="M16 3.13a4 4 0 0 1 0 7.75"></path>
  </svg>
);

const IconHome = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path>
    <polyline points="9 22 9 12 15 12 15 22"></polyline>
  </svg>
);

const IconBarChart = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="12" y1="20" x2="12" y2="10"></line>
    <line x1="18" y1="20" x2="18" y2="4"></line>
    <line x1="6" y1="20" x2="6" y2="16"></line>
  </svg>
);

const IconTrophy = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <path d="M6 9H4.5a2.5 2.5 0 0 1 0-5H6"></path>
    <path d="M18 9h1.5a2.5 2.5 0 0 0 0-5H18"></path>
    <path d="M4 22h16"></path>
    <path d="M10 14.66V17c0 .55-.47.98-.97 1.21C7.85 18.75 7 20.24 7 22"></path>
    <path d="M14 14.66V17c0 .55.47.98.97 1.21C16.15 18.75 17 20.24 17 22"></path>
    <path d="M18 2H6v7a6 6 0 0 0 12 0V2Z"></path>
  </svg>
);

const IconStar = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
  </svg>
);

const IconClock = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="10"></circle>
    <polyline points="12 6 12 12 16 14"></polyline>
  </svg>
);

const IconRefresh = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <polyline points="23 4 23 10 17 10"></polyline>
    <polyline points="1 20 1 14 7 14"></polyline>
    <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path>
  </svg>
);

const IconList = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <line x1="8" y1="6" x2="21" y2="6"></line>
    <line x1="8" y1="12" x2="21" y2="12"></line>
    <line x1="8" y1="18" x2="21" y2="18"></line>
    <line x1="3" y1="6" x2="3.01" y2="6"></line>
    <line x1="3" y1="12" x2="3.01" y2="12"></line>
    <line x1="3" y1="18" x2="3.01" y2="18"></line>
  </svg>
);

const IconRadio = ({ size = 16 }: { size?: number }) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
  >
    <circle cx="12" cy="12" r="2"></circle>
    <path d="M16.24 7.76a6 6 0 0 1 0 8.49m-8.48-.01a6 6 0 0 1 0-8.49m11.31-2.82a10 10 0 0 1 0 14.14m-14.14 0a10 10 0 0 1 0-14.14"></path>
  </svg>
);

export default function Dashboard() {
  const [adminKey, setAdminKey] = useState(() => {
    return localStorage.getItem("pk_admin_key") || "";
  });
  const [isAuthed, setIsAuthed] = useState(false);
  const [keyInput, setKeyInput] = useState("");
  const [period, setPeriod] = useState<Period>("7d");
  const [data, setData] = useState<DetailedAnalytics | null>(null);
  const [activeRooms, setActiveRooms] = useState<ActiveRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchData = useCallback(async () => {
    if (!adminKey) return;
    setLoading(true);
    setError("");

    try {
      const [analytics, rooms] = await Promise.all([
        getDetailedAnalytics(adminKey, period),
        getActiveRooms(adminKey),
      ]);

      if (!analytics) {
        setError("Chave inválida ou erro ao carregar dados");
        setIsAuthed(false);
        localStorage.removeItem("pk_admin_key");
        return;
      }

      setData(analytics);
      setActiveRooms(rooms);
      setIsAuthed(true);
    } catch {
      setError("Erro ao conectar com o servidor");
    } finally {
      setLoading(false);
    }
  }, [adminKey, period]);

  useEffect(() => {
    if (adminKey) {
      fetchData();
    }
  }, [fetchData, adminKey]);

  // Auto-refresh every 30 seconds
  useEffect(() => {
    if (!isAuthed) return;
    const interval = setInterval(fetchData, 30000);
    return () => clearInterval(interval);
  }, [isAuthed, fetchData]);

  const handleLogin = () => {
    if (keyInput.trim()) {
      localStorage.setItem("pk_admin_key", keyInput.trim());
      setAdminKey(keyInput.trim());
    }
  };

  const handleLogout = () => {
    localStorage.removeItem("pk_admin_key");
    setAdminKey("");
    setIsAuthed(false);
    setData(null);
  };

  if (!isAuthed) {
    return (
      <div className="dashboard-login">
        <div className="login-card">
          <h1
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 10,
            }}
          >
            <IconMic size={32} /> Karaokêando
          </h1>
          <h2>Dashboard Admin</h2>
          {error && <p className="error">{error}</p>}
          <input
            type="password"
            placeholder="Chave de acesso"
            value={keyInput}
            onChange={e => setKeyInput(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleLogin()}
          />
          <button onClick={handleLogin}>Entrar</button>
        </div>
      </div>
    );
  }

  const summary = data?.summary;

  return (
    <div className="dashboard">
      <header className="dashboard-header">
        <div className="header-left">
          <h1 style={{ display: "flex", alignItems: "center", gap: 12 }}>
            <IconMic size={28} /> Karaokêando Dashboard
          </h1>
          <span className="last-update">
            Atualizado: {new Date().toLocaleTimeString("pt-BR")}
          </span>
        </div>
        <div className="header-right">
          <button
            className="btn-refresh"
            onClick={fetchData}
            disabled={loading}
            style={{ display: "flex", alignItems: "center", gap: 6 }}
          >
            <IconRefresh size={16} /> {loading ? "..." : "Atualizar"}
          </button>
          <button className="btn-logout" onClick={handleLogout}>
            Sair
          </button>
        </div>
      </header>

      {/* Period Filter */}
      <div className="period-filter">
        <span>Período:</span>
        <div className="period-buttons">
          {(["today", "7d", "30d", "all"] as Period[]).map(p => (
            <button
              key={p}
              className={period === p ? "active" : ""}
              onClick={() => setPeriod(p)}
            >
              {p === "today"
                ? "Hoje"
                : p === "7d"
                ? "7 dias"
                : p === "30d"
                ? "30 dias"
                : "Tudo"}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="stats-grid">
        <StatCard
          title="Salas Criadas"
          value={summary?.roomsThisWeek ?? 0}
          subtitle="esta semana"
          growth={summary?.roomsGrowth}
          icon={<IconHome size={28} />}
        />
        <StatCard
          title="Músicas Tocadas"
          value={summary?.songsThisWeek ?? 0}
          subtitle="esta semana"
          growth={summary?.songsGrowth}
          icon={<IconMusic size={28} />}
        />
        <StatCard
          title="Usuários Únicos"
          value={summary?.totalUsers ?? 0}
          subtitle="total"
          icon={<IconUsers size={28} />}
        />
        <StatCard
          title="Média por Sala"
          value={summary?.avgSongsPerRoom ?? 0}
          subtitle="músicas/sala"
          icon={<IconBarChart size={28} />}
        />
      </div>

      {/* Totals Row */}
      <div className="totals-row">
        <div className="total-item">
          <span className="total-label">Total Salas</span>
          <span className="total-value">{summary?.totalRooms ?? 0}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Total Músicas</span>
          <span className="total-value">{summary?.totalSongsPlayed ?? 0}</span>
        </div>
        <div className="total-item">
          <span className="total-label">Hoje</span>
          <span className="total-value">
            {summary?.songsToday ?? 0} músicas
          </span>
        </div>
        <div className="total-item">
          <span className="total-label">Este Mês</span>
          <span className="total-value">
            {summary?.songsThisMonth ?? 0} músicas
          </span>
        </div>
      </div>

      {/* Active Rooms */}
      {activeRooms.length > 0 && (
        <section className="dashboard-section">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconRadio size={20} /> Salas Ativas Agora
          </h2>
          <div className="active-rooms-grid">
            {activeRooms.map(room => (
              <div key={room.code} className="active-room-card">
                <div className="room-code">{room.code}</div>
                <div className="room-info">
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <IconUsers size={14} /> {room.participantsCount} online
                  </span>
                  <span
                    style={{ display: "flex", alignItems: "center", gap: 4 }}
                  >
                    <IconList size={14} /> {room.queueLength} na fila
                  </span>
                </div>
                {room.nowPlaying && (
                  <div
                    className="now-playing-mini"
                    style={{ display: "flex", alignItems: "center", gap: 6 }}
                  >
                    <IconMic size={12} /> {room.nowPlaying.slice(0, 30)}...
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Charts Row */}
      <div className="charts-row">
        {/* Daily Chart */}
        <section className="dashboard-section chart-section">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconBarChart size={20} /> Atividade Diária
          </h2>
          <DailyChart data={data?.dailyStats || []} />
        </section>

        {/* Peak Hours */}
        <section className="dashboard-section chart-section">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconClock size={20} /> Horários de Pico
          </h2>
          <PeakHoursChart data={data?.peakHours || []} />
        </section>
      </div>

      {/* Top Content Row */}
      <div className="top-content-row">
        {/* Top Songs */}
        <section className="dashboard-section">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconTrophy size={20} /> Top Músicas
          </h2>
          <div className="top-list">
            {data?.topSongs.slice(0, 10).map((song, i) => (
              <div key={song.videoId} className="top-item">
                <span className="rank">{getRankBadge(i)}</span>
                <img
                  src={`https://i.ytimg.com/vi/${song.videoId}/default.jpg`}
                  alt=""
                  className="song-thumb"
                />
                <div className="song-info">
                  <span className="song-title">{song.title}</span>
                  <span className="play-count">{song.playCount}x tocada</span>
                </div>
                <div className="bar-container">
                  <div
                    className="bar"
                    style={{
                      width: `${
                        (song.playCount / (data?.topSongs[0]?.playCount || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {(!data?.topSongs || data.topSongs.length === 0) && (
              <p className="empty-state">Nenhuma música tocada ainda</p>
            )}
          </div>
        </section>

        {/* Top Users */}
        <section className="dashboard-section">
          <h2 style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <IconStar size={20} /> Top Cantores
          </h2>
          <div className="top-list">
            {data?.topUsers.slice(0, 10).map((user, i) => (
              <div key={user.name} className="top-item user-item">
                <span className="rank">{getRankBadge(i)}</span>
                <div className="user-avatar">{user.name[0]?.toUpperCase()}</div>
                <div className="user-info">
                  <span className="user-name">{user.name}</span>
                  <span className="song-count">{user.songCount} músicas</span>
                </div>
                <div className="bar-container">
                  <div
                    className="bar user-bar"
                    style={{
                      width: `${
                        (user.songCount / (data?.topUsers[0]?.songCount || 1)) *
                        100
                      }%`,
                    }}
                  />
                </div>
              </div>
            ))}
            {(!data?.topUsers || data.topUsers.length === 0) && (
              <p className="empty-state">Nenhum cantor ainda</p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// Components
// ─────────────────────────────────────────────────────────────

function StatCard({
  title,
  value,
  subtitle,
  growth,
  icon,
}: {
  title: string;
  value: number;
  subtitle: string;
  growth?: number;
  icon: React.ReactNode;
}) {
  return (
    <div className="stat-card">
      <div className="stat-icon">{icon}</div>
      <div className="stat-content">
        <div className="stat-value">{value.toLocaleString("pt-BR")}</div>
        <div className="stat-title">{title}</div>
        <div className="stat-subtitle">
          {subtitle}
          {growth !== undefined && (
            <span className={`growth ${growth >= 0 ? "positive" : "negative"}`}>
              {growth >= 0 ? "↑" : "↓"} {Math.abs(growth)}%
            </span>
          )}
        </div>
      </div>
    </div>
  );
}

function DailyChart({ data }: { data: DailyStats[] }) {
  if (data.length === 0) {
    return <p className="empty-state">Sem dados suficientes</p>;
  }

  const maxSongs = Math.max(...data.map(d => d.songs), 1);
  const last14Days = data.slice(-14);

  return (
    <div className="daily-chart">
      <div className="chart-bars">
        {last14Days.map(day => (
          <div key={day.date} className="chart-bar-wrapper">
            <div
              className="chart-bar"
              style={{ height: `${(day.songs / maxSongs) * 100}%` }}
              title={`${day.date}: ${day.songs} músicas, ${day.rooms} salas`}
            >
              <span className="bar-value">{day.songs}</span>
            </div>
            <span className="bar-label">
              {new Date(day.date).toLocaleDateString("pt-BR", {
                day: "2-digit",
                month: "2-digit",
              })}
            </span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
          <IconMusic size={14} /> Músicas por dia
        </span>
      </div>
    </div>
  );
}

function PeakHoursChart({ data }: { data: { hour: number; count: number }[] }) {
  if (data.length === 0) {
    return <p className="empty-state">Sem dados suficientes</p>;
  }

  const maxCount = Math.max(...data.map(d => d.count), 1);

  // Fill in missing hours
  const allHours = Array.from({ length: 24 }, (_, i) => {
    const found = data.find(d => d.hour === i);
    return { hour: i, count: found?.count || 0 };
  });

  return (
    <div className="peak-hours-chart">
      <div className="hours-grid">
        {allHours.map(({ hour, count }) => (
          <div
            key={hour}
            className="hour-cell"
            style={{
              backgroundColor: `rgba(255, 64, 129, ${count / maxCount})`,
            }}
            title={`${hour}h: ${count} músicas`}
          >
            <span className="hour-label">{hour}h</span>
          </div>
        ))}
      </div>
      <div className="chart-legend">
        <span>Intensidade = mais músicas tocadas</span>
      </div>
    </div>
  );
}

function getRankBadge(index: number) {
  const styles: Record<number, React.CSSProperties> = {
    0: {
      background: "linear-gradient(135deg, #ffd700, #ffb700)",
      color: "#000",
    },
    1: {
      background: "linear-gradient(135deg, #c0c0c0, #a0a0a0)",
      color: "#000",
    },
    2: {
      background: "linear-gradient(135deg, #cd7f32, #a0522d)",
      color: "#fff",
    },
  };

  const baseStyle: React.CSSProperties = {
    width: 24,
    height: 24,
    borderRadius: "50%",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: "bold",
    fontSize: 12,
    ...(styles[index] || { background: "#444", color: "#fff" }),
  };

  return <span style={baseStyle}>{index + 1}</span>;
}
