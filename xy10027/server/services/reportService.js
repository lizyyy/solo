const ExcelJS = require('exceljs');
const PDFDocument = require('pdfkit');
const fs = require('fs');
const path = require('path');
const db = require('../config/database');
const logger = require('../utils/logger');

class ReportService {
  static async generateInventoryReport(taskId, format) {
    const taskData = await this.getTaskData(taskId);
    
    switch (format.toLowerCase()) {
      case 'excel':
        return this.generateExcelReport(taskData);
      case 'markdown':
        return this.generateMarkdownReport(taskData);
      case 'pdf':
        return this.generatePDFReport(taskData);
      default:
        throw new Error(`Unsupported format: ${format}`);
    }
  }

  static async getTaskData(taskId) {
    const query = `
      SELECT 
        it.id, it.name, it.description, it.status,
        w.name as warehouse_name,
        u.full_name as created_by_name,
        ua.full_name as assigned_to_name,
        it.scheduled_date, it.start_time, it.end_time, it.completed_at,
        json_agg(json_build_object(
          'sku', ii.sku,
          'item_name', ii.name,
          'expected_quantity', iti.expected_quantity,
          'actual_quantity', iti.actual_quantity,
          'difference', iti.difference,
          'status', iti.status,
          'notes', iti.notes,
          'counted_by', uc.full_name
        )) as items
      FROM inventory_tasks it
      JOIN warehouses w ON it.warehouse_id = w.id
      JOIN users u ON it.created_by = u.id
      LEFT JOIN users ua ON it.assigned_to = ua.id
      LEFT JOIN inventory_task_items iti ON it.id = iti.task_id
      LEFT JOIN inventory_items ii ON iti.item_id = ii.id
      LEFT JOIN users uc ON iti.counted_by = uc.id
      WHERE it.id = $1
      GROUP BY 
        it.id, it.name, it.description, it.status,
        w.name, u.full_name, ua.full_name,
        it.scheduled_date, it.start_time, it.end_time, it.completed_at
    `;
    
    const result = await db.query(query, [taskId]);
    
    if (result.rows.length === 0) {
      throw new Error('Task not found');
    }
    
    return result.rows[0];
  }

  static async generateExcelReport(taskData) {
    const workbook = new ExcelJS.Workbook();
    
    workbook.creator = 'Warehouse Inventory System';
    workbook.created = new Date();

    const summarySheet = workbook.addWorksheet('Summary');
    const detailsSheet = workbook.addWorksheet('Details');

    summarySheet.columns = [
      { header: 'Field', key: 'field', width: 30 },
      { header: 'Value', key: 'value', width: 50 }
    ];

    summarySheet.addRows([
      { field: 'Task Name', value: taskData.name },
      { field: 'Description', value: taskData.description },
      { field: 'Warehouse', value: taskData.warehouse_name },
      { field: 'Created By', value: taskData.created_by_name },
      { field: 'Assigned To', value: taskData.assigned_to_name || 'Not Assigned' },
      { field: 'Status', value: taskData.status },
      { field: 'Scheduled Date', value: taskData.scheduled_date },
      { field: 'Start Time', value: taskData.start_time },
      { field: 'End Time', value: taskData.end_time },
      { field: 'Completed At', value: taskData.completed_at }
    ]);

    detailsSheet.columns = [
      { header: 'SKU', key: 'sku', width: 15 },
      { header: 'Item Name', key: 'item_name', width: 30 },
      { header: 'Expected', key: 'expected_quantity', width: 12 },
      { header: 'Actual', key: 'actual_quantity', width: 12 },
      { header: 'Difference', key: 'difference', width: 12 },
      { header: 'Status', key: 'status', width: 12 },
      { header: 'Counted By', key: 'counted_by', width: 20 },
      { header: 'Notes', key: 'notes', width: 40 }
    ];

    taskData.items.forEach((item) => {
      detailsSheet.addRow(item);
    });

    const buffer = await workbook.xlsx.writeBuffer();
    logger.info(`Excel report generated for task: ${taskData.id}`);
    
    return {
      buffer, filename: `inventory_report_${taskData.id}.xlsx`, contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' };
  }

  static async generateMarkdownReport(taskData) {
    let markdown = `# 仓库盘点报告\n\n`;
    markdown += `## 任务信息\n\n`;
    markdown += `- **任务名称**: ${taskData.name}\n`;
    markdown += `- **仓库**: ${taskData.warehouse_name}\n`;
    markdown += `- **创建人**: ${taskData.created_by_name}\n`;
    markdown += `- **负责人**: ${taskData.assigned_to_name || '未分配'}\n`;
    markdown += `- **状态**: ${taskData.status}\n`;
    markdown += `- **计划日期**: ${taskData.scheduled_date}\n`;
    if (taskData.start_time) markdown += `- **开始时间**: ${taskData.start_time}\n`;
    if (taskData.end_time) markdown += `- **结束时间**: ${taskData.end_time}\n`;
    if (taskData.completed_at) markdown += `- **完成时间**: ${taskData.completed_at}\n`;
    
    markdown += `\n## 盘点明细\n\n`;
    markdown += `| SKU | 商品名称 | 预期数量 | 实际数量 | 差异 | 状态 | 盘点人 | 备注 |\n`;
    markdown += `|-----|---------|---------|---------|------|------|--------|------|\n`;
    
    taskData.items.forEach((item) => {
      markdown += `| ${item.sku} | ${item.item_name} | ${item.expected_quantity || '-'} | ${item.actual_quantity || '-'} | ${item.difference || '-'} | ${item.status} | ${item.counted_by || '-'} | ${item.notes || '-'} |\n`;
    });

    const totalItems = taskData.items.length;
    const completedItems = taskData.items.filter(i => i.status === 'completed').length;
    const differenceCount = taskData.items.filter(i => i.difference !== 0).length;
    const totalDifference = taskData.items.reduce((sum, i) => sum + (i.difference || 0), 0);

    markdown += `\n## 统计信息\n\n`;
    markdown += `- **总商品数**: ${totalItems}\n`;
    markdown += `- **已完成盘点**: ${completedItems}\n`;
    markdown += `- **有差异商品**: ${differenceCount}\n`;
    markdown += `- **总差异数量**: ${totalDifference}\n`;

    logger.info(`Markdown report generated for task: ${taskData.id}`);
    
    return {
      content: markdown,
      filename: `inventory_report_${taskData.id}.md`,
      contentType: 'text/markdown'
    };
  }

  static async generatePDFReport(taskData) {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ margin: 50 });
      const chunks = [];

