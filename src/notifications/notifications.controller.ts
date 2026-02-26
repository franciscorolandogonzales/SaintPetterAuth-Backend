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
import { AuthGuard } from '../auth/auth.guard';

@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notificationsService: NotificationsService) {}

  @Post('send')
  @HttpCode(HttpStatus.ACCEPTED)
  @UseGuards(AuthGuard)
  async send(
    @Body() body: SendNotificationRequestDto,
  ): Promise<SendNotificationResponseDto> {
    return this.notificationsService.send(body);
  }
}
