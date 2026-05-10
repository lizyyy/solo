const express = require('express');
const router = express.Router();
const ExcelJS = require('exceljs');
const moment = require('moment');
const Prescription = require('../models/Prescription');

router.get('/summary', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;
    const dateFilter = {};

    if (startDate) dateFilter.$gte = new Date(startDate);
    if (endDate) dateFilter.$lte = new Date(endDate);
    if (Object.keys(dateFilter).length > 0) {
      dateFilter.createdAt = dateFilter;
    }

    const prescriptions = await Prescription.find(
      Object.keys(dateFilter).length > 0 ? dateFilter : {}
    ).sort({ createdAt: -1 });

    const statusSummary = {
      待复核: 0,
      已通过: 0,
      已退回: 0,
      需补充: 0,
      已发药: 0
    };

    const riskSummary = {
      过敏风险: 0,
      重复成分: 0,
      剂量超限: 0,
      其他: 0
    };

    const severitySummary = {
      高: 0,
      中: 0,
      低: 0
    };

    prescriptions.forEach(p => {
      if (statusSummary[p.status] !== undefined) {
        statusSummary[p.status]++;
      }

      p.risks.forEach(r => {
        if (riskSummary[r.category] !== undefined) {
          riskSummary[r.category]++;
        }
        if (severitySummary[r.severity] !== undefined) {
          severitySummary[r.severity]++;
        }
      });
    });

    const reviewTimes = prescriptions.map(p => {
      if (p.reviewedAt && p.createdAt) {
        return (p.reviewedAt - p.createdAt) / (1000 * 60);
      }
      return null;
    }).filter(t => t !== null);

    const avgReviewTime = reviewTimes.length > 0
      ? (reviewTimes.reduce((a, b) => a + b, 0) / reviewTimes.length).toFixed(1)
      : 0;

    const pendingPrescriptions = prescriptions.filter(p => 
      p.status === '待复核' || p.status === '需补充'
    ).slice(0, 10);

    const highRiskPrescriptions = prescriptions.filter(p => 
      p.risks.some(r => r.severity === '高')
    ).slice(0, 10);

    res.json({
      overview: {
        total: prescriptions.length,
        passRate: prescriptions.length > 0
          ? ((statusSummary.已通过 / prescriptions.length) * 100).toFixed(1)
          : 0,
        avgReviewTime,
        highRiskCount: severitySummary.高
      },
      statusSummary,
      riskSummary,
      severitySummary,
      pendingPrescriptions,
      highRiskPrescriptions
    });
  } catch (error) {
    res.status(500).json({ error: '获取汇总数据失败', message: error.message });
  }
});

