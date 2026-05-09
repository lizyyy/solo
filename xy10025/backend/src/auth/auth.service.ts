import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../users/user.entity';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly jwtService: JwtService,
  ) {}

  async register(dto: RegisterDto) {
    const existingUser = await this.userRepository.findOne({
      where: [{ username: dto.username }, { email: dto.email }],
    });

    if (existingUser) {
      throw new UnauthorizedException('用户名或邮箱已存在');
    }

    const hashedPassword = await bcrypt.hash(dto.password, 10);

    const user = this.userRepository.create({
      username: dto.username,
      email: dto.email,
      password: hashedPassword,
      displayName: dto.displayName || dto.username,
    });

    await this.userRepository.save(user);

    return this.generateTokens(user);
  }

  async login(dto: LoginDto) {
    const user = await this.userRepository.findOne({
      where: [{ username: dto.username }, { email: dto.username }],
    });

    if (!user) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用');
    }

    const isPasswordValid = await bcrypt.compare(dto.password, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedException('用户名或密码错误');
    }

    return this.generateTokens(user);
  }

  async validateUser(userId: string): Promise<User> {
    const user = await this.userRepository.findOne({
      where: { id: userId },
    });

    if (!user) {
      throw new UnauthorizedException('用户不存在');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('账户已被禁用');
    }

    return user;
  }

  private generateTokens(user: User) {
    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
    };

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        displayName: user.displayName,
      },
    };
  }
}
