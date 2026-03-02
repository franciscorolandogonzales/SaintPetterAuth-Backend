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

  async findByOrganizationPaginated(
    organizationId: string,
    page: number,
    size: number,
  ): Promise<{ members: UserOrganizationEntity[]; total: number }> {
    const skip = (page - 1) * size;
    const [members, total] = await this.repo.findAndCount({
      where: { organizationId },
      relations: ['user'],
      order: { createdAt: 'ASC' },
      skip,
      take: size,
    });
    return { members, total };
  }

  async deleteByUserId(userId: string): Promise<void> {
    await this.repo.delete({ userId });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete(id);
  }
}
