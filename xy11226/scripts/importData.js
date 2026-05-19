const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { initDatabase, Ticket, User } = require('../src/models');
const { classifyTicket } = require('../src/services/classificationService');
const { logImport } = require('../src/services/auditService');

const OPERATOR_ID = 2;

const importFromCSV = async (filePath) => {
  const results = [];
  
  return new Promise((resolve, reject) => {
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => results.push(data))
      .on('end', () => resolve(results))
      .on('error', reject);
  });
};

const importTickets = async (filePath) => {
  try {
    await initDatabase();
    console.log('数据库连接成功');

    const ticketsData = await importFromCSV(filePath);
    console.log(`读取到 ${ticketsData.length} 条数据`);

    let successCount = 0;
    let errorCount = 0;

    for (const ticketData of ticketsData) {
      try {
        const existingTicket = await Ticket.findOne({ where: { ticketNo: ticketData.ticketNo } });
        if (existingTicket) {
          console.log(`跳过已存在的客服单: ${ticketData.ticketNo}`);
          continue;
        }

        if (!ticketData.problemType) {
          const classificationResult = classifyTicket(ticketData.description);
          ticketData.problemType = classificationResult.type;
        }

        await Ticket.create({
          ticketNo: ticketData.ticketNo,
          customerName: ticketData.customerName || null,
          customerPhone: ticketData.customerPhone || null,
          stationId: ticketData.stationId,
          stationName: ticketData.stationName,
          description: ticketData.description,
          problemType: ticketData.problemType,
          status: ticketData.status || 'pending',
          priority: ticketData.priority || 'medium',
          source: ticketData.source || 'import',
          operatorId: OPERATOR_ID
        });

        successCount++;
        console.log(`导入成功: ${ticketData.ticketNo}`);
      } catch (error) {
        errorCount++;
        console.error(`导入失败 ${ticketData.ticketNo}:`, error.message);
      }
    }

    await logImport(successCount, OPERATOR_ID, 'localhost', 'script');

    console.log(`\n导入完成: 成功 ${successCount} 条, 失败 ${errorCount} 条`);
    process.exit(0);
  } catch (error) {
    console.error('导入过程出错:', error);
    process.exit(1);
  }
};

const importSampleData = async () => {
  try {
    await initDatabase();
    console.log('数据库连接成功');

    const sampleData = require('../data/sampleData.json');
    console.log(`读取到 ${sampleData.length} 条样例数据`);

    let successCount = 0;

    for (const ticketData of sampleData) {
      try {
        const existingTicket = await Ticket.findOne({ where: { ticketNo: ticketData.ticketNo } });
        if (existingTicket) {
          console.log(`跳过已存在的客服单: ${ticketData.ticketNo}`);
          continue;
        }

        if (!ticketData.problemType) {
          const classificationResult = classifyTicket(ticketData.description);
          ticketData.problemType = classificationResult.type;
        }

        await Ticket.create({
          ...ticketData,
          operatorId: OPERATOR_ID
        });

        successCount++;
        console.log(`导入成功: ${ticketData.ticketNo} - ${ticketData.problemType}`);
      } catch (error) {
        console.error(`导入失败 ${ticketData.ticketNo}:`, error.message);
      }
    }

    await logImport(successCount, OPERATOR_ID, 'localhost', 'script');

    console.log(`\n样例数据导入完成: 成功 ${successCount} 条`);
    process.exit(0);
  } catch (error) {
    console.error('导入过程出错:', error);
    process.exit(1);
  }
};

const filePath = process.argv[2];

if (filePath === 'sample') {
  importSampleData();
} else if (filePath) {
  importTickets(filePath);
} else {
  console.log('使用方法:');
  console.log('  导入CSV文件: node scripts/importData.js <csv文件路径>');
  console.log('  导入样例数据: node scripts/importData.js sample');
  process.exit(1);
}
