import {
  CanActivate,
  ExecutionContext,
  Injectable,
  ForbiddenException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { AuthenticatedRequest } from '../interfaces/request.interface';

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const user = req.user;
    if (!user?.email) {
      throw new ForbiddenException('Admin access denied');
    }
    const allow = (this.configService.get<string>('ADMIN_EMAILS') ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean);

    if (allow.length === 0) {
      throw new ForbiddenException('Admin access not configured');
    }
    if (!allow.includes(user.email.toLowerCase())) {
      throw new ForbiddenException('Admin access denied');
    }
    return true;
  }
}
