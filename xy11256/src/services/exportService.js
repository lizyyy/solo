const fs = require('fs');
const path = require('path');
const XLSX = require('xlsx');
const { Parser } = require('json2csv');
const hazardModel = require('../models/hazard');
const photoModel = require('../models/photo');
const importBatchModel = require('../models/importBatch');
const { 
  HAZARD_STATUS_LABELS, 
  HAZARD_LEVEL_LABELS,
  IMPORT_STATUS,
  RECORD_STATUS
} = require('../utils/constants');

class ExportService {
  async exportHazardsToExcel(outputPath, filters = {}) {
    const hazards = await hazardModel.findAll(filters);
    
    const formattedData = hazards.map(h => ({
      '隐患编号': h.hazard_code,
      '隐患标题': h.title,
      '隐患描述': h.description || '',
      '隐患位置': h.location,
      '隐患级别': HAZARD_LEVEL_LABELS[h.level] || h.level,
      '发现日期': h.discover_date,
      '发现人': h.discoverer,
      '所属部门': h.department || '',
      '整改责任人': h.responsible_person || '',
      '整改期限': h.deadline || '',
      '当前状态': HAZARD_STATUS_LABELS[h.status] || h.status,
      '整改描述': h.rectification_description || '',
      '整改开始日期': h.rectification_date || '',
      '整改完成日期': h.rectification_complete_date || '',
      '复查结果': h.review_result || '',
      '复查日期': h.review_date || '',
      '复查人': h.reviewer || '',
      '复查意见': h.review_comments || ''
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '隐患清单');

    const stats = await hazardModel.getStatistics();
    const statsData = [
      { '统计项': '隐患总数', '数值': stats.total },
      { '统计项': '已闭环', '数值': stats.closed },
      { '统计项': '待处理', '数值': stats.pending },
      { '统计项': '超期待处理', '数值': stats.overdue },
      { '统计项': '闭环率', '数值': `${stats.closureRate}%` }
    ];
    const wsStats = XLSX.utils.json_to_sheet(statsData);
    XLSX.utils.book_append_sheet(wb, wsStats, '统计汇总');

    XLSX.writeFile(wb, outputPath);
    return { filePath: outputPath, recordCount: hazards.length };
  }

  async exportHazardsToCSV(outputPath, filters = {}) {
    const hazards = await hazardModel.findAll(filters);
    
    const formattedData = hazards.map(h => ({
      hazardCode: h.hazard_code,
      title: h.title,
      description: h.description || '',
      location: h.location,
      level: HAZARD_LEVEL_LABELS[h.level] || h.level,
      discoverDate: h.discover_date,
      discoverer: h.discoverer,
      department: h.department || '',
      responsiblePerson: h.responsible_person || '',
      deadline: h.deadline || '',
      status: HAZARD_STATUS_LABELS[h.status] || h.status,
      reviewResult: h.review_result || '',
      reviewDate: h.review_date || ''
    }));

    const parser = new Parser();
    const csv = parser.parse(formattedData);
    fs.writeFileSync(outputPath, csv, 'utf8');

    return { filePath: outputPath, recordCount: hazards.length };
  }

  async exportPhotosReport(outputPath) {
    const photos = await photoModel.findAll();
    
    const formattedData = photos.map(p => ({
      '照片ID': p.photo_id,
      '隐患编号': p.hazard_code,
      '照片类型': p.photo_type,
      '文件路径': p.file_path,
      '上传日期': p.upload_date,
      '上传人': p.uploader,
      '描述': p.description || ''
    }));

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '照片清单');
    XLSX.writeFile(wb, outputPath);

    return { filePath: outputPath, recordCount: photos.length };
  }

  async exportImportErrorsToExcel(batchId, outputPath) {
    const batch = await importBatchModel.getBatch(batchId);
    if (!batch) {
      throw new Error(`批次不存在: ${batchId}`);
    }

    const failedRecords = await importBatchModel.getFailedRecords(batchId);
    
    const formattedData = failedRecords.map(r => {
      const raw = JSON.parse(r.raw_data);
      return {
        '行号': r.row_number,
        '原始数据': JSON.stringify(raw),
        '错误信息': r.error_message,
        '修改建议': r.suggestion || '',
        '导入时间': r.created_at
      };
    });

    const ws = XLSX.utils.json_to_sheet(formattedData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, '导入错误记录');

    const batchInfo = [
      { '项': '批次ID', '值': batch.batch_id },
      { '项': '导入类型', '值': batch.import_type },
      { '项': '文件名', '值': batch.file_name },
      { '项': '导入状态', '值': batch.status },
      { '项': '总记录数', '值': batch.total_count },
      { '项': '成功', '值': batch.success_count },
      { '项': '失败', '值': batch.failed_count },
      { '项': '跳过', '值': batch.skipped_count }
    ];
    const wsInfo = XLSX.utils.json_to_sheet(batchInfo);
    XLSX.utils.book_append_sheet(wb, wsInfo, '批次信息');

    XLSX.writeFile(wb, outputPath);
    return { filePath: outputPath, errorCount: failedRecords.length };
  }

  async generateMonthlyReport(year, month, outputDir) {
    const startDate = `${year}-${String(month).padStart(2, '0')}-01`;
    const endDate = month === 12 
      ? `${year + 1}-01-01` 
      : `${year}-${String(month + 1).padStart(2, '0')}-01`;

    const db = require('../utils/database');
    
    const allHazards = await db.all(`
      SELECT * FROM hazards 
      WHERE discover_date >= ? AND discover_date < ?
      ORDER BY discover_date ASC
    `, [startDate, endDate]);

    const closedHazards = allHazards.filter(h => h.status === 'closed');
    const pendingHazards = allHazards.filter(h => h.status !== 'closed');
    
    const byLevel = { critical: 0, high: 0, medium: 0, low: 0 };
    allHazards.forEach(h => {
      if (byLevel[h.level] !== undefined) byLevel[h.level]++;
    });

    const byDepartment = {};
    allHazards.forEach(h => {
      const dept = h.department || '未分类';
      byDepartment[dept] = (byDepartment[dept] || 0) + 1;
    });

    const report = {
      reportPeriod: `${year}年${month}月`,
      generatedAt: new Date().toISOString(),
      summary: {
        total: allHazards.length,
        closed: closedHazards.length,
        pending: pendingHazards.length,
        closureRate: allHazards.length > 0 
          ? Math.round((closedHazards.length / allHazards.length) * 100) 
          : 0
      },
      byLevel,
      byDepartment,
      hazards: allHazards
    };

    const outputPath = path.join(outputDir, `月度报告_${year}${String(month).padStart(2, '0')}.xlsx`);
    
    const summaryData = [
      { '项目': '报告期间', '值': report.reportPeriod },
      { '项目': '生成时间', '值': report.generatedAt },
      { '项目': '', '值': '' },
      { '项目': '隐患总数', '值': report.summary.total },
      { '项目': '已闭环', '值': report.summary.closed },
      { '项目': '待处理', '值': report.summary.pending },
      { '项目': '闭环率', '值': `${report.summary.closureRate}%` }
    ];

    const hazardData = allHazards.map(h => ({
      '隐患编号': h.hazard_code,
      '隐患标题': h.title,
      '隐患位置': h.location,
      '隐患级别': HAZARD_LEVEL_LABELS[h.level] || h.level,
      '发现日期': h.discover_date,
      '发现人': h.discoverer,
      '整改责任人': h.responsible_person || '',
      '整改期限': h.deadline || '',
      '当前状态': HAZARD_STATUS_LABELS[h.status] || h.status
    }));

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '报告摘要');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(hazardData), '隐患明细');
    
