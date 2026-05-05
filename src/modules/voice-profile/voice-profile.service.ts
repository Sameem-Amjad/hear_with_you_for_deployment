import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { parseBuffer } from 'music-metadata';
import {
  NotificationType,
  Prisma,
  VoiceProfile,
  VoiceStatus,
} from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { NotificationService } from '../notification/notification.service';
import { CompleteUploadVoiceProfileDto } from './dto/complete-upload-voice-profile.dto';
import { CreateUploadSessionDto } from './dto/create-upload-session.dto';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { ElevenLabsService } from './elevenlabs.service';
import { extname } from 'path';

@Injectable()
export class VoiceProfileService {
  private readonly logger = new Logger(VoiceProfileService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly elevenLabsService: ElevenLabsService,
    private readonly notificationService: NotificationService,
  ) {}

  private toClientVoiceProfile<T extends { type?: unknown; typeCode?: number }>(
    profile: T,
  ) {
    const { typeCode, type, ...rest } = profile as T & {
      typeCode?: number;
      type?: unknown;
    };

    return {
      ...rest,
      type: typeCode ?? 0,
      profileType: type,
    };
  }

  private async resolveSampleAudioUrls(
    urls: VoiceProfile['sampleAudioUrls'],
  ): Promise<string[]> {
    return Promise.all(
      urls.map((url) => this.storageService.resolveAccessibleUrl(url)),
    );
  }

