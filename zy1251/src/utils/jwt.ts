import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { config } from '../config';

export interface JwtPayload {
  userId: string;
  tenantId: string;
  email: string;
  roles: string[];
  type: 'access' | 'refresh';
  jti: string;
}

export function generateAccessToken(payload: Omit<JwtPayload, 'type' | 'jti'>): string {
  const accessPayload: JwtPayload = {
    ...payload,
    type: 'access',
    jti: uuidv4(),
  };
  return jwt.sign(accessPayload, config.jwt.secret, {
    expiresIn: config.jwt.accessExpiresIn,
  });
}

export function generateRefreshToken(payload: Omit<JwtPayload, 'type' | 'jti'>): string {
  const refreshPayload: JwtPayload = {
    ...payload,
    type: 'refresh',
    jti: uuidv4(),
  };
  return jwt.sign(refreshPayload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });
}

export function verifyToken(token: string): JwtPayload | null {
  try {
    const decoded = jwt.verify(token, config.jwt.secret) as JwtPayload;
    return decoded;
  } catch {
    return null;
  }
}

export function decodeToken(token: string): JwtPayload | null {
  try {
    return jwt.decode(token) as JwtPayload | null;
  } catch {
    return null;
  }
}
