import { Request, Response, NextFunction } from 'express';
import { checkIdempotency, createIdempotencyRecord, updateIdempotencyResponse } from '../utils/idempotency';
import { successResponse } from '../utils/response';

export function idempotencyMiddleware(operationType: string) {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      return next();
    }

    const result = await checkIdempotency(idempotencyKey, operationType);

    if (result.exists) {
      if (result.response) {
        const responseData = JSON.parse(result.response);
        return res.status(responseData.code).json(responseData);
      }
      return successResponse(res, { idempotencyKey, resourceId: result.resourceId }, '请求已处理', 200);
    }

    await createIdempotencyRecord(idempotencyKey, operationType);

    const originalJson = res.json.bind(res);
    res.json = function(body: any) {
      updateIdempotencyResponse(idempotencyKey, JSON.stringify(body), body.data?.id);
      return originalJson(body);
    };

    next();
  };
}
