import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan } from 'typeorm';
import { DomainEventEntity } from './domain-event.entity';

@Injectable()
export class EventsRepository {
  constructor(
    @InjectRepository(DomainEventEntity)
    private readonly repo: Repository<DomainEventEntity>,
  ) {}

  async append(type: string, payload: Record<string, unknown>): Promise<DomainEventEntity> {
    const entity = new DomainEventEntity();
    entity.type = type;
    entity.payload = payload;
    return this.repo.save(entity);
  }

  async findAfter(since: Date, limit: number): Promise<DomainEventEntity[]> {
    return this.repo.find({
      where: { occurredAt: MoreThan(since) },
      order: { occurredAt: 'ASC' },
      take: limit,
    });
  }
}
