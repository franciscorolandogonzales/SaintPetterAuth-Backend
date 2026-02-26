import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { SessionEntity } from './session.entity';

@Injectable()
export class SessionRepository {
  constructor(
    @InjectRepository(SessionEntity)
    private readonly repo: Repository<SessionEntity>,
  ) {}

  async save(session: SessionEntity): Promise<SessionEntity> {
    return this.repo.save(session);
  }

  async findByUserId(userId: string): Promise<SessionEntity[]> {
    return this.repo.find({
      where: { userId },
      order: { lastActiveAt: 'DESC' },
    });
  }

  async findById(id: string): Promise<SessionEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async deleteById(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }
}
