import type { CorsOptions } from "cors";

export const PORT = Number(process.env.PORT || 8080);

export const CORS_OPTIONS: CorsOptions = {
  origin: "http://localhost:5173",
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
