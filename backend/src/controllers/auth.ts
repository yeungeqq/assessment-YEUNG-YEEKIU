import { Router } from "express";
import { z } from "zod";
import {
  createLocalUser,
  loginLocalUser,
} from "../repositories/authRepository.js";

export const authRouter = Router();

const AUTH_SCHEMA = z.object({
  email: z.string().email(),
  password: z.string().min(6),
});

authRouter.post("/auth/login", async (req, res) => {
  const parsed = AUTH_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  const result = await loginLocalUser(parsed.data.email, parsed.data.password);
  if (!result) {
    return res.status(401).json({ error: "Invalid email or password" });
  }

  return res.json({
    data: {
      token: result.token,
      user: result.user,
    },
  });
});

authRouter.post("/auth/signup", async (req, res) => {
  const parsed = AUTH_SCHEMA.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }

  try {
    const result = await createLocalUser(parsed.data.email, parsed.data.password);

    return res.json({
      data: {
        token: result.token,
        user: result.user,
      },
    });
  } catch (e: any) {
    if (e?.code === "23505") {
      return res.status(409).json({ error: "An account already exists for this email" });
    }
    return res.status(500).json({ error: e?.message ?? "Signup failed" });
  }
});
