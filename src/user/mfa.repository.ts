import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { MfaEntity } from './mfa.entity';

@Injectable()
export class MfaRepository {
  constructor(
    @InjectRepository(MfaEntity)
    private readonly repo: Repository<MfaEntity>,
  ) {}

  async save(entity: MfaEntity): Promise<MfaEntity> {
    return this.repo.save(entity);
  }

  async findByUserId(userId: string): Promise<MfaEntity[]> {
    return this.repo.find({ where: { userId } });
  }

  async findTotpByUserId(userId: string): Promise<MfaEntity | null> {
    return this.repo.findOne({ where: { userId, type: 'totp' } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async deleteByUserIdAndType(userId: string, type: string): Promise<void> {
    await this.repo.delete({ userId, type });
  }
}
