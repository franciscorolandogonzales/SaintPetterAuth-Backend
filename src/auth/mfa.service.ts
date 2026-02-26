import { Injectable, ConflictException } from '@nestjs/common';
import * as speakeasy from 'speakeasy';
import * as QRCode from 'qrcode';
import { MfaRepository } from '../user/mfa.repository';
import { UserRepository } from '../user/user.repository';
import { MfaEntity } from '../user/mfa.entity';

@Injectable()
export class MfaService {
  constructor(
    private readonly mfaRepo: MfaRepository,
    private readonly userRepo: UserRepository,
  ) {}

  async enrollTotp(userId: string): Promise<{ secret: string; qrDataUrl: string }> {
    const user = await this.userRepo.findById(userId);
    const email = user?.email ?? 'user';
    const existing = await this.mfaRepo.findTotpByUserId(userId);
    if (existing) {
      throw new ConflictException('TOTP already enrolled');
    }
    const secret = speakeasy.generateSecret({
      name: `SaintPetter Auth (${email})`,
      length: 20,
    });
    const entity = new MfaEntity();
    entity.userId = userId;
    entity.type = 'totp';
    entity.secret = secret.base32;
    await this.mfaRepo.save(entity);
    const otpauth = secret.otpauth_url ?? '';
    const qrDataUrl = await QRCode.toDataURL(otpauth);
    return { secret: secret.base32, qrDataUrl };
  }

  async verifyTotp(userId: string, code: string): Promise<boolean> {
    const mfa = await this.mfaRepo.findTotpByUserId(userId);
    if (!mfa) return false;
    return speakeasy.totp.verify({
      secret: mfa.secret,
      encoding: 'base32',
      token: code,
      window: 1,
    });
  }

  async listMethods(userId: string): Promise<{ type: string; id: string }[]> {
    const list = await this.mfaRepo.findByUserId(userId);
    return list.map((m) => ({ type: m.type, id: m.id }));
  }

  async removeTotp(userId: string): Promise<void> {
    await this.mfaRepo.deleteByUserIdAndType(userId, 'totp');
  }
}
