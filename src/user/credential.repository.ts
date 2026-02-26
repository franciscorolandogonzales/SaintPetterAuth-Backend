import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CredentialEntity } from './credential.entity';

@Injectable()
export class CredentialRepository {
  constructor(
    @InjectRepository(CredentialEntity)
    private readonly repo: Repository<CredentialEntity>,
  ) {}

  async save(credential: CredentialEntity): Promise<CredentialEntity> {
    return this.repo.save(credential);
  }

  async findByUserId(userId: string): Promise<CredentialEntity | null> {
    return this.repo.findOne({ where: { userId } });
  }
}
