const express = require('express');
const router = express.Router();
const MarkdownExporter = require('../exporters/MarkdownExporter');
const CsvExporter = require('../exporters/CsvExporter');
const JsonAuditExporter = require('../exporters/JsonAuditExporter');

router.get('/markdown/review', async (req, res) => {
  try {
    const { startDate, endDate, includeDetails = 'true' } = req.query;

    const markdown = await MarkdownExporter.generateReviewReport({
      startDate,
      endDate,
      includeDetails: includeDetails === 'true'
    });

    res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="review-report-${new Date().toISOString().substring(0, 10)}.md"`);
    res.send(markdown);

  } catch (error) {
    console.error('生成Markdown报告失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/markdown/review-json', async (req, res) => {
  try {
    const { startDate, endDate, includeDetails = 'true' } = req.query;

    const markdown = await MarkdownExporter.generateReviewReport({
      startDate,
      endDate,
      includeDetails: includeDetails === 'true'
    });

    res.json({
      success: true,
      data: {
        content: markdown,
        filename: `review-report-${new Date().toISOString().substring(0, 10)}.md`
      }
    });

  } catch (error) {
    console.error('生成Markdown报告失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/risk-list', async (req, res) => {
  try {
    const { includeResolved, severity } = req.query;

    const csv = await CsvExporter.exportRiskList({
      includeResolved: includeResolved === 'true',
      severity
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="risk-list-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出风险清单CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/alerts', async (req, res) => {
  try {
    const { status, cage_id, includeAll } = req.query;

    const csv = await CsvExporter.exportAlerts({
      status,
      cage_id,
      includeAll: includeAll === 'true'
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="sensor-alerts-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出告警CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/transfers', async (req, res) => {
  try {
    const { status, animal_id, startDate, endDate } = req.query;

    const csv = await CsvExporter.exportTransfers({
      status,
      animal_id,
      startDate,
      endDate
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="transfer-records-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出转笼记录CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/veterinary-orders', async (req, res) => {
  try {
    const { status } = req.query;

    const csv = await CsvExporter.exportVeterinaryOrders({
      status
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="veterinary-orders-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出处置单CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/animals', async (req, res) => {
  try {
    const { status } = req.query;

    const csv = await CsvExporter.exportAnimals({
      status
    });

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="animals-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出动物CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/cages', async (req, res) => {
  try {
    const csv = await CsvExporter.exportCageStatus();

    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="cage-status-${new Date().toISOString().substring(0, 10)}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出笼位状态CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/daily-report', async (req, res) => {
  try {
    const { date } = req.query;

    const csv = await CsvExporter.exportDailyReport({
      date
    });

    const reportDate = date || new Date().toISOString().substring(0, 10);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="daily-report-${reportDate}.csv"`);
    res.send('\uFEFF' + csv);

  } catch (error) {
    console.error('导出日报CSV失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/json/audit-package', async (req, res) => {
  try {
    const { 
      startDate, 
      endDate,
      includeAnimals = 'true',
      includeCages = 'true',
      includeAlerts = 'true',
      includeTransfers = 'true',
      includeVeterinary = 'true',
      includeInspections = 'true',
      includeViolations = 'true',
      includeTimelines = 'true',
      includeAuditLogs = 'true'
    } = req.query;

    const auditPackage = await JsonAuditExporter.generateAuditPackage({
      startDate,
      endDate,
      includeAnimals: includeAnimals === 'true',
      includeCages: includeCages === 'true',
      includeAlerts: includeAlerts === 'true',
      includeTransfers: includeTransfers === 'true',
      includeVeterinary: includeVeterinary === 'true',
      includeInspections: includeInspections === 'true',
      includeViolations: includeViolations === 'true',
      includeTimelines: includeTimelines === 'true',
      includeAuditLogs: includeAuditLogs === 'true'
    });

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="audit-package-${new Date().toISOString().substring(0, 10)}.json"`);
    res.json(auditPackage);

  } catch (error) {
    console.error('生成审计包失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/json/animal-audit/:animalId', async (req, res) => {
  try {
    const { animalId } = req.params;

    const audit = await JsonAuditExporter.exportAnimalAudit(animalId);

    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="animal-audit-${animalId}.json"`);
    res.json(audit);

  } catch (error) {
    console.error('导出动物审计失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/csv/all-risk-data', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    const [
      riskList,
      alerts,
      transfers,
      veterinaryOrders,
      animals,
      cages
    ] = await Promise.all([
      CsvExporter.exportRiskList({ includeResolved: true }),
      CsvExporter.exportAlerts({ includeAll: true }),
      CsvExporter.exportTransfers({ startDate, endDate }),
      CsvExporter.exportVeterinaryOrders(),
      CsvExporter.exportAnimals(),
      CsvExporter.exportCageStatus()
    ]);

    const allData = {
      generated_at: new Date().toISOString(),
      data_sets: {
        risk_list: riskList,
        sensor_alerts: alerts,
        transfer_records: transfers,
        veterinary_orders: veterinaryOrders,
        animals: animals,
        cage_status: cages
      }
    };

    res.json({
      success: true,
      data: allData
    });

  } catch (error) {
    console.error('导出所有风险数据失败:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

module.exports = router;
