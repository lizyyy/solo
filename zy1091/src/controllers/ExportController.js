const { ExportService, BillService } = require('../services');
const { wrapAsync } = require('../middlewares');
const { POINTS_CONFIG } = require('../config/constants');

class ExportController {
  static exportJSON = wrapAsync(async (req, res, next) => {
    const {
      start_date,
      end_date,
      include_bills = true,
      include_payments = true,
      include_flatmates = true,
      include_chores = true,
      include_points = true,
      include_disputes = true,
    } = req.query;
    
    try {
      const result = await ExportService.exportToJSON({
        start_date,
        end_date,
        include_bills: include_bills !== 'false',
        include_payments: include_payments !== 'false',
        include_flatmates: include_flatmates !== 'false',
        include_chores: include_chores !== 'false',
        include_points: include_points !== 'false',
        include_disputes: include_disputes !== 'false',
      });
      
      // 设置响应头，让浏览器下载文件
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=flatmate-export-${new Date().toISOString().slice(0, 10)}.json`
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  static exportMarkdown = wrapAsync(async (req, res, next) => {
    const {
      start_date,
      end_date,
      summary_only = false,
      flatmate_id,
    } = req.query;
    
    try {
      let markdown;
      
      if (flatmate_id) {
        // 导出特定室友的对账单
        markdown = await ExportService.exportFlatmateStatementToMarkdown(
          parseInt(flatmate_id),
          {
            start_date,
            end_date,
          }
        );
      } else {
        // 导出汇总报告
        markdown = await ExportService.exportToMarkdown({
          start_date,
          end_date,
          summary_only: summary_only === 'true',
        });
      }
      
      // 设置响应头
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=flatmate-report-${new Date().toISOString().slice(0, 10)}.md`
      );
      
      res.send(markdown);
    } catch (error) {
      next(error);
    }
  });

  static getBalanceSummaryJSON = wrapAsync(async (req, res, next) => {
    try {
      const summary = await BillService.getBalanceSummary();
      
      const result = {
        export_time: new Date().toISOString(),
        report_type: 'balance_summary',
        summary: {
          total_active_flatmates: summary.total_active_flatmates,
          total_points: summary.total_points,
          total_points_value: summary.total_points_value,
          total_balance: summary.total_balance,
          total_pending: summary.total_pending,
          total_overdue: summary.total_overdue,
        },
        flatmate_balances: summary.flatmate_balances.map(fb => ({
          flatmate_id: fb.flatmate_id,
          name: fb.name,
          points: fb.points,
          points_value: fb.points_value,
          total_debt: fb.total_debt,
          total_paid: fb.total_paid,
          pending_amount: fb.pending_amount,
          overdue_amount: fb.overdue_amount,
          has_risk: parseFloat(fb.overdue_amount) > 0 || parseFloat(fb.pending_amount) > 0,
        })),
        alerts: {
          has_overdue_risk: parseFloat(summary.total_overdue) > 0,
          has_pending_bills: parseFloat(summary.total_pending) > 0,
          overdue_amount: summary.total_overdue,
          pending_amount: summary.total_pending,
        },
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=balance-summary-${new Date().toISOString().slice(0, 10)}.json`
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  static getBalanceSummaryMarkdown = wrapAsync(async (req, res, next) => {
    try {
      const summary = await BillService.getBalanceSummary();
      
      let markdown = '# 合租账户余额汇总报告\n\n';
      markdown += `> 生成时间: ${new Date().toLocaleString('zh-CN')}\n\n`;
      
      markdown += '## 总体统计\n\n';
      markdown += `| 项目 | 数值 |\n`;
      markdown += `|------|------|\n`;
      markdown += `| 活跃室友数 | ${summary.total_active_flatmates} |\n`;
      markdown += `| 总积分余额 | ${summary.total_points} 积分 (¥${summary.total_points_value}) |\n`;
      markdown += `| 总待支付金额 | ¥${summary.total_balance} |\n`;
      markdown += `| 待支付金额 | ¥${summary.total_pending} |\n`;
      markdown += `| 逾期金额 | ¥${summary.total_overdue} |\n\n`;
      
      // 风险提示
      if (parseFloat(summary.total_overdue) > 0) {
        markdown += `## ⚠️ 风险提示\n\n`;
        markdown += `> **当前有逾期金额 ¥${summary.total_overdue}，请及时处理**\n\n`;
      }
      
      markdown += '## 各室友余额明细\n\n';
      markdown += `| 室友 | 积分 | 积分价值 | 总欠款 | 已支付 | 待支付 | 逾期 | 状态 |\n`;
      markdown += `|------|------|---------|--------|--------|--------|------|------|\n`;
      
      for (const fb of summary.flatmate_balances) {
        const hasOverdue = parseFloat(fb.overdue_amount) > 0;
        const hasPending = parseFloat(fb.pending_amount) > 0;
        let status = '✅ 正常';
        if (hasOverdue) {
          status = '🔴 逾期';
        } else if (hasPending) {
          status = '🟡 待支付';
        }
        
        markdown += `| ${fb.name} | ${fb.points} | ¥${fb.points_value} | ¥${fb.total_debt} | ¥${fb.total_paid} | ¥${fb.pending_amount} | ¥${fb.overdue_amount} | ${status} |\n`;
      }
      markdown += '\n';
      
      markdown += `---\n\n`;
      markdown += `## 积分规则说明\n\n`;
      markdown += `- **1 积分 = ¥${POINTS_CONFIG.EXCHANGE_RATE}**\n`;
      markdown += `- **单次最大抵扣比例**: ${POINTS_CONFIG.MAX_DEDUCTION_RATE * 100}%\n`;
      markdown += `- **单次最大抵扣积分**: ${POINTS_CONFIG.MAX_DEDUCTION_POINTS_PER_BILL} 积分\n`;
      markdown += `- **积分有效期**: ${POINTS_CONFIG.EXPIRY_DAYS} 天\n\n`;
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=balance-summary-${new Date().toISOString().slice(0, 10)}.md`
      );
      
      res.send(markdown);
    } catch (error) {
      next(error);
    }
  });

  static getFlatmateStatementJSON = wrapAsync(async (req, res, next) => {
    const { flatmate_id } = req.params;
    const { start_date, end_date, status } = req.query;
    
    try {
      const statement = await BillService.getFlatmateStatement(
        parseInt(flatmate_id),
        {
          startDate: start_date,
          endDate: end_date,
          status,
        }
      );
      
      const result = {
        export_time: new Date().toISOString(),
        report_type: 'flatmate_statement',
        flatmate_id: statement.flatmate_id,
        summary: {
          ...statement.summary,
        },
        transactions: statement.transactions.map(tx => ({
          bill_id: tx.bill_id,
          bill_title: tx.bill?.title,
          bill_category: tx.bill?.category,
          amount: tx.amount,
          paid_amount: tx.paid_amount,
          points_used: tx.points_used,
          status: tx.status,
          created_at: tx.bill?.created_at,
          due_date: tx.due_date,
        })),
        alerts: {
          has_overdue: parseFloat(statement.summary.overdue_amount) > 0,
          has_pending: parseFloat(statement.summary.pending_amount) > 0,
          overdue_amount: statement.summary.overdue_amount,
          pending_amount: statement.summary.pending_amount,
        },
      };
      
      res.setHeader('Content-Type', 'application/json');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=flatmate-${flatmate_id}-statement-${new Date().toISOString().slice(0, 10)}.json`
      );
      
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  static getFlatmateStatementMarkdown = wrapAsync(async (req, res, next) => {
    const { flatmate_id } = req.params;
    const { start_date, end_date } = req.query;
    
    try {
      const markdown = await ExportService.exportFlatmateStatementToMarkdown(
        parseInt(flatmate_id),
        {
          start_date,
          end_date,
        }
      );
      
      res.setHeader('Content-Type', 'text/markdown; charset=utf-8');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename=flatmate-${flatmate_id}-statement-${new Date().toISOString().slice(0, 10)}.md`
      );
      
      res.send(markdown);
    } catch (error) {
      next(error);
    }
  });
}

module.exports = ExportController;
