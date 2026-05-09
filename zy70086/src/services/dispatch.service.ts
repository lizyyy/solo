import { Repository, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { Bin, Vehicle, VehicleStatus, Dispatch, DispatchStatus, Route, RoutePointStatus, BinType } from '../entities';
import { AppDataSource } from '../database/data-source';
import { BizResponse, success, idempotent, invalidParam, notFound, statusError, businessError } from '../utils/biz-response';
import { IdempotentService } from './idempotent.service';

export interface CreateDispatchDto {
  requestId: string;
  vehicleId: string;
  dispatchDate: string;
  binIds: string[];
  dispatcher?: string;
  remark?: string;
}

export class DispatchService {
  private dispatchRepo: Repository<Dispatch>;
  private vehicleRepo: Repository<Vehicle>;
  private binRepo: Repository<Bin>;
  private routeRepo: Repository<Route>;
  private idempotentService: IdempotentService;

  constructor() {
    this.dispatchRepo = AppDataSource.getRepository(Dispatch);
    this.vehicleRepo = AppDataSource.getRepository(Vehicle);
    this.binRepo = AppDataSource.getRepository(Bin);
    this.routeRepo = AppDataSource.getRepository(Route);
    this.idempotentService = new IdempotentService();
  }

  private generateDispatchNo(): string {
    const dateStr = dayjs().format('YYYYMMDD');
    const random = Math.floor(Math.random() * 10000).toString().padStart(4, '0');
    return `DISPATCH-${dateStr}-${random}`;
  }

  async createDispatch(dto: CreateDispatchDto): Promise<BizResponse> {
    if (!dto.requestId) {
      return invalidParam('必须提供 requestId（幂等请求ID）');
    }
    if (!dto.vehicleId) {
      return invalidParam('必须指定车辆');
    }
    if (!dto.binIds || dto.binIds.length === 0) {
      return invalidParam('至少指定一个需要清运的桶点');
    }

    const bizType = 'DISPATCH_CREATE';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      dto.requestId,
      JSON.stringify(dto),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该调度已创建（重复请求）');
      }
      if (existing.status === 'FAILED') {
        return businessError('上次创建失败，请使用新的 requestId 重试');
      }
      return idempotent({ dispatchId: existing.bizId }, '该调度正在创建或已创建');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { id: dto.vehicleId },
      });
      if (!vehicle) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到指定车辆');
      }

      if (vehicle.status !== VehicleStatus.IDLE) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`车辆当前状态为「${vehicle.status}」，无法调度`);
      }

      const bins = await queryRunner.manager.find(Bin, {
        where: { id: In(dto.binIds) },
      });

      if (bins.length !== dto.binIds.length) {
        if (reserved) await this.idempotentService.markFailed(bizType, dto.requestId);
        await queryRunner.rollbackTransaction();
        return notFound('部分桶点不存在，请检查桶点ID列表');
      }

      const binsByType = new Map<BinType, Bin[]>();
      let estimatedWeight = 0;
      const urgentCount = bins.filter((b) => b.isUrgent).length;

      for (const bin of bins) {
        if (!binsByType.has(bin.binType)) {
          binsByType.set(bin.binType, []);
        }
        binsByType.get(bin.binType)!.push(bin);
        estimatedWeight += Math.floor((bin.fillLevel / 100) * bin.capacity * 0.6);
      }

      const targetBinType = binsByType.size === 1 ? Array.from(binsByType.keys())[0] : null;

      vehicle.status = VehicleStatus.DISPATCHED;
      await queryRunner.manager.save(vehicle);

      const dispatchNo = this.generateDispatchNo();
      const dispatch = queryRunner.manager.create(Dispatch, {
        dispatchNo,
        requestId: dto.requestId,
        vehicleId: vehicle.id,
        dispatchDate: dto.dispatchDate,
        status: DispatchStatus.PENDING,
        binIdsJson: JSON.stringify(dto.binIds),
        targetBinType,
        estimatedBinCount: bins.length,
        actualBinCount: 0,
        estimatedWeight,
        actualWeight: 0,
        totalFee: 0,
        dispatcher: dto.dispatcher || '系统调度',
        remark: dto.remark || null,
      });

      const savedDispatch = await queryRunner.manager.save(dispatch);

      const routes = dto.binIds.map((binId, index) => {
        const bin = bins.find((b) => b.id === binId)!;
        return queryRunner.manager.create(Route, {
          dispatchId: savedDispatch.id,
          seqNo: index + 1,
          binId: bin.id,
          binType: bin.binType,
          status: RoutePointStatus.PENDING,
        });
      });

      await queryRunner.manager.save(Route, routes);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        dto.requestId,
        savedDispatch.id,
        JSON.stringify({
          dispatchId: savedDispatch.id,
          dispatchNo: savedDispatch.dispatchNo,
        }),
      );

      const urgentMsg = urgentCount > 0 ? `，其中 ${urgentCount} 个为紧急桶点` : '';
      return success(
        {
          dispatchId: savedDispatch.id,
          dispatchNo: savedDispatch.dispatchNo,
          vehicleId: vehicle.id,
          plateNumber: vehicle.plateNumber,
          driverName: vehicle.driverName,
          dispatchDate: savedDispatch.dispatchDate,
          targetBinType: targetBinType || '混合清运',
          binCount: bins.length,
          estimatedWeight,
          urgentCount,
          routes: routes.map((r, i) => {
            const bin = bins.find((b) => b.id === r.binId)!;
            return {
              seqNo: i + 1,
              binId: r.binId,
              community: bin.community,
              location: bin.location,
              binType: bin.binType,
              fillLevel: bin.fillLevel,
              isUrgent: bin.isUrgent,
            };
          }),
        },
        `调度单创建成功：${vehicle.plateNumber}（${vehicle.driverName}）将清运 ${bins.length} 个桶点${urgentMsg}`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, dto.requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async confirmDispatch(dispatchId: string, requestId: string, driver: string): Promise<BizResponse> {
    const bizType = 'DISPATCH_CONFIRM';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ dispatchId, driver }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该调度已确认（重复请求）');
      }
      return idempotent({ dispatchId }, '该调度正在确认或已确认');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispatch = await queryRunner.manager.findOne(Dispatch, {
        where: { id: dispatchId },
      });
      if (!dispatch) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该调度单');
      }

      if (dispatch.status === DispatchStatus.CONFIRMED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ dispatchId, status: dispatch.status }, '该调度已确认过');
      }

      if (dispatch.status !== DispatchStatus.PENDING) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`调度单当前状态为「${dispatch.status}」，无法确认`);
      }

      const vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { id: dispatch.vehicleId },
      });
      if (!vehicle) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('关联车辆不存在');
      }

      dispatch.status = DispatchStatus.CONFIRMED;
      dispatch.driverConfirmedBy = driver;
      dispatch.driverConfirmedAt = new Date();
      dispatch.departAt = new Date();
      await queryRunner.manager.save(dispatch);

      vehicle.status = VehicleStatus.ON_ROUTE;
      await queryRunner.manager.save(vehicle);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        dispatch.id,
        JSON.stringify({ dispatchId, status: DispatchStatus.CONFIRMED }),
      );

      return success(
        {
          dispatchId: dispatch.id,
          dispatchNo: dispatch.dispatchNo,
          status: dispatch.status,
          driverConfirmedBy: dispatch.driverConfirmedBy,
          driverConfirmedAt: dispatch.driverConfirmedAt,
          departAt: dispatch.departAt,
        },
        `${driver} 已确认调度单 ${dispatch.dispatchNo}，车辆 ${vehicle.plateNumber} 已出发`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async completeDispatch(dispatchId: string, requestId: string): Promise<BizResponse> {
    const bizType = 'DISPATCH_COMPLETE';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ dispatchId }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该调度已完成（重复请求）');
      }
      return idempotent({ dispatchId }, '该调度正在完成或已完成');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const dispatch = await queryRunner.manager.findOne(Dispatch, {
        where: { id: dispatchId },
      });
      if (!dispatch) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该调度单');
      }

      if (dispatch.status === DispatchStatus.COMPLETED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ dispatchId, status: dispatch.status }, '该调度已完成');
      }

      if (dispatch.status !== DispatchStatus.CONFIRMED && dispatch.status !== DispatchStatus.IN_PROGRESS) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`调度单当前状态为「${dispatch.status}」，无法完成`);
      }

      const routes = await queryRunner.manager.find(Route, {
        where: { dispatchId },
        order: { seqNo: 'ASC' },
      });

      const collectedRoutes = routes.filter((r) => r.status === RoutePointStatus.COLLECTED);
      const actualBinCount = collectedRoutes.length;
      const actualWeight = collectedRoutes.reduce(
        (sum, r) => sum + (r.collectedWeight || 0),
        0,
      );

      dispatch.status = DispatchStatus.COMPLETED;
      dispatch.actualBinCount = actualBinCount;
      dispatch.actualWeight = actualWeight;
      dispatch.completedAt = new Date();
      await queryRunner.manager.save(dispatch);

      const vehicle = await queryRunner.manager.findOne(Vehicle, {
        where: { id: dispatch.vehicleId },
      });
      if (vehicle) {
        vehicle.status = VehicleStatus.IDLE;
        vehicle.currentLoadWeight = 0;
        await queryRunner.manager.save(vehicle);
      }

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        dispatch.id,
        JSON.stringify({
          dispatchId,
          status: DispatchStatus.COMPLETED,
          actualBinCount,
          actualWeight,
        }),
      );

      const skippedCount = routes.length - actualBinCount;
      const skippedMsg = skippedCount > 0 ? `，${skippedCount} 个桶点未清运` : '';

      return success(
        {
          dispatchId: dispatch.id,
          dispatchNo: dispatch.dispatchNo,
          status: dispatch.status,
          estimatedBinCount: dispatch.estimatedBinCount,
          actualBinCount,
          skippedCount,
          estimatedWeight: dispatch.estimatedWeight,
          actualWeight,
          completedAt: dispatch.completedAt,
        },
        `调度单 ${dispatch.dispatchNo} 已完成：清运 ${actualBinCount} 个桶点，共 ${actualWeight} 千克${skippedMsg}`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async getDispatches(
    status?: DispatchStatus,
    date?: string,
    limit: number = 20,
  ): Promise<BizResponse> {
    const where: any = {};
    if (status) where.status = status;
    if (date) where.dispatchDate = date;

    const dispatches = await this.dispatchRepo.find({
      where,
      order: { createdAt: 'DESC' },
      take: limit,
    });

    const vehicles = await this.vehicleRepo.find();
    const vehicleMap = new Map(vehicles.map((v) => [v.id, v]));

    const statusDesc: Record<string, string> = {
      [DispatchStatus.PENDING]: '待司机确认',
      [DispatchStatus.CONFIRMED]: '已出发，正在执行',
      [DispatchStatus.IN_PROGRESS]: '执行中',
      [DispatchStatus.COMPLETED]: '已完成',
      [DispatchStatus.CANCELLED]: '已取消',
    };

    return success(
      {
        total: dispatches.length,
        dispatches: dispatches.map((d) => {
          const vehicle = vehicleMap.get(d.vehicleId);
          const binIds = JSON.parse(d.binIdsJson || '[]') as string[];
          return {
            dispatchId: d.id,
            dispatchNo: d.dispatchNo,
            plateNumber: vehicle?.plateNumber,
            driverName: vehicle?.driverName,
            dispatchDate: d.dispatchDate,
            status: d.status,
            statusDesc: statusDesc[d.status] || d.status,
            targetBinType: d.targetBinType,
            binCount: binIds.length,
            estimatedWeight: d.estimatedWeight,
            actualWeight: d.actualWeight,
            totalFee: d.totalFee,
            createdAt: d.createdAt,
            completedAt: d.completedAt,
          };
        }),
      },
      `共查询到 ${dispatches.length} 条调度单${status ? `（状态：${status}）` : ''}`,
    );
  }
}
