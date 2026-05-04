/* eslint-disable @typescript-eslint/no-unsafe-assignment */
/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OtpPurpose } from '@prisma/client';
import { createTransport, type Transporter } from 'nodemailer';
import type SMTPTransport from 'nodemailer/lib/smtp-transport';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly transporter: Transporter<SMTPTransport.SentMessageInfo>;

  constructor(private readonly configService: ConfigService) {
    this.transporter = createTransport({
      host: this.configService.getOrThrow<string>('SMTP_HOST'),
      port: this.configService.getOrThrow<number>('SMTP_PORT'),
      secure: false,
      requireTLS: true,
      auth: {
        user: this.configService.getOrThrow<string>('SMTP_USER'),
        pass: this.configService.getOrThrow<string>('SMTP_PASS'),
      },
    });
  }

  async sendOtp(
    email: string,
    otp: string,
    purpose: OtpPurpose,
  ): Promise<void> {
    const expiryMinutes =
      this.configService.getOrThrow<number>('OTP_EXPIRY_MINUTES');
    const subjectMap: Record<OtpPurpose, string> = {
      REGISTRATION: 'Your Registration OTP',
      LOGIN: 'Your Login OTP',
      FORGOT_PASSWORD: 'Password Reset OTP',
      VERIFICATION: 'Verification OTP',
    };

    try {
      await this.transporter.sendMail({
        from: this.configService.getOrThrow<string>('EMAIL_FROM'),
        to: email,
        subject: subjectMap[purpose],
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
            <h2>Hear With You Nest</h2>
            <p>Your one-time verification code is:</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 8px; margin: 24px 0;">${otp}</div>
            <p>This code expires in ${expiryMinutes} minutes.</p>
            <p>Do not share this code with anyone.</p>
          </div>
        `,
      });
      this.logger.log(`OTP email sent to ${email} for ${purpose}`);
    } catch (error) {
      this.logger.error(
        `Failed to send OTP email to ${email}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to send OTP email');
    }
  }

  async sendWelcomeEmail(email: string, name?: string): Promise<void> {
    try {
      await this.transporter.sendMail({
        from: this.configService.getOrThrow<string>('EMAIL_FROM'),
        to: email,
        subject: 'Welcome to Hear With You Nest',
        html: `<p>Hello ${name ?? 'there'}, welcome to Hear With You Nest.</p>`,
      });
    } catch (error) {
      this.logger.warn(
        `Failed to send welcome email to ${email}: ${String(error)}`,
      );
    }
  }
}
