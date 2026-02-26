import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { EventListResponseDto } from './dto/event.dto';
import { EventsService } from './events.service';
import { AuthGuard } from '../auth/auth.guard';

@Controller('events')
@UseGuards(AuthGuard)
export class EventsController {
  constructor(private readonly eventsService: EventsService) {}

  @Get()
  async list(
    @Query('since') since?: string,
    @Query('limit') limitStr?: string,
  ): Promise<EventListResponseDto> {
    const limit = limitStr ? Math.min(100, Math.max(1, parseInt(limitStr, 10) || 50)) : 50;
    return this.eventsService.list(since, limit);
  }
}
