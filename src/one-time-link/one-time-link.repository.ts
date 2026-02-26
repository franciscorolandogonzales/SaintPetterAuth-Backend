import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OneTimeLinkEntity } from './one-time-link.entity';

@Injectable()
export class OneTimeLinkRepository {
  constructor(
    @InjectRepository(OneTimeLinkEntity)
    private readonly repo: Repository<OneTimeLinkEntity>,
  ) {}

  async save(entity: OneTimeLinkEntity): Promise<OneTimeLinkEntity> {
    return this.repo.save(entity);
  }

  async findByToken(token: string): Promise<OneTimeLinkEntity | null> {
    return this.repo.findOne({ where: { token } });
  }

  async markUsed(id: string): Promise<void> {
    await this.repo.update({ id }, { usedAt: new Date() });
  }

  /** Clean up expired links (optional housekeeping). */
  async deleteExpired(): Promise<void> {
    await this.repo
      .createQueryBuilder()
      .delete()
      .where('expiresAt < :now', { now: new Date() })
      .execute();
  }
}
