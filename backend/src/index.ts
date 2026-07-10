import "dotenv/config";
import express from "express";
import cors from "cors";
import { PORT } from "./config/server.js";
import "./config/database.js";
import { ensureDatabaseSchema } from "./config/database.js";
import { CORS_OPTIONS } from "./config/server.js";
import { chatRouter } from "./controllers/chat.js";
import { documentsRouter } from "./controllers/documents.js";
import { projectsRouter } from "./controllers/projects.js";
import { authRouter } from "./controllers/auth.js";
import { modelConfigRouter } from "./modules/model-config/model-config.routes.js";

const app = express();

await ensureDatabaseSchema();

app.use(cors(CORS_OPTIONS));
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

app.use(authRouter);
app.use(modelConfigRouter);
app.use(chatRouter);
app.use(documentsRouter);
app.use(projectsRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
