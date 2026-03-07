import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { RedisService } from '../redis/redis.service';

@Controller('health')
export class HealthController {
  constructor(
    private readonly dataSource: DataSource,
    private readonly redis: RedisService,
  ) {}

  @Get()
  async check(): Promise<{ status: string }> {
    try {
      await this.dataSource.query('SELECT 1');
    } catch {
      throw new ServiceUnavailableException({ status: 'unhealthy', error: 'Database unreachable' });
    }

    const client = this.redis.getClient();
    if (client) {
      try {
        await client.ping();
      } catch {
        throw new ServiceUnavailableException({ status: 'unhealthy', error: 'Redis unreachable' });
      }
    }

    return { status: 'ok' };
  }
}