router.get('/export', async (req, res) => {
  try {
    const { startDate, endDate, status } = req.query;
    const query = {};

    if (status) {
      query.status = status;
    }

    if (startDate || endDate) {
      query.createdAt = {};
      if (startDate) query.createdAt.$gte = new Date(startDate);
      if (endDate) query.createdAt.$lte = new Date(endDate);
    }

    const prescriptions = await Prescription.find(query).sort({ createdAt: -1 });

    const workbook = new ExcelJS.Workbook();
    
    const summarySheet = workbook.addWorksheet('负责人汇总');
    summarySheet.columns = [
      { header: '统计项', key: 'item', width: 25 },
      { header: '数值', key: 'value', width: 15 }
    ];

    const statusCounts = { 待复核: 0, 已通过: 0, 已退回: 0, 需补充: 0, 已发药: 0 };
    const riskCounts = { 过敏风险: 0, 重复成分: 0, 剂量超限: 0, 其他: 0 };
    let highRiskCount = 0;

    prescriptions.forEach(p => {
      if (statusCounts[p.status] !== undefined) statusCounts[p.status]++;
      p.risks.forEach(r => {
        if (riskCounts[r.category] !== undefined) riskCounts[r.category]++;
        if (r.severity === '高') highRiskCount++;
      });
    });

    summarySheet.addRow({ item: '处方总数', value: prescriptions.length });
    summarySheet.addRow({ item: '待复核', value: statusCounts.待复核 });
    summarySheet.addRow({ item: '已通过', value: statusCounts.已通过 });
    summarySheet.addRow({ item: '已退回', value: statusCounts.已退回 });
    summarySheet.addRow({ item: '需补充', value: statusCounts.需补充 });
    summarySheet.addRow({ item: '已发药', value: statusCounts.已发药 });
    summarySheet.addRow({ item: '高风险处方', value: highRiskCount });
    summarySheet.addRow({ item: '过敏风险', value: riskCounts.过敏风险 });
    summarySheet.addRow({ item: '重复成分', value: riskCounts.重复成分 });
    summarySheet.addRow({ item: '剂量超限', value: riskCounts.剂量超限 });
    summarySheet.addRow({ item: '通过率', value: prescriptions.length > 0 
      ? ((statusCounts.已通过 / prescriptions.length) * 100).toFixed(1) + '%'
      : '0%' 
    });

    const detailSheet = workbook.addWorksheet('处方明细');
    detailSheet.columns = [
      { header: '处方编号', key: 'prescriptionNo', width: 20 },
      { header: '患者姓名', key: 'patientName', width: 12 },
      { header: '开具医生', key: 'doctorName', width: 12 },
      { header: '诊断', key: 'diagnosis', width: 25 },
      { header: '药品', key: 'drugs', width: 40 },
      { header: '状态', key: 'status', width: 10 },
      { header: '风险等级', key: 'riskLevel', width: 10 },
      { header: '风险原因', key: 'risks', width: 50 },
      { header: '创建时间', key: 'createdAt', width: 20 },
      { header: '复核时间', key: 'reviewedAt', width: 20 },
      { header: '复核结果', key: 'reviewResult', width: 20 }
    ];

    prescriptions.forEach(p => {
      const riskLevel = p.risks.some(r => r.severity === '高') ? '高'
        : p.risks.some(r => r.severity === '中') ? '中'
        : p.risks.length > 0 ? '低' : '无';

      detailSheet.addRow({
        prescriptionNo: p.prescriptionNo,
        patientName: p.patientName,
        doctorName: p.doctorName,
        diagnosis: p.diagnosis,
        drugs: p.items.map(i => `${i.drugName} ${i.dosage} ${i.frequency}`).join('; '),
        status: p.status,
        riskLevel,
        risks: p.risks.map(r => r.description).join('; '),
        createdAt: moment(p.createdAt).format('YYYY-MM-DD HH:mm'),
        reviewedAt: p.reviewedAt ? moment(p.reviewedAt).format('YYYY-MM-DD HH:mm') : '',
        reviewResult: p.status === '已通过' ? '通过' : 
                     p.status === '已退回' ? '退回' :
                     p.status === '需补充' ? '需补充' : ''
      });
    });

    const historySheet = workbook.addWorksheet('处理历史');
    historySheet.columns = [
      { header: '处方编号', key: 'prescriptionNo', width: 20 },
      { header: '操作人', key: 'reviewer', width: 12 },
      { header: '操作', key: 'action', width: 12 },
      { header: '原因', key: 'reason', width: 30 },
      { header: '备注', key: 'notes', width: 30 },
      { header: '操作时间', key: 'timestamp', width: 20 }
    ];

    prescriptions.forEach(p => {
      p.reviewHistory.forEach(h => {
        historySheet.addRow({
          prescriptionNo: p.prescriptionNo,
          reviewer: h.reviewer,
          action: h.action,
          reason: h.reason || '',
          notes: h.notes || '',
          timestamp: moment(h.timestamp).format('YYYY-MM-DD HH:mm')
        });
      });
    });

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=处方复核报表_${moment().format('YYYYMMDD')}.xlsx`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    res.status(500).json({ error: '导出报表失败', message: error.message });
  }
});

module.exports = router;
