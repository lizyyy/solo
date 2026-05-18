import { RepairFundInvoice } from '../types';

export const normalInvoice: Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
  invoiceNo: 'WXJJ-2024-001',
  communityName: '阳光花园小区',
  ownerName: '张三',
  houseNumber: '1栋2单元301室',
  repairItem: '电梯维护保养',
  paymentAmount: 5000.00,
  invoiceAmount: 5000.00,
  invoiceDate: '2024-01-15',
  handler: '李四',
  reviewer: '王五',
  status: 'approved',
  remark: '2024年第一季度电梯维护费用'
};

export const conflictInvoice: Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
  invoiceNo: 'WXJJ-2024-001',
  communityName: '和谐家园小区',
  ownerName: '赵六',
  houseNumber: '2栋1单元102室',
  repairItem: '消防设施检测',
  paymentAmount: 3000.00,
  invoiceAmount: 3000.00,
  invoiceDate: '2024-02-20',
  handler: '孙七',
  reviewer: '周八',
  status: 'pending',
  remark: '年度消防检测费用'
};

export const amountMismatchInvoice: Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'> = {
  invoiceNo: 'WXJJ-2024-002',
  communityName: '幸福里小区',
  ownerName: '钱九',
  houseNumber: '3栋3单元501室',
  repairItem: '给排水管道维修',
  paymentAmount: 8000.00,
  invoiceAmount: 7500.00,
  invoiceDate: '2024-03-10',
  handler: '吴十',
  reviewer: '郑十一',
  status: 'pending',
  remark: '付款金额与票据金额不一致的测试数据'
};

export const invalidInvoice: Partial<RepairFundInvoice> = {
  invoiceNo: '',
  communityName: '',
  ownerName: '陈十二',
  houseNumber: '4栋2单元402室',
  repairItem: '门禁系统升级',
  paymentAmount: -1000.00,
  invoiceAmount: 0,
  invoiceDate: '2024/04/05',
  handler: '',
  reviewer: '黄十三',
  status: 'unknown'
};

export const sampleInvoices: Omit<RepairFundInvoice, 'id' | 'createdAt' | 'updatedAt'>[] = [
  {
    invoiceNo: 'WXJJ-2024-003',
    communityName: '锦绣江南小区',
    ownerName: '林十四',
    houseNumber: '5栋1单元201室',
    repairItem: '绿化养护工程',
    paymentAmount: 12000.00,
    invoiceAmount: 12000.00,
    invoiceDate: '2024-04-15',
    handler: '杨十五',
    reviewer: '朱十六',
    status: 'approved',
    remark: '2024年上半年绿化养护费用'
  },
  {
    invoiceNo: 'WXJJ-2024-004',
    communityName: '东方明珠小区',
    ownerName: '何十七',
    houseNumber: '6栋3单元602室',
    repairItem: '监控设备更新',
    paymentAmount: 25000.00,
    invoiceAmount: 25000.00,
    invoiceDate: '2024-05-20',
    handler: '高十八',
    reviewer: '罗十九',
    status: 'pending',
    remark: '园区监控系统升级改造'
  },
  {
    invoiceNo: 'WXJJ-2024-005',
    communityName: '西湖花园小区',
    ownerName: '梁二十',
    houseNumber: '7栋2单元303室',
    repairItem: '外墙防水维修',
    paymentAmount: 18000.00,
    invoiceAmount: 18000.00,
    invoiceDate: '2024-06-10',
    handler: '宋二十一',
    reviewer: '唐二十二',
    status: 'rejected',
    remark: '维修方案需重新评估'
  }
];

export const importTestData = {
  validData: [
    {
      invoiceNo: 'WXJJ-2024-006',
      communityName: '滨江花园小区',
      ownerName: '许二十三',
      houseNumber: '8栋1单元101室',
      repairItem: '公共区域照明更新',
      paymentAmount: 6500.00,
      invoiceAmount: 6500.00,
      invoiceDate: '2024-07-05',
      handler: '邓二十四',
      reviewer: '冯二十五',
      status: 'approved' as const,
      remark: '楼道LED灯具更换'
    }
  ],
  withBadRows: [
    {
      invoiceNo: 'WXJJ-2024-007',
      communityName: '世纪花园小区',
      ownerName: '曹二十六',
      houseNumber: '9栋2单元401室',
      repairItem: '化粪池清理',
      paymentAmount: 4000.00,
      invoiceAmount: 4000.00,
      invoiceDate: '2024-08-15',
      handler: '彭二十七',
      reviewer: '曾二十八',
      status: 'approved' as const
    },
    {
      invoiceNo: '',
      communityName: '',
      ownerName: '萧二十九',
      houseNumber: '10栋3单元502室',
      repairItem: '健身器材维护',
      paymentAmount: -500.00,
      invoiceAmount: 2000.00,
      invoiceDate: '20240910',
      handler: '',
      reviewer: '尹三十',
      status: 'invalid'
    },
    {
      invoiceNo: 'WXJJ-2024-008',
      communityName: '翡翠城小区',
      ownerName: '姚三十一',
      houseNumber: '11栋1单元202室',
      repairItem: '儿童游乐设施更新',
      paymentAmount: 8500.00,
      invoiceAmount: 8500.00,
      invoiceDate: '2024-09-20',
      handler: '邵三十二',
      reviewer: '汪三十三',
      status: 'pending' as const,
      remark: '滑梯和秋千设备更新'
    }
  ]
};
