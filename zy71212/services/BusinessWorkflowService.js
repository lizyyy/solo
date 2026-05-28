const moment = require('moment');
const { RenewalReport } = require('../models');
const StorageService = require('./StorageService');
const GracePeriodService = require('./GracePeriodService');
const ReminderService = require('./ReminderService');
const AdvancePaymentService = require('./AdvancePaymentService');
const DataConsistencyManager = require('./DataConsistencyManager');
const HolidayService = require('./HolidayService');

class BusinessWorkflowService {
  constructor() {
    this.storageService = new StorageService();
    this.gracePeriodService = new GracePeriodService(this.storageService);
    this.reminderService = new ReminderService(this.storageService);
    this.advancePaymentService = new AdvancePaymentService(this.storageService);
    this.consistencyManager = new DataConsistencyManager();
    this.holidayService = new HolidayService();
  }

  async processDirectory(dirPath, options = {}) {
    const FileProcessor = require('./FileProcessor');
    const fileProcessor = new FileProcessor({ stopOnError: false });
    
    const result = await fileProcessor.processDirectory(dirPath);
    
    const validRecords = {
      policies: [],
      paymentPlans: [],
      advancePayments: [],
      visitRecords: [],
      reminderRecords: []
    };

    const invalidRecords = [];
    const missingFieldsSummary = {};

    result.success.forEach(fileResult => {
      fileResult.records.forEach(record => {
        if (record.valid && record.model) {
          switch (record.type) {
            case 'policy':
              validRecords.policies.push(record.model);
              break;
            case 'paymentPlan':
              validRecords.paymentPlans.push(record.model);
              break;
            case 'advancePayment':
              validRecords.advancePayments.push(record.model);
              break;
            case 'visitRecord':
              validRecords.visitRecords.push(record.model);
              break;
            case 'reminderRecord':
              validRecords.reminderRecords.push(record.model);
              break;
          }
        } else {
          invalidRecords.push({
            file: fileResult.file,
            raw: record.raw,
            type: record.typeName,
            error: record.error,
            missingFields: record.missingFields
          });
          
          record.missingFields?.forEach(field => {
            missingFieldsSummary[field] = (missingFieldsSummary[field] || 0) + 1;
          });
        }
      });
    });

    if (!options.dryRun) {
      if (validRecords.policies.length > 0) {
        const existing = this.storageService.getPolicies();
        const merged = this.mergeById(existing, validRecords.policies, 'policyNo');
        this.storageService.savePolicies(merged);
      }
      if (validRecords.paymentPlans.length > 0) {
        const existing = this.storageService.getPaymentPlans();
        const merged = this.mergeById(existing, validRecords.paymentPlans, 'planId');
        this.storageService.savePaymentPlans(merged);
      }
      if (validRecords.advancePayments.length > 0) {
        const existing = this.storageService.getAdvancePayments();
        const merged = this.mergeById(existing, validRecords.advancePayments, 'recordId');
        this.storageService.saveAdvancePayments(merged);
      }
      if (validRecords.visitRecords.length > 0) {
        const existing = this.storageService.getVisitRecords();
        const merged = this.mergeById(existing, validRecords.visitRecords, 'visitId');
        this.storageService.saveVisitRecords(merged);
      }
      if (validRecords.reminderRecords.length > 0) {
        const existing = this.storageService.getReminderRecords();
        const merged = this.mergeById(existing, validRecords.reminderRecords, 'reminderId');
        this.storageService.saveReminderRecords(merged);
      }
    }

    this.gracePeriodService.updateAllGraceEndDates();

    return {
      fileProcessing: result,
      validRecords: {
        policies: validRecords.policies.length,
        paymentPlans: validRecords.paymentPlans.length,
        advancePayments: validRecords.advancePayments.length,
        visitRecords: validRecords.visitRecords.length,
        reminderRecords: validRecords.reminderRecords.length,
        total: Object.values(validRecords).reduce((sum, arr) => sum + arr.length, 0)
      },
      invalidRecords,
      missingFieldsSummary: Object.entries(missingFieldsSummary)
        .map(([field, count]) => ({ field, count }))
        .sort((a, b) => b.count - a.count),
      consistencyCheck: this.checkDataConsistency()
    };
  }

