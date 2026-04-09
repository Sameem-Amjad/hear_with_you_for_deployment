import {
  CallHandler,
  ExecutionContext,
  Injectable,
  Logger,
  NestInterceptor,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Observable, tap } from 'rxjs';
import { ActivityService } from '../../modules/activity/activity.service';
import type { AuthenticatedRequest } from '../interfaces/request.interface';
import { stripSensitiveFields } from '../utils/sanitizers.util';

@Injectable()
export class ActivityLoggerInterceptor implements NestInterceptor {
  private readonly logger = new Logger(ActivityLoggerInterceptor.name);

  constructor(private readonly activityService: ActivityService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();

    return next.handle().pipe(
      tap({
        next: () => {
          if (!request.user) {
            return;
          }
          const description = this.describe(
            request.method,
            request.originalUrl ?? request.url,
          );
          void this.activityService
            .logActivity({
              userId: request.user.id,
              action: `${request.method} ${request.originalUrl ?? request.url}`,
              description,
              ipAddress: request.ip,
              userAgent: request.headers['user-agent'],
              metadata:
                request.body && typeof request.body === 'object'
                  ? (stripSensitiveFields(
                      request.body as Record<string, unknown>,
                    ) as Prisma.InputJsonValue)
                  : undefined,
            })
            .catch((error: unknown) => {
              this.logger.warn(`Failed to auto-log activity: ${String(error)}`);
            });
        },
      }),
    );
  }

  private describe(method: string, url: string): string {
    if (url.includes('login')) return 'User logged in';
    if (url.includes('profile')) return 'Profile updated';
    if (url.includes('logout')) return 'User logged out';
    return `Handled ${method} ${url}`;
  }
}
