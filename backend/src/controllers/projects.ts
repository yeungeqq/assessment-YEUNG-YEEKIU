import { Router } from "express";
import { z } from "zod";
import { requireUser } from "../middleware/requireUser.js";
import {
  createFolderRecord,
  createProjectRecord,
  findProjectByIdAndUser,
  listFoldersByProject,
  listProjectsByUser,
} from "../repositories/projectRepository.js";

export const projectsRouter = Router();

const CREATE_PROJECT_SCHEMA = z.object({
  name: z.string().min(1).max(160),
  description: z.string().max(2000).nullable().optional(),
});

const CREATE_FOLDER_SCHEMA = z.object({
  name: z.string().min(1).max(160),
  parentFolderId: z.string().uuid().nullable().optional(),
});

projectsRouter.get("/projects", requireUser, async (req, res) => {
  try {
    const projects = await listProjectsByUser(req.userId!);
    return res.json({ data: projects });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load projects" });
  }
});

projectsRouter.post("/projects", requireUser, async (req, res) => {
  const parsed = CREATE_PROJECT_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const project = await createProjectRecord({
      userId: req.userId!,
      name: parsed.data.name,
      description: parsed.data.description ?? null,
    });
    return res.status(201).json({ data: project });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to create project" });
  }
});

projectsRouter.get("/projects/:projectId", requireUser, async (req, res) => {
  try {
    const { project } = await findProjectByIdAndUser(
      req.params.projectId,
      req.userId!
    );
    if (!project) return res.status(404).json({ error: "Project not found" });
    return res.json({ data: project });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load project" });
  }
});

projectsRouter.get("/projects/:projectId/folders", requireUser, async (req, res) => {
  try {
    const { project } = await findProjectByIdAndUser(
      req.params.projectId,
      req.userId!
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const folders = await listFoldersByProject(req.params.projectId, req.userId!);
    return res.json({ data: folders });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to load folders" });
  }
});

projectsRouter.post("/projects/:projectId/folders", requireUser, async (req, res) => {
  const parsed = CREATE_FOLDER_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const { project } = await findProjectByIdAndUser(
      req.params.projectId,
      req.userId!
    );
    if (!project) return res.status(404).json({ error: "Project not found" });

    const folder = await createFolderRecord({
      userId: req.userId!,
      projectId: req.params.projectId,
      name: parsed.data.name,
      parentFolderId: parsed.data.parentFolderId ?? null,
    });

    return res.status(201).json({ data: folder });
  } catch (e: any) {
    return res.status(500).json({ error: e?.message ?? "Failed to create folder" });
  }
});
