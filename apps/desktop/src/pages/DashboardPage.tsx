import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import * as API from "../Api";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default function DashboardPage() {
  const navigate = useNavigate();
  const [projects, setProjects] = useState<ProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [query, setQuery] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function loadProjects() {
    setLoading(true);
    setError(null);

    const { data, error } = await API.fetchProjects();
    if (error) setError(error.message);
    setProjects((data ?? []) as ProjectRow[]);
    setLoading(false);
  }

  useEffect(() => {
    void loadProjects();
  }, []);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return projects;

    return projects.filter((project) => {
      const nameText = project.name.toLowerCase();
      const descriptionText = (project.description ?? "").toLowerCase();
      return nameText.includes(needle) || descriptionText.includes(needle);
    });
  }, [projects, query]);

  async function createProject() {
    const cleanName = name.trim();
    if (!cleanName) {
      setError("Project name is required.");
      return;
    }

    setCreating(true);
    setError(null);

    try {
      const { data, error } = await API.createProject({
        name: cleanName,
        description: description.trim() || null,
      });

      if (error || !data) {
        throw new Error(error?.message ?? "Failed to create project.");
      }

      setName("");
      setDescription("");
      setOpen(false);
      navigate(`/projects/${(data as ProjectRow).id}`);
    } catch (e: any) {
      setError(e?.message ?? "Failed to create project.");
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 md:flex-row md:items-center">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">
            Group documents before chatting so CortexDocs can stay grounded in the right context.
          </p>
        </div>

        <button
          type="button"
          onClick={() => setOpen(true)}
          className="md:ml-auto rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          New Project
        </button>
      </div>

      <input
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Search projects..."
        className="h-11 w-full rounded-md border border-slate-200 bg-white px-4 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />

      {error && (
        <div className="rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {loading ? (
          <div className="text-sm text-slate-600">Loading projects...</div>
        ) : filtered.length === 0 ? (
          <div className="text-sm text-slate-600">No projects found.</div>
        ) : (
          filtered.map((project) => (
            <Link
              key={project.id}
              to={`/projects/${project.id}`}
              className="rounded-md border border-slate-200 bg-white p-5 shadow-sm transition hover:border-blue-200 hover:shadow-md"
            >
              <div className="text-lg font-semibold text-slate-900">{project.name}</div>
              <div className="mt-2 min-h-10 text-sm text-slate-600">
                {project.description || "No description"}
              </div>
              <div className="mt-5 text-xs text-slate-500">
                Updated {new Date(project.updated_at ?? project.created_at).toLocaleString()}
              </div>
            </Link>
          ))
        )}
      </div>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/30"
            onClick={() => (creating ? null : setOpen(false))}
          />
          <div className="relative mx-4 w-full max-w-lg rounded-lg border border-slate-200 bg-white p-6 shadow-xl">
            <div className="flex items-center">
              <h2 className="text-lg font-bold text-slate-900">New project</h2>
              <button
                type="button"
                className="ml-auto text-slate-400 hover:text-slate-600"
                onClick={() => (creating ? null : setOpen(false))}
              >
                x
              </button>
            </div>

            <div className="mt-5 space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Name</span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  className="mt-1 h-10 w-full rounded-md border border-slate-200 px-3 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              <label className="block">
                <span className="text-sm font-semibold text-slate-700">Description</span>
                <textarea
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                  rows={3}
                  className="mt-1 w-full rounded-md border border-slate-200 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={creating}
                className="rounded-md border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void createProject()}
                disabled={creating}
                className="rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
              >
                {creating ? "Creating..." : "Create"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
