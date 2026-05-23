const moment = require('moment');
const Vehicle = require('../models/Vehicle');
const MonthlyPlan = require('../models/MonthlyPlan');
const VehicleSubscription = require('../models/VehicleSubscription');
const DeductionRecord = require('../models/DeductionRecord');

class SubscriptionService {
  static async createSubscription(plateNumber, planId) {
    const vehicle = await Vehicle.findByPlate(plateNumber);
    if (!vehicle) {
      throw new Error('车辆不存在');
    }

    const plan = await MonthlyPlan.findById(planId);
    if (!plan || !plan.is_active) {
      throw new Error('套餐不存在或已停用');
    }

    const existingSubscription = await VehicleSubscription.findActiveByVehicleId(vehicle.id);
    let startDate = moment();
    if (existingSubscription) {
      startDate = moment(existingSubscription.end_date);
    }

    const endDate = startDate.clone().add(plan.duration_days, 'days');

    if (vehicle.balance < plan.price) {
      throw new Error('账户余额不足，请先充值');
    }

    const balanceBefore = vehicle.balance;
    const balanceAfter = balanceBefore - plan.price;
    await Vehicle.updateBalance(vehicle.id, balanceAfter);

    const subscriptionId = await VehicleSubscription.create({
      vehicle_id: vehicle.id,
      plan_id: plan.id,
      start_date: startDate.format('YYYY-MM-DD HH:mm:ss'),
      end_date: endDate.format('YYYY-MM-DD HH:mm:ss'),
      total_amount: plan.price
    });

    await DeductionRecord.create({
      plate_number: plateNumber,
      vehicle_id: vehicle.id,
      subscription_id: subscriptionId,
      amount: plan.price,
      deduction_type: 'monthly_renewal',
      balance_before: balanceBefore,
      balance_after: balanceAfter,
      remark: `套餐续费: ${plan.plan_name}`
    });

    return {
      success: true,
      subscription_id: subscriptionId,
      start_date: startDate.format('YYYY-MM-DD'),
      end_date: endDate.format('YYYY-MM-DD'),
      amount: plan.price,
      balance_after: balanceAfter
    };
  }

  static async checkSubscriptionValidity(vehicleId) {
    const subscription = await VehicleSubscription.findActiveByVehicleId(vehicleId);
    if (!subscription) {
      return { valid: false, message: '无有效月租套餐' };
    }

    const now = moment();
    const endDate = moment(subscription.end_date);
    
    if (now.isAfter(endDate)) {
      return { valid: false, message: '套餐已过期', end_date: subscription.end_date };
    }

    const daysRemaining = endDate.diff(now, 'days');
    return {
      valid: true,
      end_date: subscription.end_date,
      days_remaining: daysRemaining,
      subscription_id: subscription.id
    };
  }

  static async recharge(plateNumber, amount) {
    if (amount <= 0) {
      throw new Error('充值金额必须大于0');
    }

    let vehicle = await Vehicle.findByPlate(plateNumber);
    if (!vehicle) {
      const vehicleId = await Vehicle.create({
        plate_number: plateNumber,
        balance: amount
      });
      vehicle = await Vehicle.findById(vehicleId);
    } else {
      const newBalance = vehicle.balance + amount;
      await Vehicle.updateBalance(vehicle.id, newBalance);
      vehicle = await Vehicle.findById(vehicle.id);
    }

    await DeductionRecord.create({
      plate_number: plateNumber,
      vehicle_id: vehicle.id,
      amount: -amount,
      deduction_type: 'recharge',
      balance_before: vehicle.balance - amount,
      balance_after: vehicle.balance,
      status: 'success',
      remark: '账户充值'
    });

    return {
      success: true,
      plate_number: plateNumber,
      recharge_amount: amount,
      current_balance: vehicle.balance
    };
  }
}

module.exports = SubscriptionService;
