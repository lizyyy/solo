import { AppDataSource } from '../data-source';
import { Franchise } from '../entities/Franchise';
import { Material } from '../entities/Material';
import { Order } from '../entities/Order';
import { OrderItem } from '../entities/OrderItem';
import { LossRecord } from '../entities/LossRecord';
import { HeadquartersPrice } from '../entities/HeadquartersPrice';
import { RefundRecord } from '../entities/RefundRecord';
import { validationService } from './ValidationService';

export class BasicDataService {
  private franchiseRepository = AppDataSource.getRepository(Franchise);
  private materialRepository = AppDataSource.getRepository(Material);
  private orderRepository = AppDataSource.getRepository(Order);
  private orderItemRepository = AppDataSource.getRepository(OrderItem);
  private lossRecordRepository = AppDataSource.getRepository(LossRecord);
  private priceRepository = AppDataSource.getRepository(HeadquartersPrice);
  private refundRepository = AppDataSource.getRepository(RefundRecord);

  async importFranchise(data: Partial<Franchise>): Promise<Franchise> {
    const franchise = this.franchiseRepository.create(data);
    return this.franchiseRepository.save(franchise);
  }

  async importMaterial(data: Partial<Material>): Promise<Material> {
    const material = this.materialRepository.create(data);
    return this.materialRepository.save(material);
  }

  async importOrder(data: any): Promise<{ success: boolean; order?: Order; errors?: string[] }> {
    const validation = await validationService.validateOrderData(data);

    if (!validation.isValid) {
      await validationService.recordFailure(
        { sourceType: 'order', sourceNo: data.orderNo, data },
        validation.errors
      );
      return { success: false, errors: validation.errors };
    }

    const order = this.orderRepository.create({
      orderNo: data.orderNo,
      franchiseId: data.franchiseId,
      orderDate: data.orderDate,
      totalAmount: data.totalAmount,
      status: data.status,
      remark: data.remark
    });

    const savedOrder = await this.orderRepository.save(order);

    if (data.items && data.items.length > 0) {
      for (const item of data.items) {
        const orderItem = this.orderItemRepository.create({
          orderId: savedOrder.id,
          materialId: item.materialId,
          quantity: item.quantity,
          unitPrice: item.unitPrice,
          amount: item.amount,
          batchNo: item.batchNo
        });
        await this.orderItemRepository.save(orderItem);
      }
    }

    return { success: true, order: savedOrder };
  }

  async importLossRecord(data: any): Promise<{ success: boolean; record?: LossRecord; errors?: string[] }> {
    const validation = await validationService.validateLossRecordData(data);

    if (!validation.isValid) {
      await validationService.recordFailure(
        { sourceType: 'loss', sourceNo: data.recordNo, data },
        validation.errors
      );
      return { success: false, errors: validation.errors };
    }

    const record = this.lossRecordRepository.create(data);
    const savedRecord = await this.lossRecordRepository.save(record);

    return { success: true, record: savedRecord as unknown as LossRecord };
  }

  async importHeadquartersPrice(data: Partial<HeadquartersPrice>): Promise<HeadquartersPrice> {
    const price = this.priceRepository.create(data);
    return this.priceRepository.save(price);
  }

  async importRefundRecord(data: Partial<RefundRecord>): Promise<RefundRecord> {
    const refund = this.refundRepository.create(data);
    return this.refundRepository.save(refund);
  }

  async getFranchiseList(): Promise<Franchise[]> {
    return this.franchiseRepository.find({ where: { isDeleted: false } });
  }

  async getMaterialList(): Promise<Material[]> {
    return this.materialRepository.find({ where: { isDeleted: false } });
  }

  async getOrderList(params: { franchiseId?: string; page?: number; pageSize?: number }) {
    const { franchiseId, page = 1, pageSize = 20 } = params;

    const queryBuilder = this.orderRepository
      .createQueryBuilder('order')
      .leftJoinAndSelect('order.items', 'items')
      .where('order.isDeleted = :isDeleted', { isDeleted: false });

    if (franchiseId) {
      queryBuilder.andWhere('order.franchiseId = :franchiseId', { franchiseId });
    }

    const [list, total] = await queryBuilder
      .orderBy('order.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async getLossRecordList(params: { franchiseId?: string; page?: number; pageSize?: number }) {
    const { franchiseId, page = 1, pageSize = 20 } = params;

    const queryBuilder = this.lossRecordRepository
      .createQueryBuilder('loss')
      .where('loss.isDeleted = :isDeleted', { isDeleted: false });

    if (franchiseId) {
      queryBuilder.andWhere('loss.franchiseId = :franchiseId', { franchiseId });
    }

    const [list, total] = await queryBuilder
      .orderBy('loss.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }

  async getRefundRecordList(params: { franchiseId?: string; page?: number; pageSize?: number }) {
    const { franchiseId, page = 1, pageSize = 20 } = params;

    const queryBuilder = this.refundRepository
      .createQueryBuilder('refund')
      .where('refund.isDeleted = :isDeleted', { isDeleted: false });

    if (franchiseId) {
      queryBuilder.andWhere('refund.franchiseId = :franchiseId', { franchiseId });
    }

    const [list, total] = await queryBuilder
      .orderBy('refund.createdAt', 'DESC')
      .skip((page - 1) * pageSize)
      .take(pageSize)
      .getManyAndCount();

    return { list, total };
  }
}

export const basicDataService = new BasicDataService();
