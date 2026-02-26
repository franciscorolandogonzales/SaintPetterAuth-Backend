import { Injectable } from '@nestjs/common';
import { EventsRepository } from './events.repository';
import { DomainEventDto, EventListResponseDto } from './dto/event.dto';

@Injectable()
export class EventsService {
  constructor(private readonly eventsRepo: EventsRepository) {}

  async emit(type: string, payload: Record<string, unknown>): Promise<void> {
    await this.eventsRepo.append(type, payload);
  }

  async list(since?: string, limit = 50): Promise<EventListResponseDto> {
    const sinceDate = since ? new Date(since) : new Date(0);
    const events = await this.eventsRepo.findAfter(sinceDate, limit);
    const nextCursor =
      events.length === limit && events.length > 0
        ? events[events.length - 1].occurredAt.toISOString()
        : null;
    return {
      events: events.map((e) => ({
        type: e.type as 'UserRegistered' | 'LoginSucceeded',
        id: e.id,
        occurredAt: e.occurredAt.toISOString(),
        payload: e.payload as object,
      })),
      nextCursor,
    };
  }
}
