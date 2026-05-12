const express = require('express');
const router = express.Router();
const { success, error } = require('../utils/response');
const reportService = require('../services/reportService');
const alertService = require('../services/alertService');
const dayjs = require('dayjs');

router.get('/risk', (req, res) => {
  try {
    const report = reportService.generateRiskReport();
    res.json(success(report, '备件风险报告生成成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/equipment-impact', (req, res) => {
  try {
    const report = reportService.generateEquipmentImpactReport();
    res.json(success(report, '设备影响报告生成成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/purchase-suggestion', (req, res) => {
  try {
    const report = reportService.generatePurchaseSuggestionReport();
    res.json(success(report, '采购建议报告生成成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/full', (req, res) => {
  try {
    const report = reportService.generateFullReport();
    res.json(success(report, '综合报告生成成功'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/alerts', (req, res) => {
  try {
    const alerts = alertService.getActiveAlerts();
    res.json(success(alerts));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.post('/check-all', (req, res) => {
  try {
    const alerts = alertService.checkAllParts();
    res.json(success({
      checked: true,
      newAlerts: alerts.length,
      alerts
    }, '库存预警检查完成'));
  } catch (e) {
    res.json(error(e.message));
  }
});

router.get('/export', (req, res) => {
  try {
    const report = reportService.generateFullReport();
    const timestamp = dayjs().format('YYYYMMDD_HHmmss');
    
    const lines = [];
    lines.push('='.repeat(60));
    lines.push('检修备件最低库存 - 综合报告');
    lines.push(`生成时间: ${dayjs(report.generatedAt).format('YYYY-MM-DD HH:mm:ss')}`);
    lines.push('='.repeat(60));
    lines.push('');
    
    lines.push('【一、风险汇总】');
    const risk = report.riskReport.summary;
    lines.push(`  预警总数: ${risk.totalAlerts}`);
    lines.push(`  严重预警: ${risk.criticalAlerts}`);
    lines.push(`  一般预警: ${risk.warningAlerts}`);
    lines.push(`  影响设备数: ${risk.affectedEquipmentCount}`);
    lines.push(`  关键设备受影响: ${risk.affectedCriticalEquipments}/${risk.totalCriticalEquipments}`);
    lines.push(`  紧急风险数: ${risk.urgentRiskCount}`);
    lines.push('');
    
    lines.push('【二、风险明细】');
    report.riskReport.risks.forEach((r, i) => {
      lines.push(`  ${i + 1}. [${r.alertLevel}] ${r.part.code} - ${r.part.name}`);
      lines.push(`     当前库存: ${r.currentStock}, 最低库存: ${r.minStock}, 缺口: ${r.deficit}`);
      lines.push(`     在途数量: ${r.inTransit}, 有替代件: ${r.hasAlternatives ? '是' : '否'}`);
      lines.push(`     影响设备: ${r.affectedEquipments.map(e => `${e.code}(${e.criticality})`).join(', ') || '无'}`);
    });
    lines.push('');
    
    lines.push('【三、设备影响】');
    const eqImpact = report.equipmentImpactReport.summary;
    lines.push(`  设备总数: ${eqImpact.totalEquipments}`);
    lines.push(`  严重影响设备: ${eqImpact.SEVERE}`);
    lines.push(`  高度影响设备: ${eqImpact.HIGH}`);
    lines.push(`  中度影响设备: ${eqImpact.MEDIUM}`);
    lines.push(`  无影响设备: ${eqImpact.NONE}`);
    lines.push('');
    
    lines.push('【四、采购建议】');
    const purchase = report.purchaseSuggestionReport.summary;
    lines.push(`  建议采购项数: ${purchase.totalSuggestions}`);
    lines.push(`  紧急采购: ${purchase.URGENT}`);
    lines.push(`  优先采购: ${purchase.HIGH}`);
    lines.push(`  常规采购: ${purchase.NORMAL}`);
    lines.push(`  建议采购总量: ${purchase.totalSuggestedQuantity}`);
    lines.push('');
    
    lines.push('【五、采购建议明细】');
    report.purchaseSuggestionReport.suggestions.forEach((s, i) => {
      lines.push(`  ${i + 1}. [${s.urgency}] ${s.part.code} - ${s.part.name}`);
      lines.push(`     当前: ${s.currentStock}, 在途: ${s.inTransit}, 最低: ${s.minStock}`);
      lines.push(`     采购周期: ${s.cycleDays}天, 建议采购: ${s.suggestedQuantity}`);
      lines.push(`     影响设备: ${s.affectedEquipments.map(e => `${e.code}(${e.criticality})`).join(', ') || '无'}`);
    });
    
    const content = lines.join('\n');
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="stock-report-${timestamp}.txt"`);
    res.send(content);
  } catch (e) {
    res.json(error(e.message));
  }
});

module.exports = router;
