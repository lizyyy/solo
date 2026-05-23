const GateEvent = require('../models/GateEvent');
const Vehicle = require('../models/Vehicle');
const DeductionRecord = require('../models/DeductionRecord');
const SubscriptionService = require('./SubscriptionService');
const ExceptionLog = require('../models/ExceptionLog');

class GateEventService {
  static async processEvent(eventData) {
    const existingEvent = await GateEvent.findByEventId(eventData.event_id);
    if (existingEvent) {
      await ExceptionLog.create({
        exception_type: 'gate_event_duplicate',
        raw_input: eventData,
        error_message: '事件ID已存在，重复上报',
        processing_result: '返回已处理状态，不重复扣费',
        api_path: '/api/v1/gate-events'
      });
      return {
        success: true,
        duplicate: true,
        message: '事件已处理',
        event_id: eventData.event_id
      };
    }

    const duplicates = await GateEvent.findDeduplicates(
      eventData.plate_number,
      eventData.event_time,
      300
    );

    if (duplicates.length > 0) {
      const eventResult = await GateEvent.create(eventData);
      if (eventResult.success) {
        await GateEvent.markDeduplicated(eventResult.id);
      }
      await ExceptionLog.create({
        exception_type: 'gate_event_deduplicated',
        raw_input: eventData,
        error_message: '5分钟内同车辆重复事件，已去重',
        processing_result: '标记去重，不扣费',
        api_path: '/api/v1/gate-events'
      });
      return {
        success: true,
        deduplicated: true,
        message: '5分钟内重复事件，已去重',
        event_id: eventData.event_id
      };
    }

    const eventResult = await GateEvent.create(eventData);
    if (!eventResult.success) {
      await ExceptionLog.create({
        exception_type: 'gate_event_create_failed',
        raw_input: eventData,
        error_message: '事件写入数据库失败',
        processing_result: '返回失败状态',
        api_path: '/api/v1/gate-events'
      });
      return eventResult;
    }

    const vehicle = await Vehicle.findByPlate(eventData.plate_number);
    let deductionResult = null;

    if (vehicle) {
      const validity = await SubscriptionService.checkSubscriptionValidity(vehicle.id);
      
      if (validity.valid) {
        await GateEvent.markProcessed(eventResult.id);
        deductionResult = {
          type: 'monthly_pass',
          message: '月卡车免费通行',
          subscription_id: validity.subscription_id
        };
      } else {
        const tempFee = 10;
        if (vehicle.balance >= tempFee) {
          const balanceBefore = vehicle.balance;
          const balanceAfter = balanceBefore - tempFee;
          await Vehicle.updateBalance(vehicle.id, balanceAfter);

          await DeductionRecord.create({
            plate_number: eventData.plate_number,
            vehicle_id: vehicle.id,
            event_id: eventData.event_id,
            amount: tempFee,
            deduction_type: 'temporary',
            balance_before: balanceBefore,
            balance_after: balanceAfter,
            remark: '临停扣费'
          });

          await GateEvent.markProcessed(eventResult.id);
          deductionResult = {
            type: 'temporary',
            amount: tempFee,
            balance_after: balanceAfter
          };
        } else {
          await ExceptionLog.create({
            exception_type: 'balance_insufficient',
            raw_input: eventData,
            error_message: `余额不足: 当前${vehicle.balance}元, 需${tempFee}元`,
            processing_result: '返回余额不足，需现场缴费',
            api_path: '/api/v1/gate-events'
          });
          deductionResult = {
            type: 'balance_insufficient',
            message: '余额不足，请充值',
            required_amount: tempFee,
            current_balance: vehicle.balance
          };
        }
      }
    } else {
      await ExceptionLog.create({
        exception_type: 'unregistered_vehicle',
        raw_input: eventData,
        error_message: '车辆未注册，无账户信息',
        processing_result: '返回未注册，需现场缴费',
        api_path: '/api/v1/gate-events'
      });
      deductionResult = {
        type: 'unregistered',
        message: '未注册车辆',
        action: '现场缴费'
      };
    }

    return {
      success: true,
      event_id: eventData.event_id,
      plate_number: eventData.plate_number,
      event_time: eventData.event_time,
      deduction: deductionResult
    };
  }
}

module.exports = GateEventService;
