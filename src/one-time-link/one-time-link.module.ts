import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { OneTimeLinkEntity } from './one-time-link.entity';
import { OneTimeLinkRepository } from './one-time-link.repository';
import { OneTimeLinkService } from './one-time-link.service';

@Module({
  imports: [TypeOrmModule.forFeature([OneTimeLinkEntity])],
  providers: [OneTimeLinkRepository, OneTimeLinkService],
  exports: [OneTimeLinkService],
})
export class OneTimeLinkModule {}