  private async getUserSubscription(userId: string) {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: {
        currentSubscriptionPlanId: true,
        isDeleted: true,
        isActive: true,
      },
    });
    if (!user || user.isDeleted || !user.isActive) {
      throw new NotFoundException('User not found');
    }
    return user;
  }

  private async ensureVoiceLimit(userId: string): Promise<void> {
    const user = await this.getUserSubscription(userId);

    const plan = user.currentSubscriptionPlanId
      ? await this.prismaService.subscriptionPlan.findUnique({
          where: { id: user.currentSubscriptionPlanId },
          select: { voiceProfiles: true },
        })
      : null;

    const maxVoices = plan?.voiceProfiles ?? 1;
    const existingCount = await this.prismaService.voiceProfile.count({
      where: { userId, isActive: true },
    });
    if (existingCount >= maxVoices) {
      throw new ForbiddenException(
        'Voice profile limit reached for your subscription plan',
      );
    }
  }

  private async createProfileAndClone(params: {
    userId: string;
    name: string;
    description?: string;
    typeCode?: number;
    sampleAudioUrls: string[];
    sampleDuration: number;
    filesForClone: Array<{
      filename: string;
      buffer: Buffer;
      mimetype: string;
    }>;
  }) {
    const voiceProfile = await this.prismaService.voiceProfile.create({
      data: {
        userId: params.userId,
        name: params.name,
        description: params.description,
        typeCode: params.typeCode ?? 0,
        sampleAudioUrls: params.sampleAudioUrls,
        sampleDuration: params.sampleDuration || undefined,
        status: VoiceStatus.PROCESSING,
      },
    });

    try {
      const addRes = await this.elevenLabsService.addVoice({
        name: voiceProfile.name,
        description: voiceProfile.description ?? undefined,
        files: params.filesForClone,
      });

      const updated = await this.prismaService.voiceProfile.update({
        where: { id: voiceProfile.id },
        data: {
          elevenLabsVoiceId: addRes.voice_id,
          status: VoiceStatus.READY,
          processingError: null,
        },
      });

      const activeVoiceCount = await this.prismaService.voiceProfile.count({
        where: { userId: params.userId, isActive: true },
      });
      await this.prismaService.user.update({
        where: { id: params.userId },
        data: { voiceProfilesCount: activeVoiceCount },
      });

      await this.notificationService.notifyUser({
        userId: params.userId,
        type: NotificationType.VOICE_READY,
        title: 'Voice profile ready',
        message: `Your voice profile "${updated.name}" is ready.`,
        actionUrl: `/voice-profiles/${updated.id}`,
        actionText: 'View voice profile',
        data: {
          voiceProfileId: updated.id,
          name: updated.name,
        },
      });

      return {
        message: 'Voice profile created',
        voiceProfile: this.toClientVoiceProfile({
          ...updated,
          sampleAudioUrls: await this.resolveSampleAudioUrls(
            updated.sampleAudioUrls,
          ),
        }),
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.logger.warn(`Voice cloning failed: ${msg}`);
      await this.prismaService.voiceProfile.update({
        where: { id: voiceProfile.id },
        data: { status: VoiceStatus.FAILED, processingError: msg },
      });
      throw new BadRequestException('Voice cloning failed');
    }
  }

  async createUploadSession(userId: string, dto: CreateUploadSessionDto) {
    if (dto.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Audio file size must not exceed 10MB');
    }

    await this.ensureVoiceLimit(userId);

    const session = await this.storageService.createAudioPresignedUpload({
      userId,
      fileName: dto.fileName,
      contentType: dto.contentType,
    });

    return {
      uploadSession: session,
      provider: 'digitalocean-spaces',
      message: 'Upload session created',
    };
  }

  async createWithUploadedKeys(
    userId: string,
    dto: CompleteUploadVoiceProfileDto,
  ) {
    await this.ensureVoiceLimit(userId);

    let totalDurationSeconds = 0;
    const cloneFiles: Array<{
      filename: string;
      buffer: Buffer;
      mimetype: string;
    }> = [];
    const sampleAudioUrls: string[] = [];

    for (const key of dto.objectKeys) {
      if (!key.startsWith(`voice-samples/${userId}/uploads/`)) {
        throw new BadRequestException('Invalid object key');
      }

      await this.storageService.assertObjectExists(key);
      const buffer = await this.storageService.downloadObjectBuffer(key);
      const mimetype = key.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
      const file: Express.Multer.File = {
        fieldname: 'samples',
        originalname: key.split('/').pop() ?? 'sample.mp3',
        encoding: '7bit',
        mimetype,
        size: buffer.length,
        buffer,
        destination: '',
        filename: '',
        path: '',
        stream: undefined as never,
      };

      this.logger.log(
        `Downloaded voice sample ${file.originalname} size=${buffer.length} mimetype=${mimetype}`,
      );

      if (buffer.length === 0) {
        this.logger.warn(`Downloaded audio buffer for key=${key} is empty`);
        throw new BadRequestException('Uploaded audio file is empty');
      }

      const extension = extname(file.originalname).toLowerCase();
      const supportedExt = new Set(['.mp3', '.wav', '.mpeg', '.mpga','.m4a']);
      if (!supportedExt.has(extension)) {
        this.logger.warn(`Unsupported audio extension uploaded: ${file.originalname}`);
        throw new BadRequestException('Only mp3 and wav audio files are supported for cloning. Please re-upload as mp3 or wav.');
      }

      this.storageService.validateAudioFile(file);
      const metadata = await parseBuffer(buffer, mimetype, {
        duration: true,
      }).catch(() => null);
      const dur = metadata?.format?.duration
        ? Math.round(metadata.format.duration)
        : 0;
      totalDurationSeconds += dur;

      cloneFiles.push({
        filename: file.originalname,
        buffer,
        mimetype,
      });
      sampleAudioUrls.push(this.storageService.getPublicUrlFromKey(key));
    }

    return this.createProfileAndClone({
      userId,
      name: dto.name,
      description: dto.description,
      typeCode: dto.type,
      sampleAudioUrls,
      sampleDuration: totalDurationSeconds,
      filesForClone: cloneFiles,
    });
  }

  async createWithSamples(
    userId: string,
    dto: CreateVoiceProfileDto,
    files: Express.Multer.File[],
  ) {
    if (!files?.length) {
      throw new BadRequestException('At least one audio sample is required');
    }
    if (files.length > 5) {
      throw new BadRequestException('Maximum 5 audio samples allowed');
    }

    await this.ensureVoiceLimit(userId);

    let totalDurationSeconds = 0;
    const sampleAudioUrls: string[] = [];

    for (const file of files) {
      this.storageService.validateAudioFile(file);
      const metadata = await parseBuffer(file.buffer, file.mimetype, {
        duration: true,
      }).catch(() => null);
      const dur = metadata?.format?.duration
        ? Math.round(metadata.format.duration)
        : 0;
      totalDurationSeconds += dur;
      const url = await this.storageService.uploadAudioFile(
        file,
        `voice-samples/${userId}`,
      );
      sampleAudioUrls.push(url);
    }

    return this.createProfileAndClone({
      userId,
      name: dto.name,
      description: dto.description,
      sampleAudioUrls,
      sampleDuration: totalDurationSeconds,
      filesForClone: files.map((f) => ({
        filename: f.originalname,
        buffer: f.buffer,
        mimetype: f.mimetype,
      })),
    });
  }

  async list(userId: string, page = 1, limit = 20) {
    const skip = (page - 1) * limit;
    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.voiceProfile.findMany({
        where: { userId, isActive: true, elevenLabsVoiceId: { not: null } },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          name: true,
          description: true,
          type: true,
          typeCode: true,
          elevenLabsVoiceId: true,
          sampleAudioUrls: true,
          isActive: true,
          lastUsedAt: true,
          updatedAt: true,
          _count: {
            select: {
              stories: true,
            },
          },
        },
      }),
      this.prismaService.voiceProfile.count({
        where: { userId, isActive: true },
      }),
    ]);

    return {
      items: await Promise.all(
        items.map(async (item) => ({
          id: item.id,
          userId: item.userId,
          name: item.name,
          description: item.description,
          type: item.typeCode,
          profileType: item.type,
          elevenLabsVoiceId: item.elevenLabsVoiceId,
          sampleAudioUrl: item.sampleAudioUrls[0]
            ? await this.storageService.resolveAccessibleUrl(
                item.sampleAudioUrls[0],
              )
            : null,
          isActive: item.isActive,
          lastUsedAt: item.lastUsedAt,
          updatedAt: item.updatedAt,
          storiesCount: item._count.stories,
        })),
      ),
      total,
      page,
      limit,
    };
  }

  async get(userId: string, id: string) {
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id },
    });
    if (!voice || voice.userId !== userId)
      throw new NotFoundException('Voice profile not found');
    return {
      voiceProfile: this.toClientVoiceProfile({
        ...voice,
        sampleAudioUrls: await this.resolveSampleAudioUrls(voice.sampleAudioUrls),
      }),
    };
  }

  async update(userId: string, id: string, dto: UpdateVoiceProfileDto) {
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id },
    });
    if (!voice || voice.userId !== userId)
      throw new NotFoundException('Voice profile not found');

    const data: Prisma.VoiceProfileUpdateInput = {
      name: dto.name,
      description: dto.description,
      stability: dto.stability,
      similarityBoost: dto.similarityBoost,
      style: dto.style,
      useSpeakerBoost: dto.useSpeakerBoost,
      isActive: dto.isActive,
      isDefault: dto.isDefault,
    };

    if (dto.isDefault) {
      await this.prismaService.voiceProfile.updateMany({
        where: { userId, isDefault: true },
        data: { isDefault: false },
      });
    }

    const updated = await this.prismaService.voiceProfile.update({
      where: { id },
      data,
    });
    return {
      message: 'Voice profile updated',
      voiceProfile: this.toClientVoiceProfile({
        ...updated,
        sampleAudioUrls: await this.resolveSampleAudioUrls(updated.sampleAudioUrls),
      }),
    };
  }

  async remove(userId: string, id: string) {
    console.log('Removing voice profile', { userId, id });
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id },
    });
    if (!voice)
      throw new NotFoundException('Voice profile not found');
    userId = voice.userId; // Override userId to ensure users can only delete their own voices, even if they manipulate the request
    // Do all DB reference updates together so API/state cannot become partially broken.
    await this.prismaService.$transaction(async (tx) => {
      await tx.story.updateMany({
        where: {  voiceProfileId: id },
        data: { voiceProfileId: null },
      });

      await tx.voiceProfile.update({
        where: { id },
        data: {
          isActive: false,
          isDefault: false,
          status: VoiceStatus.DELETED,
        },
      });

      if (voice.isDefault) {
        const fallback = await tx.voiceProfile.findFirst({
          where: { userId, isActive: true, id: { not: id } },
          orderBy: { updatedAt: 'desc' },
          select: { id: true },
        });

        if (fallback) {
          await tx.voiceProfile.update({
            where: { id: fallback.id },
            data: { isDefault: true },
          });
        }
      }
    });

    // Best-effort external cleanup; DB delete should still succeed even if provider/storage is unavailable.
    if (voice.elevenLabsVoiceId) {
      await this.elevenLabsService
        .deleteVoice(voice.elevenLabsVoiceId)
        .catch((error) => {
          this.logger.warn(
            `Failed to delete ElevenLabs voice ${voice.elevenLabsVoiceId}: ${String(error)}`,
          );
        });
    }

    await Promise.all(
      (voice.sampleAudioUrls ?? []).map((url) =>
        this.storageService.deleteFile(url).catch((error) => {
          this.logger.warn(
            `Failed to delete voice sample ${url}: ${String(error)}`,
          );
        }),
      ),
    );

    const activeVoiceCount = await this.prismaService.voiceProfile.count({
      where: { userId, isActive: true },
    });
    await this.prismaService.user.update({
      where: { id: userId },
      data: { voiceProfilesCount: activeVoiceCount },
    });

    return { message: 'Voice profile deleted' };
  }

  async listStories(
    userId: string,
    voiceProfileId: string,
    page = 1,
    limit = 20,
  ) {
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id: voiceProfileId },
      select: { id: true, userId: true },
    });
    if (!voice || voice.userId !== userId)
      throw new NotFoundException('Voice profile not found');

    const skip = (page - 1) * limit;

    const [items, total] = await this.prismaService.$transaction([
      this.prismaService.story.findMany({
        where: { voiceProfileId, userId },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
        select: {
          id: true,
          userId: true,
          voiceProfileId: true,
          voiceProfile: { select: { typeCode: true } },
          title: true,
          content: true,
          isFeatured: true,
          promptUsed: true,
          audioStatus: true,
          audioUrl: true,
          audioDuration: true,
          audioFormat: true,
          lastPlayedAt: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prismaService.story.count({ where: { voiceProfileId, userId } }),
    ]);

    const mappedItems = items.map(({ voiceProfile, ...story }) => ({
      ...story,
      type: voiceProfile?.typeCode ?? null,
      elevenLabsRequestId: null, // Not exposing this for now since it's not currently used on the frontend and would require additional DB query to fetch for each story if we want to support it for stories that don't have it in the main table.
    }));

    return {
      items: mappedItems,
      total,
      page,
      limit,
    };
  }
}
