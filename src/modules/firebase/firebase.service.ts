import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { App, cert, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { Auth, DecodedIdToken, UserRecord, getAuth } from 'firebase-admin/auth';

@Injectable()
export class FirebaseService {
  private readonly logger = new Logger(FirebaseService.name);
  private readonly app: App;
  private readonly auth: Auth;

  constructor(private readonly configService: ConfigService) {
    this.app =
      getApps().length > 0
        ? getApp()
        : initializeApp({
            credential: cert({
              projectId: this.configService.getOrThrow<string>(
                'FIREBASE_PROJECT_ID',
              ),
              clientEmail: this.configService.getOrThrow<string>(
                'FIREBASE_CLIENT_EMAIL',
              ),
              privateKey: this.configService
                .getOrThrow<string>('FIREBASE_PRIVATE_KEY')
                .replace(/\\n/g, '\n'),
            }),
          });
    this.auth = getAuth(this.app);
  }

  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    return this.auth.verifyIdToken(idToken, true);
  }

  async getUser(uid: string): Promise<UserRecord> {
    return this.auth.getUser(uid);
  }

  async createUser(params: {
    email?: string;
    phoneNumber?: string;
    password?: string;
    displayName?: string;
  }): Promise<UserRecord> {
    this.logger.log('Creating Firebase user');
    return this.auth.createUser(params);
  }

  async updatePassword(uid: string, newPassword: string): Promise<UserRecord> {
    return this.auth.updateUser(uid, { password: newPassword });
  }

  async createCustomToken(uid: string): Promise<string> {
    return this.auth.createCustomToken(uid);
  }

  async deleteUser(uid: string): Promise<void> {
    await this.auth.deleteUser(uid);
  }
}
