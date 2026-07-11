// src/Api.tsx
const BACKEND_URL = import.meta.env.VITE_BACKEND_URL as string;
const LOCAL_TOKEN_KEY = "cortexdocs.localToken";
const LOCAL_USER_KEY = "cortexdocs.localUser";

type LocalAuthResponse = {
  token: string;
  user: { id: string; email?: string | null };
};

export type ModelConfig = {
  id: string;
  provider: string;
  label: string;
  model: string;
  capability: "llm" | "embedding";
  enabled: boolean;
  dimensions?: number;
  baseUrl?: string;
};

export type ModelConfigResponse = {
  defaults: {
    llmModelId: string;
    embeddingModelId: string;
  };
  llm: ModelConfig[];
  embedding: ModelConfig[];
};

function clearLocalAuth() {
  localStorage.removeItem(LOCAL_TOKEN_KEY);
  localStorage.removeItem(LOCAL_USER_KEY);
  window.dispatchEvent(new Event("cortexdocs-auth-cleared"));
}

function errorMessage(error: unknown, fallback = "Request failed") {
  if (typeof error === "string") return error;
  if (error && typeof error === "object") {
    const maybeMessage = (error as { message?: unknown }).message;
    if (typeof maybeMessage === "string") return maybeMessage;

    const fieldErrors = (error as { fieldErrors?: Record<string, string[]> })
      .fieldErrors;
    if (fieldErrors && typeof fieldErrors === "object") {
      const messages = Object.values(fieldErrors).flat().filter(Boolean);
      if (messages.length > 0) return messages.join(" ");
    }
  }

  return fallback;
}

// AUTH
export async function login(email: string, password: string) {
  const result = await publicBackendRequest<LocalAuthResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.error) return result;
  if (!result.data?.token) {
    return {
      data: result.data,
      error: { message: "Login failed because no token was returned." },
    };
  }

  localStorage.setItem(LOCAL_TOKEN_KEY, result.data.token);
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(result.data.user));
  return { data: result.data, error: null };
}

export async function signup(email: string, password: string) {
  const result = await publicBackendRequest<LocalAuthResponse>("/auth/signup", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });

  if (result.error) return result;
  if (!result.data?.token) {
    return {
      data: result.data,
      error: { message: "Signup failed because no token was returned." },
    };
  }

  localStorage.setItem(LOCAL_TOKEN_KEY, result.data.token);
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(result.data.user));
  return { data: result.data, error: null };
}

export async function getCurrentUser() {
  const localUser = localStorage.getItem(LOCAL_USER_KEY);
  if (localUser) {
    try {
      return { data: { user: JSON.parse(localUser) }, error: null };
    } catch {
      clearLocalAuth();
      return { data: { user: null }, error: null };
    }
  }

  return { data: { user: null }, error: null };
}

export async function logout() {
  clearLocalAuth();
}

export async function getSessionToken() {
  const localToken = localStorage.getItem(LOCAL_TOKEN_KEY);
  if (localToken) return localToken;

  return null;
}

async function publicBackendRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers: {
        "Content-Type": "application/json",
        ...(options.headers ?? {}),
      },
    });

    const json = await res.json().catch(() => ({}));
    if (!res.ok) {
      return {
        data: null,
        error: { message: errorMessage((json as any)?.error) },
      };
    }

    return { data: ((json as any).data ?? json) as T, error: null };
  } catch (e: any) {
    return {
      data: null,
      error: {
        message: `Cannot reach backend at ${BACKEND_URL}. Start the backend/PostgreSQL services, then try again. (${e?.message ?? "request failed"})`,
      },
    };
  }
}

