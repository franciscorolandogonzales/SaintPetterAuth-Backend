import { IsArray, IsString, ArrayMinSize, MinLength } from 'class-validator';

export class AuthorizationCheckRequestDto {
  @IsArray()
  @ArrayMinSize(1, { message: 'At least one action is required' })
  @IsString({ each: true })
  actions!: string[];

  @IsString()
  @MinLength(1, { message: 'Resource is required' })
  resource!: string;
}

export class AuthorizationCheckResponseDto {
  allowed!: boolean;
}
