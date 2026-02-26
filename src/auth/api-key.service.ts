import { Injectable } from '@nestjs/common';
import { createHash, randomBytes } from 'crypto';
import { ApiKeyEntity } from '../user/api-key.entity';
import { ApiKeyRepository } from '../user/api-key.repository';

const API_KEY_PREFIX = 'spk_';

export interface GeneratedApiKey {
  rawKey: string;
  entity: ApiKeyEntity;
}

@Injectable()
export class ApiKeyService {
  constructor(private readonly apiKeyRepo: ApiKeyRepository) {}

  /**
   * Generate a new API key, persist it (hashed), and return the raw key.
   * The raw key is only available at this point — it is never stored or returned again.
   */
  async generateForUser(
    userId: string,
    name: string | null = null,
    expiresAt: Date | null = null,
  ): Promise<GeneratedApiKey> {
    const rawKey = API_KEY_PREFIX + randomBytes(32).toString('hex');
    const keyHash = this.hash(rawKey);
    const keyPrefix = rawKey.slice(0, 12);

    const entity = new ApiKeyEntity();
    entity.userId = userId;
    entity.keyHash = keyHash;
    entity.keyPrefix = keyPrefix;
    entity.name = name;
    entity.active = true;
    entity.expiresAt = expiresAt;
    entity.lastUsedAt = null;

    const saved = await this.apiKeyRepo.save(entity);
    return { rawKey, entity: saved };
  }

  /**
   * Look up a raw API key. Returns the entity if found, active, and not expired.
   * Updates lastUsedAt on success.
   */
  async findAndValidate(rawKey: string): Promise<ApiKeyEntity | null> {
    if (!rawKey.startsWith(API_KEY_PREFIX)) return null;
    const keyHash = this.hash(rawKey);
    const apiKey = await this.apiKeyRepo.findActiveByHash(keyHash);
    if (!apiKey) return null;
    if (apiKey.expiresAt && apiKey.expiresAt < new Date()) return null;
    void this.apiKeyRepo.updateLastUsed(apiKey.id).catch(() => undefined);
    return apiKey;
  }

  private hash(rawKey: string): string {
    return createHash('sha256').update(rawKey).digest('hex');
  }
}
