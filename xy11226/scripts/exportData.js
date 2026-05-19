const fs = require('fs');
const path = require('path');
const { Parser } = require('json2csv');
const { initDatabase, Ticket, User } = require('../src/models');
const { logExport } = require('../src/services/auditService');
const { maskSensitiveFields } = require('../src/utils/dataMask');

const OPERATOR_ID = 2;

const exportTickets = async (options = {}) => {
  try {
    await initDatabase();
    console.log('数据库连接成功');

    const { problemType, status, startDate, endDate, outputFile } = options;

    const where = {};
    if (problemType) where.problemType = problemType;
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) where.createdAt.gte = new Date(startDate);
      if (endDate) where.createdAt.lte = new Date(endDate);
    }

    const tickets = await Ticket.findAll({
      where,
      include: [
        { model: User, as: 'operator', attributes: ['username', 'realName'] },
        { model: User, as: 'reviewer', attributes: ['username', 'realName'] }
      ],
      order: [['createdAt', 'DESC']]
    });

    const maskedTickets = maskSensitiveFields(tickets);

    const exportData = maskedTickets.map(ticket => ({
      客服单号: ticket.ticketNo,
      客户姓名: ticket.customerName || '',
      联系电话: ticket.customerPhone || '',
      换电站ID: ticket.stationId,
      换电站名称: ticket.stationName,
      问题类型: ticket.problemType || '',
      问题类型标签: ticket.problemTypeLabel || '',
      问题描述: ticket.description,
      状态: ticket.status,
      状态标签: ticket.statusLabel,
      优先级: ticket.priority,
      处理人: ticket.operator ? ticket.operator.realName : '',
      复核人: ticket.reviewer ? ticket.reviewer.realName : '',
      解决方案: ticket.resolution || '',
      来源: ticket.source,
      创建时间: ticket.createdAt ? ticket.createdAt.toISOString() : '',
      解决时间: ticket.resolvedAt ? ticket.resolvedAt.toISOString() : ''
    }));

    const fields = [
      '客服单号', '客户姓名', '联系电话', '换电站ID', '换电站名称',
      '问题类型', '问题类型标签', '问题描述', '状态', '状态标签',
      '优先级', '处理人', '复核人', '解决方案', '来源', '创建时间', '解决时间'
    ];

    const json2csvParser = new Parser({ fields });
    const csv = json2csvParser.parse(exportData);

    const outputPath = outputFile || path.join(__dirname, `../exports/tickets_${Date.now()}.csv`);
    
    const exportDir = path.dirname(outputPath);
    if (!fs.existsSync(exportDir)) {
      fs.mkdirSync(exportDir, { recursive: true });
    }

    fs.writeFileSync(outputPath, csv, 'utf8');

    await logExport(exportData.length, { problemType, status, startDate, endDate }, OPERATOR_ID, 'localhost', 'script');

    console.log(`导出成功: 共 ${exportData.length} 条记录`);
    console.log(`输出文件: ${outputPath}`);
    process.exit(0);
  } catch (error) {
    console.error('导出失败:', error);
    process.exit(1);
  }
};

const args = process.argv.slice(2);
const options = {};

args.forEach((arg, index) => {
  if (arg.startsWith('--')) {
    const key = arg.slice(2);
    const value = args[index + 1];
    if (value && !value.startsWith('--')) {
      options[key] = value;
    }
  }
});

console.log('使用方法: node scripts/exportData.js [选项]');
console.log('选项:');
console.log('  --problemType <类型>  按问题类型过滤');
console.log('  --status <状态>        按状态过滤');
console.log('  --startDate <日期>     开始日期 (YYYY-MM-DD)');
console.log('  --endDate <日期>       结束日期 (YYYY-MM-DD)');
console.log('  --outputFile <路径>    输出文件路径');
console.log('');

exportTickets(options);
