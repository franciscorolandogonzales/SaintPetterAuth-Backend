import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { UserEntity } from './user.entity';
import { CredentialEntity } from './credential.entity';
import { SessionEntity } from './session.entity';
import { OAuthAccountEntity } from './oauth-account.entity';
import { MfaEntity } from './mfa.entity';
import { ApiKeyEntity } from './api-key.entity';
import { UserRepository } from './user.repository';
import { SessionRepository } from './session.repository';
import { CredentialRepository } from './credential.repository';
import { OAuthAccountRepository } from './oauth-account.repository';
import { MfaRepository } from './mfa.repository';
import { ApiKeyRepository } from './api-key.repository';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      UserEntity,
      CredentialEntity,
      SessionEntity,
      OAuthAccountEntity,
      MfaEntity,
      ApiKeyEntity,
    ]),
  ],
  providers: [
    UserRepository,
    SessionRepository,
    CredentialRepository,
    OAuthAccountRepository,
    MfaRepository,
    ApiKeyRepository,
  ],
  exports: [
    TypeOrmModule,
    UserRepository,
    SessionRepository,
    CredentialRepository,
    OAuthAccountRepository,
    MfaRepository,
    ApiKeyRepository,
  ],
})
export class UserModule {}
