import bcrypt from 'bcryptjs';
import { SignJWT, jwtVerify, type JWTPayload } from 'jose';
import { db } from '../db/index.js';

const SALT_ROUNDS = 12;
const SESSION_DURATION_HOURS = parseInt(process.env.SESSION_DURATION_HOURS || '24', 10);

function getJwtSecret(): Uint8Array {
  const secret = process.env.JWT_SECRET;
  if (!secret) {
    const encoded = new TextEncoder().encode('dev-secret-do-not-use-in-production');
    return encoded;
  }
  return new TextEncoder().encode(secret);
}

interface JwtPayload extends JWTPayload {
  userId: string;
  email: string;
  role?: string;
}

export const authService = {
  async hashPassword(password: string): Promise<string> {
    return bcrypt.hash(password, SALT_ROUNDS);
  },

  async verifyPassword(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  },

  async createToken(payload: { userId: string; email: string }): Promise<string> {
    const token = await new SignJWT(payload satisfies JwtPayload)
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${SESSION_DURATION_HOURS}h`)
      .sign(getJwtSecret());

    return token;
  },

  async verifyToken(token: string): Promise<JwtPayload | null> {
    try {
      const { payload } = await jwtVerify(token, getJwtSecret());
      return payload as JwtPayload;
    } catch {
      return null;
    }
  },

  async register(params: { email: string; password: string; name: string }) {
    const passwordHash = await this.hashPassword(params.password);

    if (db.connected) {
      const existing = await db.queryOne<{ id: string }>(
        'SELECT id FROM users WHERE email = $1',
        [params.email],
      );
      if (existing) throw new Error('Email already registered');

      const user = await db.queryOne<{
        id: string;
        email: string;
        name: string;
        avatar_url: string | null;
        auth_provider: string;
        created_at: string;
      }>(
        `INSERT INTO users (email, password_hash, name, auth_provider, created_at)
         VALUES ($1, $2, $3, 'email', now())
         RETURNING id, email, name, avatar_url, auth_provider, created_at`,
        [params.email, passwordHash, params.name],
      );
      if (!user) throw new Error('Failed to create user');

      const token = await this.createToken({ userId: user.id, email: user.email });
      return {
        token,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatar_url,
          authProvider: user.auth_provider as 'email',
          createdAt: user.created_at,
        },
      };
    }

    const user = {
      id: crypto.randomUUID(),
      email: params.email,
      name: params.name,
      avatarUrl: null,
      authProvider: 'email' as const,
      createdAt: new Date().toISOString(),
    };
    const token = await this.createToken({ userId: user.id, email: user.email });
    return { token, user };
  },

  async login(params: { email: string; password: string }) {
    if (db.connected) {
      const row = await db.queryOne<{
        id: string;
        email: string;
        name: string;
        password_hash: string;
        avatar_url: string | null;
        auth_provider: string;
        created_at: string;
      }>(
        'SELECT id, email, name, password_hash, avatar_url, auth_provider, created_at FROM users WHERE email = $1',
        [params.email],
      );
      if (!row) throw new Error('Invalid email or password');

      const valid = await this.verifyPassword(params.password, row.password_hash);
      if (!valid) throw new Error('Invalid email or password');

      const token = await this.createToken({ userId: row.id, email: row.email });
      return {
        token,
        user: {
          id: row.id,
          email: row.email,
          name: row.name,
          avatarUrl: row.avatar_url,
          authProvider: row.auth_provider as 'email',
          createdAt: row.created_at,
        },
      };
    }

    const token = await this.createToken({ userId: 'in-memory', email: params.email });
    return {
      token,
      user: {
        id: crypto.randomUUID(),
        email: params.email,
        name: params.email.split('@')[0] || 'User',
        avatarUrl: null,
        authProvider: 'email' as const,
        createdAt: new Date().toISOString(),
      },
    };
  },

  async validateSession(token: string) {
    const payload = await this.verifyToken(token);
    if (!payload) return null;
    return { valid: true, userId: payload.userId, email: payload.email };
  },
};
