import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserOrganizationEntity } from './user-organization.entity';

@Injectable()
export class UserOrganizationRepository {
  constructor(
    @InjectRepository(UserOrganizationEntity)
    private readonly repo: Repository<UserOrganizationEntity>,
  ) {}

  async save(entity: UserOrganizationEntity): Promise<UserOrganizationEntity> {
    return this.repo.save(entity);
  }

  async findByUser(userId: string): Promise<UserOrganizationEntity[]> {
    return this.repo.find({
      where: { userId },
      relations: ['organization'],
      order: { isDefault: 'DESC' },
    });
  }

  async findByOrganization(organizationId: string): Promise<UserOrganizationEntity[]> {
    return this.repo.find({
      where: { organizationId },
      relations: ['user'],
    });
  }

  async findMembership(userId: string, organizationId: string): Promise<UserOrganizationEntity | null> {
    return this.repo.findOne({
      where: { userId, organizationId },
      relations: ['organization'],
    });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
