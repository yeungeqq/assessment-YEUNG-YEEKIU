import type { CorsOptions } from "cors";

export const PORT = Number(process.env.PORT || 8080);

const ALLOWED_ORIGINS = new Set([
  "http://localhost:1420",
  "http://127.0.0.1:1420",
  "tauri://localhost",
]);

export const CORS_OPTIONS: CorsOptions = {
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin)) {
      callback(null, true);
      return;
    }

    callback(new Error(`Origin ${origin} is not allowed by CORS`));
  },
  credentials: true,
  allowedHeaders: ["Content-Type", "Authorization"],
  methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
};
