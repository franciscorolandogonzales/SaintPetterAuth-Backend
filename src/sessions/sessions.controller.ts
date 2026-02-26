import {
  Controller,
  Get,
  Delete,
  Param,
  HttpCode,
  HttpStatus,
  Req,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import { SessionListResponseDto } from './dto/session.dto';
import { SessionsService } from './sessions.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('sessions')
@UseGuards(AuthGuard)
export class SessionsController {
  constructor(private readonly sessionsService: SessionsService) {}

  @Get()
  async list(@Req() req: Request & { userId?: string }): Promise<SessionListResponseDto> {
    const userId = req.userId ?? '';
    return this.sessionsService.listForUser(userId);
  }

  @Delete()
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeAll(@Req() req: Request & { userId?: string }): Promise<void> {
    const userId = req.userId ?? '';
    await this.sessionsService.revokeAllForUser(userId);
  }

  @Delete(':sessionId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revoke(
    @Param('sessionId') sessionId: string,
    @Req() req: Request & { userId?: string },
  ): Promise<void> {
    const userId = req.userId ?? '';
    await this.sessionsService.revokeOne(sessionId, userId);
  }
}
