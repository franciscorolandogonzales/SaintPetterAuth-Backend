import { Injectable } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { RedisService } from '../redis/redis.service';

const ACCESS_TOKEN_PREFIX = 'at:';
const REFRESH_TOKEN_PREFIX = 'rt:';
const ACCESS_TTL_SECONDS = 900; // 15 min
const REFRESH_TTL_SECONDS = 60 * 60 * 24 * 7; // 7 days

@Injectable()
export class TokenService {
  constructor(private readonly redis: RedisService) {}

  generateOpaqueToken(): string {
    return randomBytes(32).toString('hex');
  }

  async storeAccessToken(token: string, userId: string, sessionId: string): Promise<void> {
    await this.redis.set(
      ACCESS_TOKEN_PREFIX + token,
      JSON.stringify({ userId, sessionId }),
      ACCESS_TTL_SECONDS,
    );
  }

  async storeRefreshToken(token: string, userId: string, sessionId: string): Promise<void> {
    await this.redis.set(
      REFRESH_TOKEN_PREFIX + token,
      JSON.stringify({ userId, sessionId }),
      REFRESH_TTL_SECONDS,
    );
  }

  async resolveAccessToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
    const raw = await this.redis.get(ACCESS_TOKEN_PREFIX + token);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { userId: string; sessionId: string };
    } catch {
      return null;
    }
  }

  async resolveRefreshToken(token: string): Promise<{ userId: string; sessionId: string } | null> {
    const raw = await this.redis.get(REFRESH_TOKEN_PREFIX + token);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as { userId: string; sessionId: string };
    } catch {
      return null;
    }
  }

  async revokeAccessToken(token: string): Promise<void> {
    const key = ACCESS_TOKEN_PREFIX + token;
    const client = this.redis.getClient();
    if (client) await client.del(key);
  }

  async revokeRefreshToken(token: string): Promise<void> {
    const key = REFRESH_TOKEN_PREFIX + token;
    const client = this.redis.getClient();
    if (client) await client.del(key);
  }
}
