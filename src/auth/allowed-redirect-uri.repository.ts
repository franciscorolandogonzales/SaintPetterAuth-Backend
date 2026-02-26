import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { AllowedRedirectUriEntity } from './allowed-redirect-uri.entity';

@Injectable()
export class AllowedRedirectUriRepository {
  constructor(
    @InjectRepository(AllowedRedirectUriEntity)
    private readonly repo: Repository<AllowedRedirectUriEntity>,
  ) {}

  /** All URIs across every organization (used by RedirectAllowlistService.refresh). */
  async findAll(): Promise<AllowedRedirectUriEntity[]> {
    return this.repo.find({ order: { organizationId: 'ASC', createdAt: 'ASC' } });
  }

  /** All URIs for a single organization. */
  async findByOrg(organizationId: string): Promise<AllowedRedirectUriEntity[]> {
    return this.repo.find({ where: { organizationId }, order: { createdAt: 'ASC' } });
  }

  /** All URIs for a set of organizations (used by org_admin with multiple orgs). */
  async findByOrgs(organizationIds: string[]): Promise<AllowedRedirectUriEntity[]> {
    if (organizationIds.length === 0) return [];
    return this.repo.find({
      where: { organizationId: In(organizationIds) },
      order: { organizationId: 'ASC', createdAt: 'ASC' },
    });
  }

  /** Check uniqueness within the same organization. */
  async findByUriAndOrg(uri: string, organizationId: string): Promise<AllowedRedirectUriEntity | null> {
    return this.repo.findOne({ where: { uri, organizationId } });
  }

  async findById(id: string): Promise<AllowedRedirectUriEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async create(uri: string, organizationId: string): Promise<AllowedRedirectUriEntity> {
    const entity = this.repo.create({ uri, organizationId });
    return this.repo.save(entity);
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
