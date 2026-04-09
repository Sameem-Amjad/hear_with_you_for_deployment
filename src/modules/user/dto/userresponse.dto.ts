import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { AuthProvider, User } from '@prisma/client';

export class UserResponseDto {
  @ApiProperty()
  id: string;

  @ApiPropertyOptional()
  username?: string | null;

  @ApiPropertyOptional()
  name?: string | null;

  @ApiPropertyOptional()
  email?: string | null;

  @ApiPropertyOptional()
  phone?: string | null;

  @ApiPropertyOptional()
  profilePicture?: string | null;

  @ApiProperty({ enum: AuthProvider })
  provider: AuthProvider;

  @ApiProperty()
  isProfileComplete: boolean;

  @ApiPropertyOptional()
  lastActiveAt?: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;

  constructor(partial: Partial<UserResponseDto>) {
    Object.assign(this, partial);
  }

  static fromUser(user: User): UserResponseDto {
    return new UserResponseDto({
      id: user.id,
      username: user.username,
      name: user.name,
      email: user.email,
      phone: user.phone,
      profilePicture: user.profilePicture,
      provider: user.provider,
      isProfileComplete: user.isProfileComplete,
      lastActiveAt: user.lastActiveAt,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    });
  }
}
