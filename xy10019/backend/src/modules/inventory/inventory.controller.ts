import { Controller, Get, Post, Put, Param, Body, Query, UseGuards, HttpCode, HttpStatus } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { InventoryService, InventoryOperationData, PriceChangeData, CreateTransferData } from './inventory.service';
import { AuthGuard } from '../auth/auth.guard';
import { CurrentUser, RequestId } from '../../common/decorators/user.decorator';
import { User, UserRole, TransferStatus } from '@prisma/client';
import { success } from '../../common/types/api-response.type';
import { SetMetadata } from '@nestjs/common';

const ROLES_KEY = 'roles';
const Roles = (...roles: UserRole[]) => SetMetadata(ROLES_KEY, roles);

@ApiTags('库存管理')
@ApiBearerAuth()
@Controller('inventory')
@UseGuards(AuthGuard)
export class InventoryController {
  constructor(private readonly inventoryService: InventoryService) {}

  @Get()
  @ApiOperation({ summary: '获取库存列表' })
  @HttpCode(HttpStatus.OK)
  async findAll(
    @Query('storeId') storeId?: string,
    @Query('productId') productId?: string,
    @Query('keyword') keyword?: string,
    @Query('lowStock') lowStock?: boolean,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.inventoryService.findAll(
      { storeId, productId, keyword, lowStock },
      limit,
      offset,
    );
    return success(result);
  }

  @Get(':storeId/:productId')
  @ApiOperation({ summary: '获取指定门店商品库存' })
  @HttpCode(HttpStatus.OK)
  async findByStoreAndProduct(
    @Param('storeId') storeId: string,
    @Param('productId') productId: string,
  ) {
    const result = await this.inventoryService.findByStoreAndProduct(storeId, productId);
    return success(result);
  }

  @Get('records')
  @ApiOperation({ summary: '获取库存变动记录' })
  @HttpCode(HttpStatus.OK)
  async getInventoryRecords(
    @Query('inventoryId') inventoryId?: string,
    @Query('storeId') storeId?: string,
    @Query('productId') productId?: string,
    @Query('operationType') operationType?: string,
    @Query('operatorId') operatorId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.inventoryService.getInventoryRecords(
      {
        inventoryId,
        storeId,
        productId,
        operationType,
        operatorId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      },
      limit,
      offset,
    );
    return success(result);
  }

  @Post('adjust')
  @ApiOperation({ summary: '调整库存' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER, UserRole.OPERATOR)
  @HttpCode(HttpStatus.OK)
  async adjust(
    @Body() data: InventoryOperationData,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.adjust(
      data,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '库存调整成功');
  }

  @Post('batch-adjust')
  @ApiOperation({ summary: '批量调整库存' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async batchAdjust(
    @Body() data: { operations: InventoryOperationData[] },
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.batchAdjust(
      data.operations,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '批量调整成功');
  }

  @Post('change-price')
  @ApiOperation({ summary: '变更价格' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async changePrice(
    @Body() data: PriceChangeData,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.changePrice(
      data,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '价格变更成功');
  }

  @Get('statistics')
  @ApiOperation({ summary: '获取库存统计' })
  @HttpCode(HttpStatus.OK)
  async getStatistics(@Query('storeId') storeId?: string) {
    const result = await this.inventoryService.getStatistics(storeId);
    return success(result);
  }

  @Post('transfers')
  @ApiOperation({ summary: '创建调拨单' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.CREATED)
  async createTransfer(
    @Body() data: CreateTransferData,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.createTransfer(
      data,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '调拨单创建成功');
  }

  @Get('transfers')
  @ApiOperation({ summary: '获取调拨单列表' })
  @HttpCode(HttpStatus.OK)
  async getTransferOrders(
    @Query('orderNo') orderNo?: string,
    @Query('sourceStoreId') sourceStoreId?: string,
    @Query('targetStoreId') targetStoreId?: string,
    @Query('status') status?: TransferStatus,
    @Query('operatorId') operatorId?: string,
    @Query('startTime') startTime?: string,
    @Query('endTime') endTime?: string,
    @Query('limit') limit: number = 50,
    @Query('offset') offset: number = 0,
  ) {
    const result = await this.inventoryService.getTransferOrders(
      {
        orderNo,
        sourceStoreId,
        targetStoreId,
        status,
        operatorId,
        startTime: startTime ? new Date(startTime) : undefined,
        endTime: endTime ? new Date(endTime) : undefined,
      },
      limit,
      offset,
    );
    return success(result);
  }

  @Get('transfers/:id')
  @ApiOperation({ summary: '获取调拨单详情' })
  @HttpCode(HttpStatus.OK)
  async getTransferOrderById(@Param('id') id: string) {
    const result = await this.inventoryService.getTransferOrderById(id);
    return success(result);
  }

  @Put('transfers/:id/complete')
  @ApiOperation({ summary: '完成调拨' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async completeTransfer(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.completeTransfer(
      id,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '调拨完成');
  }

  @Put('transfers/:id/cancel')
  @ApiOperation({ summary: '取消调拨' })
  @Roles(UserRole.ADMIN, UserRole.MANAGER)
  @HttpCode(HttpStatus.OK)
  async cancelTransfer(
    @Param('id') id: string,
    @CurrentUser() user: User,
    @RequestId() requestId: string,
  ) {
    const result = await this.inventoryService.cancelTransfer(
      id,
      user.id,
      user.name,
      requestId,
    );
    return success(result, '调拨已取消');
  }
}
