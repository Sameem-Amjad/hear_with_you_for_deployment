import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { ActivityService } from '../activity/activity.service';
import { FirebaseService } from '../firebase/firebase.service';
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
    private readonly firebaseService: FirebaseService,
  ) {}

  private async buildUserResponse(user: User): Promise<UserResponseDto> {
    const profilePicture = user.profilePicture
      ? await this.storageService.resolveAccessibleUrl(user.profilePicture)
      : user.profilePicture;

    return UserResponseDto.fromUser({
      ...user,
      profilePicture,
    });
  }

  async setupProfile(
    userId: string,
    dto: SetupProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    const currentUser = await this.findActiveUserById(userId);

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
        username:
          currentUser.username ??
          (await this.generateUniqueUsername(
            dto.name || currentUser.email || currentUser.phone || userId,
          )),
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
      user: await this.buildUserResponse(user),
    };
  }

  async getCurrentProfile(userId: string) {
    const user = await this.findActiveUserById(userId);
    return { user: await this.buildUserResponse(user) };
  }

  async updateProfile(
    userId: string,
    dto: UpdateProfileDto,
    profilePicture?: Express.Multer.File,
  ) {
    const currentUser = await this.findActiveUserById(userId);

    const data: Partial<User> = {};
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
      user: await this.buildUserResponse(user),
    };
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

  private async generateUniqueUsername(seed: string): Promise<string> {
    const normalizedSeed = seed
      .toLowerCase()
      .replace(/[^a-z0-9_-]/g, '')
      .replace(/^[_-]+|[_-]+$/g, '');

    const base = (normalizedSeed || 'user').slice(0, 24);

    for (let attempt = 0; attempt < 20; attempt += 1) {
      const suffix = Math.floor(Math.random() * 100000)
        .toString()
        .padStart(5, '0');
      const candidate = `${base}_${suffix}`;

      const existingUser = await this.prismaService.user.findFirst({
        where: {
          username: candidate,
          isDeleted: false,
        },
        select: { id: true },
      });

      if (!existingUser) {
        return candidate;
      }
    }

    throw new BadRequestException(API_MESSAGES.USER.ERROR.USERNAME_TAKEN);
  }

  async softDeleteAccount(userId: string) {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(API_MESSAGES.USER.ERROR.USER_NOT_FOUND);

    // Delete Firebase account if linked
    if (user.firebaseUid) {
      try {
        await this.firebaseService.deleteUser(user.firebaseUid);
      } catch (err) {
        // log and continue
      }
    }

    // Delete profile picture from storage
    if (user.profilePicture) {
      try {
        await this.storageService.deleteFile(user.profilePicture);
      } catch (err) {
        // ignore
      }
    }

    const localPart = (user.email || user.username || user.id).split('@')[0].replace(/[^a-z0-9_.-]/gi, '').slice(0, 50);
    const providerTag = (user.provider || 'deleted').toString().toLowerCase();
    const anonymizedEmail = `${localPart}_softdelete_${providerTag}@example.com`;

    // Anonymize and soft-delete in DB
    await this.prismaService.user.update({
      where: { id: userId },
      data: {
        email: anonymizedEmail,
        phone: null,
        username: null,
        passwordHash: null,
        firebaseUid: null,
        profilePicture: null,
        isDeleted: true,
        isActive: false,
      },
    });

    await this.activityService.logActivity({
      userId,
      action: 'account_soft_delete',
      description: 'User account soft-deleted and anonymized',
    });

    return { message: API_MESSAGES.USER.SUCCESS.ACCOUNT_SOFT_DELETED };
  }

  async hardDeleteAccount(userId: string) {
    const user = await this.prismaService.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundException(API_MESSAGES.USER.ERROR.USER_NOT_FOUND);

    // Delete associated files: profile picture, voice samples, story audio keys
    try {
      if (user.profilePicture) {
        await this.storageService.deleteFile(user.profilePicture);
      }

      // delete voice profile sample audio urls
      const voiceProfiles = await this.prismaService.voiceProfile.findMany({ where: { userId } });
      for (const vp of voiceProfiles) {
        for (const url of vp.sampleAudioUrls ?? []) {
          await this.storageService.deleteFile(url);
        }
      }

      // delete story audio keys and files referenced
      const stories = await this.prismaService.story.findMany({ where: { userId } });
      for (const s of stories) {
        if (s.audioS3Key) {
          try {
            await this.storageService.deleteFile(s.audioS3Key);
          } catch (err) {
            // try delete by key
            try {
              const key = this.storageService.getObjectKeyFromUrlOrKey(s.audioS3Key);
              await this.storageService.deleteFileByKey(key);
            } catch (_) {}
          }
        }
      }
    } catch (err) {
      // continue even if storage deletion fails
    }

    // Attempt to delete Firebase user
    if (user.firebaseUid) {
      try {
        await this.firebaseService.deleteUser(user.firebaseUid);
      } catch (err) {
        // continue
      }
    }

    // Log action BEFORE deleting the user to avoid foreign-key errors
    await this.activityService.logActivity({
      userId,
      action: 'account_hard_delete',
      description: 'User account hard-deleted and all data removed',
    });

    // Delete the user record (cascades will remove related records)
    await this.prismaService.user.delete({ where: { id: userId } });

    return { message: API_MESSAGES.USER.SUCCESS.ACCOUNT_HARD_DELETED };
  }
}
