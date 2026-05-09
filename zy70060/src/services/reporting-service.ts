import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import { runQuery, getOne, getAll } from '../utils/db-helpers';
import { RegulatoryReport } from '../types';

interface RegulatoryReportRow {
  id: string;
  report_date: string;
  customer_id: string;
  total_buy_amount: number;
  total_sell_amount: number;
  transaction_count: number;
  report_data: string;
  created_at: string;
}

export const reportingService = {
  async generateDailyReport(date?: string): Promise<RegulatoryReport[]> {
    const targetDate = date || dayjs().format('YYYY-MM-DD');
    
    const transactionRows = await getAll<{
      customer_id: string;
      type: string;
      rmb_amount: number;
      count: number;
    }>(
      `SELECT 
         customer_id, 
         type, 
         SUM(rmb_amount) as rmb_amount,
         COUNT(*) as count
       FROM transactions 
       WHERE date(created_at) = ? 
         AND status = 'SUCCESS'
       GROUP BY customer_id, type`,
      [targetDate]
    );

    const customerReports = new Map<string, {
      customerId: string;
      totalBuyAmount: number;
      totalSellAmount: number;
      transactionCount: number;
      transactions: Array<{type: string; amount: number; count: number}>;
    }>();

    for (const row of transactionRows) {
      if (!customerReports.has(row.customer_id)) {
        customerReports.set(row.customer_id, {
          customerId: row.customer_id,
          totalBuyAmount: 0,
          totalSellAmount: 0,
          transactionCount: 0,
          transactions: []
        });
      }

      const report = customerReports.get(row.customer_id)!;
      if (row.type === 'BUY') {
        report.totalBuyAmount += row.rmb_amount;
      } else {
        report.totalSellAmount += row.rmb_amount;
      }
      report.transactionCount += row.count;
      report.transactions.push({
        type: row.type,
        amount: row.rmb_amount,
        count: row.count
      });
    }

    const reports: RegulatoryReport[] = [];
    const now = dayjs().toISOString();

    for (const [customerId, data] of customerReports) {
      const id = uuidv4();
      const reportData = JSON.stringify(data.transactions);

      await runQuery(
        `INSERT INTO regulatory_reports (
          id, report_date, customer_id, total_buy_amount, 
          total_sell_amount, transaction_count, report_data, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(report_date, customer_id) DO UPDATE SET
          total_buy_amount = excluded.total_buy_amount,
          total_sell_amount = excluded.total_sell_amount,
          transaction_count = excluded.transaction_count,
          report_data = excluded.report_data`,
        [
          id,
          targetDate,
          customerId,
          data.totalBuyAmount,
          data.totalSellAmount,
          data.transactionCount,
          reportData,
          now
        ]
      );

      reports.push({
        id,
        reportDate: targetDate,
        customerId,
        totalBuyAmount: data.totalBuyAmount,
        totalSellAmount: data.totalSellAmount,
        transactionCount: data.transactionCount,
        reportData,
        createdAt: now
      });
    }

    return reports;
  },

  async generateMonthlyReport(year: number, month: number): Promise<RegulatoryReport[]> {
    const startDate = dayjs(`${year}-${month.toString().padStart(2, '0')}-01`).format('YYYY-MM-DD');
    const endDate = dayjs(startDate).endOf('month').format('YYYY-MM-DD');

    const transactionRows = await getAll<{
      customer_id: string;
      type: string;
      rmb_amount: number;
      count: number;
    }>(
      `SELECT 
         customer_id, 
         type, 
         SUM(rmb_amount) as rmb_amount,
         COUNT(*) as count
       FROM transactions 
       WHERE date(created_at) BETWEEN ? AND ?
         AND status = 'SUCCESS'
       GROUP BY customer_id, type`,
      [startDate, endDate]
    );

    const customerReports = new Map<string, {
      customerId: string;
      totalBuyAmount: number;
      totalSellAmount: number;
      transactionCount: number;
      transactions: Array<{type: string; amount: number; count: number}>;
    }>();

    for (const row of transactionRows) {
      if (!customerReports.has(row.customer_id)) {
        customerReports.set(row.customer_id, {
          customerId: row.customer_id,
          totalBuyAmount: 0,
          totalSellAmount: 0,
          transactionCount: 0,
          transactions: []
        });
      }

      const report = customerReports.get(row.customer_id)!;
      if (row.type === 'BUY') {
        report.totalBuyAmount += row.rmb_amount;
      } else {
        report.totalSellAmount += row.rmb_amount;
      }
      report.transactionCount += row.count;
      report.transactions.push({
        type: row.type,
        amount: row.rmb_amount,
        count: row.count
      });
    }

    const reports: RegulatoryReport[] = [];
    const now = dayjs().toISOString();
    const reportDate = `${year}-${month.toString().padStart(2, '0')}`;

    for (const [customerId, data] of customerReports) {
      const id = uuidv4();
      const reportData = JSON.stringify(data.transactions);

      reports.push({
        id,
        reportDate,
        customerId,
        totalBuyAmount: data.totalBuyAmount,
        totalSellAmount: data.totalSellAmount,
        transactionCount: data.transactionCount,
        reportData,
        createdAt: now
      });
    }

    return reports;
  },

  async getReportsByDate(date: string): Promise<RegulatoryReport[]> {
    const rows = await getAll<RegulatoryReportRow>(
      'SELECT * FROM regulatory_reports WHERE report_date = ? ORDER BY created_at DESC',
      [date]
    );

    return rows.map(this.rowToReport);
  },

  async getReportsByCustomer(customerId: string, limit: number = 10): Promise<RegulatoryReport[]> {
    const rows = await getAll<RegulatoryReportRow>(
      'SELECT * FROM regulatory_reports WHERE customer_id = ? ORDER BY report_date DESC LIMIT ?',
      [customerId, limit]
    );

    return rows.map(this.rowToReport);
  },

  async exportRegulatoryData(date: string): Promise<any[]> {
    const rows = await getAll<any>(
      `SELECT 
         t.id,
         t.idempotent_key,
         t.customer_id,
         c.name as customer_name,
         c.id_card_no,
         t.type,
         t.currency,
         t.foreign_currency_amount,
         t.rmb_amount,
         er.currency as rate_currency,
         er.buy_rate,
         er.sell_rate,
         t.status,
         t.created_at
       FROM transactions t
       LEFT JOIN customers c ON t.customer_id = c.id
       LEFT JOIN exchange_rate_snapshots er ON t.rate_snapshot_id = er.id
       WHERE date(t.created_at) = ?
       ORDER BY t.created_at ASC`,
      [date]
    );

    return rows;
  },

  rowToReport(row: RegulatoryReportRow): RegulatoryReport {
    return {
      id: row.id,
      reportDate: row.report_date,
      customerId: row.customer_id,
      totalBuyAmount: row.total_buy_amount,
      totalSellAmount: row.total_sell_amount,
      transactionCount: row.transaction_count,
      reportData: row.report_data,
      createdAt: row.created_at
    };
  }
};