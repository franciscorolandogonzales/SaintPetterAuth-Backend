import { Module } from '@nestjs/common';
import { SeedService } from './seed.service';
import { OrganizationModule } from '../organization/organization.module';
import { UserModule } from '../user/user.module';

@Module({
  imports: [OrganizationModule, UserModule],
  providers: [SeedService],
})
export class SeedModule {}
