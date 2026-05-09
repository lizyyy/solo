import { Injectable, NestInterceptor, ExecutionContext, CallHandler, Logger } from '@nestjs/common';
import { Observable } from 'rxjs';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger(RequestIdInterceptor.name);

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const headerName = process.env.REQUEST_ID_HEADER || 'x-request-id';

    if (!request.headers[headerName]) {
      request.headers[headerName] = uuidv4();
      request.requestId = request.headers[headerName];
      this.logger.debug(`生成新的 Request ID: ${request.headers[headerName]}`);
    } else {
      request.requestId = request.headers[headerName];
    }

    return next.handle();
  }
}
