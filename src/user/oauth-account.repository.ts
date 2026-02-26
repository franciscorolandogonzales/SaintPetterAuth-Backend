import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { OAuthAccountEntity } from './oauth-account.entity';

@Injectable()
export class OAuthAccountRepository {
  constructor(
    @InjectRepository(OAuthAccountEntity)
    private readonly repo: Repository<OAuthAccountEntity>,
  ) {}

  async save(entity: OAuthAccountEntity): Promise<OAuthAccountEntity> {
    return this.repo.save(entity);
  }

  async findByProvider(provider: string, providerId: string): Promise<OAuthAccountEntity | null> {
    return this.repo.findOne({
      where: { provider, providerId },
      relations: ['user'],
    });
  }

  async findByUserId(userId: string): Promise<OAuthAccountEntity[]> {
    return this.repo.find({ where: { userId } });
  }
}
