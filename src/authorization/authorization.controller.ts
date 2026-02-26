import {
  Controller,
  Post,
  Body,
  Req,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { Request } from 'express';
import {
  AuthorizationCheckRequestDto,
  AuthorizationCheckResponseDto,
} from './dto/authorization-check.dto';
import { AuthorizationService } from './authorization.service';
import { AuthGuard } from '../auth/auth.guard';

type ReqWithAuth = Request & { userId: string; organizationId?: string | null };

@Controller('authorization')
export class AuthorizationController {
  constructor(private readonly authorizationService: AuthorizationService) {}

  @Post('check')
  @HttpCode(HttpStatus.OK)
  @UseGuards(AuthGuard)
  async check(
    @Req() req: ReqWithAuth,
    @Body() body: AuthorizationCheckRequestDto,
  ): Promise<AuthorizationCheckResponseDto> {
    return this.authorizationService.check(req.userId, body, req.organizationId ?? null);
  }
}
