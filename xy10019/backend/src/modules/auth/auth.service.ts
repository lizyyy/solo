import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import * as bcrypt from 'bcrypt';
import { User, UserRole } from '@prisma/client';

export interface JwtPayload {
  sub: string;
  username: string;
  role: UserRole;
  storeId?: string;
}

export interface LoginResult {
  accessToken: string;
  user: Partial<User> & { store?: any };
}

@Injectable()
export class AuthService {
  constructor(
    private prismaService: PrismaService,
    private jwtService: JwtService,
  ) {}

  async login(username: string, password: string): Promise<LoginResult> {
    const user = await this.prismaService.user.findUnique({
      where: { username },
      include: { store: true },
    });

    if (!user || !user.isActive) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    const payload: JwtPayload = {
      sub: user.id,
      username: user.username,
      role: user.role,
      storeId: user.storeId,
    };

    const accessToken = this.jwtService.sign(payload);

    return {
      accessToken,
      user: {
        id: user.id,
        username: user.username,
        name: user.name,
        email: user.email,
        phone: user.phone,
        role: user.role,
        storeId: user.storeId,
        store: user.store,
      },
    };
  }

  async register(
    data: {
      username: string;
      password: string;
      name: string;
      email?: string;
      phone?: string;
      role?: UserRole;
      storeId?: string;
    },
  ): Promise<User> {
    const existing = await this.prismaService.user.findUnique({
      where: { username: data.username },
    });

    if (existing) {
      throw new BadRequestException('用户名已存在');
    }

    if (data.email) {
      const existingEmail = await this.prismaService.user.findUnique({
        where: { email: data.email },
      });
      if (existingEmail) {
        throw new BadRequestException('邮箱已被使用');
      }
    }

    const hashedPassword = await bcrypt.hash(data.password, 10);

    return this.prismaService.user.create({
      data: {
        username: data.username,
        password: hashedPassword,
        name: data.name,
        email: data.email,
        phone: data.phone,
        role: data.role || UserRole.OPERATOR,
        storeId: data.storeId,
      },
    });
  }

  async findById(id: string): Promise<User | null> {
    return this.prismaService.user.findUnique({
      where: { id },
      include: { store: true },
    });
  }

  async validateToken(token: string): Promise<JwtPayload | null> {
    try {
      const payload = this.jwtService.verify<JwtPayload>(token);
      return payload;
    } catch {
      return null;
    }
  }

  async updateLastLogin(userId: string): Promise<void> {
    await this.prismaService.user.update({
      where: { id: userId },
      data: { lastLogin: new Date() },
    });
  }
}
