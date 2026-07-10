import { Router } from "express";
import { requireUser } from "../../middleware/requireUser.js";
import { listModelConfig } from "./model-config.service.js";

export const modelConfigRouter = Router();

modelConfigRouter.get("/model-config", requireUser, (_req, res) => {
  return res.json({ data: listModelConfig() });
});
