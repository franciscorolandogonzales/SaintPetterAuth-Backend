import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { EventsController } from './events.controller';
import { EventsService } from './events.service';
import { EventsRepository } from './events.repository';
import { DomainEventEntity } from './domain-event.entity';
import { AuthModule } from '../auth/auth.module';
import { UserModule } from '../user/user.module';
import { OrganizationModule } from '../organization/organization.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([DomainEventEntity]),
    UserModule,
    OrganizationModule,
    forwardRef(() => AuthModule),
  ],
  controllers: [EventsController],
  providers: [EventsService, EventsRepository],
  exports: [EventsService],
})
export class EventsModule {}
