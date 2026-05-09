import { Repository } from 'typeorm';
import dayjs from 'dayjs';
import { Route, RoutePointStatus, Bin, BinStatus, Vehicle, VehicleStatus, Dispatch, DispatchStatus } from '../entities';
import { AppDataSource } from '../database/data-source';
import { BizResponse, success, idempotent, invalidParam, notFound, statusError, businessError } from '../utils/biz-response';
import { IdempotentService } from './idempotent.service';

export interface CollectPointDto {
  weight?: number;
  photoUrls?: string;
  driverRemark?: string;
}

export class RouteService {
  private routeRepo: Repository<Route>;
  private binRepo: Repository<Bin>;
  private vehicleRepo: Repository<Vehicle>;
  private dispatchRepo: Repository<Dispatch>;
  private idempotentService: IdempotentService;

  constructor() {
    this.routeRepo = AppDataSource.getRepository(Route);
    this.binRepo = AppDataSource.getRepository(Bin);
    this.vehicleRepo = AppDataSource.getRepository(Vehicle);
    this.dispatchRepo = AppDataSource.getRepository(Dispatch);
    this.idempotentService = new IdempotentService();
  }

  async getRoutesByDispatch(dispatchId: string): Promise<BizResponse> {
    const routes = await this.routeRepo.find({
      where: { dispatchId },
      order: { seqNo: 'ASC' },
    });

    if (routes.length === 0) {
      return notFound('该调度单没有路线数据');
    }

    const binIds = routes.map((r) => r.binId);
    const bins = await this.binRepo.findByIds(binIds);
    const binMap = new Map(bins.map((b) => [b.id, b]));

    const statusDesc: Record<string, string> = {
      [RoutePointStatus.PENDING]: '待前往',
      [RoutePointStatus.ARRIVED]: '已到达，等待清运',
      [RoutePointStatus.COLLECTED]: '已清运',
      [RoutePointStatus.SKIPPED]: '已跳过',
    };

    const totalWeight = routes
      .filter((r) => r.status === RoutePointStatus.COLLECTED)
      .reduce((sum, r) => sum + (r.collectedWeight || 0), 0);
    const collectedCount = routes.filter((r) => r.status === RoutePointStatus.COLLECTED).length;
    const skippedCount = routes.filter((r) => r.status === RoutePointStatus.SKIPPED).length;
    const remainingCount = routes.length - collectedCount - skippedCount;

    return success(
      {
        dispatchId,
        totalPoints: routes.length,
        collectedCount,
        skippedCount,
        remainingCount,
        totalCollectedWeight: totalWeight,
        progress: `${Math.floor((collectedCount / routes.length) * 100)}%`,
        routes: routes.map((r) => {
          const bin = binMap.get(r.binId);
          return {
            routeId: r.id,
            seqNo: r.seqNo,
            binId: r.binId,
            community: bin?.community,
            location: bin?.location,
            binType: r.binType,
            status: r.status,
            statusDesc: statusDesc[r.status] || r.status,
            fillLevelAtArrive: r.fillLevelAtArrive,
            collectedWeight: r.collectedWeight,
            skipReason: r.skipReason,
            arrivedAt: r.arrivedAt,
            completedAt: r.completedAt,
            driverRemark: r.driverRemark,
          };
        }),
      },
      `路线进度：已清运 ${collectedCount} 个，跳过 ${skippedCount} 个，剩余 ${remainingCount} 个（${Math.floor((collectedCount / routes.length) * 100)}%）`,
    );
  }

