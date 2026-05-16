import { Request, Response, NextFunction } from 'express';
import Joi from 'joi';
export declare function validateRequest(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
export declare function validateQuery(schema: Joi.ObjectSchema): (req: Request, res: Response, next: NextFunction) => void;
export declare function errorHandler(error: Error, req: Request, res: Response, next: NextFunction): void;
export declare function notFoundHandler(req: Request, res: Response): void;
