import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { Request, Response } from 'express';

@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    const errorResponse =
      typeof exceptionResponse === 'object'
        ? exceptionResponse
        : { message: exceptionResponse };

    response.status(status).json({
      code: (errorResponse as any).code || status,
      message: (errorResponse as any).message || exception.message,
      timestamp: new Date().toISOString(),
      path: request.url,
      details: (errorResponse as any).details,
    });
  }
}