  async arriveAtPoint(
    routeId: string,
    requestId: string,
    fillLevel?: number,
  ): Promise<BizResponse> {
    const bizType = 'ROUTE_ARRIVE';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ routeId, fillLevel }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该到达已确认（重复请求）');
      }
      return idempotent({ routeId }, '该到达正在确认或已确认');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const route = await queryRunner.manager.findOne(Route, {
        where: { id: routeId },
      });
      if (!route) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该路线点');
      }

      if (route.status === RoutePointStatus.ARRIVED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ routeId, status: route.status }, '已经到达该桶点');
      }

      if (route.status !== RoutePointStatus.PENDING) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`该路线点当前状态为「${route.status}」，无法重复到达`);
      }

      const dispatch = await queryRunner.manager.findOne(Dispatch, {
        where: { id: route.dispatchId },
      });
      if (dispatch && dispatch.status === DispatchStatus.PENDING) {
        dispatch.status = DispatchStatus.IN_PROGRESS;
        await queryRunner.manager.save(dispatch);
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: route.binId },
      });

      route.status = RoutePointStatus.ARRIVED;
      route.arrivedAt = new Date();
      route.fillLevelAtArrive = fillLevel ?? bin?.fillLevel ?? null;
      await queryRunner.manager.save(route);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        route.id,
        JSON.stringify({ routeId, status: RoutePointStatus.ARRIVED }),
      );

      const binInfo = bin ? `${bin.community} ${bin.location}` : route.binId;
      return success(
        {
          routeId: route.id,
          dispatchId: route.dispatchId,
          seqNo: route.seqNo,
          binId: route.binId,
          binType: route.binType,
          status: route.status,
          fillLevelAtArrive: route.fillLevelAtArrive,
          arrivedAt: route.arrivedAt,
        },
        `已到达第 ${route.seqNo} 站：${binInfo}（${route.binType}），当前余量 ${route.fillLevelAtArrive ?? '未知'}%`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async collectPoint(
    routeId: string,
    requestId: string,
    dto: CollectPointDto,
  ): Promise<BizResponse> {
    const bizType = 'ROUTE_COLLECT';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ routeId, ...dto }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该清运已完成（重复请求）');
      }
      return idempotent({ routeId }, '该清运正在处理或已完成');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const route = await queryRunner.manager.findOne(Route, {
        where: { id: routeId },
      });
      if (!route) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该路线点');
      }

      if (route.status === RoutePointStatus.COLLECTED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ routeId, status: route.status }, '该桶点已清运完成');
      }

      if (route.status !== RoutePointStatus.ARRIVED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError(`该路线点当前状态为「${route.status}」，请先到达再清运`);
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: route.binId },
      });

      const estimatedWeight = bin
        ? Math.floor((bin.fillLevel / 100) * bin.capacity * 0.6)
        : 0;
      const actualWeight = dto.weight ?? estimatedWeight;

      route.status = RoutePointStatus.COLLECTED;
      route.collectedWeight = actualWeight;
      route.completedAt = new Date();
      route.photoUrls = dto.photoUrls || null;
      route.driverRemark = dto.driverRemark || null;
      await queryRunner.manager.save(route);

      if (bin) {
        bin.fillLevel = 0;
        bin.status = BinStatus.NORMAL;
        bin.isUrgent = false;
        bin.consecutiveFullCount = 0;
        bin.lastClearedAt = new Date();
        await queryRunner.manager.save(bin);
      }

      const dispatch = await queryRunner.manager.findOne(Dispatch, {
        where: { id: route.dispatchId },
      });
      if (dispatch) {
        const routes = await queryRunner.manager.find(Route, {
          where: { dispatchId: dispatch.id },
        });
        const collectedWeight = routes
          .filter((r) => r.status === RoutePointStatus.COLLECTED)
          .reduce((sum, r) => sum + (r.collectedWeight || 0), 0);
        dispatch.actualWeight = collectedWeight;
        dispatch.actualBinCount = routes.filter(
          (r) => r.status === RoutePointStatus.COLLECTED,
        ).length;
        await queryRunner.manager.save(dispatch);

        const vehicle = await queryRunner.manager.findOne(Vehicle, {
          where: { id: dispatch.vehicleId },
        });
        if (vehicle) {
          vehicle.currentLoadWeight = collectedWeight;
          vehicle.status = collectedWeight >= vehicle.maxLoadWeight * 0.9
            ? VehicleStatus.RETURNING
            : VehicleStatus.ON_ROUTE;
          await queryRunner.manager.save(vehicle);
        }
      }

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        route.id,
        JSON.stringify({
          routeId,
          status: RoutePointStatus.COLLECTED,
          collectedWeight: actualWeight,
        }),
      );

      const binInfo = bin ? `${bin.community} ${bin.location}` : route.binId;
      const weightInfo = actualWeight > 0 ? `，清运重量 ${actualWeight} 千克` : '';
      const isFullLoad = dispatch && actualWeight >= (dispatch.estimatedWeight || 0) * 0.9;
      const loadMsg = isFullLoad ? '（车辆已接近满载，建议返程过磅）' : '';

      return success(
        {
          routeId: route.id,
          dispatchId: route.dispatchId,
          seqNo: route.seqNo,
          binId: route.binId,
          binType: route.binType,
          status: route.status,
          collectedWeight: actualWeight,
          completedAt: route.completedAt,
          isFullLoad,
        },
        `清运完成：第 ${route.seqNo} 站 ${binInfo}（${route.binType}）${weightInfo}${loadMsg}`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }

  async skipPoint(
    routeId: string,
    requestId: string,
    reason: string,
  ): Promise<BizResponse> {
    const bizType = 'ROUTE_SKIP';
    const { reserved, existing } = await this.idempotentService.checkOrReserve(
      bizType,
      requestId,
      JSON.stringify({ routeId, reason }),
    );

    if (!reserved && existing) {
      if (existing.status === 'SUCCESS' && existing.responseSnapshot) {
        const savedData = JSON.parse(existing.responseSnapshot);
        return idempotent(savedData, '该跳过已记录（重复请求）');
      }
      return idempotent({ routeId }, '该跳过正在处理或已记录');
    }

    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const route = await queryRunner.manager.findOne(Route, {
        where: { id: routeId },
      });
      if (!route) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return notFound('未找到该路线点');
      }

      if (route.status === RoutePointStatus.COLLECTED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return statusError('该桶点已清运，无法跳过');
      }

      if (route.status === RoutePointStatus.SKIPPED) {
        if (reserved) await this.idempotentService.markFailed(bizType, requestId);
        await queryRunner.rollbackTransaction();
        return idempotent({ routeId, status: route.status }, '该桶点已跳过');
      }

      const bin = await queryRunner.manager.findOne(Bin, {
        where: { id: route.binId },
      });

      route.status = RoutePointStatus.SKIPPED;
      route.skipReason = reason;
      route.completedAt = new Date();
      await queryRunner.manager.save(route);

      await queryRunner.commitTransaction();

      await this.idempotentService.markSuccess(
        bizType,
        requestId,
        route.id,
        JSON.stringify({ routeId, status: RoutePointStatus.SKIPPED }),
      );

      const binInfo = bin ? `${bin.community} ${bin.location}` : route.binId;

      return success(
        {
          routeId: route.id,
          dispatchId: route.dispatchId,
          seqNo: route.seqNo,
          binId: route.binId,
          binType: route.binType,
          status: route.status,
          skipReason: reason,
          skippedAt: route.completedAt,
        },
        `跳过第 ${route.seqNo} 站：${binInfo}（${route.binType}），原因：${reason}`,
      );
    } catch (e: any) {
      await queryRunner.rollbackTransaction();
      await this.idempotentService.markFailed(bizType, requestId);
      throw e;
    } finally {
      await queryRunner.release();
    }
  }
}
