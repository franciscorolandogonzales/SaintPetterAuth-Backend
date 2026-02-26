import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { AuditLogEntity } from './audit-log.entity';

@Injectable()
export class AuditService {
  constructor(
    @InjectRepository(AuditLogEntity)
    private readonly repo: Repository<AuditLogEntity>,
  ) {}

  async log(params: {
    action: string;
    userId?: string | null;
    resource?: string | null;
    outcome: 'success' | 'failure';
    metadata?: Record<string, unknown> | null;
  }): Promise<void> {
    const entity = new AuditLogEntity();
    entity.action = params.action;
    entity.userId = params.userId ?? null;
    entity.resource = params.resource ?? null;
    entity.outcome = params.outcome;
    entity.metadata = params.metadata ?? null;
    await this.repo.save(entity);
  }
}
