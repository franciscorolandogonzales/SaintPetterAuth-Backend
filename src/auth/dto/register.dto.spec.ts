import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { RegisterRequestDto } from './register.dto';

describe('RegisterRequestDto', () => {
  it('should pass with valid email and password', async () => {
    const dto = plainToInstance(RegisterRequestDto, {
      email: 'test@example.com',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('should fail with invalid email', async () => {
    const dto = plainToInstance(RegisterRequestDto, {
      email: 'invalid',
      password: 'password123',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'email')).toBe(true);
  });

  it('should fail with short password', async () => {
    const dto = plainToInstance(RegisterRequestDto, {
      email: 'test@example.com',
      password: 'short',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors.some((e) => e.property === 'password')).toBe(true);
  });
});
