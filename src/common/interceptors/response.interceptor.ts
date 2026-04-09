import {
  CallHandler,
  ExecutionContext,
  Injectable,
  NestInterceptor,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { Observable, map } from 'rxjs';
import { buildSuccessResponse } from '../utils/response.util';

@Injectable()
export class ResponseInterceptor implements NestInterceptor {
  constructor(private readonly reflector: Reflector) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const http = context.switchToHttp();
    const response = http.getResponse<{ statusCode?: number }>();

    return next.handle().pipe(
      map((body: unknown) => {
        if (body instanceof Buffer) {
          return body;
        }
        if (
          typeof body === 'object' &&
          body !== null &&
          'pipe' in (body as Record<string, unknown>)
        ) {
          return body;
        }

        const statusCode = response.statusCode ?? 200;
        const payload =
          typeof body === 'object' && body !== null
            ? (body as Record<string, unknown>)
            : { data: body };
        const message =
          typeof payload.message === 'string'
            ? payload.message
            : statusCode >= 200 && statusCode < 300
              ? 'Request successful'
              : 'Request completed';
        const data =
          Object.prototype.hasOwnProperty.call(payload, 'data') &&
          Object.keys(payload).length <= 2
            ? payload.data
            : payload;

        return buildSuccessResponse(statusCode, data, message);
      }),
    );
  }
}
