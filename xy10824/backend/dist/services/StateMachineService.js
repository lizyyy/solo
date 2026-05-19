"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.StateMachineService = void 0;
const uuid_1 = require("uuid");
const db_1 = require("../database/db");
const schema_1 = require("../database/schema");
class StateMachineService {
    async validateStateTransition(currentStatus, targetStatus) {
        const transitions = {
            [schema_1.ReservationStatus.PENDING]: [schema_1.ReservationStatus.RESERVED, schema_1.ReservationStatus.RELEASED],
            [schema_1.ReservationStatus.RESERVED]: [
                schema_1.ReservationStatus.CONFIRMED,
                schema_1.ReservationStatus.RELEASING,
                schema_1.ReservationStatus.RELEASED,
            ],
            [schema_1.ReservationStatus.RELEASING]: [schema_1.ReservationStatus.RELEASED, schema_1.ReservationStatus.RELEASE_FAILED],
            [schema_1.ReservationStatus.CONFIRMED]: [],
            [schema_1.ReservationStatus.RELEASED]: [],
            [schema_1.ReservationStatus.RELEASE_FAILED]: [schema_1.ReservationStatus.RELEASING, schema_1.ReservationStatus.RELEASED],
        };
        return transitions[currentStatus]?.includes(targetStatus) ?? false;
    }
    async logInventoryChange(poolId, reservationId, orderId, changeType, quantityChange, operator = 'system') {
        const pool = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.INVENTORY_POOL} WHERE pool_id = ?`, [poolId]);
        if (!pool)
            return;
        await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.INVENTORY_LOG} (
        log_id, pool_id, reservation_id, order_id, change_type, quantity_change,
        before_total, after_total, before_reserved, after_reserved, operator
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`, [
            (0, uuid_1.v4)(),
            poolId,
            reservationId,
            orderId,
            changeType,
            quantityChange,
            pool.total_quantity,
            pool.total_quantity,
            pool.reserved_quantity,
            pool.reserved_quantity - quantityChange,
            operator,
        ]);
    }
    async createReservation(request) {
        const { orderId, poolId, quantity, expireSeconds = 1800 } = request;
        const existing = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE order_id = ? AND pool_id = ? AND status IN (?, ?)`, [orderId, poolId, schema_1.ReservationStatus.PENDING, schema_1.ReservationStatus.RESERVED]);
        if (existing) {
            return existing;
        }
        await (0, db_1.beginTransaction)();
        try {
            const pool = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.INVENTORY_POOL} WHERE pool_id = ?`, [poolId]);
            if (!pool) {
                throw new Error('Inventory pool not found');
            }
            if (pool.available_quantity < quantity) {
                throw new Error('Insufficient inventory');
            }
            const reservationId = (0, uuid_1.v4)();
            const expireAt = new Date(Date.now() + expireSeconds * 1000).toISOString();
            await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.RESERVATION} (
          reservation_id, order_id, pool_id, quantity, status, expire_at
        ) VALUES (?, ?, ?, ?, ?, ?)`, [reservationId, orderId, poolId, quantity, schema_1.ReservationStatus.RESERVED, expireAt]);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity + ?, 
             available_quantity = available_quantity - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`, [quantity, quantity, poolId]);
            await this.logInventoryChange(poolId, reservationId, orderId, 'RESERVE', quantity);
            await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.TIMEOUT_TASK} (
          task_id, reservation_id, scheduled_at, status
        ) VALUES (?, ?, ?, ?)`, [(0, uuid_1.v4)(), reservationId, expireAt, schema_1.TaskStatus.PENDING]);
            await (0, db_1.commitTransaction)();
            const reservation = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
            if (!reservation) {
                throw new Error('Reservation creation failed');
            }
            return reservation;
        }
        catch (error) {
            await (0, db_1.rollbackTransaction)();
            throw error;
        }
    }
    async confirmReservation(reservationId) {
        const reservation = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
        if (!reservation) {
            throw new Error('Reservation not found');
        }
        if (!(await this.validateStateTransition(reservation.status, schema_1.ReservationStatus.CONFIRMED))) {
            throw new Error(`Invalid state transition from ${reservation.status} to CONFIRMED`);
        }
        await (0, db_1.beginTransaction)();
        try {
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`, [schema_1.ReservationStatus.CONFIRMED, reservationId]);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity - ?,
             total_quantity = total_quantity - ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`, [reservation.quantity, reservation.quantity, reservation.pool_id]);
            await this.logInventoryChange(reservation.pool_id, reservationId, reservation.order_id, 'CONFIRM', reservation.quantity);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.TIMEOUT_TASK} 
         SET status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ? AND status = ?`, [schema_1.TaskStatus.SUCCESS, reservationId, schema_1.TaskStatus.PENDING]);
            await (0, db_1.commitTransaction)();
            const updated = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
            if (!updated) {
                throw new Error('Reservation confirmation failed');
            }
            return updated;
        }
        catch (error) {
            await (0, db_1.rollbackTransaction)();
            throw error;
        }
    }
    async releaseReservation(reservationId, releaseType, reason = '', releasedBy = 'system') {
        const reservation = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
        if (!reservation) {
            throw new Error('Reservation not found');
        }
        if (reservation.status === schema_1.ReservationStatus.RELEASED) {
            return reservation;
        }
        if (!(await this.validateStateTransition(reservation.status, schema_1.ReservationStatus.RELEASING)) &&
            !(await this.validateStateTransition(reservation.status, schema_1.ReservationStatus.RELEASED))) {
            throw new Error(`Invalid state transition from ${reservation.status} to RELEASED`);
        }
        await (0, db_1.beginTransaction)();
        try {
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`, [schema_1.ReservationStatus.RELEASING, reservationId]);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.INVENTORY_POOL} 
         SET reserved_quantity = reserved_quantity - ?,
             available_quantity = available_quantity + ?,
             updated_at = CURRENT_TIMESTAMP
         WHERE pool_id = ?`, [reservation.quantity, reservation.quantity, reservation.pool_id]);
            await this.logInventoryChange(reservation.pool_id, reservationId, reservation.order_id, 'RELEASE', -reservation.quantity, releasedBy);
            await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.RELEASE_RECORD} (
          record_id, reservation_id, order_id, pool_id, quantity, release_type, release_reason, released_by
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`, [(0, uuid_1.v4)(), reservationId, reservation.order_id, reservation.pool_id, reservation.quantity, releaseType, reason, releasedBy]);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`, [schema_1.ReservationStatus.RELEASED, reservationId]);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.TIMEOUT_TASK} 
         SET status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ? AND status = ?`, [schema_1.TaskStatus.SUCCESS, reservationId, schema_1.TaskStatus.PENDING]);
            await (0, db_1.commitTransaction)();
            const updated = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
            if (!updated) {
                throw new Error('Reservation release failed');
            }
            return updated;
        }
        catch (error) {
            await (0, db_1.rollbackTransaction)();
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.RESERVATION} 
         SET status = ?, updated_at = CURRENT_TIMESTAMP 
         WHERE reservation_id = ?`, [schema_1.ReservationStatus.RELEASE_FAILED, reservationId]);
            throw error;
        }
    }
    async processTimeoutTasks() {
        const now = new Date().toISOString();
        const tasks = await (0, db_1.getAll)(`SELECT t.*, r.status as reservation_status 
       FROM ${schema_1.TABLES.TIMEOUT_TASK} t
       JOIN ${schema_1.TABLES.RESERVATION} r ON t.reservation_id = r.reservation_id
       WHERE t.status = ? AND t.scheduled_at <= ? AND r.status = ?
       LIMIT 100`, [schema_1.TaskStatus.PENDING, now, schema_1.ReservationStatus.RESERVED]);
        let processed = 0;
        for (const task of tasks) {
            try {
                await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.TIMEOUT_TASK} SET status = ? WHERE task_id = ?`, [schema_1.TaskStatus.PROCESSING, task.task_id]);
                await this.releaseReservation(task.reservation_id, schema_1.ReleaseType.TIMEOUT, 'Payment timeout');
                await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.TIMEOUT_TASK} 
           SET status = ?, executed_at = CURRENT_TIMESTAMP 
           WHERE task_id = ?`, [schema_1.TaskStatus.SUCCESS, task.task_id]);
                processed++;
            }
            catch (error) {
                await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.TIMEOUT_TASK} 
           SET status = ?, retry_count = retry_count + 1, error_message = ?
           WHERE task_id = ?`, [
                    task.retry_count + 1 >= task.max_retries ? schema_1.TaskStatus.FAILED : schema_1.TaskStatus.PENDING,
                    error instanceof Error ? error.message : 'Unknown error',
                    task.task_id,
                ]);
            }
        }
        return processed;
    }
    async manualCompensation(reservationId, operator) {
        const reservation = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
        if (!reservation) {
            throw new Error('Reservation not found');
        }
        const actionId = (0, uuid_1.v4)();
        await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.COMPENSATION_ACTION} (
        action_id, reservation_id, action_type, action_status, executed_by
      ) VALUES (?, ?, ?, ?, ?)`, [actionId, reservationId, 'MANUAL_RELEASE', schema_1.CompensationStatus.PENDING, operator]);
        try {
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.COMPENSATION_ACTION} 
         SET action_status = ? 
         WHERE action_id = ?`, [schema_1.CompensationStatus.PROCESSING, actionId]);
            const result = await this.releaseReservation(reservationId, schema_1.ReleaseType.MANUAL, 'Manual compensation', operator);
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.COMPENSATION_ACTION} 
         SET action_status = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE action_id = ?`, [schema_1.CompensationStatus.SUCCESS, actionId]);
            return { success: true, reservation: result };
        }
        catch (error) {
            await (0, db_1.runQuery)(`UPDATE ${schema_1.TABLES.COMPENSATION_ACTION} 
         SET action_status = ?, error_message = ?, executed_at = CURRENT_TIMESTAMP 
         WHERE action_id = ?`, [
                schema_1.CompensationStatus.FAILED,
                error instanceof Error ? error.message : 'Unknown error',
                actionId,
            ]);
            throw error;
        }
    }
    async getReservation(reservationId) {
        return (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE reservation_id = ?`, [reservationId]);
    }
    async getReservationsByOrder(orderId) {
        return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE order_id = ? ORDER BY created_at DESC`, [orderId]);
    }
    async listReservations(status, limit = 100, offset = 0) {
        if (status) {
            return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} WHERE status = ? ORDER BY created_at DESC LIMIT ? OFFSET ?`, [status, limit, offset]);
        }
        return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.RESERVATION} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [limit, offset]);
    }
    async getInventoryPool(poolId) {
        return (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.INVENTORY_POOL} WHERE pool_id = ?`, [poolId]);
    }
    async listInventoryPools() {
        return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.INVENTORY_POOL} ORDER BY created_at DESC`);
    }
    async createInventoryPool(poolName, initialQuantity = 0) {
        const poolId = (0, uuid_1.v4)();
        await (0, db_1.runQuery)(`INSERT INTO ${schema_1.TABLES.INVENTORY_POOL} (
        pool_id, pool_name, total_quantity, reserved_quantity, available_quantity
      ) VALUES (?, ?, ?, 0, ?)`, [poolId, poolName, initialQuantity, initialQuantity]);
        const pool = await (0, db_1.getOne)(`SELECT * FROM ${schema_1.TABLES.INVENTORY_POOL} WHERE pool_id = ?`, [poolId]);
        if (!pool) {
            throw new Error('Failed to create inventory pool');
        }
        return pool;
    }
    async getStatistics() {
        const totalReservations = await (0, db_1.getOne)(`SELECT COUNT(*) as count FROM ${schema_1.TABLES.RESERVATION}`);
        const statusStats = await (0, db_1.getAll)(`SELECT status, COUNT(*) as count FROM ${schema_1.TABLES.RESERVATION} GROUP BY status`);
        const failedTasks = await (0, db_1.getOne)(`SELECT COUNT(*) as count FROM ${schema_1.TABLES.TIMEOUT_TASK} WHERE status = ?`, [schema_1.TaskStatus.FAILED]);
        const pendingCompensation = await (0, db_1.getOne)(`SELECT COUNT(*) as count FROM ${schema_1.TABLES.COMPENSATION_ACTION} WHERE action_status = ?`, [schema_1.CompensationStatus.PENDING]);
        const inventoryStats = await (0, db_1.getAll)(`SELECT pool_name, total_quantity, reserved_quantity, available_quantity FROM ${schema_1.TABLES.INVENTORY_POOL}`);
        return {
            totalReservations: totalReservations?.count || 0,
            statusStats: Object.fromEntries(statusStats.map((s) => [s.status, s.count])),
            failedTasks: failedTasks?.count || 0,
            pendingCompensation: pendingCompensation?.count || 0,
            inventoryStats,
        };
    }
    async getFailedReleases() {
        return (0, db_1.getAll)(`SELECT r.*, t.error_message as task_error, c.error_message as compensation_error
       FROM ${schema_1.TABLES.RESERVATION} r
       LEFT JOIN ${schema_1.TABLES.TIMEOUT_TASK} t ON r.reservation_id = t.reservation_id AND t.status = ?
       LEFT JOIN ${schema_1.TABLES.COMPENSATION_ACTION} c ON r.reservation_id = c.reservation_id AND c.action_status = ?
       WHERE r.status = ?
       ORDER BY r.updated_at DESC`, [schema_1.TaskStatus.FAILED, schema_1.CompensationStatus.FAILED, schema_1.ReservationStatus.RELEASE_FAILED]);
    }
    async getReleaseRecords(reservationId, limit = 100) {
        if (reservationId) {
            return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.RELEASE_RECORD} WHERE reservation_id = ? ORDER BY created_at DESC LIMIT ?`, [reservationId, limit]);
        }
        return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.RELEASE_RECORD} ORDER BY created_at DESC LIMIT ?`, [limit]);
    }
    async getInventoryLogs(poolId, orderId, limit = 100) {
        let sql = `SELECT * FROM ${schema_1.TABLES.INVENTORY_LOG}`;
        const params = [];
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
        return (0, db_1.getAll)(sql, params);
    }
    async getCompensationActions(status, limit = 100) {
        if (status) {
            return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.COMPENSATION_ACTION} WHERE action_status = ? ORDER BY created_at DESC LIMIT ?`, [status, limit]);
        }
        return (0, db_1.getAll)(`SELECT * FROM ${schema_1.TABLES.COMPENSATION_ACTION} ORDER BY created_at DESC LIMIT ?`, [limit]);
    }
}
exports.StateMachineService = StateMachineService;