      doc.on('data', (chunk) => chunks.push(chunk));
      doc.on('end', () => {
        const buffer = Buffer.concat(chunks);
        logger.info(`PDF report generated for task: ${taskData.id}`);
        resolve({
          buffer,
          filename: `inventory_report_${taskData.id}.pdf`,
          contentType: 'application/pdf'
        });
      });
      doc.on('error', reject);

      doc.fontSize(24).text('仓库盘点报告', { align: 'center' });
      doc.moveDown();

      doc.fontSize(14).text('任务信息', { underline: true });
      doc.fontSize(12);
      doc.text(`任务名称: ${taskData.name}`);
      doc.text(`仓库: ${taskData.warehouse_name}`);
      doc.text(`创建人: ${taskData.created_by_name}`);
      doc.text(`负责人: ${taskData.assigned_to_name || '未分配'}`);
      doc.text(`状态: ${taskData.status}`);
      doc.text(`计划日期: ${taskData.scheduled_date}`);
      
      doc.moveDown();
      doc.fontSize(14).text('盘点明细', { underline: true });
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const columnWidths = [80, 100, 60, 60, 60, 60, 80, 80];
      const headers = ['SKU', '商品名称', '预期', '实际', '差异', '状态', '盘点人', '备注'];

      doc.font('Helvetica-Bold');
      let x = 50;
      headers.forEach((header, i) => {
        doc.text(header, x, tableTop, { width: columnWidths[i], align: 'left' });
        x += columnWidths[i];
      });

      doc.font('Helvetica');
      let y = tableTop + 20;
      taskData.items.forEach((item) => {
        if (y > 700) {
          doc.addPage();
          y = 50;
        }
        
        let colX = 50;
        doc.text(item.sku || '-', colX, y, { width: columnWidths[0] });
        colX += columnWidths[0];
        doc.text(item.item_name || '-', colX, y, { width: columnWidths[1] });
        colX += columnWidths[1];
        doc.text(item.expected_quantity || '-', colX, y, { width: columnWidths[2] });
        colX += columnWidths[2];
        doc.text(item.actual_quantity || '-', colX, y, { width: columnWidths[3] });
        colX += columnWidths[3];
        doc.text(item.difference || '-', colX, y, { width: columnWidths[4] });
        colX += columnWidths[4];
        doc.text(item.status || '-', colX, y, { width: columnWidths[5] });
        colX += columnWidths[5];
        doc.text(item.counted_by || '-', colX, y, { width: columnWidths[6] });
        colX += columnWidths[6];
        doc.text(item.notes || '-', colX, y, { width: columnWidths[7] });
        
        y += 20;
      });

      doc.end();
    });
  }

  static async saveReportToFile(report, outputPath) {
    if (report.buffer) {
      fs.writeFileSync(outputPath, report.buffer);
    } else if (report.content) {
      fs.writeFileSync(outputPath, report.content, 'utf8');
    }
    logger.info(`Report saved to: ${outputPath}`);
    return outputPath;
  }
}

module.exports = ReportService;
