const { BusinessWorkflowService } = require('../services');
const { INPUT_TYPE_NAMES } = require('../models');

class ApiController {
  constructor() {
    this.workflowService = new BusinessWorkflowService();
    const services = this.workflowService.getServices();
    this.storageService = services.storageService;
    this.gracePeriodService = services.gracePeriodService;
    this.reminderService = services.reminderService;
    this.advancePaymentService = services.advancePaymentService;
    this.consistencyManager = services.consistencyManager;
    this.holidayService = services.holidayService;
  }

  async processDirectory(req, res) {
    try {
      const { dirPath, dryRun = false } = req.body;
      
      if (!dirPath) {
        return res.status(400).json({
          success: false,
          error: '请提供目录路径'
        });
      }

      const result = await this.workflowService.processDirectory(dirPath, { dryRun });
      
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getDashboard(req, res) {
    try {
      const data = this.workflowService.getDashboardData();
      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getNextSteps(req, res) {
    try {
      const data = this.workflowService.getNextSteps(req.query);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  runGraceAnalysis(req, res) {
    try {
      const data = this.workflowService.runGracePeriodAnalysis(req.body);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  generateReminderList(req, res) {
    try {
      const data = this.workflowService.generateReminderList(req.body);
      res.json({
        success: true,
        data
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  executeReminders(req, res) {
    try {
      const { reminders, options } = req.body;
      
      if (!reminders || !Array.isArray(reminders)) {
        return res.status(400).json({
          success: false,
          error: '请提供催缴数据列表'
        });
      }

      const result = this.workflowService.executeReminders(reminders, options);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  processAdvancePayments(req, res) {
    try {
      const result = this.workflowService.processAdvancePayments(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  generateReport(req, res) {
    try {
      const result = this.workflowService.generateRenewalReport(req.body);
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  exportReport(req, res) {
    try {
      const { reportId, format = 'json' } = req.query;
      
      if (!reportId) {
        return res.status(400).json({
          success: false,
          error: '请提供报告ID'
        });
      }

      const result = this.workflowService.exportReport(reportId, format);
      
      if (!result.success) {
        return res.status(404).json(result);
      }

      if (format === 'csv') {
        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
        return res.send(result.content);
      }

      res.setHeader('Content-Disposition', `attachment; filename="${result.filename}"`);
      res.json(JSON.parse(result.content));
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getPolicies(req, res) {
    try {
      const { policyNo } = req.query;
      let policies = this.storageService.getPolicies();
      
      if (policyNo) {
        policies = policies.filter(p => p.policyNo.includes(policyNo));
      }
      
      res.json({
        success: true,
        data: policies
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getPolicyDetail(req, res) {
    try {
      const { policyNo } = req.params;
      
      const policy = this.storageService.getPolicies().find(p => p.policyNo === policyNo);
      if (!policy) {
        return res.status(404).json({
          success: false,
          error: '保单不存在'
        });
      }

      const paymentPlans = this.storageService.getPaymentPlans().filter(p => p.policyNo === policyNo);
      const advancePayments = this.advancePaymentService.getAdvancePaymentStatus(policyNo);
      const visitRecords = this.storageService.getVisitRecords()
        .filter(v => v.policyNo === policyNo)
        .sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
      const reminderRecords = this.reminderService.getReminderHistory(policyNo);

      const graceInfo = this.gracePeriodService.calculateAllGracePeriods().results
        .filter(g => g.policyNo === policyNo);

      res.json({
        success: true,
        data: {
          policy,
          paymentPlans,
          advancePayments,
          visitRecords,
          reminderRecords,
          graceInfo
        }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getConsistencyCheck(req, res) {
    try {
      const result = this.workflowService.checkDataConsistency();
      res.json({
        success: true,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getConfig(req, res) {
    try {
      const config = this.storageService.getConfig();
      res.json({
        success: true,
        data: config
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  updateConfig(req, res) {
    try {
      const config = req.body;
      const success = this.storageService.saveConfig(config);
      
      res.json({
        success,
        data: this.storageService.getConfig()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getReports(req, res) {
    try {
      const reports = this.storageService.getReports()
        .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      
      res.json({
        success: true,
        data: reports
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getReportDetail(req, res) {
    try {
      const { reportId } = req.params;
      const report = this.storageService.getReports().find(r => r.reportId === reportId);
      
      if (!report) {
        return res.status(404).json({
          success: false,
          error: '报告不存在'
        });
      }

      res.json({
        success: true,
        data: report
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getHolidays(req, res) {
    try {
      const holidays = this.holidayService.exportHolidays();
      res.json({
        success: true,
        data: holidays
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  addHoliday(req, res) {
    try {
      const { date, name } = req.body;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          error: '请提供日期'
        });
      }

      this.holidayService.addHoliday(date, name);
      res.json({
        success: true,
        data: { date, name }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  addWorkday(req, res) {
    try {
      const { date } = req.body;
      
      if (!date) {
        return res.status(400).json({
          success: false,
          error: '请提供日期'
        });
      }

      this.holidayService.addWorkday(date);
      res.json({
        success: true,
        data: { date }
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getReminderTemplates(req, res) {
    try {
      const templates = this.reminderService.getReminderTemplates();
      res.json({
        success: true,
        data: templates
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getReminderStatistics(req, res) {
    try {
      const stats = this.reminderService.getReminderStatistics(req.query);
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getAdvanceStatistics(req, res) {
    try {
      const stats = this.advancePaymentService.getAdvancePaymentStatistics();
      res.json({
        success: true,
        data: stats
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  repayAdvance(req, res) {
    try {
      const { recordId, amount, repayDate, remark } = req.body;
      
      if (!recordId || !amount) {
        return res.status(400).json({
          success: false,
          error: '请提供垫交记录ID和还款金额'
        });
      }

      const result = this.advancePaymentService.repayAdvancePayment(
        recordId,
        Number(amount),
        { repayDate, remark }
      );

      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  createAdvance(req, res) {
    try {
      const { policyNo, period, amount, advanceType, remark } = req.body;
      
      if (!policyNo || !period) {
        return res.status(400).json({
          success: false,
          error: '请提供保单号和缴费期次'
        });
      }

      const result = this.advancePaymentService.createAdvancePayment(
        policyNo,
        period,
        Number(amount) || 0,
        { advanceType, remark }
      );

      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getVisitRecords(req, res) {
    try {
      const { policyNo } = req.query;
      let records = this.storageService.getVisitRecords();
      
      if (policyNo) {
        records = records.filter(v => v.policyNo === policyNo);
      }
      
      records.sort((a, b) => new Date(b.visitDate) - new Date(a.visitDate));
      
      res.json({
        success: true,
        data: records
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  createVisitRecord(req, res) {
    try {
      const { VisitRecord } = require('../models');
      const data = req.body;
      
      if (!data.policyNo || !data.visitDate || !data.visitType || !data.contactResult) {
        return res.status(400).json({
          success: false,
          error: '请提供完整的回访信息'
        });
      }

      const visitRecord = new VisitRecord({
        ...data,
        visitId: `VIS_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
      });

      visitRecord.validate();
      
      const records = this.storageService.getVisitRecords();
      records.push(visitRecord.toJSON());
      this.storageService.saveVisitRecords(records);

      res.json({
        success: true,
        data: visitRecord.toJSON()
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  backupData(req, res) {
    try {
      const result = this.storageService.backupData();
      res.json({
        success: result.success,
        data: result
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getBackups(req, res) {
    try {
      const backups = this.storageService.listBackups();
      res.json({
        success: true,
        data: backups
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  restoreBackup(req, res) {
    try {
      const { backupFile } = req.body;
      
      if (!backupFile) {
        return res.status(400).json({
          success: false,
          error: '请提供备份文件路径'
        });
      }

      const success = this.storageService.restoreBackup(backupFile);
      res.json({
        success,
        message: success ? '恢复成功' : '恢复失败'
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  exportAllData(req, res) {
    try {
      const data = this.storageService.exportData('json');
      res.setHeader('Content-Disposition', `attachment; filename="insurance_data_${new Date().toISOString().split('T')[0]}.json"`);
      res.json(JSON.parse(data));
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  getInputTypes(req, res) {
    try {
      res.json({
        success: true,
        data: INPUT_TYPE_NAMES
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }

  async uploadAndProcess(req, res) {
    try {
      const uploadedFiles = [];
      if (req.files) {
        if (req.files.file) {
          uploadedFiles.push(...req.files.file);
        }
        if (req.files.files) {
          uploadedFiles.push(...req.files.files);
        }
      }
      if (uploadedFiles.length === 0) {
        return res.status(400).json({
          success: false,
          error: '请上传文件'
        });
      }

      const { BusinessWorkflowService } = require('../services');
      const fileProcessor = new (require('../services/FileProcessor'))({ stopOnError: false });
      const workflow = new BusinessWorkflowService();
      
      const allResults = {
        success: true,
        totalFiles: uploadedFiles.length,
        successCount: 0,
        failedCount: 0,
        records: [],
        results: [],
        failed: [],
        summary: {},
        savedRecords: { policies: 0, paymentPlans: 0, visitRecords: 0, advancePayments: 0, reminderRecords: 0 }
      };

      const validRecords = {
        policies: [],
        paymentPlans: [],
        advancePayments: [],
        visitRecords: [],
        reminderRecords: []
      };

      for (const file of uploadedFiles) {
        try {
          const result = await fileProcessor.processFile(file.path);
          if (result.success) {
            allResults.successCount++;
            allResults.results.push(result);
            allResults.records.push(...(result.records || []));

            (result.records || []).forEach(record => {
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
              }
            });
          } else {
            allResults.failedCount++;
            allResults.failed.push(result);
          }
        } catch (error) {
          allResults.failedCount++;
          allResults.failed.push({
            file: file.originalname,
            success: false,
            error: error.message
          });
        }
      }

      if (validRecords.policies.length > 0) {
        const existing = workflow.storageService.getPolicies();
        const merged = workflow.mergeById(existing, validRecords.policies, 'policyNo');
        workflow.storageService.savePolicies(merged);
        allResults.savedRecords.policies = validRecords.policies.length;
      }
      if (validRecords.paymentPlans.length > 0) {
        const existing = workflow.storageService.getPaymentPlans();
        const merged = workflow.mergeById(existing, validRecords.paymentPlans, 'planId');
        workflow.storageService.savePaymentPlans(merged);
        allResults.savedRecords.paymentPlans = validRecords.paymentPlans.length;
      }
      if (validRecords.advancePayments.length > 0) {
        const existing = workflow.storageService.getAdvancePayments();
        const merged = workflow.mergeById(existing, validRecords.advancePayments, 'recordId');
        workflow.storageService.saveAdvancePayments(merged);
        allResults.savedRecords.advancePayments = validRecords.advancePayments.length;
      }
      if (validRecords.visitRecords.length > 0) {
        const existing = workflow.storageService.getVisitRecords();
        const merged = workflow.mergeById(existing, validRecords.visitRecords, 'visitId');
        workflow.storageService.saveVisitRecords(merged);
        allResults.savedRecords.visitRecords = validRecords.visitRecords.length;
      }
      if (validRecords.reminderRecords.length > 0) {
        const existing = workflow.storageService.getReminderRecords();
        const merged = workflow.mergeById(existing, validRecords.reminderRecords, 'reminderId');
        workflow.storageService.saveReminderRecords(merged);
        allResults.savedRecords.reminderRecords = validRecords.reminderRecords.length;
      }

      if (validRecords.paymentPlans.length > 0) {
        workflow.gracePeriodService.updateAllGraceEndDates();
      }

      allResults.summary = {
        total: uploadedFiles.length,
        success: allResults.successCount,
        failed: allResults.failedCount,
        records: allResults.records.length
      };

      res.json({
        success: true,
        data: allResults
      });
    } catch (error) {
      res.status(500).json({
        success: false,
        error: error.message
      });
    }
  }
}

module.exports = ApiController;
