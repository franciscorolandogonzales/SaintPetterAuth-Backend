import { Injectable, UnauthorizedException } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { OneTimeLinkEntity, OneTimeLinkKind } from './one-time-link.entity';
import { OneTimeLinkRepository } from './one-time-link.repository';

/** Default TTL in seconds per link kind. */
const DEFAULT_TTL: Record<OneTimeLinkKind, number> = {
  password_reset: 3600,        // 1 hour
  email_verification: 86400,   // 24 hours
  invitation: 604800,          // 7 days
  mfa_setup: 3600,             // 1 hour
  mfa_recovery: 3600,          // 1 hour
};

export interface CreateLinkOptions {
  kind: OneTimeLinkKind;
  userId?: string;
  payload?: Record<string, unknown>;
  /** Override the default TTL in seconds for this link. */
  ttlSeconds?: number;
}

export interface ConsumeResult {
  kind: OneTimeLinkKind;
  userId: string | null;
  payload: Record<string, unknown> | null;
}

@Injectable()
export class OneTimeLinkService {
  constructor(private readonly repo: OneTimeLinkRepository) {}

  /**
   * Generate a one-time link token and persist the record.
   * Returns the opaque token to be embedded in the URL.
   */
  async create(options: CreateLinkOptions): Promise<string> {
    const token = randomBytes(64).toString('hex'); // 512 bits → URL-safe hex
    const ttl = options.ttlSeconds ?? DEFAULT_TTL[options.kind];

    const entity = new OneTimeLinkEntity();
    entity.token = token;
    entity.kind = options.kind;
    entity.userId = options.userId ?? null;
    entity.payload = options.payload ?? null;
    entity.expiresAt = new Date(Date.now() + ttl * 1000);
    entity.usedAt = null;

    await this.repo.save(entity);
    return token;
  }

  /**
   * Validate and consume a one-time token.
   * Throws UnauthorizedException if the token is unknown, expired, or already used.
   * Marks the link as used atomically on success.
   */
  async consume(token: string, expectedKind?: OneTimeLinkKind): Promise<ConsumeResult> {
    const link = await this.repo.findByToken(token);

    if (!link) {
      throw new UnauthorizedException('Invalid or expired link');
    }
    if (link.usedAt) {
      throw new UnauthorizedException('This link has already been used');
    }
    if (link.expiresAt < new Date()) {
      throw new UnauthorizedException('This link has expired');
    }
    if (expectedKind && link.kind !== expectedKind) {
      throw new UnauthorizedException('Invalid link type');
    }

    await this.repo.markUsed(link.id);

    return {
      kind: link.kind,
      userId: link.userId,
      payload: link.payload,
    };
  }

  /**
   * Validate a token without consuming it. Useful for previewing invite details.
   * Throws UnauthorizedException if the token is invalid, expired, or used.
   */
  async peek(token: string, expectedKind?: OneTimeLinkKind): Promise<ConsumeResult> {
    const link = await this.repo.findByToken(token);
    if (!link) throw new UnauthorizedException('Invalid or expired link');
    if (link.usedAt) throw new UnauthorizedException('This link has already been used');
    if (link.expiresAt < new Date()) throw new UnauthorizedException('This link has expired');
    if (expectedKind && link.kind !== expectedKind) throw new UnauthorizedException('Invalid link type');
    return { kind: link.kind, userId: link.userId, payload: link.payload };
  }

  /** Build a frontend URL for the given kind and token. */
  buildUrl(kind: OneTimeLinkKind, token: string): string {
    const baseUrl = process.env.FRONTEND_URL ?? 'http://localhost:5678';
    const paths: Record<OneTimeLinkKind, string> = {
      password_reset: '/password-reset/confirm',
      email_verification: '/auth/verify-email',
      invitation: '/invite/accept',
      mfa_setup: '/mfa/setup',
      mfa_recovery: '/mfa/recovery',
    };
    return `${baseUrl}${paths[kind]}?token=${token}`;
  }
}
