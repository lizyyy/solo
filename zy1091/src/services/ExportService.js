const { Op } = require('sequelize');
const moment = require('moment');
const {
  Bill,
  SplitRule,
  PaymentRecord,
  Flatmate,
  ChoreTask,
  PointAdjustment,
  Dispute,
} = require('../models');
const BillService = require('./BillService');
const { POINTS_CONFIG, STATUS_MAP } = require('../config/constants');

class ExportService {
  static async exportToJSON(options = {}) {
    const {
      start_date,
      end_date,
      include_bills = true,
      include_payments = true,
      include_flatmates = true,
      include_chores = true,
      include_points = true,
      include_disputes = true,
    } = options;
    
    const result = {
      export_info: {
        export_time: moment().toISOString(),
        export_type: 'json',
        time_range: {
          start: start_date ? moment(start_date).startOf('day').toISOString() : null,
          end: end_date ? moment(end_date).endOf('day').toISOString() : null,
        },
        included_modules: {
          bills: include_bills,
          payments: include_payments,
          flatmates: include_flatmates,
          chores: include_chores,
          points: include_points,
          disputes: include_disputes,
        },
      },
      data: {},
    };
    
    const dateWhere = {};
    if (start_date) {
      dateWhere.created_at = {
        ...dateWhere.created_at,
        [Op.gte]: moment(start_date).startOf('day').toDate(),
      };
    }
    if (end_date) {
      dateWhere.created_at = {
        ...dateWhere.created_at,
        [Op.lte]: moment(end_date).endOf('day').toDate(),
      };
    }
    
    // 导出室友
    if (include_flatmates) {
      const flatmates = await Flatmate.findAll({
        attributes: { exclude: ['email', 'phone'] }, // 排除敏感信息
        order: [['created_at', 'ASC']],
      });
      result.data.flatmates = flatmates;
    }
    
    // 导出账单
    if (include_bills) {
      const bills = await Bill.findAll({
        where: dateWhere,
        include: [
          {
            model: SplitRule,
            as: 'splitRules',
            include: [
              {
                model: Flatmate,
                as: 'flatmate',
                attributes: ['id', 'name'],
              },
            ],
          },
          {
            model: Flatmate,
            as: 'creator',
            attributes: ['id', 'name'],
          },
        ],
        order: [['created_at', 'DESC']],
      });
      result.data.bills = bills;
    }
    
    // 导出付款记录
    if (include_payments) {
      const payments = await PaymentRecord.findAll({
        where: dateWhere,
        include: [
          {
            model: Bill,
            as: 'bill',
            attributes: ['id', 'title'],
          },
          {
            model: Flatmate,
            as: 'payer',
            attributes: ['id', 'name'],
          },
          {
            model: Flatmate,
            as: 'receiver',
            attributes: ['id', 'name'],
          },
        ],
        order: [['created_at', 'DESC']],
      });
      result.data.payments = payments;
    }
    
    // 导出家务任务
    if (include_chores) {
      const chores = await ChoreTask.findAll({
        where: dateWhere,
        include: [
          {
            model: Flatmate,
            as: 'assignedTo',
            attributes: ['id', 'name'],
          },
          {
            model: Flatmate,
            as: 'completedBy',
            attributes: ['id', 'name'],
          },
        ],
        order: [['due_date', 'DESC']],
      });
      result.data.chores = chores;
    }
    
    // 导出积分调整
    if (include_points) {
      const pointAdjustments = await PointAdjustment.findAll({
        where: dateWhere,
        include: [
          {
            model: Flatmate,
            as: 'flatmate',
            attributes: ['id', 'name'],
          },
          {
            model: ChoreTask,
            as: 'task',
            attributes: ['id', 'title'],
          },
          {
            model: Bill,
            as: 'bill',
            attributes: ['id', 'title'],
          },
        ],
        order: [['created_at', 'DESC']],
      });
      result.data.point_adjustments = pointAdjustments;
    }
    
    // 导出争议
    if (include_disputes) {
      const disputes = await Dispute.findAll({
        where: dateWhere,
        include: [
          {
            model: Flatmate,
            as: 'raisedBy',
            attributes: ['id', 'name'],
          },
          {
            model: Flatmate,
            as: 'resolvedBy',
            attributes: ['id', 'name'],
          },
          {
            model: Bill,
            as: 'bill',
            attributes: ['id', 'title'],
          },
          {
            model: ChoreTask,
            as: 'task',
            attributes: ['id', 'title'],
          },
        ],
        order: [['created_at', 'DESC']],
      });
      result.data.disputes = disputes;
    }
    
    return result;
  }

