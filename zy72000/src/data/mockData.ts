import type { FundRedemption } from '@/types';

export const mockRedemptions: FundRedemption[] = [
  {
    id: '1',
    fundCode: '000001',
    fundName: '华夏成长混合',
    applyAmount: 500000.00,
    applyDate: '2026-05-20',
    expectArriveDate: '2026-05-26',
    applicant: '张三',
    status: 'confirmed',
    queueReason: '大额赎回需预约排队，渠道确认额度充足',
    materials: [
      {
        id: 'm1-1',
        type: 'receipt',
        amount: 500000.00,
        date: '2026-05-20',
        content: '招商银行收款流水，流水号：CMB202605200001，金额¥500,000.00，付款方：张三',
        source: '招商银行网银系统'
      },
      {
        id: 'm1-2',
        type: 'refund',
        amount: 500000.00,
        date: '2026-05-20',
        content: '退款申请单，申请编号：RF20260520001，原交易：基金申购，退款原因：预约赎回',
        source: '业务系统'
      },
      {
        id: 'm1-3',
        type: 'email',
        amount: 500000.00,
        date: '2026-05-20',
        content: '审批邮件：同意000001华夏成长50万元赎回预约，预计5月26日到账，请财务部配合划款。发送人：李总',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm1-4',
        type: 'import',
        amount: 500000.00,
        date: '2026-05-20',
        content: '系统导入数据：基金代码000001，赎回金额500000.00，申请日期2026-05-20',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r1-1',
        content: '材料齐全，金额日期均一致，已确认入账',
        operator: '阿宁',
        createdAt: '2026-05-21 10:30:00'
      }
    ],
    operationLogs: [
      {
        id: 'o1-1',
        action: 'confirm',
        fromStatus: undefined,
        toStatus: 'confirmed',
        reason: '材料齐全一致',
        operator: '阿宁',
        createdAt: '2026-05-21 10:30:00'
      }
    ],
    createdAt: '2026-05-20 15:00:00',
    updatedAt: '2026-05-21 10:30:00'
  },
  {
    id: '2',
    fundCode: '110011',
    fundName: '易方达中小盘混合',
    applyAmount: 320000.00,
    applyDate: '2026-05-21',
    expectArriveDate: '2026-05-27',
    applicant: '李四',
    status: 'pending',
    queueReason: '客户资金调拨需求，需提前锁定赎回份额',
    materials: [
      {
        id: 'm2-2',
        type: 'refund',
        amount: 320000.00,
        date: '2026-05-21',
        content: '退款申请单，申请编号：RF20260521001，原交易：基金申购，退款原因：客户资金需求',
        source: '业务系统'
      },
      {
        id: 'm2-3',
        type: 'email',
        amount: 320000.00,
        date: '2026-05-21',
        content: '审批邮件：同意110011易方达中小盘32万元赎回预约，请财务部跟进。发送人：王经理',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm2-4',
        type: 'import',
        amount: 320000.00,
        date: '2026-05-21',
        content: '系统导入数据：基金代码110011，赎回金额320000.00，申请日期2026-05-21',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r2-1',
        content: '缺收款流水，已催渠道提供，预计明天上午能补上',
        operator: '阿宁',
        createdAt: '2026-05-22 09:15:00'
      }
    ],
    operationLogs: [
      {
        id: 'o2-1',
        action: 'pending',
        fromStatus: undefined,
        toStatus: 'pending',
        reason: '缺少收款流水凭证',
        operator: '阿宁',
        createdAt: '2026-05-22 09:15:00'
      }
    ],
    createdAt: '2026-05-21 11:30:00',
    updatedAt: '2026-05-22 09:15:00'
  },
  {
    id: '3',
    fundCode: '161725',
    fundName: '招商中证白酒指数',
    applyAmount: 180000.00,
    applyDate: '2026-05-22',
    expectArriveDate: '2026-05-28',
    applicant: '王五',
    status: 'pending',
    queueReason: '定投止盈赎回，分批到账',
    materials: [
      {
        id: 'm3-1',
        type: 'receipt',
        amount: 180000.00,
        date: '2026-05-22',
        content: '工商银行收款流水，流水号：ICBC202605220008，金额¥180,000.00，付款方：王五',
        source: '工商银行网银系统'
      },
      {
        id: 'm3-3',
        type: 'email',
        amount: 180000.00,
        date: '2026-05-22',
        content: '审批邮件：同意161725招商中证白酒18万元赎回预约，客户定投止盈。发送人：李总',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm3-4',
        type: 'import',
        amount: 180000.00,
        date: '2026-05-22',
        content: '系统导入数据：基金代码161725，赎回金额180000.00，申请日期2026-05-22',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r3-1',
        content: '缺退款申请单，已让业务同事补走流程',
        operator: '阿宁',
        createdAt: '2026-05-22 16:45:00'
      }
    ],
    operationLogs: [
      {
        id: 'o3-1',
        action: 'pending',
        fromStatus: undefined,
        toStatus: 'pending',
        reason: '缺少退款申请凭证',
        operator: '阿宁',
        createdAt: '2026-05-22 16:45:00'
      }
    ],
    createdAt: '2026-05-22 14:20:00',
    updatedAt: '2026-05-22 16:45:00'
  },
  {
    id: '4',
    fundCode: '005827',
    fundName: '易方达蓝筹精选混合',
    applyAmount: 480000.00,
    applyDate: '2026-05-19',
    expectArriveDate: '2026-05-25',
    applicant: '赵六',
    status: 'manual',
    queueReason: '季度末大额赎回，渠道额度紧张需排队',
    materials: [
      {
        id: 'm4-1',
        type: 'receipt',
        amount: 480000.00,
        date: '2026-05-19',
        content: '建设银行收款流水，流水号：CCB202605190015，金额¥480,000.00，付款方：赵六',
        source: '建设银行网银系统'
      },
      {
        id: 'm4-2',
        type: 'refund',
        amount: 480000.00,
        date: '2026-05-19',
        content: '退款申请单，申请编号：RF20260519003，原交易：基金申购，退款原因：季度赎回',
        source: '业务系统'
      },
      {
        id: 'm4-3',
        type: 'email',
        amount: 500000.00,
        date: '2026-05-19',
        content: '审批邮件：同意005827易方达蓝筹50万元赎回预约，季度末资金安排。发送人：张总监',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm4-4',
        type: 'import',
        amount: 480000.00,
        date: '2026-05-19',
        content: '系统导入数据：基金代码005827，赎回金额480000.00，申请日期2026-05-19',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r4-1',
        content: '邮件写50万但流水和系统都是48万，已发邮件和张总监确认，待回复后处理',
        operator: '阿宁',
        createdAt: '2026-05-20 14:20:00'
      }
    ],
    operationLogs: [
      {
        id: 'o4-1',
        action: 'manual',
        fromStatus: undefined,
        toStatus: 'manual',
        reason: '金额冲突：邮件50万 vs 导入48万，差异¥20,000.00',
        operator: '阿宁',
        createdAt: '2026-05-20 14:20:00'
      }
    ],
    createdAt: '2026-05-19 16:00:00',
    updatedAt: '2026-05-20 14:20:00'
  },
  {
    id: '5',
    fundCode: '519674',
    fundName: '银河创新成长混合',
    applyAmount: 250000.00,
    applyDate: '2026-05-18',
    expectArriveDate: '2026-05-24',
    applicant: '孙七',
    status: 'manual',
    queueReason: '客户购房资金需求，提前赎回',
    materials: [
      {
        id: 'm5-1',
        type: 'receipt',
        amount: 250000.00,
        date: '2026-05-18',
        content: '农业银行收款流水，流水号：ABC202605180023，金额¥250,000.00，付款方：孙七',
        source: '农业银行网银系统'
      },
      {
        id: 'm5-2',
        type: 'refund',
        amount: 250000.00,
        date: '2026-05-18',
        content: '退款申请单，申请编号：RF20260518005，原交易：基金申购，退款原因：购房资金',
        source: '业务系统'
      },
      {
        id: 'm5-3',
        type: 'email',
        amount: 250000.00,
        date: '2026-05-17',
        content: '审批邮件：同意519674银河创新25万元赎回预约，客户购房首付急用。发送人：王经理',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm5-4',
        type: 'import',
        amount: 250000.00,
        date: '2026-05-18',
        content: '系统导入数据：基金代码519674，赎回金额250000.00，申请日期2026-05-18',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r5-1',
        content: '邮件日期是5月17日，但流水和系统都是5月18日，可能是前一天晚上提交的，需要和渠道确认实际交易日',
        operator: '阿宁',
        createdAt: '2026-05-19 11:00:00'
      }
    ],
    operationLogs: [
      {
        id: 'o5-1',
        action: 'manual',
        fromStatus: undefined,
        toStatus: 'manual',
        reason: '日期冲突：邮件5月17日 vs 导入5月18日',
        operator: '阿宁',
        createdAt: '2026-05-19 11:00:00'
      }
    ],
    createdAt: '2026-05-18 10:30:00',
    updatedAt: '2026-05-19 11:00:00'
  },
  {
    id: '6',
    fundCode: '003834',
    fundName: '华夏能源革新股票',
    applyAmount: 150000.00,
    applyDate: '2026-05-23',
    expectArriveDate: '2026-05-29',
    applicant: '周八',
    status: 'confirmed',
    queueReason: '基金分红前赎回，避税安排',
    materials: [
      {
        id: 'm6-1',
        type: 'receipt',
        amount: 150000.00,
        date: '2026-05-23',
        content: '中国银行收款流水，流水号：BOC202605230005，金额¥150,000.00，付款方：周八',
        source: '中国银行网银系统'
      },
      {
        id: 'm6-2',
        type: 'refund',
        amount: 150000.00,
        date: '2026-05-23',
        content: '退款申请单，申请编号：RF20260523002，原交易：基金申购，退款原因：分红前赎回',
        source: '业务系统'
      },
      {
        id: 'm6-3',
        type: 'email',
        amount: 150000.00,
        date: '2026-05-23',
        content: '审批邮件：同意003834华夏能源15万元赎回预约，分红避税安排。发送人：李总',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm6-4',
        type: 'import',
        amount: 150000.00,
        date: '2026-05-23',
        content: '系统导入数据：基金代码003834，赎回金额150000.00，申请日期2026-05-23',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r6-1',
        content: '材料齐全，金额日期均一致，已确认',
        operator: '阿宁',
        createdAt: '2026-05-23 15:30:00'
      },
      {
        id: 'r6-2',
        content: '客户追加备注：这笔是税务筹划的一部分，到账后请及时通知理财经理',
        operator: '阿宁',
        createdAt: '2026-05-23 15:45:00'
      }
    ],
    operationLogs: [
      {
        id: 'o6-1',
        action: 'confirm',
        fromStatus: undefined,
        toStatus: 'confirmed',
        reason: '材料齐全一致',
        operator: '阿宁',
        createdAt: '2026-05-23 15:30:00'
      }
    ],
    createdAt: '2026-05-23 14:00:00',
    updatedAt: '2026-05-23 15:45:00'
  },
  {
    id: '7',
    fundCode: '001938',
    fundName: '中欧时代先锋股票',
    applyAmount: 420000.00,
    applyDate: '2026-05-15',
    expectArriveDate: '2026-05-21',
    applicant: '吴九',
    status: 'manual',
    queueReason: '多笔赎回合并处理，金额有尾差',
    materials: [
      {
        id: 'm7-1',
        type: 'receipt',
        amount: 421500.80,
        date: '2026-05-15',
        content: '交通银行收款流水，流水号：BOCOM202605150012，金额¥421,500.80，付款方：吴九',
        source: '交通银行网银系统'
      },
      {
        id: 'm7-2',
        type: 'refund',
        amount: 420000.00,
        date: '2026-05-15',
        content: '退款申请单，申请编号：RF20260515007，原交易：多笔基金申购合并，退款原因：资金归集',
        source: '业务系统'
      },
      {
        id: 'm7-3',
        type: 'email',
        amount: 420000.00,
        date: '2026-05-15',
        content: '审批邮件：同意001938中欧时代42万元赎回预约，客户多笔合并。发送人：张总监',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm7-4',
        type: 'import',
        amount: 420000.00,
        date: '2026-05-15',
        content: '系统导入数据：基金代码001938，赎回金额420000.00，申请日期2026-05-15',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'm7-1',
        content: '收款流水比申请金额多¥1,500.80，经查是之前的利息结余一起划过来了，需要拆分入账，先挂人工改判',
        operator: '阿宁',
        createdAt: '2026-05-16 10:00:00'
      },
      {
        id: 'r7-2',
        content: '已和理财经理确认，差额确实是历史利息，准备明天改判为已确认，差额部分入利息收入',
        operator: '阿宁',
        createdAt: '2026-05-16 16:30:00'
      }
    ],
    operationLogs: [
      {
        id: 'o7-1',
        action: 'manual',
        fromStatus: undefined,
        toStatus: 'manual',
        reason: '金额冲突：流水¥421,500.80 vs 其他¥420,000.00，差异¥1,500.80',
        operator: '阿宁',
        createdAt: '2026-05-16 10:00:00'
      }
    ],
    createdAt: '2026-05-15 13:45:00',
    updatedAt: '2026-05-16 16:30:00'
  },
  {
    id: '8',
    fundCode: '320007',
    fundName: '诺安成长混合',
    applyAmount: 280000.00,
    applyDate: '2026-05-24',
    expectArriveDate: '2026-05-30',
    applicant: '郑十',
    status: 'pending',
    queueReason: '基金调仓需求，先赎回再申购其他',
    materials: [
      {
        id: 'm8-3',
        type: 'email',
        amount: 280000.00,
        date: '2026-05-24',
        content: '审批邮件：同意320007诺安成长28万元赎回预约，客户调仓需求。发送人：王经理',
        source: 'Outlook邮件审批'
      },
      {
        id: 'm8-4',
        type: 'import',
        amount: 280000.00,
        date: '2026-05-24',
        content: '系统导入数据：基金代码320007，赎回金额280000.00，申请日期2026-05-24',
        source: '基金TA系统导入'
      }
    ],
    remarks: [
      {
        id: 'r8-1',
        content: '收款流水和退款申请都缺，刚收到邮件，让业务那边尽快补',
        operator: '阿宁',
        createdAt: '2026-05-24 17:00:00'
      }
    ],
    operationLogs: [
      {
        id: 'o8-1',
        action: 'pending',
        fromStatus: undefined,
        toStatus: 'pending',
        reason: '缺少收款流水和退款申请两项凭证',
        operator: '阿宁',
        createdAt: '2026-05-24 17:00:00'
      }
    ],
    createdAt: '2026-05-24 16:30:00',
    updatedAt: '2026-05-24 17:00:00'
  }
];
