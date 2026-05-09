import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { AuditService } from '../../modules/audit/audit.service';
import { Reflector } from '@nestjs/core';
import { AUDIT_LOG_METADATA } from '../decorators/audit.decorator';
import { AuditOperation, AuditEntity } from '@prisma/client';

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  constructor(
    private readonly reflector: Reflector,
    private readonly auditService: AuditService,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const auditMetadata = this.reflector.getAllAndOverride(AUDIT_LOG_METADATA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (!auditMetadata) {
      return next.handle();
    }

    const { operation, entity } = auditMetadata;
    const requestId = request.headers['x-request-id'] as string;
    const userId = request.user?.id;
    const operatorName = request.user?.name;
    const ipAddress = request.ip || request.connection?.remoteAddress;
    const userAgent = request.headers['user-agent'];

    const beforeSnapshot = { ...request.body };

    return next.handle().pipe(
      tap({
        next: async (result) => {
          let entityId = result?.id;
          let entityName = result?.name || result?.username;

          if (!entityId && request.params) {
            entityId = request.params.id;
          }

          await this.auditService.log({
            requestId,
            operation,
            entity,
            entityId,
            entityName,
            beforeSnapshot,
            afterSnapshot: result,
            userId,
            operatorName,
            ipAddress,
            userAgent,
            remark: auditMetadata.remark || `${operation} ${entity}`,
          });
        },
        error: async (error) => {
          await this.auditService.log({
            requestId,
            operation,
            entity,
            entityId: request.params?.id,
            beforeSnapshot,
            userId,
            operatorName,
            ipAddress,
            userAgent,
            remark: `操作失败: ${error.message}`,
          });
        },
      }),
    );
  }
}
