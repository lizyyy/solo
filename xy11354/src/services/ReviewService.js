const logger = require('../config/logger');
const Visitor = require('../models/Visitor');
const TemporaryPlate = require('../models/TemporaryPlate');
const Blacklist = require('../models/Blacklist');
const VerifyService = require('./VerifyService');

class ReviewService {
  static async getPendingReviews(type = 'all') {
    const result = {};
    
    if (type === 'all' || type === 'visitor') {
      result.visitors = await Visitor.findAll({ reviewStatus: 'pending' });
    }
    
    if (type === 'all' || type === 'temporary_plate') {
      result.temporaryPlates = await TemporaryPlate.findAll({ reviewStatus: 'pending' });
    }
    
    return result;
  }

  static async reviewVisitor(id, status, remark, reviewer = 'system') {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status, must be approved or rejected');
    }
    
    const visitor = await Visitor.findById(id);
    if (!visitor) {
      throw new Error('Visitor not found');
    }
    
    let blacklistInfo = null;
    if (visitor.phone) {
      const verifyResult = await VerifyService.verifyVisitor(visitor.phone, { checkDate: visitor.visit_date });
      if (verifyResult.isInBlacklist) {
        blacklistInfo = {
          isBlacklisted: true,
          reason: verifyResult.blacklistReason,
          level: verifyResult.blacklistLevel
        };
        if (status === 'approved') {
          status = 'rejected';
          remark = remark ? `${remark} (系统自动拦截: 黑名单人员)` : '系统自动拦截: 黑名单人员';
        }
      }
    }
    
    if (visitor.license_plate) {
      const plateResult = await VerifyService.verifyLicensePlate(visitor.license_plate, { checkDate: visitor.visit_date });
      if (plateResult.isInBlacklist && status === 'approved') {
        blacklistInfo = {
          isBlacklisted: true,
          reason: plateResult.blacklistReason,
          level: plateResult.blacklistLevel
        };
        status = 'rejected';
        remark = remark ? `${remark} (系统自动拦截: 黑名单车辆)` : '系统自动拦截: 黑名单车辆';
      }
    }
    
    const success = await Visitor.review(id, status, remark, reviewer);
    if (success) {
      logger.info(`Visitor ${id} reviewed: ${status} by ${reviewer}`);
    }
    
    return {
      success,
      finalStatus: status,
      blacklistInfo,
      remark
    };
  }

  static async reviewTemporaryPlate(id, status, remark, reviewer = 'system') {
    if (!['approved', 'rejected'].includes(status)) {
      throw new Error('Invalid status, must be approved or rejected');
    }
    
    const plate = await TemporaryPlate.findById(id);
    if (!plate) {
      throw new Error('Temporary plate not found');
    }
    
    let blacklistInfo = null;
    const verifyResult = await VerifyService.verifyLicensePlate(plate.plate_number, { checkDate: plate.valid_start_date });
    if (verifyResult.isInBlacklist && status === 'approved') {
      blacklistInfo = {
        isBlacklisted: true,
        reason: verifyResult.blacklistReason,
        level: verifyResult.blacklistLevel
      };
      status = 'rejected';
      remark = remark ? `${remark} (系统自动拦截: 黑名单车辆)` : '系统自动拦截: 黑名单车辆';
    }
    
    const success = await TemporaryPlate.review(id, status, remark, reviewer);
    if (success) {
      logger.info(`Temporary plate ${id} reviewed: ${status} by ${reviewer}`);
    }
    
    return {
      success,
      finalStatus: status,
      blacklistInfo,
      remark
    };
  }

  static async bulkReview(type, ids, status, remark, reviewer = 'system') {
    const results = {
      total: ids.length,
      success: 0,
      failed: 0,
      autoRejected: 0,
      details: []
    };
    
    for (const id of ids) {
      try {
        let reviewResult;
        if (type === 'visitor') {
          reviewResult = await this.reviewVisitor(id, status, remark, reviewer);
        } else if (type === 'temporary_plate') {
          reviewResult = await this.reviewTemporaryPlate(id, status, remark, reviewer);
        } else {
          throw new Error('Invalid type');
        }
        
        if (reviewResult.success) {
          results.success++;
          if (reviewResult.blacklistInfo && reviewResult.blacklistInfo.isBlacklisted) {
            results.autoRejected++;
          }
        } else {
          results.failed++;
        }
        
        results.details.push({
          id,
          success: reviewResult.success,
          finalStatus: reviewResult.finalStatus,
          blacklistInfo: reviewResult.blacklistInfo,
          remark: reviewResult.remark
        });
      } catch (error) {
        results.failed++;
        results.details.push({
          id,
          success: false,
          error: error.message
        });
      }
    }
    
    return results;
  }

  static async getReviewedList(type, filters = {}) {
    const reviewFilters = { ...filters, reviewStatus: filters.reviewStatus || 'approved' };
    
    if (type === 'visitor') {
      return await Visitor.findAll(reviewFilters);
    } else if (type === 'temporary_plate') {
      return await TemporaryPlate.findAll(reviewFilters);
    } else {
      throw new Error('Invalid type');
    }
  }

  static async addToBlacklist(type, targetId, reason, level = 'normal', operator = 'system') {
    let targetData;
    
    if (type === 'visitor') {
      targetData = await Visitor.findById(targetId);
      if (!targetData) throw new Error('Visitor not found');
      
      await Visitor.updateBlacklistStatus(targetId, true);
      
      return await Blacklist.create({
        type: 'person',
        name: targetData.visitor_name,
        phone: targetData.phone,
        idCard: targetData.id_card,
        reason,
        level,
        addedBy: operator
      });
    } else if (type === 'temporary_plate') {
      targetData = await TemporaryPlate.findById(targetId);
      if (!targetData) throw new Error('Temporary plate not found');
      
      await TemporaryPlate.updateBlacklistStatus(targetId, true);
      
      return await Blacklist.create({
        type: 'vehicle',
        name: targetData.owner_name,
        licensePlate: targetData.plate_number,
        reason,
        level,
        addedBy: operator
      });
    } else {
      throw new Error('Invalid type');
    }
  }
}

module.exports = ReviewService;
