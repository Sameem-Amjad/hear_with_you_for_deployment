import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { parseBuffer } from 'music-metadata';
import { Prisma, SubscriptionTier, VoiceStatus } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';
import { CreateVoiceProfileDto } from './dto/create-voice-profile.dto';
import { UpdateVoiceProfileDto } from './dto/update-voice-profile.dto';
import { ElevenLabsService } from './elevenlabs.service';

@Injectable()
export class VoiceProfileService {
  private readonly logger = new Logger(VoiceProfileService.name);

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly elevenLabsService: ElevenLabsService,
  ) {}

  private maxVoicesForTier(tier: SubscriptionTier): number {
    switch (tier) {
      case SubscriptionTier.FREE:
        return 1;
      case SubscriptionTier.PREMIUM:
        return 3;
      case SubscriptionTier.PLATINUM:
        return 10;
      default:
        return 10;
    }
  }

  private async getUserTier(userId: string): Promise<SubscriptionTier> {
    const user = await this.prismaService.user.findUnique({
      where: { id: userId },
      select: { subscriptionTier: true, isDeleted: true, isActive: true },
    });
    if (!user || user.isDeleted || !user.isActive) {
      throw new NotFoundException('User not found');
    }
    return user.subscriptionTier;
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

    const tier = await this.getUserTier(userId);
    const existingCount = await this.prismaService.voiceProfile.count({
      where: { userId, isActive: true },
    });
    if (existingCount >= this.maxVoicesForTier(tier)) {
      throw new ForbiddenException(
        'Voice profile limit reached for your subscription tier',
      );
    }

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

    const voiceProfile = await this.prismaService.voiceProfile.create({
      data: {
        userId,
        name: dto.name,
        description: dto.description,
        sampleAudioUrls,
        sampleDuration: totalDurationSeconds || undefined,
        status: VoiceStatus.PROCESSING,
      },
    });

    // Clone voice in ElevenLabs (synchronous for now; queued orchestration added later).
    try {
      const addRes = await this.elevenLabsService.addVoice({
        name: voiceProfile.name,
        description: voiceProfile.description ?? undefined,
        files: files.map((f) => ({
          filename: f.originalname,
          buffer: f.buffer,
          mimetype: f.mimetype,
        })),
      });

      const updated = await this.prismaService.voiceProfile.update({
        where: { id: voiceProfile.id },
        data: {
          elevenLabsVoiceId: addRes.voice_id,
          status: VoiceStatus.READY,
          processingError: null,
        },
      });

      return {
        message: 'Voice profile created',
        voiceProfile: updated,
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

  async list(userId: string) {
    const items = await this.prismaService.voiceProfile.findMany({
      where: { userId, isActive: true },
      orderBy: { createdAt: 'desc' },
    });
    return {
      voiceProfiles: items,
    };
  }

  async get(userId: string, id: string) {
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id },
    });
    if (!voice || voice.userId !== userId)
      throw new NotFoundException('Voice profile not found');
    return { voiceProfile: voice };
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
    return { message: 'Voice profile updated', voiceProfile: updated };
  }

  async remove(userId: string, id: string) {
    const voice = await this.prismaService.voiceProfile.findUnique({
      where: { id },
    });
    if (!voice || voice.userId !== userId)
      throw new NotFoundException('Voice profile not found');

    if (voice.elevenLabsVoiceId) {
      await this.elevenLabsService
        .deleteVoice(voice.elevenLabsVoiceId)
        .catch(() => undefined);
    }

    await this.prismaService.voiceProfile.update({
      where: { id },
      data: { isActive: false, status: VoiceStatus.DELETED },
    });
    return { message: 'Voice profile deleted' };
  }
}
