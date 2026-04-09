import {
  CanActivate,
  ExecutionContext,
  Injectable,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { PrismaService } from '../../modules/prisma/prisma.service';
import { FirebaseService } from '../../modules/firebase/firebase.service';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';
import type { AuthenticatedRequest } from '../interfaces/request.interface';

@Injectable()
export class FirebaseAuthGuard implements CanActivate {
  private readonly logger = new Logger(FirebaseAuthGuard.name);

  constructor(
    private readonly reflector: Reflector,
    private readonly firebaseService: FirebaseService,
    private readonly prismaService: PrismaService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC_KEY, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const authorization = request.headers.authorization;

    if (!authorization?.startsWith('Bearer ')) {
      throw new UnauthorizedException('Authorization token is required');
    }

    const token = authorization.replace('Bearer ', '').trim();
    const decodedToken = await this.firebaseService.verifyIdToken(token);
    const firebaseUid = decodedToken.uid;

    const user = await this.prismaService.user.findFirst({
      where: {
        firebaseUid,
        isActive: true,
        isDeleted: false,
      },
    });

    if (!user) {
      throw new UnauthorizedException('User is not authorized');
    }

    request.user = user;
    void this.prismaService.user
      .update({
        where: { id: user.id },
        data: { lastActiveAt: new Date() },
      })
      .catch((error: unknown) => {
        this.logger.warn(`Failed to update lastActiveAt: ${String(error)}`);
      });

    return true;
  }
}