  static async exportToMarkdown(options = {}) {
    const {
      start_date,
      end_date,
      flatmate_id, // 特定室友的对账单
      summary_only = false,
    } = options;
    
    let markdown = '# 合租账户对账单\n\n';
    
    const summary = await BillService.getBalanceSummary();
    const now = moment();
    const dateRange = start_date || end_date 
      ? `${start_date ? moment(start_date).format('YYYY-MM-DD') : '最早'} 至 ${end_date ? moment(end_date).format('YYYY-MM-DD') : '现在'}`
      : '全部';
    
    markdown += `> 生成时间: ${now.format('YYYY-MM-DD HH:mm:ss')}\n`;
    markdown += `> 时间范围: ${dateRange}\n\n`;
    
    // 汇总部分
    markdown += '## 汇总统计\n\n';
    
    markdown += `| 项目 | 数值 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 活跃室友数 | ${summary.total_active_flatmates} |\n`;
    markdown += `| 总积分余额 | ${summary.total_points} (价值 ¥${summary.total_points_value}) |\n`;
    markdown += `| 待支付总额 | ¥${summary.total_pending} |\n`;
    markdown += `| 逾期总额 | ¥${summary.total_overdue} |\n\n`;
    
    // 室友余额明细
    markdown += '### 各室友余额\n\n';
    
    markdown += `| 室友 | 当前积分 | 积分价值 | 总欠款 | 已支付 | 待支付 | 逾期 |\n`;
    markdown += `|------|---------|---------|--------|--------|--------|------|\n`;
    
    for (const fb of summary.flatmate_balances) {
      markdown += `| ${fb.name} | ${fb.points} | ¥${fb.points_value} | ¥${fb.total_debt} | ¥${fb.total_paid} | ¥${fb.pending_amount} | ¥${fb.overdue_amount} |\n`;
    }
    markdown += '\n';
    
    if (summary_only) {
      return markdown;
    }
    
    // 如果指定了室友，显示该室友的详细对账单
    if (flatmate_id) {
      const statement = await BillService.getFlatmateStatement(flatmate_id, {
        startDate: start_date,
        endDate: end_date,
      });
      
      const flatmate = summary.flatmate_balances.find(fb => fb.flatmate_id === parseInt(flatmate_id));
      
      if (flatmate && statement.transactions.length > 0) {
        markdown += `---\n\n`;
        markdown += `## ${flatmate.name} 详细对账单\n\n`;
        
        markdown += `### 交易明细\n\n`;
        markdown += `| 账单标题 | 类型 | 应付金额 | 已支付 | 状态 | 创建时间 |\n`;
        markdown += `|----------|------|----------|--------|------|----------|\n`;
        
        for (const tx of statement.transactions.slice(0, 50)) { // 最多显示50条
          const bill = tx.bill;
          if (!bill) continue;
          
          const categoryMap = {
            utility: '水电网',
            supplies: '公共用品',
            rent: '房租',
            service: '服务',
            other: '其他',
          };
          
          const statusMap = {
            pending: '待支付',
            partial: '部分支付',
            paid: '已支付',
            overdue: '逾期',
            disputed: '有争议',
          };
          
          markdown += `| ${bill.title} | ${categoryMap[bill.category] || bill.category} | ¥${tx.amount} | ¥${tx.paid_amount} | ${statusMap[tx.status] || tx.status} | ${moment(bill.created_at).format('YYYY-MM-DD')} |\n`;
        }
        markdown += '\n';
        
        if (statement.transactions.length > 50) {
          markdown += `> 仅显示最近50条交易，完整数据请查看JSON导出。\n\n`;
        }
      }
    }
    
    // 逾期账单提醒
    const overdueBills = summary.flatmate_balances.filter(fb => parseFloat(fb.overdue_amount) > 0);
    if (overdueBills.length > 0) {
      markdown += `---\n\n`;
      markdown += `## ⚠️ 逾期提醒\n\n`;
      
      for (const fb of overdueBills) {
        markdown += `- **${fb.name}**: 逾期金额 ¥${fb.overdue_amount}\n`;
      }
      markdown += '\n';
    }
    
    // 积分说明
    markdown += `---\n\n`;
    markdown += `## 积分规则说明\n\n`;
    markdown += `- **1 积分 = ¥${POINTS_CONFIG.EXCHANGE_RATE}**\n`;
    markdown += `- **单次最大抵扣比例**: ${POINTS_CONFIG.MAX_DEDUCTION_RATE * 100}% 应付金额\n`;
    markdown += `- **单次最大抵扣积分**: ${POINTS_CONFIG.MAX_DEDUCTION_POINTS_PER_BILL} 积分 (¥${POINTS_CONFIG.MAX_DEDUCTION_POINTS_PER_BILL * POINTS_CONFIG.EXCHANGE_RATE})\n`;
    markdown += `- **积分有效期**: ${POINTS_CONFIG.EXPIRY_DAYS} 天\n\n`;
    
    return markdown;
  }

