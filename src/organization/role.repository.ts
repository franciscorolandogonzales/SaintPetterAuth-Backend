import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull } from 'typeorm';
import { RoleEntity } from './role.entity';

@Injectable()
export class RoleRepository {
  constructor(
    @InjectRepository(RoleEntity)
    private readonly repo: Repository<RoleEntity>,
  ) {}

  async save(entity: RoleEntity): Promise<RoleEntity> {
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<RoleEntity | null> {
    return this.repo.findOne({
      where: { id },
      relations: ['permissions'],
    });
  }

  async findGlobalRoles(): Promise<RoleEntity[]> {
    return this.repo.find({
      where: { organizationId: IsNull() },
      relations: ['permissions'],
    });
  }

  async findByOrganization(organizationId: string): Promise<RoleEntity[]> {
    return this.repo.find({
      where: { organizationId },
      relations: ['permissions'],
      order: { name: 'ASC' },
    });
  }

  async findBySlug(slug: string, organizationId: string | null): Promise<RoleEntity | null> {
    return this.repo.findOne({
      where:
        organizationId === null
          ? { slug, organizationId: IsNull() }
          : { slug, organizationId },
      relations: ['permissions'],
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
