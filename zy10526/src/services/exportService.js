const { Parser } = require('json2csv');
const moment = require('moment');
const {
  CustomerWhitelist,
  HitRecord,
  ExplanationReport,
  ExceptionLog,
  Customer,
  WhitelistType,
  WhitelistRule,
  ApplicationSource
} = require('../models');

class ExportService {
  async exportWhitelists(params = {}, format = 'json') {
    const { accountId, status, startDate, endDate } = params;
    const where = {};

    if (accountId) {
      const customer = await Customer.findOne({ where: { accountId } });
      if (customer) {
        where.customerId = customer.id;
      }
    }

    if (status) {
      where.status = status;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, $gte: moment(startDate).toDate() };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, $lte: moment(endDate).toDate() };
    }

    const whitelists = await CustomerWhitelist.findAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: WhitelistType, as: 'whitelistType' },
        { model: WhitelistRule, as: 'whitelistRule' },
        { model: ApplicationSource, as: 'applicationSource' }
      ],
      order: [['createdAt', 'DESC']]
    });

    const data = whitelists.map(w => ({
      id: w.id,
      accountId: w.customer.accountId,
      customerName: w.customer.customerName,
      whitelistType: w.whitelistType.typeName,
      ruleName: w.whitelistRule.ruleName,
      sourceName: w.applicationSource.sourceName,
      status: w.status,
      effectiveDate: moment(w.effectiveDate).format('YYYY-MM-DD HH:mm:ss'),
      expiryDate: w.expiryDate ? moment(w.expiryDate).format('YYYY-MM-DD HH:mm:ss') : '',
      createdBy: w.createdBy,
      createdAt: moment(w.createdAt).format('YYYY-MM-DD HH:mm:ss'),
      remark: w.remark || ''
    }));

    if (format === 'csv') {
      const parser = new Parser();
      return parser.parse(data);
    }

    return data;
  }

  async exportHitRecords(params = {}, format = 'json') {
    const { whitelistId, hitScene, hitResult, startDate, endDate } = params;
    const where = {};

    if (whitelistId) {
      where.customerWhitelistId = whitelistId;
    }

    if (hitScene) {
      where.hitScene = hitScene;
    }

    if (hitResult) {
      where.hitResult = hitResult;
    }

    if (startDate) {
      where.hitTime = { ...where.hitTime, $gte: moment(startDate).toDate() };
    }

    if (endDate) {
      where.hitTime = { ...where.hitTime, $lte: moment(endDate).toDate() };
    }

    const hits = await HitRecord.findAll({
      where,
      include: [
        { model: Customer, as: 'customer' },
        { model: CustomerWhitelist, as: 'customerWhitelist', include: [
          { model: WhitelistType, as: 'whitelistType' },
          { model: ApplicationSource, as: 'applicationSource' }
        ]}
      ],
      order: [['hitTime', 'DESC']]
    });

    const data = hits.map(h => ({
      id: h.id,
      accountId: h.customer.accountId,
      customerName: h.customer.customerName,
      whitelistType: h.customerWhitelist?.whitelistType?.typeName || '',
      sourceName: h.customerWhitelist?.applicationSource?.sourceName || '',
      hitScene: h.hitScene,
      hitTime: moment(h.hitTime).format('YYYY-MM-DD HH:mm:ss'),
      hitResult: h.hitResult,
      isMatch: h.matchDetails?.isMatch ? '是' : '否',
      matchedConditions: h.matchDetails?.matchedConditions?.map(c => c.field).join(',') || '',
      operator: h.operator || ''
    }));

    if (format === 'csv') {
      const parser = new Parser();
      return parser.parse(data);
    }

    return data;
  }

  async exportExceptions(params = {}, format = 'json') {
    const { exceptionType, severity, resolved, startDate, endDate } = params;
    const where = {};

    if (exceptionType) {
      where.exceptionType = exceptionType;
    }

    if (severity) {
      where.severity = severity;
    }

    if (resolved !== undefined) {
      where.resolved = resolved;
    }

    if (startDate) {
      where.createdAt = { ...where.createdAt, $gte: moment(startDate).toDate() };
    }

    if (endDate) {
      where.createdAt = { ...where.createdAt, $lte: moment(endDate).toDate() };
    }

    const exceptions = await ExceptionLog.findAll({
      where,
      order: [['createdAt', 'DESC']]
    });

    const data = exceptions.map(e => ({
      id: e.id,
      requestId: e.requestId,
      exceptionType: e.exceptionType,
      severity: e.severity,
      errorMessage: e.errorMessage,
      apiEndpoint: e.apiEndpoint || '',
      httpMethod: e.httpMethod || '',
      operator: e.operator || '',
      resolved: e.resolved ? '是' : '否',
      resolvedBy: e.resolvedBy || '',
      resolvedAt: e.resolvedAt ? moment(e.resolvedAt).format('YYYY-MM-DD HH:mm:ss') : '',
      createdAt: moment(e.createdAt).format('YYYY-MM-DD HH:mm:ss')
    }));

    if (format === 'csv') {
      const parser = new Parser();
      return parser.parse(data);
    }

    return data;
  }
}

module.exports = new ExportService();
