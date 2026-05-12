const { sequelize, Contract, Installment } = require('../models');
const moment = require('moment');

async function seedDatabase() {
  try {
    console.log('开始初始化数据库...');
    
    await sequelize.sync({ force: true });
    console.log('数据库表创建完成');

    const contractsData = [
      {
        contractNo: 'LOAN20250001',
        customerName: '张三',
        customerIdNo: '110101199001011234',
        principal: 100000,
        interestRate: 8.5,
        totalAmount: 104582.85,
        term: 12,
        startDate: new Date(),
        status: 'active',
        maxForbearanceTimes: 3,
        usedForbearanceTimes: 0,
        isInCollection: false,
      },
      {
        contractNo: 'LOAN20250002',
        customerName: '李四',
        customerIdNo: '310101198505055678',
        principal: 50000,
        interestRate: 9.0,
        totalAmount: 52473.84,
        term: 12,
        startDate: moment().subtract(3, 'months').toDate(),
        status: 'active',
        maxForbearanceTimes: 3,
        usedForbearanceTimes: 1,
        isInCollection: true,
      },
    ];

    for (const contractData of contractsData) {
      const contract = await Contract.create(contractData);
      console.log(`创建合同: ${contract.contractNo}`);

      const monthlyRate = contract.interestRate / 100 / 12;
      const monthlyPayment = contract.principal * monthlyRate * Math.pow(1 + monthlyRate, contract.term) / 
        (Math.pow(1 + monthlyRate, contract.term) - 1);

      for (let i = 1; i <= contract.term; i++) {
        const dueDate = moment(contract.startDate).add(i, 'months').toDate();
        const principalAmount = monthlyPayment - (contract.principal - (monthlyPayment * (i - 1))) * monthlyRate;
        const interestAmount = monthlyPayment - principalAmount;

        await Installment.create({
          contractId: contract.id,
          installmentNo: i,
          originalDueDate: dueDate,
          currentDueDate: dueDate,
          principalAmount: principalAmount.toFixed(2),
          interestAmount: interestAmount.toFixed(2),
          totalAmount: monthlyPayment.toFixed(2),
          remainingAmount: monthlyPayment.toFixed(2),
          paidAmount: 0,
          status: i <= 3 && contract.contractNo === 'LOAN20250002' ? 'overdue' : 'pending',
        });
      }
    }

    console.log('种子数据创建完成');
    console.log('\n测试合同:');
    console.log('  LOAN20250001 - 张三 - 正常合同');
    console.log('  LOAN20250002 - 李四 - 已逾期合同(催收中)');

  } catch (error) {
    console.error('种子数据创建失败:', error);
  } finally {
    await sequelize.close();
  }
}

seedDatabase();
