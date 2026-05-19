"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const dotenv_1 = __importDefault(require("dotenv"));
const StateMachineService_1 = require("../services/StateMachineService");
const schema_1 = require("../database/schema");
const db_1 = require("../database/db");
dotenv_1.default.config();
async function runTests() {
    console.log('='.repeat(60));
    console.log('Running Inventory Reservation State Machine Tests');
    console.log('='.repeat(60));
    const db = await (0, db_1.getDb)();
    const tables = ['inventory_pool', 'reservation', 'timeout_task', 'release_record', 'compensation_action', 'inventory_log'];
    for (const table of tables) {
        await new Promise((resolve, reject) => {
            db.run(`DELETE FROM ${table}`, (err) => {
                if (err)
                    reject(err);
                else
                    resolve();
            });
        });
    }
    const service = new StateMachineService_1.StateMachineService();
    let passed = 0;
    let failed = 0;
    async function test(name, fn) {
        console.log(`\n[TEST] ${name}`);
        try {
            await fn();
            console.log(`  ✓ PASSED`);
            passed++;
        }
        catch (error) {
            console.log(`  ✗ FAILED: ${error instanceof Error ? error.message : 'Unknown error'}`);
            failed++;
        }
    }
    await test('Create inventory pool', async () => {
        const pool = await service.createInventoryPool('Test Pool', 100);
        if (!pool.pool_id)
            throw new Error('Pool ID not generated');
        if (pool.total_quantity !== 100)
            throw new Error('Initial quantity incorrect');
        if (pool.available_quantity !== 100)
            throw new Error('Available quantity incorrect');
    });
    let poolId;
    await test('Get inventory pool', async () => {
        const pools = await service.listInventoryPools();
        poolId = pools[0].pool_id;
        const pool = await service.getInventoryPool(poolId);
        if (!pool)
            throw new Error('Pool not found');
    });
    let reservationId;
    await test('Create reservation', async () => {
        const reservation = await service.createReservation({
            orderId: 'ORDER_001',
            poolId,
            quantity: 10,
        });
        reservationId = reservation.reservation_id;
        if (reservation.status !== schema_1.ReservationStatus.RESERVED) {
            throw new Error('Reservation status should be RESERVED');
        }
        const pool = await service.getInventoryPool(poolId);
        if (pool?.reserved_quantity !== 10)
            throw new Error('Reserved quantity not updated');
        if (pool?.available_quantity !== 90)
            throw new Error('Available quantity not updated');
    });
    await test('Idempotent reservation (same order)', async () => {
        const reservation1 = await service.createReservation({
            orderId: 'ORDER_001',
            poolId,
            quantity: 10,
        });
        const reservation2 = await service.createReservation({
            orderId: 'ORDER_001',
            poolId,
            quantity: 10,
        });
        if (reservation1.reservation_id !== reservation2.reservation_id) {
            throw new Error('Same order should return existing reservation');
        }
        const pool = await service.getInventoryPool(poolId);
        if (pool?.reserved_quantity !== 10)
            throw new Error('Quantity should not change on duplicate');
    });
    await test('Insufficient inventory should fail', async () => {
        try {
            await service.createReservation({
                orderId: 'ORDER_002',
                poolId,
                quantity: 200,
            });
            throw new Error('Should have thrown insufficient inventory error');
        }
        catch (error) {
            if (!(error instanceof Error && error.message === 'Insufficient inventory')) {
                throw error;
            }
        }
    });
    await test('Confirm reservation', async () => {
        const confirmed = await service.confirmReservation(reservationId);
        if (confirmed.status !== schema_1.ReservationStatus.CONFIRMED) {
            throw new Error('Reservation status should be CONFIRMED');
        }
        const pool = await service.getInventoryPool(poolId);
        if (pool?.total_quantity !== 90)
            throw new Error('Total quantity should decrease after confirm');
        if (pool?.reserved_quantity !== 0)
            throw new Error('Reserved quantity should be 0 after confirm');
    });
    let releaseReservationId;
    await test('Release reservation (order cancel)', async () => {
        const reservation = await service.createReservation({
            orderId: 'ORDER_003',
            poolId,
            quantity: 5,
        });
        releaseReservationId = reservation.reservation_id;
        const released = await service.releaseReservation(releaseReservationId, schema_1.ReleaseType.ORDER_CANCEL, 'User cancelled');
        if (released.status !== schema_1.ReservationStatus.RELEASED) {
            throw new Error('Reservation status should be RELEASED');
        }
        const pool = await service.getInventoryPool(poolId);
        if (pool?.available_quantity !== 90)
            throw new Error('Available quantity should be restored');
    });
    await test('Inventory logs should exist', async () => {
        const logs = await service.getInventoryLogs(poolId);
        if (logs.length === 0)
            throw new Error('No inventory logs found');
        const reserveLog = logs.find(l => l.change_type === 'RESERVE');
        const confirmLog = logs.find(l => l.change_type === 'CONFIRM');
        const releaseLog = logs.find(l => l.change_type === 'RELEASE');
        if (!reserveLog || !confirmLog || !releaseLog) {
            throw new Error('Missing expected log entries');
        }
    });
    await test('Release records should exist', async () => {
        const records = await service.getReleaseRecords(releaseReservationId);
        if (records.length === 0)
            throw new Error('No release records found');
        if (records[0].release_type !== schema_1.ReleaseType.ORDER_CANCEL) {
            throw new Error('Release type incorrect');
        }
    });
    await test('Get statistics', async () => {
        const stats = await service.getStatistics();
        if (!stats.totalReservations)
            throw new Error('Should have total reservations count');
        if (!stats.statusStats)
            throw new Error('Should have status stats');
        if (!stats.inventoryStats)
            throw new Error('Should have inventory stats');
    });
    await test('List reservations by status', async () => {
        const confirmed = await service.listReservations(schema_1.ReservationStatus.CONFIRMED);
        if (confirmed.length === 0)
            throw new Error('Should have confirmed reservations');
    });
    let timeoutReservationId;
    await test('Timeout task processing', async () => {
        const reservation = await service.createReservation({
            orderId: 'ORDER_TIMEOUT',
            poolId,
            quantity: 3,
            expireSeconds: 1,
        });
        timeoutReservationId = reservation.reservation_id;
        await new Promise(resolve => setTimeout(resolve, 1500));
        const processed = await service.processTimeoutTasks();
        if (processed !== 1)
            throw new Error(`Should have processed 1 timeout task, got ${processed}`);
        const updated = await service.getReservation(timeoutReservationId);
        if (updated?.status !== schema_1.ReservationStatus.RELEASED) {
            throw new Error('Timed out reservation should be released');
        }
    });
    console.log('\n' + '='.repeat(60));
    console.log(`Test Results: ${passed} PASSED, ${failed} FAILED`);
    console.log('='.repeat(60));
    if (failed > 0) {
        process.exit(1);
    }
}
runTests().catch(console.error);
