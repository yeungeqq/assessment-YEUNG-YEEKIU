import { useEffect, useMemo, useState } from "react";
import { NavLink, useLocation, useNavigate } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  FolderKanban,
  LogOut,
  Plus,
  Search,
} from "lucide-react";
import * as API from "../../Api";

const COLLAPSED_WIDTH = 64;
const DEFAULT_WIDTH = 320;
const MIN_WIDTH = 240;
const MAX_WIDTH = 520;

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

type ProjectSidebarProps = {
  onSignOut?: () => void;
};

export default function ProjectSidebar({ onSignOut }: ProjectSidebarProps) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [width, setWidth] = useState(DEFAULT_WIDTH);
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [query, setQuery] = useState("");
  const [creating, setCreating] = useState(false);
  const [projectName, setProjectName] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    const { data, error } = await API.fetchProjects();
    if (error) {
      setError(error.message);
      return;
    }

    setProjects((data ?? []) as ProjectRow[]);
  }

  useEffect(() => {
    void loadProjects();
  }, [location.pathname]);

  const filteredProjects = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;
    return projects.filter((project) => project.name.toLowerCase().includes(needle));
  }, [projects, query]);

  async function createProject() {
    const cleanName = projectName.trim();
    if (!cleanName) return;

    setCreating(true);
    setError(null);

    try {
      const { data, error } = await API.createProject({
        name: cleanName,
        description: null,
      });

      if (error || !data) throw new Error(error?.message ?? "Failed to create project.");

      const project = data as ProjectRow;
      setProjectName("");
      setProjects((prev) => [project, ...prev.filter((item) => item.id !== project.id)]);
      navigate(`/projects/${project.id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  function startResize(event: React.PointerEvent<HTMLDivElement>) {
    event.preventDefault();
    const startX = event.clientX;
    const startWidth = width;

    function onPointerMove(moveEvent: PointerEvent) {
      const nextWidth = startWidth + moveEvent.clientX - startX;
      setWidth(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, nextWidth)));
    }

    function onPointerUp() {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
      document.body.style.cursor = "";
      document.body.style.userSelect = "";
    }

    document.body.style.cursor = "col-resize";
    document.body.style.userSelect = "none";
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  return (
    <aside
      className="relative flex h-full shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-200"
      style={{ width: collapsed ? COLLAPSED_WIDTH : width }}
    >
      <div className="flex h-16 items-center gap-3 border-b border-slate-200 px-4">
        {!collapsed && (
          <button
            type="button"
            onClick={() => navigate("/dashboard")}
            className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm hover:bg-slate-50"
            aria-label="Go to home"
            title="Go to home"
          >
            <img
              src="/logo.png"
              alt="CortexDocs AI Logo"
              className="h-9 w-9 object-contain"
              draggable={false}
            />
          </button>
        )}
        {!collapsed && (
          <div className="min-w-0">
            <div className="truncate text-sm font-bold text-slate-900">
              CortexDocs AI
            </div>
            <div className="text-xs text-slate-500">Projects</div>
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((value) => !value)}
          className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-md border border-slate-200 text-slate-600 hover:bg-slate-50"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      {!collapsed && (
        <div className="border-b border-slate-200 p-4">
          <div className="relative">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search projects"
              className="h-10 w-full rounded-md border border-slate-200 bg-slate-50 pl-9 pr-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
            />
          </div>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto px-3 py-3">
        {collapsed ? (
          <div className="space-y-2">
            {projects.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  [
                    "flex h-10 w-10 items-center justify-center rounded-md",
                    isActive
                      ? "bg-blue-600 text-white"
                      : "text-slate-600 hover:bg-slate-100",
                  ].join(" ")
                }
                title={project.name}
              >
                <FolderKanban size={18} />
              </NavLink>
            ))}
          </div>
        ) : (
          <div className="space-y-1">
            {error && (
              <div className="mb-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
                {error}
              </div>
            )}

            {filteredProjects.map((project) => (
              <NavLink
                key={project.id}
                to={`/projects/${project.id}`}
                className={({ isActive }) =>
                  [
                    "block rounded-md px-3 py-2 text-sm transition",
                    isActive
                      ? "bg-blue-50 font-semibold text-blue-700"
                      : "text-slate-700 hover:bg-slate-100",
                  ].join(" ")
                }
              >
                <div className="truncate">{project.name}</div>
              </NavLink>
            ))}

            {filteredProjects.length === 0 && (
              <div className="px-3 py-3 text-sm text-slate-500">No projects found.</div>
            )}

            <div className="pt-3">
              <div className="flex gap-2">
                <input
                  value={projectName}
                  onChange={(event) => setProjectName(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") void createProject();
                  }}
                  placeholder="New project"
                  className="h-10 min-w-0 flex-1 rounded-md border border-slate-200 px-3 text-sm outline-none focus:border-blue-400 focus:ring-2 focus:ring-blue-100"
                />
                <button
                  type="button"
                  onClick={() => void createProject()}
                  disabled={creating || !projectName.trim()}
                  className="inline-flex h-10 w-10 items-center justify-center rounded-md bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                  aria-label="Add project"
                  title="Add project"
                >
                  <Plus size={18} />
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <div className="border-t border-slate-200 p-3">
        <button
          type="button"
          onClick={onSignOut}
          className={[
            "flex h-10 items-center rounded-md text-sm font-semibold text-slate-700 hover:bg-slate-100",
            collapsed ? "w-10 justify-center" : "w-full gap-2 px-3",
          ].join(" ")}
          aria-label="Log out"
          title="Log out"
        >
          <LogOut size={18} />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>

      {!collapsed && (
        <div
          role="separator"
          aria-orientation="vertical"
          aria-label="Resize project sidebar"
          onPointerDown={startResize}
          className="absolute right-[-3px] top-0 z-20 h-full w-1.5 cursor-col-resize bg-transparent transition hover:bg-blue-400/50"
        />
      )}
    </aside>
  );
}
