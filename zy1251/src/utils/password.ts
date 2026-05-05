import bcrypt from 'bcryptjs';
import { config } from '../config';

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, config.bcrypt.saltRounds);
}

export async function comparePassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}
