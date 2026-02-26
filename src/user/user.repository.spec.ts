import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserEntity } from './user.entity';
import { UserRepository } from './user.repository';

describe('UserRepository', () => {
  let repo: UserRepository;
  let mockRepo: Partial<Repository<UserEntity>>;

  beforeEach(async () => {
    mockRepo = {
      save: jest.fn(),
      findOne: jest.fn(),
    };
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        UserRepository,
        { provide: getRepositoryToken(UserEntity), useValue: mockRepo },
      ],
    }).compile();
    repo = module.get<UserRepository>(UserRepository);
  });

  it('findByEmail returns user when found', async () => {
    const user = Object.assign(new UserEntity(), {
      id: 'id-1',
      email: 'a@b.com',
      emailVerified: false,
    });
    (mockRepo.findOne as jest.Mock).mockResolvedValue(user);
    const result = await repo.findByEmail('a@b.com');
    expect(result).toEqual(user);
    expect(mockRepo.findOne).toHaveBeenCalledWith({
      where: { email: 'a@b.com' },
    });
  });

  it('findByEmail returns null when not found', async () => {
    (mockRepo.findOne as jest.Mock).mockResolvedValue(null);
    const result = await repo.findByEmail('x@y.com');
    expect(result).toBeNull();
  });
});
