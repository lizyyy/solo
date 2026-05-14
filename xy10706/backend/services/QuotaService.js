const { Op } = require('sequelize');
const { Customer, Package, ApiEndpoint, CallRecord, CustomerPackage, ReviewRecord, sequelize } = require('../models');
const crypto = require('crypto');
const moment = require('moment');

class QuotaService {
  static async processCall(apiKey, path, method, idempotencyKey = null, requestId = null) {
    const startTime = Date.now();
    requestId = requestId || crypto.randomUUID();

    const transaction = await sequelize.transaction();

    try {
      const customer = await Customer.findOne({
        where: { apiKey, status: 'active' },
        transaction
      });

      if (!customer) {
        await transaction.rollback();
        return {
          success: false,
          status: 'blocked',
          requestId,
          message: 'Invalid API key or customer suspended'
        };
      }

      const apiEndpoint = await ApiEndpoint.findOne({
        where: { path, method, status: 'active' },
        transaction
      });

      if (!apiEndpoint) {
        await transaction.rollback();
        return {
          success: false,
          status: 'blocked',
          requestId,
          message: 'API endpoint not found or deprecated'
        };
      }

      if (idempotencyKey && apiEndpoint.isIdempotent) {
        const existingCall = await CallRecord.findOne({
          where: {
            CustomerId: customer.id,
            ApiEndpointId: apiEndpoint.id,
            idempotencyKey
          },
          transaction
        });

        if (existingCall) {
          await transaction.commit();
          return {
            success: existingCall.status === 'success',
            status: existingCall.status,
            requestId: existingCall.requestId,
            message: 'Idempotent call - returning previous result',
            idempotent: true
          };
        }
      }

      const customerPackage = await CustomerPackage.findOne({
        where: {
          CustomerId: customer.id,
          status: 'active',
          startDate: { [Op.lte]: new Date() },
          [Op.or]: [
            { endDate: null },
            { endDate: { [Op.gte]: new Date() } }
          ]
        },
        include: [{ model: Package }],
        transaction
      });

      if (!customerPackage) {
        await CallRecord.create({
          CustomerId: customer.id,
          ApiEndpointId: apiEndpoint.id,
          requestId,
          idempotencyKey,
          status: 'blocked',
          cost: apiEndpoint.costPerCall,
          errorMessage: 'No active package found'
        }, { transaction });

        await transaction.commit();
        return {
          success: false,
          status: 'blocked',
          requestId,
          message: 'No active package found for customer'
        };
      }

      const pkg = customerPackage.Package;
      const cost = apiEndpoint.costPerCall;

      const burstResult = await this.detectBurst(
        customer.id,
        apiEndpoint.id,
        pkg.burstThreshold,
        pkg.burstWindowMinutes,
        transaction
      );

      if (burstResult.isBurst) {
        await CallRecord.create({
          CustomerId: customer.id,
          ApiEndpointId: apiEndpoint.id,
          CustomerPackageId: customerPackage.id,
          requestId,
          idempotencyKey,
          status: 'pending_review',
          burstDetected: true,
          cost,
          errorMessage: 'Burst traffic detected, pending review'
        }, { transaction });

        await transaction.commit();
        return {
          success: false,
          status: 'pending_review',
          requestId,
          message: 'Burst traffic detected, call pending review',
          burstDetected: true
        };
      }

      const newUsedQuota = customerPackage.usedQuota + cost;
      const isOverQuota = newUsedQuota > pkg.monthlyQuota;

      if (isOverQuota) {
        await CallRecord.create({
          CustomerId: customer.id,
          ApiEndpointId: apiEndpoint.id,
          CustomerPackageId: customerPackage.id,
          requestId,
          idempotencyKey,
          status: 'pending_review',
          overQuota: true,
          cost,
          errorMessage: 'Quota exceeded, pending review'
        }, { transaction });

        await customerPackage.update({
          overQuota: customerPackage.overQuota + cost
        }, { transaction });

        await transaction.commit();
        return {
          success: false,
          status: 'pending_review',
          requestId,
          message: 'Quota exceeded, call pending review',
          overQuota: true
        };
      }

      const responseTime = Date.now() - startTime;

      await CallRecord.create({
        CustomerId: customer.id,
        ApiEndpointId: apiEndpoint.id,
        CustomerPackageId: customerPackage.id,
        requestId,
        idempotencyKey,
        status: 'success',
        cost,
        responseTime
      }, { transaction });

      await customerPackage.update({
        usedQuota: newUsedQuota
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        status: 'success',
        requestId,
        message: 'Call processed successfully',
        remainingQuota: pkg.monthlyQuota - newUsedQuota
      };

    } catch (error) {
      await transaction.rollback();
      console.error('Error processing call:', error);

      await CallRecord.create({
        CustomerId: customer?.id || 0,
        ApiEndpointId: apiEndpoint?.id || 0,
        requestId,
        idempotencyKey,
        status: 'retryable',
        errorMessage: error.message
      });

      return {
        success: false,
        status: 'retryable',
        requestId,
        message: 'Temporary error, please retry',
        retryable: true
      };
    }
  }

  static async detectBurst(customerId, apiEndpointId, threshold, windowMinutes, transaction) {
    const windowStart = moment().subtract(windowMinutes, 'minutes').toDate();

    const callCount = await CallRecord.count({
      where: {
        CustomerId: customerId,
        ApiEndpointId: apiEndpointId,
        createdAt: { [Op.gte]: windowStart },
        status: { [Op.in]: ['success', 'pending_review'] }
      },
      transaction
    });

    return {
      isBurst: callCount >= threshold,
      callCount,
      threshold
    };
  }

  static async processRetry(requestId) {
    const callRecord = await CallRecord.findOne({
      where: { requestId }
    });

    if (!callRecord) {
      return { success: false, message: 'Call record not found' };
    }

    if (callRecord.status !== 'retryable') {
      return { success: false, message: 'Call is not in retryable state' };
    }

    const customerPackage = await CustomerPackage.findByPk(callRecord.CustomerPackageId, {
      include: [{ model: Package }]
    });

    if (callRecord.retryCount >= customerPackage.Package.maxRetries) {
      await callRecord.update({ status: 'blocked' });
      return {
        success: false,
        status: 'blocked',
        message: 'Max retry count exceeded, call blocked'
      };
    }

    await callRecord.update({ retryCount: callRecord.retryCount + 1 });

    return this.processCall(
      null,
      null,
      null,
      callRecord.idempotencyKey,
      requestId
    );
  }

  static async reviewCall(callRecordId, action, reason, reviewer) {
    const transaction = await sequelize.transaction();

    try {
      const callRecord = await CallRecord.findByPk(callRecordId, {
        include: [{ model: CustomerPackage, include: [Package] }],
        transaction
      });

      if (!callRecord) {
        await transaction.rollback();
        return { success: false, message: 'Call record not found' };
      }

      if (callRecord.reviewed) {
        await transaction.rollback();
        return { success: false, message: 'Call already reviewed' };
      }

      const previousStatus = callRecord.status;
      let newStatus;

      switch (action) {
        case 'approve':
          newStatus = 'success';
          break;
        case 'reject':
          newStatus = 'blocked';
          break;
        case 'correct':
          newStatus = 'success';
          break;
        default:
          await transaction.rollback();
          return { success: false, message: 'Invalid review action' };
      }

      if (action === 'approve' || action === 'correct') {
        const customerPackage = callRecord.CustomerPackage;
        if (customerPackage) {
          await customerPackage.update({
            usedQuota: customerPackage.usedQuota + callRecord.cost,
            overQuota: Math.max(0, customerPackage.overQuota - callRecord.cost)
          }, { transaction });
        }
      }

      await callRecord.update({
        status: newStatus,
        reviewed: true,
        corrected: action === 'correct',
        correctionReason: action === 'correct' ? reason : null
      }, { transaction });

      await ReviewRecord.create({
        CallRecordId: callRecord.id,
        CustomerId: callRecord.CustomerId,
        reviewer,
        action,
        reason,
        previousStatus,
        newStatus
      }, { transaction });

      await transaction.commit();

      return {
        success: true,
        message: 'Review processed successfully',
        previousStatus,
        newStatus
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async recalculateRecords(oldPath, newPath, method) {
    const transaction = await sequelize.transaction();

    try {
      const oldEndpoint = await ApiEndpoint.findOne({
        where: { path: oldPath, method },
        transaction
      });

      if (!oldEndpoint) {
        await transaction.rollback();
        return { success: false, message: 'Old endpoint not found' };
      }

      const newEndpoint = await ApiEndpoint.findOne({
        where: { path: newPath, method },
        transaction
      });

      if (!newEndpoint) {
        await transaction.rollback();
        return { success: false, message: 'New endpoint not found' };
      }

      const affectedRecords = await CallRecord.findAll({
        where: { ApiEndpointId: oldEndpoint.id },
        transaction
      });

      const customerPackages = new Map();

      for (const record of affectedRecords) {
        if (record.CustomerPackageId && !customerPackages.has(record.CustomerPackageId)) {
          const cp = await CustomerPackage.findByPk(record.CustomerPackageId, {
            include: [Package],
            transaction
          });
          customerPackages.set(record.CustomerPackageId, cp);
        }

        const costDiff = newEndpoint.costPerCall - oldEndpoint.costPerCall;

        if (costDiff !== 0 && record.status === 'success') {
          const cp = customerPackages.get(record.CustomerPackageId);
          if (cp) {
            await cp.update({
              usedQuota: Math.max(0, cp.usedQuota + costDiff)
            }, { transaction });
          }
        }

        await record.update({
          ApiEndpointId: newEndpoint.id,
          cost: newEndpoint.costPerCall
        }, { transaction });
      }

      await transaction.commit();

      return {
        success: true,
        message: 'Records recalculated successfully',
        affectedCount: affectedRecords.length
      };

    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  static async getStatistics(customerId = null, startDate = null, endDate = null) {
    const where = {};
    if (customerId) where.CustomerId = customerId;
    if (startDate) where.createdAt = { ...where.createdAt, [Op.gte]: startDate };
    if (endDate) where.createdAt = { ...where.createdAt, [Op.lte]: endDate };

    const [totalCalls, successCalls, pendingCalls, blockedCalls, retryableCalls] = await Promise.all([
      CallRecord.count({ where }),
      CallRecord.count({ where: { ...where, status: 'success' } }),
      CallRecord.count({ where: { ...where, status: 'pending_review' } }),
      CallRecord.count({ where: { ...where, status: 'blocked' } }),
      CallRecord.count({ where: { ...where, status: 'retryable' } })
    ]);

    const totalCost = await CallRecord.sum('cost', {
      where: { ...where, status: 'success' }
    }) || 0;

    return {
      totalCalls,
      successCalls,
      pendingCalls,
      blockedCalls,
      retryableCalls,
      totalCost,
      successRate: totalCalls > 0 ? (successCalls / totalCalls * 100).toFixed(2) : 0
    };
  }

  static async exportBillingDetails(customerId, startDate, endDate) {
    const where = {
      CustomerId: customerId,
      status: 'success',
      createdAt: { [Op.between]: [startDate, endDate] }
    };

    const records = await CallRecord.findAll({
      where,
      include: [
        { model: ApiEndpoint, attributes: ['path', 'method'] },
        { model: CustomerPackage, include: [{ model: Package, attributes: ['name', 'pricePerCall'] }] }
      ],
      order: [['createdAt', 'DESC']]
    });

    return records.map(record => ({
      date: moment(record.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      requestId: record.requestId,
      endpoint: `${record.ApiEndpoint.method} ${record.ApiEndpoint.path}`,
      cost: record.cost,
      pricePerCall: record.CustomerPackage?.Package?.pricePerCall || 0,
      totalPrice: (record.cost * (record.CustomerPackage?.Package?.pricePerCall || 0)).toFixed(4),
      status: record.status,
      burstDetected: record.burstDetected,
      corrected: record.corrected
    }));
  }
}

module.exports = QuotaService;
