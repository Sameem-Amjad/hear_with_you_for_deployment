import {
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Twilio from 'twilio';
import { E164_REGEX } from '../../common/validators/phone.decorator';

@Injectable()
export class SmsService {
  private readonly logger = new Logger(SmsService.name);
  private readonly client: Twilio.Twilio;

  constructor(private readonly configService: ConfigService) {
    this.client = Twilio(
      this.configService.getOrThrow<string>('TWILIO_ACCOUNT_SID'),
      this.configService.getOrThrow<string>('TWILIO_AUTH_TOKEN'),
    );
  }

  async sendOtp(phone: string, otp: string): Promise<void> {
    if (!E164_REGEX.test(phone)) {
      throw new InternalServerErrorException(
        'Invalid phone format for SMS delivery',
      );
    }

    try {
      const message = await this.client.messages.create({
        to: phone,
        from: this.configService.getOrThrow<string>('TWILIO_PHONE_NUMBER'),
        body: `Your verification code is: ${otp}. Valid for 5 minutes. Do not share.`,
      });
      this.logger.log(`OTP SMS sent to ${phone}. SID: ${message.sid}`);
    } catch (error) {
      this.logger.error(
        `Failed to send SMS to ${phone}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw new InternalServerErrorException('Failed to send OTP SMS');
    }
  }
}
