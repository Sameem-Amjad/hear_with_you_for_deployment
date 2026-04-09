import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { Response } from 'express';
import { MulterError } from 'multer';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = 'Internal server error';
    let error = 'InternalServerError';

    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const exceptionResponse = exception.getResponse();
      const resolvedMessage =
        typeof exceptionResponse === 'string'
          ? exceptionResponse
          : Array.isArray((exceptionResponse as { message?: unknown }).message)
            ? (exceptionResponse as { message: string[] }).message.join(', ')
            : ((exceptionResponse as { message?: string }).message ??
              exception.message);
      message = resolvedMessage;
      error = exception.name;
    } else if (exception instanceof Prisma.PrismaClientKnownRequestError) {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'DatabaseError';
      if (exception.code === 'P2002') {
        message = 'Resource already exists';
      } else if (exception.code === 'P2025') {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'Resource not found';
      } else if (exception.code === 'P2003') {
        message = 'Invalid reference';
      }
    } else if (exception instanceof MulterError) {
      statusCode = HttpStatus.BAD_REQUEST;
      error = 'FileUploadError';
      if (exception.code === 'LIMIT_FILE_SIZE') {
        message = 'Uploaded file is too large';
      } else {
        message = exception.message;
      }
    } else if (exception instanceof Error) {
      error = exception.name;
      if (exception.message.includes('auth/id-token-expired')) {
        statusCode = HttpStatus.UNAUTHORIZED;
        message = 'Token expired';
      } else if (
        exception.message.includes('auth/argument-error') ||
        exception.message.includes('auth/invalid-id-token')
      ) {
        statusCode = HttpStatus.UNAUTHORIZED;
        message = 'Invalid token';
      } else if (exception.message.includes('auth/user-not-found')) {
        statusCode = HttpStatus.NOT_FOUND;
        message = 'User not found';
      } else {
        message = exception.message || message;
      }
    }

    this.logger.error(
      message,
      exception instanceof Error ? exception.stack : undefined,
    );

    response.status(statusCode).json({
      success: false,
      statusCode,
      message,
      error,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}
