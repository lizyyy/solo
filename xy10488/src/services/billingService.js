const { Op } = require('sequelize');
const Bill = require('../models/Bill');
const House = require('../models/House');
const Room = require('../models/Room');
const Tenant = require('../models/Tenant');
const MeterReading = require('../models/MeterReading');
const { dayjs, daysInPeriod, getOverlapDays } = require('../utils/dateUtils');

class BillingService {
  async checkBillingPeriodExists(houseId, tenantId, startDate, endDate, excludeBillId = null) {
    const where = {
      houseId,
      tenantId,
      [Op.or]: [
        {
          billingPeriodStart: { [Op.between]: [startDate, endDate] }
        },
        {
          billingPeriodEnd: { [Op.between]: [startDate, endDate] }
        },
        {
          [Op.and]: [
            { billingPeriodStart: { [Op.lte]: startDate } },
            { billingPeriodEnd: { [Op.gte]: endDate } }
          ]
        }
      ]
    };
    if (excludeBillId) {
      where.id = { [Op.ne]: excludeBillId };
    }
    return await Bill.findOne({ where });
  }

  async checkTenantBillingEligibility(tenant, billingStart, billingEnd) {
    const errors = [];
    
    if (tenant.status === 'checked_out' && tenant.checkOutDate) {
      if (dayjs(billingStart).isAfter(tenant.checkOutDate)) {
        errors.push({
          type: 'post_checkout_billing',
          message: `租客已退租（${tenant.checkOutDate}），不能为退租后的周期（${billingStart} 起）计费`
        });
      }
    }
    
    return errors;
  }

  async getTenantActiveDays(tenant, billingStart, billingEnd) {
    const effectiveStart = dayjs(tenant.checkInDate).isAfter(billingStart) 
      ? tenant.checkInDate 
      : billingStart;
    
    let effectiveEnd = billingEnd;
    if (tenant.checkOutDate && dayjs(tenant.checkOutDate).isBefore(billingEnd)) {
      effectiveEnd = tenant.checkOutDate;
    }
    
    if (dayjs(effectiveStart).isAfter(effectiveEnd)) {
      return 0;
    }
    
    return getOverlapDays(effectiveStart, effectiveEnd, billingStart, billingEnd);
  }

  async calculateMeterUsage(houseId, roomId, readingType, startDate, endDate, isPublic = false) {
    const beforeReading = await MeterReading.findOne({
      where: {
        houseId,
        roomId: isPublic ? null : roomId,
        readingType,
        isPublic,
        readingDate: { [Op.lte]: startDate }
      },
      order: [['readingDate', 'DESC']]
    });
    
    const afterReading = await MeterReading.findOne({
      where: {
        houseId,
        roomId: isPublic ? null : roomId,
        readingType,
        isPublic,
        readingDate: { [Op.gte]: endDate }
      },
      order: [['readingDate', 'ASC']]
    });
    
    if (!beforeReading || !afterReading) {
      return { usage: 0, hasAbnormal: false, readings: { before: beforeReading, after: afterReading } };
    }
    
    const usage = parseFloat(afterReading.readingValue) - parseFloat(beforeReading.readingValue);
    const hasAbnormal = beforeReading.isAbnormal || afterReading.isAbnormal;
    
    return {
      usage: Math.max(0, usage),
      hasAbnormal,
      readings: { before: beforeReading, after: afterReading }
    };
  }

  async getActiveTenantsForPeriod(houseId, billingStart, billingEnd) {
    const tenants = await Tenant.findAll({
      include: [{
        model: Room,
        where: { houseId }
      }],
      where: {
        checkInDate: { [Op.lte]: billingEnd },
        [Op.or]: [
          { status: 'active' },
          { checkOutDate: { [Op.gte]: billingStart } }
        ]
      }
    });
    
    return tenants;
  }

  async getTenantCountByRoom(houseId, billingStart, billingEnd) {
    const tenants = await this.getActiveTenantsForPeriod(houseId, billingStart, billingEnd);
    const roomTenants = {};
    
    for (const tenant of tenants) {
      const roomId = tenant.roomId;
      if (!roomTenants[roomId]) {
        roomTenants[roomId] = [];
      }
      roomTenants[roomId].push(tenant);
    }
    
    return roomTenants;
  }

