import express from 'express';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';
import dayjs from 'dayjs';
import routes from './api/routes';
import { repository } from './services/DataRepository';
import {
  InstallmentContract,
  RepaymentFlow,
  OverdueRecord,
  FeeRule,
} from './types/models';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));
app.use('/api', routes);

function initDemoData() {
  const now = dayjs().toISOString();

  const feeRule: FeeRule = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
    ruleCode: 'FEE-001',
    ruleName: '消费分期提前结清规则',
    contractType: 'CONSUMPTION',
    earlySettlementPenaltyRate: 0.03,
    serviceFeeRefundRate: 0.7,
    minServiceFeeRefund: 0,
    isActive: true,
    effectiveDate: dayjs().subtract(1, 'year').toISOString(),
  };
  repository.saveFeeRule(feeRule);

  const contract1: InstallmentContract = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
    contractNo: 'HT20240001',
    customerName: '张三',
    customerId: 'CUST001',
    principal: { original: 100000, final: 100000 },
    totalAmount: 112000,
    termCount: 12,
    termUnit: 'MONTH',
    annualInterestRate: 0.08,
    serviceFeeRate: 0.03,
    startDate: dayjs().subtract(6, 'month').toISOString(),
    endDate: dayjs().add(6, 'month').toISOString(),
    status: 'NORMAL',
  };
  repository.saveContract(contract1);

  const flows1: RepaymentFlow[] = [];
  for (let i = 1; i <= 12; i++) {
    const isPaid = i <= 5;
    flows1.push({
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      flowNo: `FLOW-${i}`,
      contractNo: 'HT20240001',
      termNo: i,
      dueDate: dayjs().add(i - 6, 'month').toISOString(),
      paymentDate: isPaid ? dayjs().add(i - 6, 'month').toISOString() : undefined,
      payablePrincipal: { original: 8333.33, final: 8333.33 },
      payableInterest: { original: 666.67, final: 666.67 },
      payableServiceFee: { original: 250, final: 250 },
      paidPrincipal: isPaid ? 8333.33 : 0,
      paidInterest: isPaid ? 666.67 : 0,
      paidServiceFee: isPaid ? 250 : 0,
      status: isPaid ? 'PAID' : (i <= 6 ? 'OVERDUE' : 'PENDING'),
      isEarlySettled: false,
    });
  }
  repository.saveFlows('HT20240001', flows1);

  const overdues1: OverdueRecord[] = [
    {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      recordNo: 'OVERDUE-001',
      contractNo: 'HT20240001',
      termNo: 6,
      overdueDays: { original: 15, final: 15 },
      overdueAmount: { original: 8333.33, final: 8333.33 },
      penaltyRate: 0.0005,
      penaltyAmount: { original: 62.5, final: 62.5 },
      status: 'ACTIVE',
    },
  ];
  repository.saveOverdues('HT20240001', overdues1);

  const contract2: InstallmentContract = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
    contractNo: 'HT20240002',
    customerName: '李四',
    customerId: 'CUST002',
    principal: { original: 50000, final: 50000 },
    totalAmount: 55000,
    termCount: 6,
    termUnit: 'MONTH',
    annualInterestRate: 0.07,
    serviceFeeRate: 0.02,
    startDate: dayjs().subtract(3, 'month').toISOString(),
    endDate: dayjs().add(3, 'month').toISOString(),
    status: 'NORMAL',
  };
  repository.saveContract(contract2);

  const flows2: RepaymentFlow[] = [];
  for (let i = 1; i <= 6; i++) {
    const isPaid = i <= 3;
    flows2.push({
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      flowNo: `FLOW2-${i}`,
      contractNo: 'HT20240002',
      termNo: i,
      dueDate: dayjs().add(i - 4, 'month').toISOString(),
      paymentDate: isPaid ? dayjs().add(i - 4, 'month').toISOString() : undefined,
      payablePrincipal: { original: 8333.33, final: 8333.33 },
      payableInterest: { original: 291.67, final: 291.67 },
      payableServiceFee: { original: 166.67, final: 166.67 },
      paidPrincipal: isPaid ? 8333.33 : 0,
      paidInterest: isPaid ? 291.67 : 0,
      paidServiceFee: isPaid ? 166.67 : 0,
      status: isPaid ? 'PAID' : 'PENDING',
      isEarlySettled: false,
    });
  }
  repository.saveFlows('HT20240002', flows2);
  repository.saveOverdues('HT20240002', []);

  const contract3: InstallmentContract = {
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
    createdBy: 'system',
    updatedBy: 'system',
    contractNo: 'HT20240003',
    customerName: '王五',
    customerId: 'CUST003',
    principal: { original: 80000, final: 80000 },
    totalAmount: 88000,
    termCount: 24,
    termUnit: 'MONTH',
    annualInterestRate: 0.075,
    serviceFeeRate: 0.025,
    startDate: dayjs().subtract(12, 'month').toISOString(),
    endDate: dayjs().add(12, 'month').toISOString(),
    status: 'OVERDUE',
  };
  repository.saveContract(contract3);

  const flows3: RepaymentFlow[] = [];
  for (let i = 1; i <= 24; i++) {
    const isPaid = i <= 10;
    flows3.push({
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      flowNo: `FLOW3-${i}`,
      contractNo: 'HT20240003',
      termNo: i,
      dueDate: dayjs().add(i - 13, 'month').toISOString(),
      paymentDate: isPaid ? dayjs().add(i - 13, 'month').toISOString() : undefined,
      payablePrincipal: { original: 3333.33, final: 3333.33 },
      payableInterest: { original: 500, final: 500 },
      payableServiceFee: { original: 83.33, final: 83.33 },
      paidPrincipal: isPaid ? 3333.33 : 0,
      paidInterest: isPaid ? 500 : 0,
      paidServiceFee: isPaid ? 83.33 : 0,
      status: isPaid ? 'PAID' : (i <= 12 ? 'OVERDUE' : 'PENDING'),
      isEarlySettled: false,
    });
  }
  repository.saveFlows('HT20240003', flows3);

  const overdues3: OverdueRecord[] = [
    {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      recordNo: 'OVERDUE-002',
      contractNo: 'HT20240003',
      termNo: 11,
      overdueDays: { original: 45, final: 45 },
      overdueAmount: { original: 3333.33, final: 3333.33 },
      penaltyRate: 0.0005,
      penaltyAmount: { original: 75, final: 75 },
      status: 'ACTIVE',
    },
    {
      id: uuidv4(),
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
      updatedBy: 'system',
      recordNo: 'OVERDUE-003',
      contractNo: 'HT20240003',
      termNo: 12,
      overdueDays: { original: 15, final: 15 },
      overdueAmount: { original: 3333.33, final: 3333.33 },
      penaltyRate: 0.0005,
      penaltyAmount: { original: 25, final: 25 },
      status: 'ACTIVE',
    },
  ];
  repository.saveOverdues('HT20240003', overdues3);

  console.log('演示数据已初始化');
  console.log('可用合同编号: HT20240001 (张三), HT20240002 (李四), HT20240003 (王五)');
}

app.listen(PORT, () => {
  console.log(`服务器已启动: http://localhost:${PORT}`);
  initDemoData();
});
