import { Controller, Get, Post, Put, Delete, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProductService } from './product.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser } from '../../common/decorators/user.decorator';
import { User, UserRole } from '@prisma/client';
import { success } from '../../common/types/api-response.type';
import { SetMetadata } from '@nestjs/common';

const ROLES_KEY = 'roles';
const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@ApiTags('商品管理')
@ApiBearerAuth()
@Controller('products')
@UseGuards(AuthGuard)
export class ProductController {
  constructor(private readonly productService: ProductService) {}

  @Post()
  @ApiOperation({ summary: '创建商品' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async create(
    @Body() data: any,
    @CurrentUser() user: User,
  ) {
    const result = await this.productService.create(data, user.id);
    return success(result, '创建成功');
  }

  @Get()
  @ApiOperation({ summary: '获取商品列表' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('keyword') keyword?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: boolean,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.productService.findAll(
      { keyword, category, isActive },
      limit,
      offset,
    );
    return success(result);
  }

  @Get('categories')
  @ApiOperation({ summary: '获取商品分类列表' })
  @HttpCode(HttpStatus.OK)
  async getCategories() {
    const result = await this.productService.getCategories();
    return success(result);
  }

  @Get('sku/:sku')
  @ApiOperation({ summary: '按 SKU 获取商品' })
  @HttpCode(HttpStatus.OK)
  async findBySku(@Param('sku') sku: string) {
    const result = await this.productService.findBySku(sku);
    return success(result);
  }

  @Get(':id')
  @ApiOperation({ summary: '获取商品详情' })
  @HttpCode(HttpStatus.OK)
  async findById(@Param('id') id: string) {
    const result = await this.productService.findById(id);
    return success(result);
  }

  @Put(':id')
  @ApiOperation({ summary: '更新商品' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async update(
    @Param('id') id: string,
    @Body() data: any,
    @CurrentUser() user: User,
  ) {
    const result = await this.productService.update(id, data, user.id);
    return success(result, '更新成功');
  }

  @Put(':id/toggle')
  @ApiOperation({ summary: '启用/禁用商品' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async toggleActive(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    const result = await this.productService.toggleActive(id, user.id);
    return success(result, '操作成功');
  }

  @Delete(':id')
  @ApiOperation({ summary: '删除商品' })
  @Roles(UserRole.ADMIN)
  @HttpCode(HttpStatus.OK)
  async delete(
    @Param('id') id: string,
    @CurrentUser() user: User,
  ) {
    await this.productService.delete(id, user.id);
    return success(null, '删除成功');
  }
}
