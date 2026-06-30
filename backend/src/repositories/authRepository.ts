import { query } from "../config/database.js";
import crypto from "node:crypto";

const AUTH_SECRET = process.env.AUTH_SECRET ?? "cortexdocs-local-dev-secret";
const TOKEN_TTL_MS = 1000 * 60 * 60 * 24 * 7;

type LocalTokenPayload = {
  sub: string;
  email: string | null;
  exp: number;
};

function base64url(input: Buffer | string) {
  return Buffer.from(input).toString("base64url");
}

function signPayload(payload: LocalTokenPayload) {
  const encoded = base64url(JSON.stringify(payload));
  const signature = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encoded)
    .digest("base64url");

  return `${encoded}.${signature}`;
}

function verifyLocalToken(token: string) {
  const [encoded, signature] = token.split(".");
  if (!encoded || !signature) return null;

  const expected = crypto
    .createHmac("sha256", AUTH_SECRET)
    .update(encoded)
    .digest("base64url");

  if (!crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) {
    return null;
  }

  const payload = JSON.parse(
    Buffer.from(encoded, "base64url").toString("utf8")
  ) as LocalTokenPayload;

  if (Date.now() > payload.exp) return null;
  return payload;
}

async function hashPassword(password: string, salt = crypto.randomBytes(16).toString("hex")) {
  const derived = await new Promise<Buffer>((resolve, reject) => {
    crypto.scrypt(password, salt, 64, (error, key) => {
      if (error) reject(error);
      else resolve(key);
    });
  });

  return `${salt}:${derived.toString("hex")}`;
}

async function verifyPassword(password: string, storedHash: string) {
  const [salt, hash] = storedHash.split(":");
  if (!salt || !hash) return false;

  const candidate = await hashPassword(password, salt);
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(storedHash));
}

export async function getUserFromToken(token: string) {
  const localPayload = verifyLocalToken(token);
  if (localPayload) {
    return {
      user: {
        id: localPayload.sub,
        email: localPayload.email ?? undefined,
      },
      error: null,
    };
  }

  return { user: null, error: { message: "Invalid token" } };
}

export async function createLocalUser(email: string, password: string) {
  const passwordHash = await hashPassword(password);
  const { rows } = await query(
    `insert into users (id, email, password_hash)
     values (gen_random_uuid(), $1, $2)
     returning id, email`,
    [email.toLowerCase(), passwordHash]
  );

  const user = rows[0];
  const token = signPayload({
    sub: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  return { user, token };
}

export async function loginLocalUser(email: string, password: string) {
  const { rows } = await query(
    `select id, email, password_hash
     from users
     where email = $1
     limit 1`,
    [email.toLowerCase()]
  );

  const user = rows[0];
  if (!user?.password_hash) return null;

  const valid = await verifyPassword(password, user.password_hash);
  if (!valid) return null;

  const token = signPayload({
    sub: user.id,
    email: user.email,
    exp: Date.now() + TOKEN_TTL_MS,
  });

  return {
    user: {
      id: user.id,
      email: user.email,
    },
    token,
  };
}
