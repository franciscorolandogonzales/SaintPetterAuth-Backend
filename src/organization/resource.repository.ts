import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ResourceEntity } from './resource.entity';

@Injectable()
export class ResourceRepository {
  constructor(
    @InjectRepository(ResourceEntity)
    private readonly repo: Repository<ResourceEntity>,
  ) {}

  async save(entity: ResourceEntity): Promise<ResourceEntity> {
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<ResourceEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['organization'],
    });
  }

  async findByOrganization(organizationId: string): Promise<ResourceEntity[]> {
    return this.repo.find({
      where: { organizationId },
      order: { type: 'ASC', identifier: 'ASC' },
    });
  }

  async findByOrgAndTypeAndIdentifier(
    organizationId: string,
    type: string,
    identifier: string,
  ): Promise<ResourceEntity | null> {
    return this.repo.findOne({
      where: { organizationId, type, identifier },
      relations: ['organization'],
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
