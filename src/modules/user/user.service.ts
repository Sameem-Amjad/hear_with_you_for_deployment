import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import { SetupProfileDto } from './dto/setupprofile.dto';
import { UpdateProfileDto } from './dto/updateprofile.dto';
import { UserResponseDto } from './dto/userresponse.dto';
import { API_MESSAGES } from '../../common/constants/api.messages';

@Injectable()
export class UserService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly activityService: ActivityService,
  ) {}

  async setupProfile(
    userId: string,
    dto: SetupProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    await this.ensureUsernameAvailable(dto.username, userId);

    let profilePictureUrl: string | undefined;
    if (profilePicture) {
      profilePictureUrl = await this.storageService.uploadFile(
        profilePicture,
        'profilepictures',
      );
    }

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data: {
        username: dto.username,
        name: dto.name,
        profilePicture: profilePictureUrl,
        isProfileComplete: true,
      },
    });

    await this.activityService.logActivity({
      userId,
      action: 'profile_setup',
      description: 'Profile setup completed',
    });

    return {
      message: API_MESSAGES.USER.SUCCESS.PROFILE_SETUP,
      user: UserResponseDto.fromUser(user),
    };
  }

  async getCurrentProfile(userId: string) {
    const user = await this.findActiveUserById(userId);
    return { user: UserResponseDto.fromUser(user) };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    const currentUser = await this.findActiveUserById(userId);

    if (dto.username && dto.username !== currentUser.username) {
      await this.ensureUsernameAvailable(dto.username, userId);
    }

    const data: Partial<User> = {};
    if (dto.username) data.username = dto.username;
    if (dto.name) data.name = dto.name;

    if (profilePicture) {
      const uploadedUrl = await this.storageService.uploadFile(
        profilePicture,
        'profilepictures',
      );
      if (currentUser.profilePicture) {
        await this.storageService.deleteFile(currentUser.profilePicture);
      }
      data.profilePicture = uploadedUrl;
    }

    const user = await this.prismaService.user.update({
      where: { id: userId },
      data,
    });

    await this.activityService.logActivity({
      userId,
      action: 'profile_update',
      description: 'Profile updated successfully',
      metadata: {
        changedFields: Object.keys(data),
      },
    });

    return {
      message: API_MESSAGES.USER.SUCCESS.PROFILE_UPDATED,
      user: UserResponseDto.fromUser(user),
    };
  }

  private async ensureUsernameAvailable(
    username: string,
    userId: string,
  ): Promise<void> {
    const existingUser = await this.prismaService.user.findFirst({
      where: {
        username,
        isDeleted: false,
        id: { not: userId },
      },
    });

    if (existingUser) {
      throw new BadRequestException(API_MESSAGES.USER.ERROR.USERNAME_TAKEN);
    }
  }

  private async findActiveUserById(userId: string): Promise<User> {
    const user = await this.prismaService.user.findFirst({
      where: { id: userId, isDeleted: false, isActive: true },
    });
    if (!user) {
      throw new NotFoundException(API_MESSAGES.USER.ERROR.USER_NOT_FOUND);
    }
    return user;
  }
}
