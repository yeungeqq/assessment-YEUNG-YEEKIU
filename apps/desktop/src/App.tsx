import { Routes, Route, Navigate, useNavigate } from "react-router-dom";
import { Component, type ReactNode, useEffect, useState } from "react";
import AppLayout from "./layout/AppLayout";
import * as API from "./Api";

import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Chat from "./pages/Chat";
import Document from "./pages/Document";
import DashboardPage from "./pages/DashboardPage";
import ProjectPage from "./pages/ProjectPage";

class AppErrorBoundary extends Component<
  { children: ReactNode },
  { error: Error | null }
> {
  state: { error: Error | null } = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  render() {
    if (this.state.error) {
      return (
        <div className="min-h-screen bg-slate-50 p-8 text-slate-900">
          <div className="mx-auto max-w-2xl rounded-md border border-red-200 bg-white p-6 shadow-sm">
            <h1 className="text-lg font-bold text-red-700">CortexDocs AI crashed</h1>
            <p className="mt-3 text-sm text-slate-700">
              {this.state.error.message}
            </p>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

function Protected({
  children,
  authed,
  checkingAuth,
}: {
  children: JSX.Element;
  authed: boolean;
  checkingAuth: boolean;
}) {
  if (checkingAuth) return <div className="p-6">Loading...</div>;
  return authed ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const navigate = useNavigate();
  const [authed, setAuthed] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    API.getCurrentUser().then(({ data }) => {
      setAuthed(!!data.user);
      setCheckingAuth(false);
    });
  }, []);

  function handleAuthed() {
    setAuthed(true);
    navigate("/dashboard", { replace: true });
  }

  async function signOut() {
    await API.logout();
    setAuthed(false);
    navigate("/login");
  }

  return (
    <AppErrorBoundary>
      <AppLayout authed={authed} onSignOut={signOut}>
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/login" element={<Login onAuthed={handleAuthed} />} />
          <Route path="/signup" element={<Signup onAuthed={handleAuthed} />} />
          <Route
            path="/dashboard"
            element={
              <Protected authed={authed} checkingAuth={checkingAuth}>
                <DashboardPage />
              </Protected>
            }
          />
          <Route
            path="/projects/:projectId"
            element={
              <Protected authed={authed} checkingAuth={checkingAuth}>
                <ProjectPage />
              </Protected>
            }
          />
          <Route
            path="/chat"
            element={
              <Protected authed={authed} checkingAuth={checkingAuth}>
                <Chat />
              </Protected>
            }
          />
          <Route
            path="/document"
            element={
              <Protected authed={authed} checkingAuth={checkingAuth}>
                <Document />
              </Protected>
            }
          />
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </AppLayout>
    </AppErrorBoundary>
  );
}
