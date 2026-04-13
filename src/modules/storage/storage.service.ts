import {
  BadRequestException,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GetObjectCommand,
  HeadObjectCommand,
  DeleteObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { extname } from 'path';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class StorageService {
  private readonly logger = new Logger(StorageService.name);
  private readonly client: S3Client;
  private readonly bucket: string;
  private readonly region: string;

  constructor(private readonly configService: ConfigService) {
    this.bucket = this.configService.getOrThrow<string>('DO_SPACES_BUCKET');
    this.region = this.configService.getOrThrow<string>('DO_SPACES_REGION');
    this.client = new S3Client({
      region: this.region,
      endpoint: this.configService.getOrThrow<string>('DO_SPACES_ENDPOINT'),
      credentials: {
        accessKeyId: this.configService.getOrThrow<string>('DO_SPACES_KEY'),
        secretAccessKey:
          this.configService.getOrThrow<string>('DO_SPACES_SECRET'),
      },
      forcePathStyle: false,
    });
  }

  validateImageFile(file: Express.Multer.File): void {
    const allowedMimeTypes = new Set([
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/webp',
    ]);

    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException(
        'Only jpg, jpeg, png, and webp images are allowed',
      );
    }

    if (file.size > 5 * 1024 * 1024) {
      throw new BadRequestException('Image size must not exceed 5MB');
    }
  }

  validateAudioFile(file: Express.Multer.File): void {
    const allowedMimeTypes = new Set(['audio/mpeg', 'audio/wav', 'audio/mp3']);
    if (!allowedMimeTypes.has(file.mimetype)) {
      throw new BadRequestException('Only mp3 and wav audio files are allowed');
    }
    if (file.size > 10 * 1024 * 1024) {
      throw new BadRequestException('Audio file size must not exceed 10MB');
    }
  }

  async uploadFile(file: Express.Multer.File, folder: string): Promise<string> {
    this.validateImageFile(file);

    const extension = extname(file.originalname).toLowerCase() || '.jpg';
    const filename = `${uuidv4()}-${Date.now()}${extension}`;
    const key = `hear_with_you/${folder.replace(/\/$/, '')}/${filename}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        }),
      );
      const url = `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
      this.logger.log(`Uploaded file to ${url}`);
      return url;
    } catch (error) {
      this.logger.error(
        'Failed to upload file',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('File upload failed');
    }
  }

  async uploadAudioFile(
    file: Express.Multer.File,
    folder: string,
  ): Promise<string> {
    this.validateAudioFile(file);

    const extension = extname(file.originalname).toLowerCase() || '.mp3';
    const filename = `${uuidv4()}-${Date.now()}${extension}`;
    const key = `${folder.replace(/\/$/, '')}/${filename}`;

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read',
        }),
      );
      const url = `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
      this.logger.log(`Uploaded audio to ${url}`);
      return url;
    } catch (error) {
      this.logger.error(
        'Failed to upload audio file',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('File upload failed');
    }
  }

  async uploadAudioBuffer(params: {
    buffer: Buffer;
    folder: string;
    filenameHint?: string;
    contentType?: string;
  }): Promise<{ url: string; key: string; size: number }> {
    const extension =
      extname(params.filenameHint ?? '').toLowerCase() || '.mp3';
    const filename = `${uuidv4()}-${Date.now()}${extension}`;
    const key = `${params.folder.replace(/\/$/, '')}/${filename}`;
    const contentType = params.contentType ?? 'audio/mpeg';

    try {
      await this.client.send(
        new PutObjectCommand({
          Bucket: this.bucket,
          Key: key,
          Body: params.buffer,
          ContentType: contentType,
          ACL: 'public-read',
        }),
      );
      const url = `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
      this.logger.log(`Uploaded audio buffer to ${url}`);
      return { url, key, size: params.buffer.length };
    } catch (error) {
      this.logger.error(
        'Failed to upload audio buffer',
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('File upload failed');
    }
  }

  async createAudioPresignedUpload(params: {
    userId: string;
    fileName: string;
    contentType: string;
    expiresInSeconds?: number;
  }): Promise<{
    key: string;
    uploadUrl: string;
    publicUrl: string;
    expiresInSeconds: number;
  }> {
    const extension = extname(params.fileName).toLowerCase() || '.mp3';
    const filename = `${uuidv4()}-${Date.now()}${extension}`;
    const key = `voice-samples/${params.userId}/uploads/${filename}`;
    const expiresInSeconds = params.expiresInSeconds ?? 900;

    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      ContentType: params.contentType,
      ACL: 'public-read',
    });

    const uploadUrl = await getSignedUrl(this.client, command, {
      expiresIn: expiresInSeconds,
    });

    return {
      key,
      uploadUrl,
      publicUrl: this.getPublicUrlFromKey(key),
      expiresInSeconds,
    };
  }

  getPublicUrlFromKey(key: string): string {
    return `https://${this.bucket}.${this.region}.digitaloceanspaces.com/${key}`;
  }

  async assertObjectExists(key: string): Promise<void> {
    await this.client.send(
      new HeadObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );
  }

  async downloadObjectBuffer(key: string): Promise<Buffer> {
    const response = await this.client.send(
      new GetObjectCommand({
        Bucket: this.bucket,
        Key: key,
      }),
    );

    if (!response.Body) {
      throw new InternalServerErrorException('File download failed');
    }

    const bytes = await response.Body.transformToByteArray();
    return Buffer.from(bytes);
  }

  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const parsed = new URL(fileUrl);
      const key = parsed.pathname.replace(/^\//, '');
      await this.client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
      this.logger.log(`Deleted file ${key}`);
    } catch (error) {
      this.logger.warn(`Failed to delete file ${fileUrl}: ${String(error)}`);
    }
  }
}
