const express = require('express');
const router = express.Router();
const ValuationService = require('../services/ValuationService');

router.post('/', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await ValuationService.createValuation(req.body, operator);
    
    res.status(result.isNew ? 201 : 200).json({
      success: true,
      data: result.valuation,
      message: result.message,
      is_new: result.isNew
    });
  } catch (error) {
    console.error('创建估价失败:', error);
    res.status(500).json({
      success: false,
      message: error.message,
      error: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
});

router.get('/', async (req, res) => {
  try {
    const params = {
      status: req.query.status,
      valuation_no: req.query.valuation_no,
      limit: req.query.limit ? parseInt(req.query.limit) : undefined,
      offset: req.query.offset ? parseInt(req.query.offset) : undefined
    };
    
    const result = await ValuationService.getValuationList(params);
    res.json({
      success: true,
      data: result
    });
  } catch (error) {
    console.error('查询估价列表失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:id', async (req, res) => {
  try {
    const valuation = await ValuationService.getValuationDetail(req.params.id);
    if (!valuation) {
      return res.status(404).json({
        success: false,
        message: '估价单不存在'
      });
    }
    res.json({
      success: true,
      data: valuation
    });
  } catch (error) {
    console.error('查询估价详情失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/advance', async (req, res) => {
  try {
    const { target_status, reason } = req.body;
    const operator = req.headers['x-operator'] || 'system';
    
    if (!target_status) {
      return res.status(400).json({
        success: false,
        message: '缺少目标状态参数'
      });
    }

    const result = await ValuationService.advanceStatus(
      req.params.id,
      target_status,
      operator,
      reason
    );

    res.json({
      success: true,
      data: result,
      message: `状态已推进到${target_status}`
    });
  } catch (error) {
    console.error('推进状态失败:', error);
    
    if (error.message.includes('无法从') || error.message.includes('不存在')) {
      return res.status(400).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/quote-versions', async (req, res) => {
  try {
    const operator = req.headers['x-operator'] || 'system';
    const result = await ValuationService.createQuoteVersion(
      req.params.id,
      req.body,
      operator
    );

    res.status(201).json({
      success: true,
      data: result,
      message: '报价版本创建成功'
    });
  } catch (error) {
    console.error('创建报价版本失败:', error);
    
    if (error.message.includes('重复报价')) {
      return res.status(409).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/manual-corrections', async (req, res) => {
  try {
    const operator = req.headers['x-operator'];
    if (!operator) {
      return res.status(400).json({
        success: false,
        message: '缺少操作人信息，请在请求头中提供 x-operator'
      });
    }

    const result = await ValuationService.createManualCorrection(
      req.params.id,
      req.body,
      operator
    );

    res.status(201).json({
      success: true,
      data: result,
      message: '人工修正记录已保存'
    });
  } catch (error) {
    console.error('创建人工修正失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:id/report', async (req, res) => {
  try {
    const report = await ValuationService.generateReport(req.params.id);
    res.json({
      success: true,
      data: report
    });
  } catch (error) {
    console.error('生成报告失败:', error);
    
    if (error.message.includes('不存在')) {
      return res.status(404).json({
        success: false,
        message: error.message
      });
    }

    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.get('/:id/report/export', async (req, res) => {
  try {
    const report = await ValuationService.generateReport(req.params.id);
    
    const reportText = formatTextReport(report);
    
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=valuation-report-${report.report_no}.txt`);
    res.send(reportText);
  } catch (error) {
    console.error('导出报告失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

router.post('/:id/handle-error', async (req, res) => {
  try {
    const { error_message } = req.body;
    const operator = req.headers['x-operator'] || 'system';

    await ValuationService.handleError(
      req.params.id,
      { message: error_message || '未知错误' },
      operator
    );

    res.json({
      success: true,
      message: '异常已记录，已标记为需要人工审核'
    });
  } catch (error) {
    console.error('记录异常失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

function formatTextReport(report) {
  const lines = [];
  
  lines.push('='.repeat(60));
  lines.push(`二手车检测估价报告 - ${report.report_no}`);
  lines.push(`生成时间: ${report.generated_at}`);
  lines.push('='.repeat(60));
  
  lines.push('\n【估价信息】');
  lines.push(`估价单号: ${report.valuation_info.valuation_no}`);
  lines.push(`当前状态: ${report.valuation_info.status}`);
  lines.push(`风险等级: ${report.valuation_info.risk_level}`);
  
  lines.push('\n【车辆信息】');
  lines.push(`品牌型号: ${report.vehicle_info.brand} ${report.vehicle_info.model}`);
  lines.push(`出厂年份: ${report.vehicle_info.year}年`);
  lines.push(`表显里程: ${report.vehicle_info.mileage}公里`);
  lines.push(`车架号: ${report.vehicle_info.vin}`);
  if (report.vehicle_info.license_plate) {
    lines.push(`车牌号: ${report.vehicle_info.license_plate}`);
  }
  
  lines.push('\n【价格明细】');
  lines.push(`基础估价: ¥${report.price_breakdown.base_price.toLocaleString()}`);
  lines.push(`  - 事故扣减: -¥${report.price_breakdown.accident_deduction.toLocaleString()}`);
  lines.push(`  - 里程扣减: -¥${report.price_breakdown.mileage_deduction.toLocaleString()}`);
  lines.push(`  - 检测扣减: -¥${report.price_breakdown.inspection_deduction.toLocaleString()}`);
  lines.push(`整备成本: ¥${report.price_breakdown.repair_cost_total.toLocaleString()}`);
  lines.push('-' .repeat(40));
  lines.push(`最终估价: ¥${report.price_breakdown.final_price.toLocaleString()}`);
  lines.push(`建议售价: ¥${report.price_breakdown.suggested_sale_price.toLocaleString()}`);
  
  if (report.deduction_reasons && report.deduction_reasons.length > 0) {
    lines.push('\n【扣分原因】');
    report.deduction_reasons.forEach((reason, index) => {
      lines.push(`${index + 1}. ${reason}`);
    });
  }
  
  if (report.repair_details && report.repair_details.length > 0) {
    lines.push('\n【整备明细】');
    report.repair_details.forEach((item, index) => {
      lines.push(`${index + 1}. [${item.优先级}] ${item.项目}`);
      lines.push(`   费用: ${item.预估费用}`);
      if (item.描述) {
        lines.push(`   说明: ${item.描述}`);
      }
    });
  }
  
  const flags = report.flags;
  if (flags.has_major_accident || flags.has_mileage_anomaly || 
      flags.has_missing_inspection_items || flags.is_repair_cost_over_threshold) {
    lines.push('\n【风险标记】');
    if (flags.has_major_accident) lines.push('⚠️ 存在重大事故记录');
    if (flags.has_mileage_anomaly) lines.push('⚠️ 里程异常');
    if (flags.has_missing_inspection_items) lines.push(`⚠️ 存在${report.flags.has_missing_inspection_items ? '' : ''}未检测项`);
    if (flags.is_repair_cost_over_threshold) lines.push('⚠️ 整备成本超阈值');
    if (flags.requires_manual_review) lines.push('⚠️ 需要人工审核');
  }
  
  if (report.history && report.history.length > 0) {
    lines.push('\n【操作历史】');
    report.history.forEach((h, index) => {
      let line = `${index + 1}. [${h.time}] ${h.operator} - ${h.action}`;
      if (h.from_status && h.to_status) {
        line += ` (${h.from_status} -> ${h.to_status})`;
      }
      if (h.reason) line += ` - ${h.reason}`;
      if (h.failure_reason) line += ` [失败: ${h.failure_reason}]`;
      lines.push(line);
    });
  }
  
  lines.push('\n' + '='.repeat(60));
  lines.push('销售解释说明');
  lines.push('='.repeat(60));
  lines.push(report.sales_explanation);
  lines.push('='.repeat(60));
  
  return lines.join('\n');
}

module.exports = router;
