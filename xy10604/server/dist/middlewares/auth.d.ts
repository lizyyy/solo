import { Request, Response, NextFunction } from 'express';
import { UserRole } from '@prisma/client';
export interface AuthRequest extends Request {
    user?: {
        id: string;
        username: string;
        role: UserRole;
        name: string;
    };
}
export declare const authenticateToken: (req: AuthRequest, res: Response, next: NextFunction) => Promise<Response<any, Record<string, any>> | undefined>;
export declare const requireRoles: (...roles: UserRole[]) => (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireAdmin: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireReviewer: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
export declare const requireAuditor: (req: AuthRequest, res: Response, next: NextFunction) => Response<any, Record<string, any>> | undefined;
