import { dbPrepare, generateId } from '../db/database';
import { addHistory } from './historyService';
import { Order, RiderTrajectory, MerchantMeal, WeatherEvent, PlatformPenalty, Appeal, ImportResult } from '../types';
import { CONFIG } from '../utils/config';

function parseTimestamp(value: any): number {
  if (typeof value === 'number') return value;
  if (typeof value === 'string') {
    const parsed = Date.parse(value);
    if (!isNaN(parsed)) return parsed;
  }
  return Date.now();
}

export async function importOrders(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const raw = data[i];
      const order: Order = {
        id: generateId(),
        orderNo: raw.orderNo || raw.order_no,
        riderId: raw.riderId || raw.rider_id,
        riderName: raw.riderName || raw.rider_name,
        merchantId: raw.merchantId || raw.merchant_id,
        merchantName: raw.merchantName || raw.merchant_name,
        userId: raw.userId || raw.user_id,
        userName: raw.userName || raw.user_name,
        merchantAddress: raw.merchantAddress || raw.merchant_address,
        deliveryAddress: raw.deliveryAddress || raw.delivery_address,
        estimatedDeliveryTime: parseTimestamp(raw.estimatedDeliveryTime || raw.estimated_delivery_time),
        actualDeliveryTime: raw.actualDeliveryTime || raw.actual_delivery_time ? parseTimestamp(raw.actualDeliveryTime || raw.actual_delivery_time) : undefined,
        promisedTime: parseTimestamp(raw.promisedTime || raw.promised_time),
        createTime: parseTimestamp(raw.createTime || raw.create_time),
        acceptTime: raw.acceptTime || raw.accept_time ? parseTimestamp(raw.acceptTime || raw.accept_time) : undefined,
        arriveMerchantTime: raw.arriveMerchantTime || raw.arrive_merchant_time ? parseTimestamp(raw.arriveMerchantTime || raw.arrive_merchant_time) : undefined,
        pickUpTime: raw.pickUpTime || raw.pick_up_time ? parseTimestamp(raw.pickUpTime || raw.pick_up_time) : undefined,
        deliverTime: raw.deliverTime || raw.deliver_time ? parseTimestamp(raw.deliverTime || raw.deliver_time) : undefined,
        status: raw.status,
        cancelReason: raw.cancelReason || raw.cancel_reason,
        cancelTime: raw.cancelTime || raw.cancel_time ? parseTimestamp(raw.cancelTime || raw.cancel_time) : undefined,
        cancelInitiator: raw.cancelInitiator || raw.cancel_initiator,
      };

      const checkStmt = await dbPrepare('SELECT id FROM orders WHERE order_no = ?');
      const existing = await checkStmt.get(order.orderNo);
      
      if (existing) {
        const updateStmt = await dbPrepare(`
          UPDATE orders SET
            rider_id = ?, rider_name = ?, merchant_id = ?, merchant_name = ?,
            user_id = ?, user_name = ?, merchant_address = ?, delivery_address = ?,
            estimated_delivery_time = ?, actual_delivery_time = ?, promised_time = ?,
            create_time = ?, accept_time = ?, arrive_merchant_time = ?,
            pick_up_time = ?, deliver_time = ?, status = ?, cancel_reason = ?,
            cancel_time = ?, cancel_initiator = ?, updated_at = ?
          WHERE order_no = ?
        `);
        await updateStmt.run(
          order.riderId, order.riderName, order.merchantId, order.merchantName,
          order.userId, order.userName, order.merchantAddress, order.deliveryAddress,
          order.estimatedDeliveryTime, order.actualDeliveryTime, order.promisedTime,
          order.createTime, order.acceptTime, order.arriveMerchantTime,
          order.pickUpTime, order.deliverTime, order.status, order.cancelReason,
          order.cancelTime, order.cancelInitiator, Date.now(),
          order.orderNo
        );
      } else {
        const insertStmt = await dbPrepare(`
          INSERT INTO orders (
            id, order_no, rider_id, rider_name, merchant_id, merchant_name,
            user_id, user_name, merchant_address, delivery_address,
            estimated_delivery_time, actual_delivery_time, promised_time,
            create_time, accept_time, arrive_merchant_time, pick_up_time,
            deliver_time, status, cancel_reason, cancel_time, cancel_initiator,
            created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        await insertStmt.run(
          order.id, order.orderNo, order.riderId, order.riderName, order.merchantId, order.merchantName,
          order.userId, order.userName, order.merchantAddress, order.deliveryAddress,
          order.estimatedDeliveryTime, order.actualDeliveryTime, order.promisedTime,
          order.createTime, order.acceptTime, order.arriveMerchantTime, order.pickUpTime,
          order.deliverTime, order.status, order.cancelReason, order.cancelTime, order.cancelInitiator,
          now, now
        );
      }
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}

export async function importTrajectories(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const item = data[i];
      const traj: RiderTrajectory = {
        id: generateId(),
        orderNo: item.orderNo || item.order_no,
        riderId: item.riderId || item.rider_id,
        timestamp: parseTimestamp(item.timestamp),
        latitude: item.latitude,
        longitude: item.longitude,
        speed: item.speed,
        accuracy: item.accuracy,
        eventType: item.eventType || item.event_type,
      };
      
      const insertStmt = await dbPrepare(`
        INSERT INTO rider_trajectories (
          id, order_no, rider_id, timestamp, latitude, longitude, speed, accuracy, event_type, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      await insertStmt.run(
        traj.id, traj.orderNo, traj.riderId, traj.timestamp,
        traj.latitude, traj.longitude, traj.speed, traj.accuracy, traj.eventType,
        Date.now()
      );
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}

export async function importMerchantMeals(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const raw = data[i];
      const meal: MerchantMeal = {
        id: generateId(),
        orderNo: raw.orderNo || raw.order_no,
        merchantId: raw.merchantId || raw.merchant_id,
        expectedReadyTime: parseTimestamp(raw.expectedReadyTime || raw.expected_ready_time),
        actualReadyTime: parseTimestamp(raw.actualReadyTime || raw.actual_ready_time),
        prepareStartTime: raw.prepareStartTime || raw.prepare_start_time ? parseTimestamp(raw.prepareStartTime || raw.prepare_start_time) : undefined,
        note: raw.note,
      };

      const checkStmt = await dbPrepare('SELECT id FROM merchant_meals WHERE order_no = ?');
      const existing = await checkStmt.get(meal.orderNo);
      
      if (existing) {
        const updateStmt = await dbPrepare(`
          UPDATE merchant_meals SET
            merchant_id = ?, expected_ready_time = ?, actual_ready_time = ?,
            prepare_start_time = ?, note = ?
          WHERE order_no = ?
        `);
        await updateStmt.run(
          meal.merchantId, meal.expectedReadyTime, meal.actualReadyTime,
          meal.prepareStartTime, meal.note, meal.orderNo
        );
      } else {
        const insertStmt = await dbPrepare(`
          INSERT INTO merchant_meals (
            id, order_no, merchant_id, expected_ready_time, actual_ready_time,
            prepare_start_time, note, created_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `);
        await insertStmt.run(
          meal.id, meal.orderNo, meal.merchantId, meal.expectedReadyTime, meal.actualReadyTime,
          meal.prepareStartTime, meal.note, Date.now()
        );
      }
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}

export async function importWeatherEvents(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const raw = data[i];
      const weather: WeatherEvent = {
        id: generateId(),
        city: raw.city,
        region: raw.region,
        startTime: parseTimestamp(raw.startTime || raw.start_time),
        endTime: parseTimestamp(raw.endTime || raw.end_time),
        weatherType: raw.weatherType || raw.weather_type,
        description: raw.description,
        intensity: raw.intensity,
      };
      
      const insertStmt = await dbPrepare(`
        INSERT INTO weather_events (
          id, city, region, start_time, end_time, weather_type, description, intensity, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      await insertStmt.run(
        weather.id, weather.city, weather.region, weather.startTime,
        weather.endTime, weather.weatherType, weather.description, weather.intensity,
        Date.now()
      );
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}

export async function importPenalties(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const raw = data[i];
      const penalty: PlatformPenalty = {
        id: generateId(),
        orderNo: raw.orderNo || raw.order_no,
        riderId: raw.riderId || raw.rider_id,
        penaltyType: raw.penaltyType || raw.penalty_type,
        penaltyAmount: raw.penaltyAmount || raw.penalty_amount,
        penaltyReason: raw.penaltyReason || raw.penalty_reason,
        createTime: parseTimestamp(raw.createTime || raw.create_time),
        status: raw.status || 'active',
        revertedAmount: raw.revertedAmount || raw.reverted_amount || 0,
      };
      
      const checkStmt = await dbPrepare('SELECT id FROM platform_penalties WHERE order_no = ? AND rider_id = ?');
      const existing = await checkStmt.get(penalty.orderNo, penalty.riderId);
      
      if (existing) {
        const updateStmt = await dbPrepare(`
          UPDATE platform_penalties SET
            penalty_type = ?, penalty_amount = ?, penalty_reason = ?,
            create_time = ?, status = ?, reverted_amount = ?, updated_at = ?
          WHERE order_no = ? AND rider_id = ?
        `);
        await updateStmt.run(
          penalty.penaltyType, penalty.penaltyAmount, penalty.penaltyReason,
          penalty.createTime, penalty.status, penalty.revertedAmount, Date.now(),
          penalty.orderNo, penalty.riderId
        );
      } else {
        const insertStmt = await dbPrepare(`
          INSERT INTO platform_penalties (
            id, order_no, rider_id, penalty_type, penalty_amount,
            penalty_reason, create_time, status, reverted_amount, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `);
        const now = Date.now();
        await insertStmt.run(
          penalty.id, penalty.orderNo, penalty.riderId, penalty.penaltyType, penalty.penaltyAmount,
          penalty.penaltyReason, penalty.createTime, penalty.status, penalty.revertedAmount, now, now
        );
      }
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}

export async function importAppeals(data: any[]): Promise<ImportResult> {
  const result: ImportResult = { total: data.length, success: 0, failed: 0, failures: [] };
  
  for (let i = 0; i < data.length; i++) {
    try {
      const raw = data[i];
      const orderNo = raw.orderNo || raw.order_no;
      const appealType = raw.appealType || raw.appeal_type;
      
      const checkStmt = await dbPrepare(`
        SELECT id, status FROM appeals 
        WHERE order_no = ? AND appeal_type = ? AND status != 'corrected'
      `);
      const existing = await checkStmt.get(orderNo, appealType);
      
      if (existing) {
        result.failed++;
        result.failures.push({ 
          index: i, 
          reason: `该订单已有同类型申诉（状态: ${existing.status}），不允许重复申诉`, 
          data: data[i] 
        });
        continue;
      }
      
      const appeal: Appeal = {
        id: generateId(),
        orderNo,
        riderId: raw.riderId || raw.rider_id,
        appealType,
        appealReason: raw.appealReason || raw.appeal_reason,
        submitTime: parseTimestamp(raw.submitTime || raw.submit_time || Date.now()),
        status: 'pending',
        revertedAmount: 0,
      };
      
      const insertStmt = await dbPrepare(`
        INSERT INTO appeals (
          id, order_no, rider_id, appeal_type, appeal_reason,
          submit_time, status, reverted_amount, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `);
      const now = Date.now();
      await insertStmt.run(
        appeal.id, appeal.orderNo, appeal.riderId, appeal.appealType, appeal.appealReason,
        appeal.submitTime, appeal.status, appeal.revertedAmount, now, now
      );
      
      await addHistory(
        appeal.orderNo,
        appeal.id,
        '申诉提交',
        `申诉类型: ${appeal.appealType}, 原因: ${appeal.appealReason}`,
        undefined,
        undefined,
        'pending'
      );
      
      result.success++;
    } catch (e: any) {
      result.failed++;
      result.failures.push({ index: i, reason: e.message, data: data[i] });
    }
  }
  
  return result;
}
