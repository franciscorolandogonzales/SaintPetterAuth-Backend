import { Test, TestingModule } from '@nestjs/testing';
import { DataSource } from 'typeorm';
import { HealthController } from './health.controller';
import { RedisService } from '../redis/redis.service';

describe('HealthController', () => {
  let controller: HealthController;

  const mockDataSource = {
    query: jest.fn().mockResolvedValue(undefined),
  };

  const mockRedisService = {
    getClient: jest.fn().mockReturnValue({
      ping: jest.fn().mockResolvedValue('PONG'),
    }),
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        { provide: DataSource, useValue: mockDataSource },
        { provide: RedisService, useValue: mockRedisService },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
  });

  it('should return status ok when DB and Redis are healthy', async () => {
    await expect(controller.check()).resolves.toEqual({ status: 'ok' });
    expect(mockDataSource.query).toHaveBeenCalledWith('SELECT 1');
  });
});
