import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import RoomTV from "./pages/RoomTV";
import RoomMobile from "./pages/RoomMobile";
import Dashboard from "./pages/Dashboard";
import "./index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/room/:code/tv" element={<RoomTV />} />
        <Route path="/room/:code" element={<RoomMobile />} />
        <Route path="/admin" element={<Dashboard />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>
);
