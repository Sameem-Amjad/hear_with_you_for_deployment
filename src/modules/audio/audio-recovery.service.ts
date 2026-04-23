import {
  AudioStatus,
} from '@prisma/client';
import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { StorageService } from '../storage/storage.service';

@Injectable()
export class AudioRecoveryService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AudioRecoveryService.name);
  private timer: NodeJS.Timeout | null = null;
  private running = false;

  constructor(
    private readonly prismaService: PrismaService,
    private readonly storageService: StorageService,
    private readonly configService: ConfigService,
  ) {}

  onModuleInit(): void {
    const intervalMs = this.getIntervalMs();
    this.timer = setInterval(() => {
      void this.runRecoveryCycle();
    }, intervalMs);

    // Run once shortly after startup to recover interrupted jobs.
    setTimeout(() => {
      void this.runRecoveryCycle();
    }, 15_000);

    this.logger.log(`Audio recovery job started. Interval=${intervalMs}ms`);
  }

  onModuleDestroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
  }

  private getIntervalMs(): number {
    const raw = this.configService.get<string>('AUDIO_RECOVERY_INTERVAL_MS');
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return 5 * 60 * 1000;
    }
    return parsed;
  }

  private async runRecoveryCycle(): Promise<void> {
    if (this.running) {
      this.logger.warn('Previous recovery cycle still running; skipping');
      return;
    }

    this.running = true;
    const startedAt = Date.now();
    this.logger.log('Audio recovery cycle started');
    try {
      const recovered = await this.recoverStories();
      const deleted = await this.cleanupOrphanedAudioObjects();
      const durationMs = Date.now() - startedAt;
      this.logger.log(
        `Audio recovery cycle complete. recovered=${recovered} orphanDeleted=${deleted} durationMs=${durationMs}`,
      );
    } catch (error) {
      this.logger.error(
        `Audio recovery cycle failed: ${String(error)}`,
        error instanceof Error ? error.stack : undefined,
      );
    } finally {
      this.running = false;
    }
  }

  private async recoverStories(): Promise<number> {
    const cutoffMinutes = this.getNumberEnv('AUDIO_RECOVERY_PROCESSING_MINUTES', 15);
    const cutoff = new Date(Date.now() - cutoffMinutes * 60 * 1000);
    const batchSize = this.getNumberEnv('AUDIO_RECOVERY_BATCH_SIZE', 200);

    const candidates = await this.prismaService.story.findMany({
      where: {
        OR: [
          {
            audioStatus: AudioStatus.PROCESSING,
            updatedAt: { lt: cutoff },
          },
          {
            audioStatus: AudioStatus.FAILED,
          },
        ],
      },
      orderBy: { updatedAt: 'asc' },
      take: batchSize,
      select: {
        id: true,
        userId: true,
        audioUrl: true,
        audioS3Key: true,
        audioStatus: true,
      },
    });

    this.logger.log(
      `Audio recovery candidates fetched. count=${candidates.length} cutoffMinutes=${cutoffMinutes} batchSize=${batchSize}`,
    );

    let recovered = 0;
    let markedFailed = 0;
    for (const story of candidates) {
      const candidateKey = this.getStoryAudioKey(story.audioS3Key, story.audioUrl);
      if (!candidateKey) {
        if (story.audioStatus === AudioStatus.PROCESSING) {
          await this.markStoryFailed(story.id, 'Recovery: stale PROCESSING with no audio key/url');
          markedFailed += 1;
        }
        continue;
      }

      const exists = await this.objectExists(candidateKey);
      if (exists) {
        const canonicalUrl = this.storageService.getPublicUrlFromKey(candidateKey);
        await this.prismaService.story.update({
          where: { id: story.id },
          data: {
            audioS3Key: candidateKey,
            audioUrl: canonicalUrl,
            audioStatus: AudioStatus.COMPLETED,
            audioError: null,
          },
        });
        recovered += 1;
        continue;
      }

      if (story.audioStatus === AudioStatus.PROCESSING) {
        await this.markStoryFailed(story.id, 'Recovery: stale PROCESSING but no object in storage');
        markedFailed += 1;
      }
    }

    this.logger.log(
      `Audio story recovery done. recovered=${recovered} markedFailed=${markedFailed}`,
    );

    return recovered;
  }

  private async cleanupOrphanedAudioObjects(): Promise<number> {
    const objects = await this.storageService.listObjectsByPrefix('audio/');
    if (objects.length === 0) {
      this.logger.log('Orphan cleanup skipped. No audio objects found in storage');
      return 0;
    }

    const graceMinutes = this.getNumberEnv('AUDIO_ORPHAN_GRACE_MINUTES', 30);
    const deleteLimit = this.getNumberEnv('AUDIO_ORPHAN_DELETE_LIMIT', 100);
    const graceCutoff = new Date(Date.now() - graceMinutes * 60 * 1000);

    const referencedKeys = await this.getReferencedAudioKeys();

    let deleted = 0;
    let skippedReferenced = 0;
    let skippedGrace = 0;
    for (const object of objects) {
      if (deleted >= deleteLimit) {
        break;
      }

      if (referencedKeys.has(object.key)) {
        skippedReferenced += 1;
        continue;
      }

      if (object.lastModified && object.lastModified > graceCutoff) {
        skippedGrace += 1;
        continue;
      }

      await this.storageService.deleteFileByKey(object.key);
      deleted += 1;
    }

    this.logger.log(
      `Orphan cleanup done. scanned=${objects.length} deleted=${deleted} skippedReferenced=${skippedReferenced} skippedGrace=${skippedGrace} deleteLimit=${deleteLimit}`,
    );

    return deleted;
  }

  private async getReferencedAudioKeys(): Promise<Set<string>> {
    const referenced = new Set<string>();
    const batchSize = 500;
    let cursor: string | undefined;

    while (true) {
      const stories = await this.prismaService.story.findMany({
        take: batchSize,
        ...(cursor
          ? {
              skip: 1,
              cursor: { id: cursor },
            }
          : {}),
        where: {
          OR: [{ audioS3Key: { not: null } }, { audioUrl: { not: null } }],
        },
        orderBy: { id: 'asc' },
        select: {
          id: true,
          audioS3Key: true,
          audioUrl: true,
        },
      });

      if (stories.length === 0) {
        break;
      }

      for (const story of stories) {
        const key = this.getStoryAudioKey(story.audioS3Key, story.audioUrl);
        if (key) {
          referenced.add(key);
        }
      }

      cursor = stories[stories.length - 1].id;
    }

    return referenced;
  }

  private getStoryAudioKey(audioS3Key?: string | null, audioUrl?: string | null): string | null {
    if (audioS3Key) {
      return audioS3Key;
    }

    if (!audioUrl) {
      return null;
    }

    return this.storageService.getObjectKeyFromUrlOrKey(audioUrl);
  }

  private async objectExists(key: string): Promise<boolean> {
    try {
      await this.storageService.assertObjectExists(key);
      return true;
    } catch {
      return false;
    }
  }

  private async markStoryFailed(storyId: string, error: string): Promise<void> {
    await this.prismaService.story.update({
      where: { id: storyId },
      data: {
        audioStatus: AudioStatus.FAILED,
        audioError: error,
      },
    });
  }

  private getNumberEnv(name: string, fallback: number): number {
    const raw = this.configService.get<string>(name);
    const parsed = raw ? Number(raw) : NaN;
    if (!Number.isFinite(parsed) || parsed <= 0) {
      return fallback;
    }
    return parsed;
  }
}
