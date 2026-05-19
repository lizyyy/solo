import { v4 as uuidv4 } from 'uuid';
import { runQuery, getOne, getAll, beginTransaction, commitTransaction, rollbackTransaction } from '../database/db';
import { TABLES, ReservationStatus, ReleaseType, TaskStatus, CompensationStatus } from '../database/schema';

export interface CreateReservationRequest {
  orderId: string;
  poolId: string;
  quantity: number;
  expireSeconds?: number;
}

export interface Reservation {
  reservation_id: string;
  order_id: string;
  pool_id: string;
  quantity: number;
  status: ReservationStatus;
  expire_at: string;
  created_at: string;
  updated_at: string;
}

export interface InventoryPool {
  pool_id: string;
  pool_name: string;
  total_quantity: number;
  reserved_quantity: number;
  available_quantity: number;
  created_at: string;
  updated_at: string;
}

export class StateMachineService {
  private async validateStateTransition(
    currentStatus: ReservationStatus,
    targetStatus: ReservationStatus
  ): Promise<boolean> {
    const transitions: Record<ReservationStatus, ReservationStatus[]> = {
      [ReservationStatus.PENDING]: [ReservationStatus.RESERVED, ReservationStatus.RELEASED],
      [ReservationStatus.RESERVED]: [
        ReservationStatus.CONFIRMED,
        ReservationStatus.RELEASING,
        ReservationStatus.RELEASED,
      ],
      [ReservationStatus.RELEASING]: [ReservationStatus.RELEASED, ReservationStatus.RELEASE_FAILED],
      [ReservationStatus.CONFIRMED]: [],
      [ReservationStatus.RELEASED]: [],
      [ReservationStatus.RELEASE_FAILED]: [ReservationStatus.RELEASING, ReservationStatus.RELEASED],
    };
    return transitions[currentStatus]?.includes(targetStatus) ?? false;
  }

  private async logInventoryChange(
    poolId: string,
    reservationId: string | null,
    orderId: string | null,
    changeType: string,
    quantityChange: number,
    beforePool: InventoryPool,
    afterPool: InventoryPool,
    operator: string = 'system'
  ) {
    await runQuery(
      `INSERT INTO ${TABLES.INVENTORY_LOG} (
        log_id, pool_id, reservation_id, order_id, change_type, quantity_change,
        before_total, after_total, before_reserved, after_reserved, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        uuidv4(),
        poolId,
        reservationId,
        orderId,
        changeType,
        quantityChange,
        beforePool.total_quantity,
        afterPool.total_quantity,
        beforePool.reserved_quantity,
        afterPool.reserved_quantity,
        operator,
      ]
    );
  }

  async createReservation(request: CreateReservationRequest): Promise<Reservation> {
    const { orderId, poolId, quantity, expireSeconds = 1800 } = request;

    if (quantity <= 0 || !Number.isInteger(quantity)) {
      throw new Error('quantity must be a positive integer');
    }

    const existing = await getOne<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE order_id = ? AND pool_id = ? AND status IN (?, ?)`,
      [orderId, poolId, ReservationStatus.PENDING, ReservationStatus.RESERVED]
    );
    if (existing) {
      return existing;
    }

    await beginTransaction();
    try {
      const beforePool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [poolId]
      );

      if (!beforePool) {
        throw new Error('Inventory pool not found');
      }

      if (beforePool.available_quantity < quantity) {
        throw new Error('Insufficient inventory');
      }

      const reservationId = uuidv4();
      const expireAt = new Date(Date.now() + expireSeconds * 1000).toISOString();

      await runQuery(
        `INSERT INTO ${TABLES.RESERVATION} (
          reservation_id, order_id, pool_id, quantity, status, expire_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
        [reservationId, orderId, poolId, quantity, ReservationStatus.RESERVED, expireAt]
      );

      await runQuery(
        `UPDATE ${TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity + ?, 
             available_quantity = available_quantity - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`,
        [quantity, quantity, poolId]
      );

      const afterPool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [poolId]
      );

      if (afterPool) {
        await this.logInventoryChange(
          poolId,
          reservationId,
          orderId,
          'RESERVE',
          quantity,
          beforePool,
          afterPool
        );
      }

      await runQuery(
        `INSERT INTO ${TABLES.TIMEOUT_TASK} (
          task_id, reservation_id, scheduled_at, status
        ) VALUES (?, ?, ?, ?)`,
        [uuidv4(), reservationId, expireAt, TaskStatus.PENDING]
      );

      await commitTransaction();

      const reservation = await getOne<Reservation>(
        `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
        [reservationId]
      );

      if (!reservation) {
        throw new Error('Reservation creation failed');
      }

      return reservation;
    } catch (error) {
      await rollbackTransaction();
      throw error;
    }
  }