async function backendRequest<T>(
  path: string,
  options: RequestInit = {}
): Promise<{ data: T | null; error: { message: string } | null }> {
  const token = await getSessionToken();
  if (!token) return { data: null, error: { message: "Not authenticated" } };

  const res = await fetch(`${BACKEND_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
      ...(options.headers ?? {}),
    },
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearLocalAuth();
    return {
      data: null,
      error: { message: "Session expired. Please log in again." },
    };
  }

  if (!res.ok) {
    return {
      data: null,
      error: { message: errorMessage((json as any)?.error) },
    };
  }

  return { data: ((json as any).data ?? json) as T, error: null };
}

// CHATS
export async function fetchChats(projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return backendRequest<any[]>(`/chats${qs}`);
}

export async function fetchMessages(chatId: string) {
  return backendRequest<any[]>(`/chats/${chatId}/messages`);
}

export async function createChat(title: string, projectId?: string) {
  return backendRequest<any>("/chats", {
    method: "POST",
    body: JSON.stringify({ title, projectId: projectId ?? null }),
  });
}

export async function removeChat(chatId: string) {
  return backendRequest<{ ok: boolean }>(`/chats/${chatId}`, {
    method: "DELETE",
  });
}

export async function updateChatTitle(chatId: string, title: string) {
  return backendRequest<any>(`/chats/${chatId}`, {
    method: "PATCH",
    body: JSON.stringify({ title }),
  });
}

export async function sendMessage(
  chatId: string,
  message: string,
  projectId?: string,
  modelConfig?: {
    llmModelId?: string;
    embeddingModelId?: string;
  }
) {
  const token = await getSessionToken();
  if (!token) throw new Error("Not authenticated");

  const res = await fetch(`${BACKEND_URL}/chat`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ chatId, message, projectId, ...modelConfig }),
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearLocalAuth();
    throw new Error("Session expired. Please log in again.");
  }

  if (!res.ok) throw new Error(errorMessage((json as any)?.error));
  return json as { answer?: string };
}

// MODEL CONFIG
export async function fetchModelConfig() {
  return backendRequest<ModelConfigResponse>("/model-config");
}

// PROJECTS
export async function fetchProjects() {
  return backendRequest<any[]>("/projects");
}

export async function fetchProject(projectId: string) {
  return backendRequest<any>(`/projects/${projectId}`);
}

export async function createProject(input: {
  name: string;
  description?: string | null;
}) {
  return backendRequest<any>("/projects", {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      description: input.description ?? null,
    }),
  });
}

export async function fetchProjectFolders(projectId: string) {
  return backendRequest<any[]>(`/projects/${projectId}/folders`);
}

export async function createProjectFolder(input: {
  project_id: string;
  name: string;
  parent_folder_id?: string | null;
}) {
  return backendRequest<any>(`/projects/${input.project_id}/folders`, {
    method: "POST",
    body: JSON.stringify({
      name: input.name,
      parentFolderId: input.parent_folder_id ?? null,
    }),
  });
}

// DOCUMENTS
export async function fetchDocuments(projectId?: string) {
  const qs = projectId ? `?projectId=${encodeURIComponent(projectId)}` : "";
  return backendRequest<any[]>(`/documents${qs}`);
}

export async function deleteDocumentRow(documentId: string) {
  return backendRequest<{ ok: boolean }>(`/documents/${documentId}`, {
    method: "DELETE",
  });
}

export async function uploadDocumentFile(input: {
  file: File;
  projectId?: string | null;
  folderId?: string | null;
  title: string;
  mimeType: string | null;
}) {
  const token = await getSessionToken();
  if (!token) return { data: null, error: { message: "Not authenticated" } };

  const params = new URLSearchParams({
    title: input.title,
  });
  if (input.projectId) params.set("projectId", input.projectId);
  if (input.folderId) params.set("folderId", input.folderId);
  if (input.mimeType) params.set("mimeType", input.mimeType);

  const res = await fetch(`${BACKEND_URL}/documents/upload?${params.toString()}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": input.mimeType || "application/octet-stream",
    },
    body: await input.file.arrayBuffer(),
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearLocalAuth();
    return {
      data: null,
      error: { message: "Session expired. Please log in again." },
    };
  }

  if (!res.ok) {
    return { data: null, error: { message: errorMessage((json as any)?.error) } };
  }

  return { data: (json as any).data as { id: string; file_path: string }, error: null };
}

export async function createDownloadUrl(documentId: string) {
  return backendRequest<{ signedUrl: string }>(
    `/documents/${documentId}/download-url`
  );
}

export async function fetchDocumentTextPreview(documentId: string) {
  return backendRequest<{ text: string }>(`/documents/${documentId}/text-preview`);
}

export async function fetchDocumentFileBlob(documentId: string) {
  const token = await getSessionToken();
  if (!token) return { data: null, error: { message: "Not authenticated" } };

  const res = await fetch(`${BACKEND_URL}/documents/${documentId}/file`, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });

  if (res.status === 401) {
    clearLocalAuth();
    return {
      data: null,
      error: { message: "Session expired. Please log in again." },
    };
  }

  if (!res.ok) {
    const json = await res.json().catch(() => ({}));
    return {
      data: null,
      error: { message: errorMessage((json as any)?.error, "Failed to load document.") },
    };
  }

  return { data: await res.blob(), error: null };
}

export async function fetchDocumentAnnotations<T = unknown>(documentId: string) {
  return backendRequest<{ annotations: T[] }>(
    `/documents/${documentId}/annotations`
  );
}

export async function saveDocumentAnnotations<T = unknown>(
  documentId: string,
  annotations: T[]
) {
  return backendRequest<{ annotations: T[] }>(
    `/documents/${documentId}/annotations`,
    {
      method: "PUT",
      body: JSON.stringify({ annotations }),
    }
  );
}

export async function replaceDocumentFile(documentId: string, file: File) {
  const token = await getSessionToken();
  if (!token) return { data: null, error: { message: "Not authenticated" } };

  const res = await fetch(`${BACKEND_URL}/documents/${documentId}/file`, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": file.type || "application/octet-stream",
    },
    body: await file.arrayBuffer(),
  });

  const json = await res.json().catch(() => ({}));
  if (res.status === 401) {
    clearLocalAuth();
    return {
      data: null,
      error: { message: "Session expired. Please log in again." },
    };
  }

  if (!res.ok) {
    return {
      data: null,
      error: { message: errorMessage((json as any)?.error) },
    };
  }

  return {
    data: (json as any).data ?? ({ chunks: (json as any).chunks ?? 0 } as { chunks: number }),
    error: null,
  };
}

export async function callIngest(documentId: string, projectId?: string) {
  const token = await getSessionToken();
  if (!token) throw new Error("Not authenticated");

  const resp = await fetch(`${BACKEND_URL}/documents/ingest`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ documentId, projectId }),
  });

  const body = await resp.json().catch(() => ({}));
  if (resp.status === 401) {
    clearLocalAuth();
    throw new Error("Session expired. Please log in again.");
  }

  if (!resp.ok) throw new Error((body as any)?.error ?? "Ingest failed");
  return body as { ok?: boolean; chunks?: number };
}
