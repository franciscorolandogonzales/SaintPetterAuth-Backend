import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';

export interface IUserRepository {
  save(user: UserEntity): Promise<UserEntity>;
  findByEmail(email: string): Promise<UserEntity | null>;
  findById(id: string): Promise<UserEntity | null>;
  findServiceAccounts(organizationId?: string | null): Promise<UserEntity[]>;
}

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(
    @InjectRepository(UserEntity)
    private readonly repo: Repository<UserEntity>,
  ) {}

  async save(user: UserEntity): Promise<UserEntity> {
    return this.repo.save(user);
  }

  async findByEmail(email: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { email: email.toLowerCase() } });
  }

  async findById(id: string): Promise<UserEntity | null> {
    return this.repo.findOne({ where: { id } });
  }

  async delete(id: string): Promise<void> {
    await this.repo.delete({ id });
  }

  async findHumanUsers(): Promise<UserEntity[]> {
    return this.repo.find({ where: { type: 'human' }, order: { createdAt: 'DESC' } });
  }

  async findServiceAccounts(organizationId?: string | null): Promise<UserEntity[]> {
    if (organizationId !== undefined && organizationId !== null) {
      return this.repo.find({
        where: { type: 'service', organizationId },
        order: { createdAt: 'DESC' },
      });
    }
    return this.repo.find({ where: { type: 'service' }, order: { createdAt: 'DESC' } });
  }
}