  async confirmReservation(reservationId: string): Promise<Reservation> {
    const reservation = await getOne<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
      [reservationId]
    );

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (!(await this.validateStateTransition(reservation.status, ReservationStatus.CONFIRMED))) {
      throw new Error(`Invalid state transition from ${reservation.status} to CONFIRMED`);
    }

    await beginTransaction();
    try {
      const beforePool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [reservation.pool_id]
      );

      if (!beforePool) {
        throw new Error('Inventory pool not found');
      }

      await runQuery(
        `UPDATE ${TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`,
        [ReservationStatus.CONFIRMED, reservationId]
      );

      await runQuery(
        `UPDATE ${TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity - ?,
             total_quantity = total_quantity - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`,
        [reservation.quantity, reservation.quantity, reservation.pool_id]
      );

      const afterPool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [reservation.pool_id]
      );

      if (afterPool) {
        await this.logInventoryChange(
          reservation.pool_id,
          reservationId,
          reservation.order_id,
          'CONFIRM',
          reservation.quantity,
          beforePool,
          afterPool
        );
      }

      await runQuery(
        `UPDATE ${TABLES.TIMEOUT_TASK} 
         SET status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ? AND status = ?`,
        [TaskStatus.SUCCESS, reservationId, TaskStatus.PENDING]
      );

      await commitTransaction();

      const updated = await getOne<Reservation>(
        `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
        [reservationId]
      );

      if (!updated) {
        throw new Error('Reservation confirmation failed');
      }

      return updated;
    } catch (error) {
      await rollbackTransaction();
      throw error;
    }
  }

  async releaseReservation(
    reservationId: string,
    releaseType: ReleaseType,
    reason: string = '',
    releasedBy: string = 'system'
  ): Promise<Reservation> {
    const reservation = await getOne<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
      [reservationId]
    );

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    if (reservation.status === ReservationStatus.RELEASED) {
      return reservation;
    }

    if (
      !(await this.validateStateTransition(reservation.status, ReservationStatus.RELEASING)) &&
      !(await this.validateStateTransition(reservation.status, ReservationStatus.RELEASED))
    ) {
      throw new Error(`Invalid state transition from ${reservation.status} to RELEASED`);
    }

    await beginTransaction();
    try {
      const beforePool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [reservation.pool_id]
      );

      if (!beforePool) {
        throw new Error('Inventory pool not found');
      }

      await runQuery(
        `UPDATE ${TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`,
        [ReservationStatus.RELEASING, reservationId]
      );

      await runQuery(
        `UPDATE ${TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity - ?,
             available_quantity = available_quantity + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`,
        [reservation.quantity, reservation.quantity, reservation.pool_id]
      );

      const afterPool = await getOne<InventoryPool>(
        `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
        [reservation.pool_id]
      );

      if (afterPool) {
        await this.logInventoryChange(
          reservation.pool_id,
          reservationId,
          reservation.order_id,
          'RELEASE',
          -reservation.quantity,
          beforePool,
          afterPool,
          releasedBy
        );
      }

      await runQuery(
        `INSERT INTO ${TABLES.RELEASE_RECORD} (
          record_id, reservation_id, order_id, pool_id, quantity, release_type, release_reason, released_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [uuidv4(), reservationId, reservation.order_id, reservation.pool_id, reservation.quantity, releaseType, reason, releasedBy]
      );

      await runQuery(
        `UPDATE ${TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`,
        [ReservationStatus.RELEASED, reservationId]
      );

      await runQuery(
        `UPDATE ${TABLES.TIMEOUT_TASK} 
         SET status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ? AND status = ?`,
        [TaskStatus.SUCCESS, reservationId, TaskStatus.PENDING]
      );

      await commitTransaction();

      const updated = await getOne<Reservation>(
        `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
        [reservationId]
      );

      if (!updated) {
        throw new Error('Reservation release failed');
      }

      return updated;
    } catch (error) {
      await rollbackTransaction();
      await runQuery(
        `UPDATE ${TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`,
        [ReservationStatus.RELEASE_FAILED, reservationId]
      );
      throw error;
    }
  }

  async processTimeoutTasks(): Promise<number> {
    const now = new Date().toISOString();
    const tasks = await getAll<any>(
      `SELECT t.*, r.status as reservation_status 
       FROM ${TABLES.TIMEOUT_TASK} t
       JOIN ${TABLES.RESERVATION} r ON t.reservation_id = r.reservation_id
       WHERE t.status = ? AND t.scheduled_at <= ? AND r.status = ?
       LIMIT 100`,
      [TaskStatus.PENDING, now, ReservationStatus.RESERVED]
    );

    let processed = 0;

    for (const task of tasks) {
      try {
        await runQuery(
          `UPDATE ${TABLES.TIMEOUT_TASK} SET status = ? WHERE task_id = ?`,
          [TaskStatus.PROCESSING, task.task_id]
        );

        await this.releaseReservation(
          task.reservation_id,
          ReleaseType.TIMEOUT,
          'Payment timeout'
        );

        await runQuery(
          `UPDATE ${TABLES.TIMEOUT_TASK} 
           SET status = ?, executed_at = CURRENT_TIMESTAMP 
           WHERE task_id = ?`,
          [TaskStatus.SUCCESS, task.task_id]
        );

        processed++;
      } catch (error) {
        await runQuery(
          `UPDATE ${TABLES.TIMEOUT_TASK} 
           SET status = ?, retry_count = retry_count + 1, error_message = ?
           WHERE task_id = ?`,
          [
            task.retry_count + 1 >= task.max_retries ? TaskStatus.FAILED : TaskStatus.PENDING,
            error instanceof Error ? error.message : 'Unknown error',
            task.task_id,
          ]
        );
      }
    }

    return processed;
  }

  async manualCompensation(reservationId: string, operator: string): Promise<any> {
    const reservation = await getOne<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
      [reservationId]
    );

    if (!reservation) {
      throw new Error('Reservation not found');
    }

    const actionId = uuidv4();
    await runQuery(
      `INSERT INTO ${TABLES.COMPENSATION_ACTION} (
        action_id, reservation_id, action_type, action_status, executed_by
      ) VALUES (?, ?, ?, ?, ?)`,
      [actionId, reservationId, 'MANUAL_RELEASE', CompensationStatus.PENDING, operator]
    );

    try {
      await runQuery(
        `UPDATE ${TABLES.COMPENSATION_ACTION} 
         SET action_status = ? 
         WHERE action_id = ?`,
        [CompensationStatus.PROCESSING, actionId]
      );

      const result = await this.releaseReservation(
        reservationId,
        ReleaseType.MANUAL,
        'Manual compensation',
        operator
      );

      await runQuery(
        `UPDATE ${TABLES.COMPENSATION_ACTION} 
         SET action_status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE action_id = ?`,
        [CompensationStatus.SUCCESS, actionId]
      );

      return { success: true, reservation: result };
    } catch (error) {
      await runQuery(
        `UPDATE ${TABLES.COMPENSATION_ACTION} 
         SET action_status = ?, error_message = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE action_id = ?`,
        [
          CompensationStatus.FAILED,
          error instanceof Error ? error.message : 'Unknown error',
          actionId,
        ]
      );
      throw error;
    }
  }

  async getReservation(reservationId: string): Promise<Reservation | undefined> {
    return getOne<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE reservation_id = ?`,
      [reservationId]
    );
  }

  async getReservationsByOrder(orderId: string): Promise<Reservation[]> {
    return getAll<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} WHERE order_id = ? ORDER BY created_at DESC`,
      [orderId]
    );
  }

  async listReservations(status?: ReservationStatus, limit: number = 100, offset: number = 0): Promise<Reservation[]> {
    if (status) {
      return getAll<Reservation>(
        `SELECT * FROM ${TABLES.RESERVATION} WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`,
        [status, limit, offset]
      );
    }
    return getAll<Reservation>(
      `SELECT * FROM ${TABLES.RESERVATION} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [limit, offset]
    );
  }

  async getInventoryPool(poolId: string): Promise<InventoryPool | undefined> {
    return getOne<InventoryPool>(
      `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
      [poolId]
    );
  }

  async listInventoryPools(): Promise<InventoryPool[]> {
    return getAll<InventoryPool>(`SELECT * FROM ${TABLES.INVENTORY_POOL} ORDER BY created_at DESC`);
  }

  async createInventoryPool(poolName: string, initialQuantity: number = 0): Promise<InventoryPool> {
    if (initialQuantity < 0 || !Number.isInteger(initialQuantity)) {
      throw new Error('initialQuantity must be a non-negative integer');
    }

    const poolId = uuidv4();
    await runQuery(
      `INSERT INTO ${TABLES.INVENTORY_POOL} (
        pool_id, pool_name, total_quantity, reserved_quantity, available_quantity
      ) VALUES (?, ?, ?, 0, ?)`,
      [poolId, poolName, initialQuantity, initialQuantity]
    );

    const pool = await getOne<InventoryPool>(
      `SELECT * FROM ${TABLES.INVENTORY_POOL} WHERE pool_id = ?`,
      [poolId]
    );

    if (!pool) {
      throw new Error('Failed to create inventory pool');
    }

    return pool;
  }

  async getStatistics(): Promise<any> {
    const totalReservations = await getOne<any>(
      `SELECT COUNT(*) as count FROM ${TABLES.RESERVATION}`
    );

    const statusStats = await getAll<any>(
      `SELECT status, COUNT(*) as count FROM ${TABLES.RESERVATION} GROUP BY status`
    );

    const failedTasks = await getOne<any>(
      `SELECT COUNT(*) as count FROM ${TABLES.TIMEOUT_TASK} WHERE status = ?`,
      [TaskStatus.FAILED]
    );

    const pendingCompensation = await getOne<any>(
      `SELECT COUNT(*) as count FROM ${TABLES.COMPENSATION_ACTION} WHERE action_status = ?`,
      [CompensationStatus.PENDING]
    );

    const inventoryStats = await getAll<any>(
      `SELECT pool_name, total_quantity, reserved_quantity, available_quantity FROM ${TABLES.INVENTORY_POOL}`
    );

    return {
      totalReservations: totalReservations?.count || 0,
      statusStats: Object.fromEntries(statusStats.map((s) => [s.status, s.count])),
      failedTasks: failedTasks?.count || 0,
      pendingCompensation: pendingCompensation?.count || 0,
      inventoryStats,
    };
  }

  async getFailedReleases(): Promise<any[]> {
    return getAll<any>(
      `SELECT r.*, t.error_message as task_error, c.error_message as compensation_error
       FROM ${TABLES.RESERVATION} r
       LEFT JOIN ${TABLES.TIMEOUT_TASK} t ON r.reservation_id = t.reservation_id AND t.status = ?
       LEFT JOIN ${TABLES.COMPENSATION_ACTION} c ON r.reservation_id = c.reservation_id AND c.action_status = ?
       WHERE r.status = ?
       ORDER BY r.updated_at DESC`,
      [TaskStatus.FAILED, CompensationStatus.FAILED, ReservationStatus.RELEASE_FAILED]
    );
  }

  async getReleaseRecords(reservationId?: string, limit: number = 100): Promise<any[]> {
    if (reservationId) {
      return getAll<any>(
        `SELECT * FROM ${TABLES.RELEASE_RECORD} WHERE reservation_id = ? ORDER BY created_at DESC LIMIT ?`,
        [reservationId, limit]
      );
    }
    return getAll<any>(
      `SELECT * FROM ${TABLES.RELEASE_RECORD} ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  }

  async getInventoryLogs(poolId?: string, orderId?: string, limit: number = 100): Promise<any[]> {
    let sql = `SELECT * FROM ${TABLES.INVENTORY_LOG}`;
    const params: any[] = [];

    if (poolId || orderId) {
      const conditions = [];
      if (poolId) {
        conditions.push('pool_id = ?');
        params.push(poolId);
      }
      if (orderId) {
        conditions.push('order_id = ?');
        params.push(orderId);
      }
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }

    sql += ` ORDER BY created_at DESC LIMIT ?`;
    params.push(limit);

    return getAll<any>(sql, params);
  }

  async getCompensationActions(status?: CompensationStatus, limit: number = 100): Promise<any[]> {
    if (status) {
      return getAll<any>(
        `SELECT * FROM ${TABLES.COMPENSATION_ACTION} WHERE action_status = ? ORDER BY created_at DESC LIMIT ?`,
        [status, limit]
      );
    }
    return getAll<any>(
      `SELECT * FROM ${TABLES.COMPENSATION_ACTION} ORDER BY created_at DESC LIMIT ?`,
      [limit]
    );
  }
}