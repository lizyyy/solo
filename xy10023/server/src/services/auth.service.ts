import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { v4 as uuidv4 } from 'uuid';
import { User, UserRole } from '../models/User';
import { config } from '../config';
import logger from '../utils/logger';

export interface RegisterUserDto {
  username: string;
  email: string;
  password: string;
  fullName: string;
  role?: UserRole;
}

export interface LoginUserDto {
  username: string;
  password: string;
}

export interface AuthToken {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

export interface JwtPayload {
  id: string;
  username: string;
  email: string;
  role: UserRole;
  type: 'access' | 'refresh';
}

const SALT_ROUNDS = 10;
const ACCESS_TOKEN_EXPIRES_IN = '2h';
const REFRESH_TOKEN_EXPIRES_IN = '7d';

class AuthService {
  async register(dto: RegisterUserDto): Promise<User> {
    const existingUser = await User.findOne({
      where: {
        [Symbol.for('or')]: [
          { username: dto.username },
          { email: dto.email },
        ] as any,
      },
    });

    if (existingUser) {
      throw new Error('Username or email already exists');
    }

    const passwordHash = await bcrypt.hash(dto.password, SALT_ROUNDS);

    const user = await User.create({
      id: uuidv4(),
      username: dto.username,
      email: dto.email,
      passwordHash,
      fullName: dto.fullName,
      role: dto.role || UserRole.AGENT,
    });

    logger.info(`User registered: ${user.username} (${user.id})`);

    return user;
  }

  async login(dto: LoginUserDto): Promise<{ user: User; tokens: AuthToken }> {
    const user = await User.findOne({
      where: { username: dto.username },
    });

    if (!user) {
      throw new Error('Invalid credentials');
    }

    if (!user.isActive) {
      throw new Error('Account is disabled');
    }

    const isValidPassword = await bcrypt.compare(dto.password, user.passwordHash);

    if (!isValidPassword) {
      throw new Error('Invalid credentials');
    }

    const tokens = this.generateTokens(user);

    logger.info(`User logged in: ${user.username} (${user.id})`);

    return { user, tokens };
  }

  async refreshToken(refreshToken: string): Promise<AuthToken> {
    try {
      const payload = jwt.verify(refreshToken, config.jwt.secret) as JwtPayload;

      if (payload.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const user = await User.findByPk(payload.id);
      if (!user || !user.isActive) {
        throw new Error('User not found or disabled');
      }

      return this.generateTokens(user);
    } catch (error) {
      logger.error('Refresh token failed:', error);
      throw new Error('Invalid refresh token');
    }
  }

  private generateTokens(user: User): AuthToken {
    const accessToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        email: user.email,
        role: user.role,
        type: 'access',
      } as JwtPayload,
      config.jwt.secret,
      { expiresIn: ACCESS_TOKEN_EXPIRES_IN }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        username: user.username,
        type: 'refresh',
      } as JwtPayload,
      config.jwt.secret,
      { expiresIn: REFRESH_TOKEN_EXPIRES_IN }
    );

    return {
      accessToken,
      refreshToken,
      expiresIn: 7200,
    };
  }

  verifyToken(token: string): JwtPayload {
    return jwt.verify(token, config.jwt.secret) as JwtPayload;
  }

  async getUserById(id: string): Promise<User | null> {
    return User.findByPk(id);
  }

  async changePassword(
    userId: string,
    oldPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const isValid = await bcrypt.compare(oldPassword, user.passwordHash);
    if (!isValid) {
      throw new Error('Invalid current password');
    }

    const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.update({ passwordHash: newPasswordHash });

    logger.info(`Password changed for user: ${user.username}`);
  }

  async resetPassword(userId: string, newPassword: string): Promise<void> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
    await user.update({ passwordHash });

    logger.info(`Password reset for user: ${user.username}`);
  }

  async listUsers(): Promise<User[]> {
    return User.findAll({
      order: [['createdAt', 'DESC']],
    });
  }

  async toggleUserActive(userId: string, isActive: boolean): Promise<User> {
    const user = await User.findByPk(userId);
    if (!user) {
      throw new Error('User not found');
    }

    await user.update({ isActive });

    logger.info(`User ${isActive ? 'activated' : 'deactivated'}: ${user.username}`);

    return user;
  }
}

export const authService = new AuthService();
export default authService;