  async generateBill(houseId, tenantId, billingStart, billingEnd, billType = 'monthly', isRecalculation = false) {
    const house = await House.findByPk(houseId);
    if (!house) throw new Error('房源不存在');
    
    const tenant = await Tenant.findByPk(tenantId, { include: [Room] });
    if (!tenant) throw new Error('租客不存在');
    
    const eligibilityErrors = await this.checkTenantBillingEligibility(tenant, billingStart, billingEnd);
    if (eligibilityErrors.length > 0) {
      return { success: false, errors: eligibilityErrors };
    }
    
    const existingBill = await this.checkBillingPeriodExists(houseId, tenantId, billingStart, billingEnd);
    if (existingBill && !isRecalculation) {
      return { 
        success: false, 
        errors: [{
          type: 'period_overlap',
          message: `账单周期重叠，已存在该周期账单（ID: ${existingBill.id}）`
        }]
      };
    }
    
    const room = tenant.Room;
    const activeDays = await this.getTenantActiveDays(tenant, billingStart, billingEnd);
    const billingDays = daysInPeriod(billingStart, billingEnd);
    
    if (activeDays === 0) {
      return { success: false, errors: [{ type: 'no_active_days', message: '租客在该计费周期内无有效入住天数' }] };
    }
    
    const roomTenants = await Tenant.findAll({
      where: {
        roomId: room.id,
        checkInDate: { [Op.lte]: billingEnd },
        [Op.or]: [
          { status: 'active' },
          { checkOutDate: { [Op.gte]: billingStart } }
        ]
      }
    });
    const tenantsInRoom = roomTenants.length;
    
    const allTenants = await this.getActiveTenantsForPeriod(houseId, billingStart, billingEnd);
    const totalPersonsInHouse = allTenants.length;
    const totalRoomsInHouse = await Room.count({ where: { houseId } });
    
    let waterResult = { usage: 0, hasAbnormal: false };
    let electricityResult = { usage: 0, hasAbnormal: false };
    let publicWaterResult = { usage: 0, hasAbnormal: false };
    let publicElectricityResult = { usage: 0, hasAbnormal: false };
    
    if (room.hasWaterMeter) {
      waterResult = await this.calculateMeterUsage(houseId, room.id, 'water', billingStart, billingEnd, false);
    }
    if (room.hasElectricityMeter) {
      electricityResult = await this.calculateMeterUsage(houseId, room.id, 'electricity', billingStart, billingEnd, false);
    }
    
    publicWaterResult = await this.calculateMeterUsage(houseId, null, 'water', billingStart, billingEnd, true);
    publicElectricityResult = await this.calculateMeterUsage(houseId, null, 'electricity', billingStart, billingEnd, true);
    
    const waterPrice = parseFloat(house.waterPrice);
    const electricityPrice = parseFloat(house.electricityPrice);
    
    let waterCost = waterResult.usage * waterPrice;
    let electricityCost = electricityResult.usage * electricityPrice;
    
    if (!room.hasWaterMeter) {
      waterCost = 0;
    } else {
      waterCost = waterCost * (activeDays / billingDays) * (1 / tenantsInRoom);
    }
    
    if (!room.hasElectricityMeter) {
      electricityCost = 0;
    } else {
      electricityCost = electricityCost * (activeDays / billingDays) * (1 / tenantsInRoom);
    }
    
    let publicWaterCost = 0;
    let publicElectricityCost = 0;
    
    if (publicWaterResult.usage > 0) {
      const totalPublicWaterCost = publicWaterResult.usage * waterPrice;
      if (house.publicWaterShare === 'by_person' && totalPersonsInHouse > 0) {
        publicWaterCost = totalPublicWaterCost * (activeDays / billingDays) * (1 / totalPersonsInHouse);
      } else if (house.publicWaterShare === 'by_room' && totalRoomsInHouse > 0) {
        publicWaterCost = (totalPublicWaterCost / totalRoomsInHouse) * (activeDays / billingDays) * (1 / tenantsInRoom);
      }
    }
    
    if (publicElectricityResult.usage > 0) {
      const totalPublicElectricityCost = publicElectricityResult.usage * electricityPrice;
      if (house.publicElectricityShare === 'by_person' && totalPersonsInHouse > 0) {
        publicElectricityCost = totalPublicElectricityCost * (activeDays / billingDays) * (1 / totalPersonsInHouse);
      } else if (house.publicElectricityShare === 'by_room' && totalRoomsInHouse > 0) {
        publicElectricityCost = (totalPublicElectricityCost / totalRoomsInHouse) * (activeDays / billingDays) * (1 / tenantsInRoom);
      }
    }
    
    const totalAmount = waterCost + electricityCost + publicWaterCost + publicElectricityCost;
    
    const sharingBasis = JSON.stringify({
      tenantName: tenant.name,
      roomNumber: room.roomNumber,
      activeDays,
      billingDays,
      tenantsInRoom,
      totalPersonsInHouse,
      totalRoomsInHouse,
      waterPrice,
      electricityPrice,
      waterUsage: waterResult.usage,
      electricityUsage: electricityResult.usage,
      publicWaterUsage: publicWaterResult.usage,
      publicElectricityUsage: publicElectricityResult.usage,
      calculations: {
        waterCost,
        electricityCost,
        publicWaterCost,
        publicElectricityCost
      }
    });
    
    const hasAbnormal = waterResult.hasAbnormal || 
                       electricityResult.hasAbnormal || 
                       publicWaterResult.hasAbnormal || 
                       publicElectricityResult.hasAbnormal;
    
    if (existingBill && isRecalculation) {
      await existingBill.destroy();
    }
    
    const bill = await Bill.create({
      houseId,
      roomId: room.id,
      tenantId,
      billType,
      billingPeriodStart: billingStart,
      billingPeriodEnd: billingEnd,
      waterUsage: waterResult.usage,
      waterCost: Number(waterCost.toFixed(2)),
      publicWaterCost: Number(publicWaterCost.toFixed(2)),
      electricityUsage: electricityResult.usage,
      electricityCost: Number(electricityCost.toFixed(2)),
      publicElectricityCost: Number(publicElectricityCost.toFixed(2)),
      totalAmount: Number(totalAmount.toFixed(2)),
      sharingBasis,
      hasAbnormalReadings: hasAbnormal,
      status: 'generated'
    });
    
    return { success: true, bill };
  }

