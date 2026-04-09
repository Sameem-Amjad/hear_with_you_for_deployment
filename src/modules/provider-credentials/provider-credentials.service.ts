import { Injectable, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CredentialProvider } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import {
  decryptString,
  encryptString,
} from '../../common/crypto/encryption.util';

@Injectable()
export class ProviderCredentialsService {
  constructor(
    private readonly prismaService: PrismaService,
    private readonly configService: ConfigService,
  ) {}

  private get encryptionKey(): string {
    return this.configService.getOrThrow<string>('APP_ENCRYPTION_KEY');
  }

  async setProviderKey(
    provider: CredentialProvider,
    plaintextKey: string,
  ): Promise<void> {
    const encryptedKey = encryptString(plaintextKey, this.encryptionKey);
    await this.prismaService.providerCredential.upsert({
      where: { provider },
      create: {
        provider,
        encryptedKey,
        isActive: true,
        lastRotatedAt: new Date(),
      },
      update: {
        encryptedKey,
        isActive: true,
        lastRotatedAt: new Date(),
      },
    });
  }

  async getProviderKey(provider: CredentialProvider): Promise<string> {
    const record = await this.prismaService.providerCredential.findFirst({
      where: { provider, isActive: true },
    });
    if (!record) {
      throw new NotFoundException(`Provider key not configured: ${provider}`);
    }
    return decryptString(record.encryptedKey, this.encryptionKey);
  }
}
