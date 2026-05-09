import { ExceptionFilter, Catch, ArgumentsHost, HttpException, Logger, NotFoundException, BadRequestException, ForbiddenException, UnauthorizedException, ConflictException } from '@nestjs/common';
import { Request, Response } from 'express';

@Catch()
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    const requestId = request.headers['x-request-id'] as string;

    let status = 500;
    let message = '服务器内部错误';
    let code = 'INTERNAL_ERROR';
    let errors: any = null;

    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const responseBody = exception.getResponse();

      if (typeof responseBody === 'string') {
        message = responseBody;
      } else if (typeof responseBody === 'object') {
        message = (responseBody as any).message || message;
        errors = (responseBody as any).errors || null;
      }

      if (exception instanceof BadRequestException) {
        code = 'BAD_REQUEST';
      } else if (exception instanceof UnauthorizedException) {
        code = 'UNAUTHORIZED';
      } else if (exception instanceof ForbiddenException) {
        code = 'FORBIDDEN';
      } else if (exception instanceof NotFoundException) {
        code = 'NOT_FOUND';
      } else if (exception instanceof ConflictException) {
        code = 'CONFLICT';
      }
    } else if (exception instanceof Error) {
      this.logger.error(
        `未捕获的异常: ${exception.message}`,
        exception.stack,
      );
      
      if (exception.message.includes('乐观锁') || exception.message.includes('version')) {
        status = 409;
        code = 'CONCURRENT_MODIFICATION';
        message = '数据已被其他用户修改，请刷新后重试';
      } else if (exception.message.includes('锁') || exception.message.includes('lock')) {
        status = 409;
        code = 'RESOURCE_LOCKED';
        message = '资源正在处理中，请稍后重试';
      } else if (exception.message.includes('重复') || exception.message.includes('duplicate')) {
        status = 409;
        code = 'DUPLICATE_REQUEST';
        message = '请勿重复提交';
      }
    }

    this.logger.error(
      `[${requestId}] ${request.method} ${request.url} -> ${status}: ${message}`,
    );

    response.status(status).json({
      success: false,
      code,
      message,
      requestId,
      errors,
      timestamp: new Date().toISOString(),
    });
  }
}
