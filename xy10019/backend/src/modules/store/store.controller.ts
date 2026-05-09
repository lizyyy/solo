import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { StoreService } from './store.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User, UserRole } from '@prisma/client';
import { success } from '../../common/types/api-response.type';
import { SetMetadata } from '@nestjs/common';

const ROLES_KEY = 'roles';
const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@ApiTags('门店管理')
@ApiBearerAuth()
@Controller('stores')
@UseGuards(AuthGuard)
export class StoreController {
  constructor(private readonly storeService: StoreService) {}

  @Post()
  @ApiOperation({ summary: '创建门店' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() data: any,
    @CurrentUser() user: User,
  ) {
    const result = await this.storeService.create(data, user.id);
    return success(result, '创建成功');
  }

  @Get()
  @ApiOperation({ summary: '获取门店列表' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('isActive') isActive?: boolean,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.storeService.findAll(
      { keyword, isActive },
      limit,
      offset,
    );
    return success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取门店详情' })
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    const result = await this.storeService.findById(id);
    return success(result);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新门店' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() user: User,
  ) {
    const result = await this.storeService.update(id, data, user.id);
    return success(result, '更新成功');
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: '启用/禁用门店' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.storeService.toggleActive(id, user.id);
    return success(result, '操作成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除门店' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    await this.storeService.delete(id, user.id);
    return success(null, '删除成功');
  }
}
