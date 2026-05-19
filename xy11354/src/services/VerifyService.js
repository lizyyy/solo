const logger = require('../config/logger');
const Visitor = require('../models/Visitor');
const TemporaryPlate = require('../models/TemporaryPlate');
const Blacklist = require('../models/Blacklist');
const VerifyRecord = require('../models/VerifyRecord');

class VerifyService {
  static async verifyVisitor(phone, options = {}) {
    const { gateNumber, verifyBy = 'system', checkDate } = options;
    const verifyDate = checkDate || new Date().toISOString().split('T')[0];
    
    let blacklistMatch = null;
    let isInBlacklist = false;
    let blacklistLevel = null;
    
    const blacklistByPhone = await Blacklist.checkPhone(phone);
    if (blacklistByPhone) {
      isInBlacklist = true;
      blacklistMatch = blacklistByPhone;
      blacklistLevel = blacklistByPhone.level;
    }
    
    const visitors = await Visitor.findByPhone(phone);
    const validVisitors = visitors.filter(v => 
      v.visit_date === verifyDate && 
      v.review_status === 'approved' &&
      v.is_blacklisted === 0
    );
    
    let isAllowed = !isInBlacklist && validVisitors.length > 0;
    let verifyResult = '';
    
    if (isInBlacklist) {
      verifyResult = `黑名单人员，原因: ${blacklistMatch.reason}, 级别: ${blacklistLevel}`;
    } else if (validVisitors.length === 0) {
      verifyResult = '无有效访客预约记录';
    } else {
      verifyResult = `核验通过，访客: ${validVisitors.map(v => v.visitor_name).join(', ')}`;
    }
    
    const recordResult = await VerifyRecord.create({
      verifyType: 'visitor',
      targetValue: phone,
      visitorId: validVisitors.length > 0 ? validVisitors[0].id : null,
      blacklistId: blacklistMatch ? blacklistMatch.id : null,
      isAllowed,
      isInBlacklist,
      verifyResult,
      verifyBy,
      gateNumber
    });
    
    if (!recordResult.success) {
      logger.error('Failed to create verify record:', recordResult.error);
    }
    
    return {
      isAllowed,
      isInBlacklist,
      blacklistLevel,
      blacklistReason: blacklistMatch ? blacklistMatch.reason : null,
      visitors: validVisitors,
      verifyResult,
      recordId: recordResult.success ? recordResult.id : null
    };
  }

  static async verifyLicensePlate(plateNumber, options = {}) {
    const { gateNumber, verifyBy = 'system', checkDate } = options;
    const verifyDate = checkDate || new Date().toISOString().split('T')[0];
    
    let blacklistMatch = null;
    let isInBlacklist = false;
    let blacklistLevel = null;
    
    const blacklistByPlate = await Blacklist.checkLicensePlate(plateNumber);
    if (blacklistByPlate) {
      isInBlacklist = true;
      blacklistMatch = blacklistByPlate;
      blacklistLevel = blacklistByPlate.level;
    }
    
    const temporaryPlate = await TemporaryPlate.findByPlateNumber(plateNumber);
    const isValidPlate = temporaryPlate && 
      temporaryPlate.status === 'active' &&
      temporaryPlate.review_status === 'approved' &&
      temporaryPlate.is_blacklisted === 0 &&
      temporaryPlate.valid_start_date <= verifyDate &&
      temporaryPlate.valid_end_date >= verifyDate;
    
    const visitorsByPlate = await Visitor.findByLicensePlate(plateNumber);
    const validVisitors = visitorsByPlate.filter(v => 
      v.visit_date === verifyDate && 
      v.review_status === 'approved' &&
      v.is_blacklisted === 0
    );
    
    let isAllowed = !isInBlacklist && (isValidPlate || validVisitors.length > 0);
    let verifyResult = '';
    
    if (isInBlacklist) {
      verifyResult = `黑名单车辆，原因: ${blacklistMatch.reason}, 级别: ${blacklistLevel}`;
    } else if (!isValidPlate && validVisitors.length === 0) {
      verifyResult = '无有效临时车牌或访客预约';
    } else if (isValidPlate) {
      verifyResult = `核验通过，临时车牌有效期: ${temporaryPlate.valid_start_date} 至 ${temporaryPlate.valid_end_date}`;
    } else {
      verifyResult = `核验通过，访客车辆预约`;
    }
    
    const recordResult = await VerifyRecord.create({
      verifyType: 'license_plate',
      targetValue: plateNumber,
      plateId: isValidPlate ? temporaryPlate.id : null,
      visitorId: validVisitors.length > 0 ? validVisitors[0].id : null,
      blacklistId: blacklistMatch ? blacklistMatch.id : null,
      isAllowed,
      isInBlacklist,
      verifyResult,
      verifyBy,
      gateNumber
    });
    
    if (!recordResult.success) {
      logger.error('Failed to create verify record:', recordResult.error);
    }
    
    return {
      isAllowed,
      isInBlacklist,
      blacklistLevel,
      blacklistReason: blacklistMatch ? blacklistMatch.reason : null,
      temporaryPlate: isValidPlate ? temporaryPlate : null,
      visitors: validVisitors,
      verifyResult,
      recordId: recordResult.success ? recordResult.id : null
    };
  }

  static async verifyByIdCard(idCard, options = {}) {
    const { gateNumber, verifyBy = 'system' } = options;
    
    const blacklistMatch = await Blacklist.checkIdCard(idCard);
    const isInBlacklist = !!blacklistMatch;
    
    let isAllowed = !isInBlacklist;
    let verifyResult = isInBlacklist 
      ? `黑名单人员，原因: ${blacklistMatch.reason}, 级别: ${blacklistMatch.level}`
      : '未在黑名单中';
    
    const recordResult = await VerifyRecord.create({
      verifyType: 'id_card',
      targetValue: idCard,
      blacklistId: blacklistMatch ? blacklistMatch.id : null,
      isAllowed,
      isInBlacklist,
      verifyResult,
      verifyBy,
      gateNumber
    });
    
    return {
      isAllowed,
      isInBlacklist,
      blacklistLevel: blacklistMatch ? blacklistMatch.level : null,
      blacklistReason: blacklistMatch ? blacklistMatch.reason : null,
      verifyResult,
      recordId: recordResult.success ? recordResult.id : null
    };
  }

  static async getVerifyHistory(filters = {}) {
    return await VerifyRecord.findAll(filters);
  }

  static async getStatistics(date = null) {
    return await VerifyRecord.getStatistics(date);
  }
}

module.exports = VerifyService;