  async generateMonthlyBills(houseId, year, month) {
    const start = dayjs(`${year}-${String(month).padStart(2, '0')}-01`);
    const end = start.endOf('month');
    const billingStart = start.format('YYYY-MM-DD');
    const billingEnd = end.format('YYYY-MM-DD');
    
    const tenants = await this.getActiveTenantsForPeriod(houseId, billingStart, billingEnd);
    const results = [];
    
    for (const tenant of tenants) {
      const result = await this.generateBill(houseId, tenant.id, billingStart, billingEnd, 'monthly');
      results.push({ tenantId: tenant.id, tenantName: tenant.name, ...result });
    }
    
    return results;
  }

  async generateCheckoutBill(tenantId) {
    const tenant = await Tenant.findByPk(tenantId, { include: [{ model: Room, include: [House] }] });
    if (!tenant) throw new Error('租客不存在');
    if (tenant.status !== 'checked_out' || !tenant.checkOutDate) {
      throw new Error('租客未完成退租登记');
    }
    
    const lastBill = await Bill.findOne({
      where: { tenantId },
      order: [['billingPeriodEnd', 'DESC']]
    });
    
    const billingStart = lastBill 
      ? dayjs(lastBill.billingPeriodEnd).add(1, 'day').format('YYYY-MM-DD')
      : tenant.checkInDate;
    const billingEnd = tenant.checkOutDate;
    
    if (dayjs(billingStart).isAfter(billingEnd)) {
      return { success: false, message: '退租结算周期与已结算账单无重叠' };
    }
    
    return await this.generateBill(
      tenant.Room.houseId, 
      tenantId, 
      billingStart, 
      billingEnd, 
      'checkout'
    );
  }

  async recalculateBill(billId) {
    const bill = await Bill.findByPk(billId);
    if (!bill) throw new Error('账单不存在');
    
    return await this.generateBill(
      bill.houseId,
      bill.tenantId,
      bill.billingPeriodStart,
      bill.billingPeriodEnd,
      bill.billType,
      true
    );
  }

  async getTenantBillDetails(tenantId) {
    const tenant = await Tenant.findByPk(tenantId, { include: [Room] });
    if (!tenant) throw new Error('租客不存在');
    
    const bills = await Bill.findAll({
      where: { tenantId },
      order: [['billingPeriodStart', 'DESC']]
    });
    
    return {
      tenant: {
        id: tenant.id,
        name: tenant.name,
        roomNumber: tenant.Room ? tenant.Room.roomNumber : null,
        checkInDate: tenant.checkInDate,
        checkOutDate: tenant.checkOutDate,
        status: tenant.status
      },
      bills: bills.map(bill => ({
        id: bill.id,
        billType: bill.billType,
        period: `${bill.billingPeriodStart} 至 ${bill.billingPeriodEnd}`,
        waterCost: bill.waterCost,
        publicWaterCost: bill.publicWaterCost,
        electricityCost: bill.electricityCost,
        publicElectricityCost: bill.publicElectricityCost,
        totalAmount: bill.totalAmount,
        sharingBasis: JSON.parse(bill.sharingBasis || '{}'),
        hasAbnormalReadings: bill.hasAbnormalReadings,
        status: bill.status
      }))
    };
  }

  async getHouseBillingSummary(houseId, startDate, endDate) {
    const house = await House.findByPk(houseId);
    if (!house) throw new Error('房源不存在');
    
    const bills = await Bill.findAll({
      where: {
        houseId,
        billingPeriodStart: { [Op.gte]: startDate },
        billingPeriodEnd: { [Op.lte]: endDate }
      },
      include: [{ model: Tenant }, { model: Room }],
      order: [['billingPeriodStart', 'ASC']]
    });
    
    const abnormalReadings = await MeterReading.findAll({
      where: { houseId, isAbnormal: true },
      order: [['readingDate', 'DESC']]
    });
    
    return {
      house: {
        id: house.id,
        name: house.name,
        waterPrice: house.waterPrice,
        electricityPrice: house.electricityPrice
      },
      bills: bills.map(bill => ({
        id: bill.id,
        tenantName: bill.Tenant ? bill.Tenant.name : 'Unknown',
        roomNumber: bill.Room ? bill.Room.roomNumber : 'Unknown',
        billType: bill.billType,
        period: `${bill.billingPeriodStart} 至 ${bill.billingPeriodEnd}`,
        totalAmount: bill.totalAmount,
        hasAbnormal: bill.hasAbnormalReadings
      })),
      abnormalReadings: abnormalReadings.map(r => ({
        id: r.id,
        roomId: r.roomId,
        readingType: r.readingType,
        date: r.readingDate,
        value: r.readingValue,
        reason: r.abnormalityReason
      }))
    };
  }
}

module.exports = new BillingService();