    const levelData = Object.entries(byLevel).map(([level, count]) => ({
      '隐患级别': HAZARD_LEVEL_LABELS[level] || level,
      '数量': count
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(levelData), '级别统计');

    const deptData = Object.entries(byDepartment).map(([dept, count]) => ({
      '部门': dept,
      '数量': count
    }));
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(deptData), '部门统计');

    XLSX.writeFile(wb, outputPath);

    return {
      reportPath: outputPath,
      ...report.summary,
      hazardCount: allHazards.length
    };
  }

  async exportClosureStatus(outputPath) {
    const stats = await hazardModel.getStatistics();
    const allHazards = await hazardModel.findAll();

    const closureData = allHazards.map(h => {
      const isClosed = h.status === 'closed';
      let isOverdue = false;
      let daysRemaining = null;
      
      if (h.deadline && !isClosed) {
        const deadline = new Date(h.deadline);
        const today = new Date();
        daysRemaining = Math.ceil((deadline - today) / (1000 * 60 * 60 * 24));
        isOverdue = daysRemaining < 0;
      }

      return {
        '隐患编号': h.hazard_code,
        '隐患标题': h.title,
        '整改责任人': h.responsible_person || '未分配',
        '整改期限': h.deadline || '未设置',
        '当前状态': HAZARD_STATUS_LABELS[h.status] || h.status,
        '是否闭环': isClosed ? '是' : '否',
        '是否超期': isOverdue ? '是' : '否',
        '剩余天数': daysRemaining !== null ? daysRemaining : '-'
      };
    });

    const summaryData = [
      { '统计项': '隐患总数', '数值': stats.total },
      { '统计项': '已闭环', '数值': stats.closed },
      { '统计项': '闭环率', '数值': `${stats.closureRate}%` },
      { '统计项': '待处理', '数值': stats.pending },
      { '统计项': '超期待处理', '数值': stats.overdue }
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(summaryData), '闭环统计');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(closureData), '闭环明细');
    XLSX.writeFile(wb, outputPath);

    return { filePath: outputPath, ...stats };
  }
}

module.exports = new ExportService();
