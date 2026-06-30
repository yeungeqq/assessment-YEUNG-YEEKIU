import { matchPath, useLocation } from "react-router-dom";
import ProjectCopilotSidebar from "../components/chat/ProjectCopilotSidebar";
import ProjectSidebar from "../components/layout/ProjectSidebar";

type Props = {
  children: React.ReactNode;
  authed: boolean;
  onSignOut?: () => void;
};

export default function AppLayout({ children, authed, onSignOut }: Props) {
  const location = useLocation();
  const projectMatch = matchPath("/projects/:projectId", location.pathname);
  const projectId = projectMatch?.params.projectId;

  if (!authed) {
    return (
      <div className="min-h-screen bg-slate-50">
        <main className="mx-auto w-full max-w-7xl px-6 py-12">{children}</main>
      </div>
    );
  }

  return (
    <div className="flex h-screen overflow-hidden bg-slate-50 text-slate-900">
      <ProjectSidebar onSignOut={onSignOut} />

      <main className="min-w-0 flex-1 overflow-y-auto">
        <div className="mx-auto w-full max-w-6xl px-8 py-8">{children}</div>
      </main>

      {projectId && <ProjectCopilotSidebar projectId={projectId} />}
    </div>
  );
}
