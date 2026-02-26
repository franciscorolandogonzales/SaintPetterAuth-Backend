import { Injectable, NotFoundException } from '@nestjs/common';
import { SessionRepository } from '../user/session.repository';
import { TokenService } from '../auth/token.service';
import { SessionDto, SessionListResponseDto } from './dto/session.dto';

@Injectable()
export class SessionsService {
  constructor(
    private readonly sessionRepo: SessionRepository,
    private readonly tokenService: TokenService,
  ) {}

  async listForUser(userId: string): Promise<SessionListResponseDto> {
    const sessions = await this.sessionRepo.findByUserId(userId);
    return {
      sessions: sessions.map((s) => ({
        id: s.id,
        createdAt: s.createdAt.toISOString(),
        lastActiveAt: s.lastActiveAt?.toISOString(),
        userAgent: s.userAgent ?? null,
      })),
    };
  }

  async revokeOne(sessionId: string, userId: string): Promise<void> {
    const session = await this.sessionRepo.findById(sessionId);
    if (!session || session.userId !== userId) {
      throw new NotFoundException('Session not found');
    }
    await this.sessionRepo.deleteById(sessionId);
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.sessionRepo.deleteByUserId(userId);
  }
}
