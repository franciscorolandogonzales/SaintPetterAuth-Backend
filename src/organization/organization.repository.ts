import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OrganizationEntity } from './organization.entity';

@Injectable()
export class OrganizationRepository {
  constructor(
    @InjectRepository(OrganizationEntity)
    private readonly repo: Repository<OrganizationEntity>,
  ) {}

  async save(entity: OrganizationEntity): Promise<OrganizationEntity> {
    return this.repo.save(entity);
  }

  async findById(id: string): Promise<OrganizationEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async findBySlug(slug: string): Promise<OrganizationEntity | null> {
    return this.repo.findOne({ where: { slug } });
  }

  async findAll(): Promise<OrganizationEntity[]> {
    return this.repo.find({ order: { name: 'ASC' } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