  mergeById(existing, incoming, idField) {
    const map = new Map();
    existing.forEach(item => map.set(item[idField], item));
    incoming.forEach(item => {
      if (item[idField]) {
        const existingItem = map.get(item[idField]);
        if (existingItem) {
          const result = this.consistencyManager.safeUpdateRecord(existingItem, item);
          if (!result.hasConflicts) {
            map.set(item[idField], { ...existingItem, ...result.updates, updatedAt: moment().format('YYYY-MM-DD HH:mm:ss') });
          }
        } else {
          map.set(item[idField], item);
        }
      } else {
        const newId = this.generateId(idField);
        map.set(newId, { ...item, [idField]: newId });
      }
    });
    return Array.from(map.values());
  }

  generateId(prefix) {
    const prefixMap = {
      policyNo: 'POL',
      planId: 'PLN',
      recordId: 'ADV',
      visitId: 'VIS',
      reminderId: 'REM',
      reportId: 'RPT'
    };
    const p = prefixMap[prefix] || 'ID';
    return `${p}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  checkDataConsistency() {
    const data = {
      policies: this.storageService.getPolicies(),
      paymentPlans: this.storageService.getPaymentPlans(),
      advancePayments: this.storageService.getAdvancePayments(),
      visitRecords: this.storageService.getVisitRecords(),
      reminderRecords: this.storageService.getReminderRecords()
    };

    return this.consistencyManager.validateAllConsistency(data);
  }

  runGracePeriodAnalysis(options = {}) {
    const graceResults = this.gracePeriodService.calculateAllGracePeriods(options);
    const needingReminder = this.gracePeriodService.getPoliciesNeedingReminder(options);
    const eligibleForAdvance = this.advancePaymentService.getPoliciesEligibleForAdvance();

    return {
      gracePeriods: graceResults,
      needingReminder,
      eligibleForAdvance,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  generateReminderList(options = {}) {
    const needingReminder = this.gracePeriodService.getPoliciesNeedingReminder(options);
    
    const reminderList = needingReminder.map(item => {
      const templateType = item.isGraceExpired ? 'expired' :
        item.urgency === '紧急' ? 'urgent' :
        item.isInGracePeriod ? 'grace' : 'normal';
      
      const reminderType = item.suggestedReminderType[0] || '短信';
      const content = this.reminderService.generateReminderContent(
        templateType,
        reminderType === '电话' ? 'phone' : (reminderType === '微信' ? 'wechat' : 'sms'),
        {
          policyholder: item.policyholder,
          policyNo: item.policyNo,
          premium: item.premium?.toLocaleString() || '',
          dueDate: item.dueDate,
          daysRemaining: item.daysRemaining,
          agent: item.agent || '您的代理人',
          interest: '0.00'
        }
      );

      return {
        ...item,
        templateType,
        reminderType,
        content,
        canSend: this.reminderService.canSendReminder(item.policyNo, item.period, reminderType).canSend
      };
    });

    return {
      total: reminderList.length,
      byUrgency: {
        '紧急': reminderList.filter(r => r.urgency === '紧急').length,
        '高': reminderList.filter(r => r.urgency === '高').length,
        '中': reminderList.filter(r => r.urgency === '中').length,
        '低': reminderList.filter(r => r.urgency === '低').length,
        '已过期': reminderList.filter(r => r.urgency === '已过期').length
      },
      reminderList
    };
  }

  executeReminders(reminderDataList, options = {}) {
    const results = this.reminderService.batchCreateReminders(reminderDataList, options);
    
    return {
      ...results,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  processAdvancePayments(options = {}) {
    return this.advancePaymentService.autoProcessAdvancePayments(options);
  }

  generateRenewalReport(options = {}) {
    const { reportPeriod = '', generatedBy = '' } = options;
    
    const graceAnalysis = this.runGracePeriodAnalysis();
    const advanceStats = this.advancePaymentService.getAdvancePaymentStatistics();
    const reminderStats = this.reminderService.getReminderStatistics();
    const policies = this.storageService.getPolicies();
    const paymentPlans = this.storageService.getPaymentPlans();
    const visitRecords = this.storageService.getVisitRecords();
    const advancePayments = this.storageService.getAdvancePayments();

    const report = new RenewalReport({
      reportId: `RPT_${Date.now()}`,
      reportDate: moment().format('YYYY-MM-DD'),
      reportPeriod,
      generatedBy
    });

    const visitMap = new Map();
    visitRecords.forEach(v => {
      if (!visitMap.has(v.policyNo) || 
          moment(v.visitDate).isAfter(moment(visitMap.get(v.policyNo).visitDate))) {
        visitMap.set(v.policyNo, v);
      }
    });

    const advanceMap = new Map();
    advancePayments.forEach(a => {
      if (!a.repaid) {
        advanceMap.set(`${a.policyNo}_${a.period}`, a);
      }
    });

    for (const grace of graceAnalysis.gracePeriods.results) {
      const policy = policies.find(p => p.policyNo === grace.policyNo);
      const paymentPlan = paymentPlans.find(p => p.policyNo === grace.policyNo && p.period === grace.period);
      const lastVisit = visitMap.get(grace.policyNo);
      const advancePayment = advanceMap.get(`${grace.policyNo}_${grace.period}`);

      const detail = {
        policyNo: grace.policyNo,
        policyholder: policy?.policyholder || '',
        phone: policy?.phone || '',
        agent: policy?.agent || '',
        productName: policy?.productName || '',
        period: grace.period,
        premium: grace.premium,
        dueDate: grace.dueDate,
        graceEndDate: grace.graceEndDate,
        graceDays: grace.graceDays,
        actualGraceDays: grace.actualGraceDays,
        isOverdue: grace.isOverdue,
        isInGracePeriod: grace.isInGracePeriod,
        isGraceExpired: grace.isGraceExpired,
        daysOverdue: grace.daysOverdue,
        daysRemaining: grace.daysRemaining,
        urgency: grace.urgency,
        status: paymentPlan?.status || '待缴费',
        paidAmount: paymentPlan?.paidAmount || 0,
        paidDate: paymentPlan?.paidDate || null,
        hasAdvancePayment: !!advancePayment,
        advanceRepaid: advancePayment?.repaid || false,
        advanceAmount: advancePayment?.advanceAmount || 0,
        hasStopIntent: lastVisit?.isStopIntent || false,
        intentLocked: lastVisit?.isIntentLocked || false,
        customerIntent: lastVisit?.customerIntent || '',
        lastContactResult: lastVisit?.contactResult || '',
        lastVisitDate: lastVisit?.visitDate || null,
        promisedPaymentDate: lastVisit?.promisedPaymentDate || null,
        needsFollowUp: lastVisit?.needsFollowUp || false,
        nextAction: graceAnalysis.needingReminder.find(n => n.policyNo === grace.policyNo)?.nextAction || null,
        extendedDueToHoliday: grace.extendedDueToHoliday,
        holidaysCount: grace.holidaysCount
      };

      report.addPolicyDetail(detail);
    }

    report.updateSummary();
    report.generateRecommendations();

    const reports = this.storageService.getReports();
    reports.push(report.toJSON());
    this.storageService.saveReports(reports);

    return {
      report: report.toJSON(),
      statistics: {
        advance: advanceStats,
        reminder: reminderStats,
        consistency: this.checkDataConsistency()
      }
    };
  }

  exportReport(reportId, format = 'json') {
    const reports = this.storageService.getReports();
    const report = reports.find(r => r.reportId === reportId);
    
    if (!report) {
      return { success: false, error: '报告不存在' };
    }

    if (format === 'json') {
      return {
        success: true,
        content: JSON.stringify(report, null, 2),
        filename: `续缴报告_${report.reportDate}_${reportId}.json`
      };
    }

    if (format === 'csv') {
      const csvContent = this.generateReportCSV(report);
      return {
        success: true,
        content: csvContent,
        filename: `续缴报告_${report.reportDate}_${reportId}.csv`
      };
    }

    return { success: false, error: '不支持的导出格式' };
  }

  generateReportCSV(report) {
    const headers = [
      '保单号', '投保人', '联系电话', '代理人', '产品名称',
      '缴费期次', '应缴保费', '应缴日期', '宽限期结束日', '宽限期天数',
      '是否逾期', '是否在宽限期', '宽限期是否已满', '逾期天数', '剩余天数',
      '紧急程度', '缴费状态', '已缴金额', '已缴日期',
      '是否垫交', '垫交金额', '是否停保意愿', '客户意愿',
      '上次联系结果', '上次回访日期', '承诺缴费日期',
      '是否需要跟进', '下次动作'
    ];

    const rows = report.details.map(d => [
      d.policyNo, d.policyholder, d.phone, d.agent, d.productName,
      d.period, d.premium, d.dueDate, d.graceEndDate, d.actualGraceDays,
      d.isOverdue ? '是' : '否', d.isInGracePeriod ? '是' : '否', 
      d.isGraceExpired ? '是' : '否', d.daysOverdue, d.daysRemaining,
      d.urgency, d.status, d.paidAmount, d.paidDate || '',
      d.hasAdvancePayment ? '是' : '否', d.advanceAmount || '',
      d.hasStopIntent ? '是' : '否', d.customerIntent || '',
      d.lastContactResult || '', d.lastVisitDate || '', d.promisedPaymentDate || '',
      d.needsFollowUp ? '是' : '否', d.nextAction?.action || ''
    ]);

    let csv = '\uFEFF' + headers.join(',') + '\n';
    rows.forEach(row => {
      csv += row.map(cell => {
        const str = String(cell ?? '');
        return str.includes(',') || str.includes('"') ? `"${str.replace(/"/g, '""')}"` : str;
      }).join(',') + '\n';
    });

    return csv;
  }

  getNextSteps(options = {}) {
    const graceAnalysis = this.runGracePeriodAnalysis();
    const needingReminder = this.gracePeriodService.getPoliciesNeedingReminder(options);
    const eligibleForAdvance = this.advancePaymentService.getPoliciesEligibleForAdvance();
    const consistency = this.checkDataConsistency();

    const nextSteps = [];

    if (graceAnalysis.gracePeriods.urgent > 0) {
      nextSteps.push({
        priority: 1,
        type: '紧急催缴',
        count: graceAnalysis.gracePeriods.urgent,
        description: `${graceAnalysis.gracePeriods.urgent}份保单宽限期剩余3天以内，需立即处理`,
        action: 'generateReminders',
        filter: { urgency: '紧急' }
      });
    }

    const highPriority = needingReminder.filter(r => r.urgency === '高').length;
    if (highPriority > 0) {
      nextSteps.push({
        priority: 2,
        type: '高优先级催缴',
        count: highPriority,
        description: `${highPriority}份保单宽限期剩余7天以内，需尽快跟进`,
        action: 'generateReminders',
        filter: { urgency: '高' }
      });
    }

    if (eligibleForAdvance.filter(e => e.canAdvance).length > 0) {
      const count = eligibleForAdvance.filter(e => e.canAdvance).length;
      nextSteps.push({
        priority: 3,
        type: '自动垫交处理',
        count,
        description: `${count}份保单即将到期且符合垫交条件，需确认是否执行自动垫交`,
        action: 'processAdvancePayments'
      });
    }

    const stopIntent = graceAnalysis.needingReminder.filter(r => r.hasStopIntent && !r.intentLocked).length;
    if (stopIntent > 0) {
      nextSteps.push({
        priority: 4,
        type: '停保意愿确认',
        count: stopIntent,
        description: `${stopIntent}份保单客户表示停保意愿但未最终确认，需再次核实`,
        action: 'generateReminders',
        filter: { hasStopIntent: true, intentLocked: false }
      });
    }

    if (consistency.errorCount > 0 || consistency.warningCount > 0) {
      nextSteps.push({
        priority: 5,
        type: '数据一致性检查',
        count: consistency.errorCount + consistency.warningCount,
        description: `发现 ${consistency.errorCount} 个错误和 ${consistency.warningCount} 个警告，请检查数据质量`,
        action: 'checkConsistency'
      });
    }

    const normalPriority = needingReminder.filter(r => r.urgency === '中' || r.urgency === '低').length;
    if (normalPriority > 0) {
      nextSteps.push({
        priority: 6,
        type: '常规催缴',
        count: normalPriority,
        description: `${normalPriority}份保单需要常规催缴`,
        action: 'generateReminders',
        filter: { urgency: ['中', '低'] }
      });
    }

    if (eligibleForAdvance.filter(e => !e.canAdvance && e.autoAdvanceEnabled).length > 0) {
      const count = eligibleForAdvance.filter(e => !e.canAdvance && e.autoAdvanceEnabled).length;
      nextSteps.push({
        priority: 7,
        type: '垫交问题处理',
        count,
        description: `${count}份保单开启了自动垫交但无法执行，请检查原因`,
        action: 'viewAdvanceEligible'
      });
    }

    return {
      nextSteps: nextSteps.sort((a, b) => a.priority - b.priority),
      summary: {
        totalActions: nextSteps.reduce((sum, s) => sum + s.count, 0),
        urgentActions: nextSteps.filter(s => s.priority <= 2).reduce((sum, s) => sum + s.count, 0),
        hasErrors: consistency.errorCount > 0
      },
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  getDashboardData() {
    const graceAnalysis = this.runGracePeriodAnalysis();
    const advanceStats = this.advancePaymentService.getAdvancePaymentStatistics();
    const reminderStats = this.reminderService.getReminderStatistics();
    const nextSteps = this.getNextSteps();
    const consistency = this.checkDataConsistency();

    return {
      overview: {
        totalPolicies: this.storageService.getPolicies().length,
        totalPaymentPlans: this.storageService.getPaymentPlans().length,
        inGracePeriod: graceAnalysis.gracePeriods.inGracePeriod,
        graceExpired: graceAnalysis.gracePeriods.graceExpired,
        urgent: graceAnalysis.gracePeriods.urgent,
        needingReminder: graceAnalysis.needingReminder.length,
        pendingAdvance: advanceStats.unrepaidCount,
        pendingFollowUp: nextSteps.nextSteps.reduce((sum, s) => sum + s.count, 0)
      },
      financial: {
        totalPremiumDue: graceAnalysis.gracePeriods.summary.totalPremiumDue,
        totalPremiumOverdue: graceAnalysis.gracePeriods.summary.totalPremiumOverdue,
        totalPremiumInGrace: graceAnalysis.gracePeriods.summary.totalPremiumInGrace,
        totalAdvanceOwed: advanceStats.totalAmountOwed,
        totalAdvancePrincipal: advanceStats.totalPrincipal,
        totalAdvanceInterest: advanceStats.totalInterest
      },
      byUrgency: graceAnalysis.gracePeriods.summary.countByUrgency,
      graceAnalysis,
      advanceStats,
      reminderStats,
      nextSteps,
      consistency,
      timestamp: moment().format('YYYY-MM-DD HH:mm:ss')
    };
  }

  getServices() {
    return {
      storageService: this.storageService,
      gracePeriodService: this.gracePeriodService,
      reminderService: this.reminderService,
      advancePaymentService: this.advancePaymentService,
      consistencyManager: this.consistencyManager,
      holidayService: this.holidayService
    };
  }
}

module.exports = BusinessWorkflowService;
