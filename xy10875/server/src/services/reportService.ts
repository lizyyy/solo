import ExcelJS from 'exceljs';
import { allQuery } from '../database';
import dayjs from 'dayjs';
import path from 'path';
import fs from 'fs';

const reportDir = path.join(__dirname, '../../data/reports');
if (!fs.existsSync(reportDir)) {
  fs.mkdirSync(reportDir, { recursive: true });
}

export class ReportService {
  async generateMatchingReport(startDate?: string, endDate?: string): Promise<string> {
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      whereConditions.push(`i.created_at >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push(`i.created_at <= ?`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const sql = `
      SELECT 
        i.id,
        i.invoice_no,
        i.invoice_code,
        i.invoice_date,
        i.total_amount,
        i.seller_name,
        i.category,
        i.status as invoice_status,
        i.employee_name,
        m.match_type,
        m.match_score,
        m.status as match_status,
        m.matched_by,
        m.matched_at,
        t.employee_name as trip_employee,
        t.departure_city,
        t.arrival_city,
        t.start_date as trip_start,
        t.end_date as trip_end,
        b.name as budget_name,
        b.code as budget_code
      FROM invoice_images i
      LEFT JOIN match_results m ON i.id = m.invoice_id
      LEFT JOIN trip_records t ON m.trip_id = t.id
      LEFT JOIN budget_categories b ON m.budget_category_id = b.id
      ${whereClause}
      ORDER BY i.created_at DESC
    `;

    const data = await allQuery(sql, params);

    const workbook = new ExcelJS.Workbook();
    workbook.creator = '报销票据匹配系统';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('匹配报告');

    worksheet.columns = [
      { header: '发票号码', key: 'invoice_no', width: 15 },
      { header: '发票代码', key: 'invoice_code', width: 15 },
      { header: '开票日期', key: 'invoice_date', width: 12 },
      { header: '金额', key: 'total_amount', width: 12 },
      { header: '销售方', key: 'seller_name', width: 20 },
      { header: '类别', key: 'category', width: 12 },
      { header: '员工', key: 'employee_name', width: 12 },
      { header: '发票状态', key: 'invoice_status', width: 12 },
      { header: '匹配类型', key: 'match_type', width: 12 },
      { header: '匹配得分', key: 'match_score', width: 10 },
      { header: '匹配状态', key: 'match_status', width: 12 },
      { header: '匹配人', key: 'matched_by', width: 12 },
      { header: '匹配时间', key: 'matched_at', width: 20 },
      { header: '行程-出发地', key: 'departure_city', width: 12 },
      { header: '行程-目的地', key: 'arrival_city', width: 12 },
      { header: '行程-开始', key: 'trip_start', width: 12 },
      { header: '预算科目', key: 'budget_name', width: 20 },
    ];

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, size: 12 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    data.forEach((row: any) => {
      worksheet.addRow({
        invoice_no: row.invoice_no || '-',
        invoice_code: row.invoice_code || '-',
        invoice_date: row.invoice_date || '-',
        total_amount: row.total_amount || 0,
        seller_name: row.seller_name || '-',
        category: row.category || '-',
        employee_name: row.employee_name || '-',
        invoice_status: this.translateStatus(row.invoice_status),
        match_type: this.translateMatchType(row.match_type),
        match_score: row.match_score || '-',
        match_status: this.translateMatchStatus(row.match_status),
        matched_by: row.matched_by || '-',
        matched_at: row.matched_at ? dayjs(row.matched_at).format('YYYY-MM-DD HH:mm') : '-',
        departure_city: row.departure_city || '-',
        arrival_city: row.arrival_city || '-',
        trip_start: row.trip_start || '-',
        budget_name: row.budget_name || '-',
      });
    });

    const summarySheet = workbook.addWorksheet('统计汇总');
    
    const stats = await this.getStatistics(startDate, endDate);
    
    summarySheet.addRow(['报销票据匹配报告统计汇总']);
    summarySheet.addRow(['生成时间', dayjs().format('YYYY-MM-DD HH:mm:ss')]);
    summarySheet.addRow([]);
    summarySheet.addRow(['统计项', '数量']);
    summarySheet.addRow(['票据总数', stats.totalInvoices]);
    summarySheet.addRow(['已匹配', stats.matched]);
    summarySheet.addRow(['待匹配', stats.pending]);
    summarySheet.addRow(['重复票据', stats.duplicate]);
    summarySheet.addRow(['已确认', stats.confirmed]);
    summarySheet.addRow(['自动匹配', stats.autoMatched]);
    summarySheet.addRow(['人工匹配', stats.manualMatched]);

    const fileName = `匹配报告_${dayjs().format('YYYYMMDD_HHmmss')}.xlsx`;
    const filePath = path.join(reportDir, fileName);
    
    await workbook.xlsx.writeFile(filePath);
    
    return fileName;
  }

  async getStatistics(startDate?: string, endDate?: string) {
    const whereConditions: string[] = [];
    const params: any[] = [];

    if (startDate) {
      whereConditions.push(`created_at >= ?`);
      params.push(startDate);
    }
    if (endDate) {
      whereConditions.push(`created_at <= ?`);
      params.push(endDate);
    }

    const whereClause = whereConditions.length > 0 ? `WHERE ${whereConditions.join(' AND ')}` : '';

    const [statusStats, matchStats] = await Promise.all([
      allQuery(`SELECT status, COUNT(*) as count FROM invoice_images ${whereClause} GROUP BY status`, params),
      allQuery(`SELECT match_type, COUNT(*) as count FROM match_results ${whereClause} GROUP BY match_type`, params),
    ]);

    const getCount = (arr: any[], status: string) => {
      const item = arr.find((i: any) => i.status === status);
      return item ? item.count : 0;
    };

    const getMatchCount = (arr: any[], type: string) => {
      const item = arr.find((i: any) => i.match_type === type);
      return item ? item.count : 0;
    };

    return {
      totalInvoices: statusStats.reduce((sum: number, item: any) => sum + item.count, 0),
      matched: getCount(statusStats, 'matched'),
      pending: getCount(statusStats, 'pending'),
      duplicate: getCount(statusStats, 'duplicate'),
      confirmed: getCount(statusStats, 'confirmed'),
      autoMatched: getMatchCount(matchStats, 'trip') + getMatchCount(matchStats, 'budget'),
      manualMatched: getMatchCount(matchStats, 'manual'),
    };
  }

  getReportPath(fileName: string): string {
    return path.join(reportDir, fileName);
  }

  private translateStatus(status: string): string {
    const map: Record<string, string> = {
      pending: '待匹配',
      matched: '已匹配',
      duplicate: '重复',
      exception: '异常',
      confirmed: '已确认',
      rejected: '已驳回',
    };
    return map[status] || status;
  }

  private translateMatchType(type: string): string {
    const map: Record<string, string> = {
      trip: '行程匹配',
      budget: '预算匹配',
      manual: '人工匹配',
    };
    return map[type] || type || '-';
  }

  private translateMatchStatus(status: string): string {
    const map: Record<string, string> = {
      pending: '待处理',
      auto_matched: '自动匹配',
      manual_matched: '人工匹配',
      confirmed: '已确认',
      rejected: '已驳回',
    };
    return map[status] || status || '-';
  }
}

export default new ReportService();
