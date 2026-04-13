import { Routes, Route, Navigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { isAuthenticated, setToken } from "./lib/api";
import Layout from "./components/Layout";
import Dashboard from "./pages/Dashboard";
import ProspectDetail from "./pages/ProspectDetail";
import Outreach from "./pages/Outreach";
import Chat from "./pages/Chat";
import FindProspects from "./pages/FindProspects";
import SignalIntel from "./pages/SignalIntel";
import Login from "./pages/Login";

function RequireAuth({ children }: { children: React.ReactNode }) {
  const [checking, setChecking] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    if (isAuthenticated()) {
      setAuthed(true);
      setChecking(false);
      return;
    }
    fetch("/api/health")
      .then((r) => r.json())
      .then((data) => {
        if (!data.authRequired) {
          setToken("dev-mode");
          setAuthed(true);
        }
      })
      .catch(() => {})
      .finally(() => setChecking(false));
  }, []);

  if (checking) return null;
  if (!authed) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <Layout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/prospect/:index" element={<ProspectDetail />} />
        <Route path="/outreach/:index" element={<Outreach />} />
        <Route path="/chat" element={<Chat />} />
        <Route path="/find" element={<FindProspects />} />
        <Route path="/signals" element={<SignalIntel />} />
      </Route>
    </Routes>
  );
}
