import { Request, Response, NextFunction } from 'express';
import { IdempotencyDAO } from '../dao/IdempotencyDAO';

const idempotencyDAO = new IdempotencyDAO();

export function idempotencyMiddleware(requiredFor: string[] = ['POST', 'PUT', 'PATCH']) {
  return async (req: Request, res: Response, next: NextFunction) => {
    if (!requiredFor.includes(req.method)) {
      return next();
    }

    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    if (!idempotencyKey) {
      return res.status(400).json({
        success: false,
        error: {
          code: 'MISSING_IDEMPOTENCY_KEY',
          message: '请求必须包含 x-idempotency-key 头以防止重复调用'
        }
      });
    }

    try {
      const result = await idempotencyDAO.checkAndSet(idempotencyKey, req.path);

      if (result.exists) {
        return res.status(200).json({
          ...result.responseData,
          idempotency: 'reused'
        });
      }

      const originalJson = res.json.bind(res);
      res.json = (data: any) => {
        idempotencyDAO.updateResponse(idempotencyKey, req.path, data).catch(err => {
          console.error('保存幂等响应失败:', err);
        });
        return originalJson(data);
      };

      next();
    } catch (error) {
      next(error);
    }
  };
}
