import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as bcrypt from 'bcrypt';
import { User } from '../user/user.entity';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ActionType } from '../../common/enums/action-type.enum';
import { LogLevel } from '../../common/enums/log-level.enum';

@Injectable()
export class AuthService {
  constructor(
    @InjectRepository(User)
    private usersRepository: Repository<User>,
    private jwtService: JwtService,
    private auditLogService: AuditLogService,
  ) {}

  async register(registerDto: RegisterDto): Promise<User> {
    const hashedPassword = await bcrypt.hash(registerDto.password, 10);

    const user = this.usersRepository.create({
      ...registerDto,
      password: hashedPassword,
    });

    const savedUser = await this.usersRepository.save(user);

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.CREATE,
      entityType: 'User',
      entityId: savedUser.id,
      performedById: savedUser.id,
      performedByUsername: savedUser.username,
      description: `User registered: ${savedUser.username}`,
      details: { email: savedUser.email, role: savedUser.role },
    });

    return savedUser;
  }

  async login(loginDto: LoginDto): Promise<{ accessToken: string; user: Partial<User> }> {
    const user = await this.usersRepository.findOne({
      where: { username: loginDto.username },
    });

    if (!user || !(await bcrypt.compare(loginDto.password, user.password))) {
      await this.auditLogService.create({
        level: LogLevel.WARN,
        actionType: ActionType.CREATE,
        entityType: 'Auth',
        performedByUsername: loginDto.username,
        description: `Failed login attempt for: ${loginDto.username}`,
      });
      throw new UnauthorizedException('Invalid credentials');
    }

    if (!user.isActive) {
      throw new UnauthorizedException('Account is disabled');
    }

    const payload = {
      sub: user.id,
      username: user.username,
      email: user.email,
      role: user.role,
    };

    await this.auditLogService.create({
      level: LogLevel.INFO,
      actionType: ActionType.CREATE,
      entityType: 'Auth',
      performedById: user.id,
      performedByUsername: user.username,
      description: `User logged in: ${user.username}`,
    });

    return {
      accessToken: this.jwtService.sign(payload),
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        fullName: user.fullName,
        role: user.role,
      },
    };
  }

  async validateUser(username: string, password: string): Promise<any> {
    const user = await this.usersRepository.findOne({ where: { username } });
    if (user && (await bcrypt.compare(password, user.password))) {
      const { password, ...result } = user;
      return result;
    }
    return null;
  }
}
