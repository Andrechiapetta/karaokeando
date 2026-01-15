import { useState } from "react";
import { useNavigate } from "react-router-dom";

export default function Home() {
  const navigate = useNavigate();
  const [joinCode, setJoinCode] = useState("");
  const [name, setName] = useState(() => {
    // Pre-fill with saved name if exists
    return localStorage.getItem("karaokeando_name") || "";
  });
  const [loading, setLoading] = useState(false);

  const createRoom = async () => {
    setLoading(true);
    const res = await fetch("/api/rooms", { method: "POST" });
    const data = await res.json();
    setLoading(false);
    if (data.roomCode) {
      // Host goes to TV view
      navigate(`/room/${data.roomCode}/tv`);
    }
  };

  const joinRoom = () => {
    const code = joinCode.trim().toUpperCase();
    if (code.length >= 4) {
      // Save name in localStorage for persistence
      if (name.trim()) {
        localStorage.setItem("karaokeando_name", name.trim());
      }
      navigate(`/room/${code}`);
    }
  };

  return (
    <div className="container" style={{ paddingTop: 60 }}>
      <h1 style={{ textAlign: "center", fontSize: "2.5rem" }}>
        🎤 Karaokêando
      </h1>
      <p style={{ textAlign: "center", color: "#888", marginBottom: 40 }}>
        Karaokê em grupo, direto do celular
      </p>

      <div className="card">
        <h2>Criar sala (Host)</h2>
        <button
          onClick={createRoom}
          disabled={loading}
          style={{ width: "100%" }}
        >
          {loading ? "Criando..." : "Criar nova sala"}
        </button>
      </div>

      <div className="card">
        <h2>Entrar em sala</h2>
        <input
          placeholder="Seu nome"
          value={name}
          onChange={e => setName(e.target.value)}
          style={{ marginBottom: 12 }}
        />
        <input
          placeholder="Código da sala (ex: ABC12)"
          value={joinCode}
          onChange={e => setJoinCode(e.target.value.toUpperCase())}
          style={{ marginBottom: 12 }}
        />
        <button
          onClick={joinRoom}
          disabled={joinCode.length < 4}
          style={{ width: "100%" }}
        >
          Entrar
        </button>
      </div>
    </div>
  );
}
