import { Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  protected async handleRequest(requestProps: any): Promise<boolean> {
    const isDev = process.env.NODE_ENV === 'development';

    if (isDev) {
      if (requestProps?.limit) {
        requestProps.limit = requestProps.limit * 100;
      }
      if (requestProps?.ttl) {
        requestProps.ttl = 60000;
      }
    }

    return super.handleRequest(requestProps);
  }
}
