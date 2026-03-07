import {
  Controller,
  Post,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  SendNotificationRequestDto,
  SendNotificationResponseDto,
} from './dto/send-notification.dto';
import { NotificationsService } from './notifications.service';
import { PlatformAdminGuard } from '../auth/platform-admin.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(PlatformAdminGuard)
  async send(
    @Body() body: SendNotificationRequestDto,
  ): Promise<SendNotificationResponseDto> {
    return this.notificationsService.send(body);
  }
}
