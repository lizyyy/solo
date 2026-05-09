import { Request, Response, NextFunction } from 'express';
import authService, { JwtPayload } from '../services/auth.service';
import { UserRole } from '../models/User';

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
  requestId?: string;
}

export const authMiddleware = (requiredRoles?: UserRole[]) => {
  return async (
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> => {
    try {
      const authHeader = req.headers.authorization;

      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        res.status(401).json({
          error: 'UNAUTHORIZED',
          message: 'Missing or invalid authorization header',
        });
        return;
      }

      const token = authHeader.substring(7);

      let payload: JwtPayload;
      try {
        payload = authService.verifyToken(token);
      } catch (error) {
        res.status(401).json({
          error: 'TOKEN_INVALID',
          message: 'Invalid or expired token',
        });
        return;
      }

      if (payload.type !== 'access') {
        res.status(401).json({
          error: 'TOKEN_TYPE_INVALID',
          message: 'Access token required',
        });
        return;
      }

      const user = await authService.getUserById(payload.id);
      if (!user || !user.isActive) {
        res.status(401).json({
          error: 'USER_NOT_FOUND',
          message: 'User not found or disabled',
        });
        return;
      }

      if (requiredRoles && requiredRoles.length > 0) {
        if (!requiredRoles.includes(payload.role)) {
          res.status(403).json({
            error: 'FORBIDDEN',
            message: 'Insufficient permissions',
          });
          return;
        }
      }

      req.user = payload;
      next();
    } catch (error) {
      res.status(500).json({
        error: 'INTERNAL_ERROR',
        message: 'Authentication failed',
      });
    }
  };
};

export const optionalAuthMiddleware = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      next();
      return;
    }

    const token = authHeader.substring(7);

    try {
      const payload = authService.verifyToken(token);
      if (payload.type === 'access') {
        const user = await authService.getUserById(payload.id);
        if (user && user.isActive) {
          req.user = payload;
        }
      }
    } catch {
      // Token invalid, but we don't enforce auth
    }

    next();
  } catch {
    next();
  }
};

export const requireAdmin = authMiddleware([UserRole.ADMIN]);
export const requireSupervisor = authMiddleware([UserRole.ADMIN, UserRole.SUPERVISOR]);
export const requireAgent = authMiddleware([UserRole.ADMIN, UserRole.SUPERVISOR, UserRole.AGENT]);

export default authMiddleware;
