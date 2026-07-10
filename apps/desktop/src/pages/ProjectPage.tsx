import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import Document from "./Document";
import * as API from "../Api";

type ProjectRow = {
  id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
};

export default function ProjectPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const [project, setProject] = useState<ProjectRow | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewingDocument, setPreviewingDocument] = useState(false);

  async function loadProject() {
    if (!projectId) return;
    setError(null);

    const projectResult = await API.fetchProject(projectId);
    if (projectResult.error) {
      setError(projectResult.error.message);
      return;
    }

    setProject(projectResult.data as ProjectRow);
  }

  useEffect(() => {
    void loadProject();
  }, [projectId]);

  if (!projectId) {
    return <div className="text-sm text-slate-600">Missing project ID.</div>;
  }

  return (
    <div className="min-h-full">
      {!previewingDocument && (
        <div className="px-8 py-8 pb-6">
          <div className="text-sm font-semibold text-slate-500">Project</div>
          <h1 className="mt-1 text-2xl font-bold text-slate-900">
            {project?.name ?? "Project"}
          </h1>
          {project?.description && (
            <p className="mt-1 max-w-3xl text-sm text-slate-600">
              {project.description}
            </p>
          )}

          {error && (
            <div className="mt-4 rounded-md border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
              {error}
            </div>
          )}
        </div>
      )}

      <Document onPreviewChange={setPreviewingDocument} />
    </div>
  );
}
