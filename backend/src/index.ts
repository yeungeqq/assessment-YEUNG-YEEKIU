import "dotenv/config";
import express from "express";
import cors from "cors";
import { PORT } from "./config/server.js";
import "./config/supabase.js";
import { CORS_OPTIONS } from "./config/server.js";
import { chatRouter } from "./controllers/chat.js";
import { documentsRouter } from "./controllers/documents.js";

const app = express();

app.use(cors(CORS_OPTIONS));
app.options("*", cors());
app.use(express.json({ limit: "10mb" }));

app.use(chatRouter);
app.use(documentsRouter);

app.listen(PORT, () => {
  console.log(`Backend listening on http://localhost:${PORT}`);
});
