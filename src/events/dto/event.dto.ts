export class DomainEventDto {
  type!: 'UserRegistered' | 'LoginSucceeded';
  id!: string;
  occurredAt!: string;
  payload!: object;
}

export class EventListResponseDto {
  events!: DomainEventDto[];
  nextCursor!: string | null;
}
