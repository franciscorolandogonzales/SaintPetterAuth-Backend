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
    const callbackURL = config.get<string>('GOOGLE_CALLBACK_URL') ?? 'http://localhost:4567/auth/google/callback';
    super({
      clientID: config.get<string>('GOOGLE_CLIENT_ID') ?? 'dummy',
      clientSecret: config.get<string>('GOOGLE_CLIENT_SECRET') ?? 'dummy',
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
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:entry',message:'validate called',hypothesisId:'H1-H2',data:{providerId,email},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    let oauthAccount: Awaited<ReturnType<typeof this.oauthAccountRepo.findByProvider>>;
    try {
      oauthAccount = await this.oauthAccountRepo.findByProvider('google', providerId);
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:findByProvider-error',message:'findByProvider threw',hypothesisId:'H1',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw err;
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:oauthAccount',message:'findByProvider result',hypothesisId:'H2',data:{found:!!oauthAccount,userLoaded:!!(oauthAccount?.user)},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    if (oauthAccount) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:returning-existing-user',message:'returning existing user from oauthAccount',hypothesisId:'H2',data:{userId:oauthAccount.user?.id,userIsNull:oauthAccount.user==null},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      return oauthAccount.user;
    }
    let user: UserEntity;
    try {
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
    } catch (err) {
      // #region agent log
      fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:create-user-error',message:'error creating user/oauth account',hypothesisId:'H1',data:{error:String(err)},timestamp:Date.now()})}).catch(()=>{});
      // #endregion
      throw err;
    }
    // #region agent log
    fetch('http://127.0.0.1:7242/ingest/bbfc576d-0bb4-453e-b278-dfbcda626b27',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'google.strategy.ts:validate:returning-new-user',message:'returning new user',hypothesisId:'H1-H2',data:{userId:user.id},timestamp:Date.now()})}).catch(()=>{});
    // #endregion
    return user;
  }
}
