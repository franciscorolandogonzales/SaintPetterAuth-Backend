import { Module } from '@nestjs/common';
import { ManagementController } from './management.controller';
import { ManagementGuard } from './management.guard';
import { AuthModule } from '../auth/auth.module';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';
import { OneTimeLinkModule } from '../one-time-link/one-time-link.module';

@Module({
  imports: [AuthModule, OrganizationModule, UserModule, OneTimeLinkModule],
  controllers: [ManagementController],
  providers: [ManagementGuard],
})
export class ManagementModule {}
