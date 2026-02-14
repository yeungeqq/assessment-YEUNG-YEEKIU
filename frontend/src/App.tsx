import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { useEffect, useState } from "react";
import { supabase } from "./supabaseClient";
import AppLayout from "./layout/AppLayout";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Upload from "./pages/Upload";
import Document from "./pages/Document";

function Protected({ children }: { children: JSX.Element }) {
  const [loading, setLoading] = useState(true);
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setAuthed(!!data.session);
      setLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  if (loading) return <div className="p-6">Loading...</div>;
  return authed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthed(!!data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((_event, session) => {
      setAuthed(!!session);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  async function signOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <AppLayout authed={authed} onSignOut={signOut}>
      <Routes>
        <Route path="/" element={<Navigate to="/chat" replace />} />
        <Route path="/login" element={<Login />} />
        <Route path="/signup" element={<Signup />} />
        <Route
          path="/chat"
          element={
            <Protected>
              <Chat />
            </Protected>
          }
        />
        <Route
          path="/document"
          element={
            <Protected>
              <Document />
            </Protected>
          }
        />
        <Route path="*" element={<Navigate to="/chat" replace />} />
      </Routes>
    </AppLayout>
  );
}