  static async exportFlatmateStatementToMarkdown(flatmateId, options = {}) {
    const {
      start_date,
      end_date,
    } = options;
    
    const flatmate = await Flatmate.findOne({
      where: { id: flatmateId },
    });
    
    if (!flatmate) {
      throw new Error('室友不存在');
    }
    
    const statement = await BillService.getFlatmateStatement(flatmateId, {
      startDate: start_date,
      endDate: end_date,
    });
    
    let markdown = `# ${flatmate.name} 个人对账单\n\n`;
    
    const now = moment();
    const dateRange = start_date || end_date 
      ? `${start_date ? moment(start_date).format('YYYY-MM-DD') : '最早'} 至 ${end_date ? moment(end_date).format('YYYY-MM-DD') : '现在'}`
      : '全部';
    
    markdown += `> 生成时间: ${now.format('YYYY-MM-DD HH:mm:ss')}\n`;
    markdown += `> 时间范围: ${dateRange}\n\n`;
    
    // 个人汇总
    markdown += '## 个人汇总\n\n';
    
    markdown += `| 项目 | 金额 |\n`;
    markdown += `|------|------|\n`;
    markdown += `| 总应付金额 | ¥${statement.summary.total_amount} |\n`;
    markdown += `| 总已支付金额 | ¥${statement.summary.total_paid} |\n`;
    markdown += `| 积分抵扣总额 | ¥${statement.summary.total_points_used} |\n`;
    markdown += `| 待支付金额 | ¥${statement.summary.pending_amount} |\n`;
    markdown += `| 逾期金额 | ¥${statement.summary.overdue_amount} |\n`;
    markdown += `| 账单总数 | ${statement.summary.bill_count} |\n`;
    markdown += `| 已结清账单 | ${statement.summary.paid_bill_count} |\n\n`;
    
    // 当前积分
    markdown += '### 当前积分\n\n';
    markdown += `- **积分余额**: ${flatmate.points} 积分\n`;
    markdown += `- **积分价值**: ¥${(flatmate.points * 0.1).toFixed(2)}\n\n`;
    
    // 交易明细
    if (statement.transactions.length > 0) {
      markdown += '## 交易明细\n\n';
      
      const statusMap = {
        pending: '待支付',
        partial: '部分支付',
        paid: '已支付',
        overdue: '逾期',
        disputed: '有争议',
      };
      
      const categoryMap = {
        utility: '水电网',
        supplies: '公共用品',
        rent: '房租',
        service: '服务',
        other: '其他',
      };
      
      markdown += `| 日期 | 账单标题 | 类型 | 应付 | 已付 | 积分抵扣 | 状态 |\n`;
      markdown += `|------|----------|------|------|------|----------|------|\n`;
      
      for (const tx of statement.transactions) {
        const bill = tx.bill;
        if (!bill) continue;
        
        const statusLabel = statusMap[tx.status] || tx.status;
        const categoryLabel = categoryMap[bill.category] || bill.category;
        const statusEmoji = tx.status === STATUS_MAP.SPLIT_RULE.OVERDUE ? '⚠️ ' : 
                           tx.status === STATUS_MAP.SPLIT_RULE.PAID ? '✅ ' : '';
        
        markdown += `| ${moment(bill.created_at).format('YYYY-MM-DD')} | ${bill.title} | ${categoryLabel} | ¥${tx.amount} | ¥${tx.paid_amount} | ¥${tx.points_used} | ${statusEmoji}${statusLabel} |\n`;
      }
      markdown += '\n';
    } else {
      markdown += '> 暂无交易记录。\n\n';
    }
    
    // 积分说明
    markdown += `---\n\n`;
    markdown += `## 积分使用说明\n\n`;
    markdown += `当前您的积分可用于抵扣账单。使用规则:\n\n`;
    markdown += `1. **1积分 = ¥0.1**\n`;
    markdown += `2. 每笔账单最多可抵扣 **20%** 的应付金额\n`;
    markdown += `3. 每次最多使用 **100积分** (¥10)\n\n`;
    
    return markdown;
  }
}

module.exports = ExportService;
