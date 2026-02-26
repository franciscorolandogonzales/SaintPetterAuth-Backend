import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ApiKeyEntity } from './api-key.entity';

@Injectable()
export class ApiKeyRepository {
  constructor(
    @InjectRepository(ApiKeyEntity)
    private readonly repo: Repository<ApiKeyEntity>,
  ) {}

  async save(apiKey: ApiKeyEntity): Promise<ApiKeyEntity> {
    return this.repo.save(apiKey);
  }

  async findActiveByHash(keyHash: string): Promise<ApiKeyEntity | null> {
    return this.repo.findOne({
      where: { keyHash, active: true },
    });
  }

  async findByUser(userId: string): Promise<ApiKeyEntity[]> {
    return this.repo.find({ where: { userId }, order: { createdAt: 'DESC' } });
  }

  async findById(id: string): Promise<ApiKeyEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async revoke(id: string): Promise<void> {
    await this.repo.update({ id }, { active: false });
  }

  async updateLastUsed(id: string): Promise<void> {
    await this.repo.update({ id }, { lastUsedAt: new Date() });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
