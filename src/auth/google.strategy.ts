import { Injectable } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback, Profile } from 'passport-google-oauth20';
import { ConfigService } from '@nestjs/config';
import { UserEntity } from '../user/user.entity';
import { UserRepository } from '../user/user.repository';
import { OAuthAccountRepository } from '../user/oauth-account.repository';
import { OAuthAccountEntity } from '../user/oauth-account.entity';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
  constructor(
    private readonly config: ConfigService,
    private readonly userRepo: UserRepository,
    private readonly oauthAccountRepo: OAuthAccountRepository,
  ) {
    const callbackURL = config.get<string>('SPA_GOOGLE_CALLBACK_URL') ?? config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:4567/auth/google/callback';
    super({
      clientID: config.get<string>('SPA_GOOGLE_CLIENT_ID') ?? config.get<string>('GOOGLE_CLIENT_ID') ?? 'dummy',
      clientSecret: config.get<string>('SPA_GOOGLE_CLIENT_SECRET') ?? config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'dummy',
      callbackURL,
      scope: ['email', 'profile'],
    });
  }

  async validate(
    _accessToken: string,
    _refreshToken: string,
    profile: Profile,
    _done: VerifyCallback,
  ): Promise<UserEntity> {
    const providerId = profile.id;
    const email = profile.emails?.[0]?.value ?? `${profile.id}@google.oauth`;

    const oauthAccount = await this.oauthAccountRepo.findByProvider('google', providerId);
    if (oauthAccount) {
      return oauthAccount.user;
    }

    let user: UserEntity;
    const found = await this.userRepo.findByEmail(email);
    if (!found) {
      const nu = new UserEntity();
      nu.email = email;
      nu.emailVerified = true;
      user = await this.userRepo.save(nu);
    } else {
      user = found;
    }
    const newAccount = new OAuthAccountEntity();
    newAccount.userId = user.id;
    newAccount.provider = 'google';
    newAccount.providerId = providerId;
    await this.oauthAccountRepo.save(newAccount);
    return user;
  }
}
