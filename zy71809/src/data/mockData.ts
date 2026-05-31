import type { Receipt, ChangeRecord, ExportRecord } from "@/types"

function d(offset: number): string {
  const date = new Date()
  date.setDate(date.getDate() + offset)
  return date.toISOString().slice(0, 10)
}

function ts(daysAgo: number, hour: number, minute: number): string {
  const date = new Date()
  date.setDate(date.getDate() - daysAgo)
  date.setHours(hour, minute, 0, 0)
  return date.toISOString()
}

export const mockReceipts: Receipt[] = [
  {
    id: "R001",
    channelName: "华东代理A",
    transactionNo: "TXN20260528001",
    amount: 125000.00,
    status: "approved",
    frozenAmount: 0,
    frozenDays: 0,
    frozenReleased: true,
    createdAt: ts(3, 9, 15),
    updatedAt: ts(3, 14, 30),
    reportDate: d(-3),
    remark: "5月28日华东区正常返佣",
    transactions: [
      {
        id: "TX001",
        receiptId: "R001",
        fields: {
          账户名称: { value: "华东代理A有限公司", originalValue: "华东代理A有限公司", modified: false },
          返佣比例: { value: "2.5%", originalValue: "2.5%", modified: false },
          返佣金额: { value: "125000.00", originalValue: "125000.00", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6222****5678", originalValue: "6222****5678", modified: false },
          开户行: { value: "工商银行上海分行", originalValue: "工商银行上海分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(3, 9, 15), operator: "系统", remark: "复核日报导入" },
      { status: "reviewing", timestamp: ts(3, 10, 20), operator: "张运营", remark: "开始复核" },
      { status: "approved", timestamp: ts(3, 14, 30), operator: "张运营", remark: "复核通过" },
    ],
  },
  {
    id: "R002",
    channelName: "华南渠道B",
    transactionNo: "TXN20260528002",
    amount: 87500.50,
    status: "exception",
    frozenAmount: 87500.50,
    frozenDays: 3,
    frozenReleased: false,
    createdAt: ts(3, 9, 15),
    updatedAt: ts(2, 16, 45),
    reportDate: d(-3),
    remark: "金额与台账不一致，待确认",
    transactions: [
      {
        id: "TX002",
        receiptId: "R002",
        fields: {
          账户名称: { value: "华南渠道B贸易有限公司", originalValue: "华南渠道B贸易有限公司", modified: false },
          返佣比例: { value: "1.8%", originalValue: "2.0%", modified: true, modifiedAt: ts(2, 16, 45) },
          返佣金额: { value: "87500.50", originalValue: "87500.50", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6228****1234", originalValue: "6228****1234", modified: false },
          开户行: { value: "建设银行深圳分行", originalValue: "建设银行深圳分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(3, 9, 15), operator: "系统", remark: "复核日报导入" },
      { status: "reviewing", timestamp: ts(3, 11, 0), operator: "李风控", remark: "开始复核" },
      { status: "exception", timestamp: ts(2, 16, 45), operator: "李风控", remark: "返佣比例与合同不一致，手动修正" },
    ],
  },
  {
    id: "R003",
    channelName: "华北代理C",
    transactionNo: "TXN20260529001",
    amount: 230000.00,
    status: "pending",
    frozenAmount: 230000.00,
    frozenDays: 2,
    frozenReleased: false,
    createdAt: ts(2, 9, 10),
    updatedAt: ts(2, 9, 10),
    reportDate: d(-2),
    remark: "",
    transactions: [
      {
        id: "TX003",
        receiptId: "R003",
        fields: {
          账户名称: { value: "华北代理C科技股份", originalValue: "华北代理C科技股份", modified: false },
          返佣比例: { value: "3.0%", originalValue: "3.0%", modified: false },
          返佣金额: { value: "230000.00", originalValue: "230000.00", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6217****9876", originalValue: "6217****9876", modified: false },
          开户行: { value: "农业银行北京分行", originalValue: "农业银行北京分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(2, 9, 10), operator: "系统", remark: "复核日报导入" },
    ],
  },
  {
    id: "R004",
    channelName: "西南渠道D",
    transactionNo: "TXN20260529002",
    amount: 56000.00,
    status: "rejected",
    frozenAmount: 0,
    frozenDays: 0,
    frozenReleased: true,
    createdAt: ts(2, 9, 10),
    updatedAt: ts(1, 11, 20),
    reportDate: d(-2),
    remark: "渠道资质过期，驳回处理",
    transactions: [
      {
        id: "TX004",
        receiptId: "R004",
        fields: {
          账户名称: { value: "西南渠道D咨询服务", originalValue: "西南渠道D咨询服务", modified: false },
          返佣比例: { value: "1.5%", originalValue: "1.5%", modified: false },
          返佣金额: { value: "56000.00", originalValue: "56000.00", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6225****4321", originalValue: "6225****4321", modified: false },
          开户行: { value: "中国银行成都分行", originalValue: "中国银行成都分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(2, 9, 10), operator: "系统", remark: "复核日报导入" },
      { status: "reviewing", timestamp: ts(1, 10, 0), operator: "王运营", remark: "开始复核" },
      { status: "rejected", timestamp: ts(1, 11, 20), operator: "王运营", remark: "渠道资质过期，驳回" },
    ],
  },
  {
    id: "R005",
    channelName: "华东代理A",
    transactionNo: "TXN20260530001",
    amount: 98000.00,
    status: "reviewing",
    frozenAmount: 98000.00,
    frozenDays: 1,
    frozenReleased: false,
    createdAt: ts(1, 9, 5),
    updatedAt: ts(1, 10, 30),
    reportDate: d(-1),
    remark: "5月30日华东区返佣，复核中",
    transactions: [
      {
        id: "TX005",
        receiptId: "R005",
        fields: {
          账户名称: { value: "华东代理A有限公司", originalValue: "华东代理A有限公司", modified: false },
          返佣比例: { value: "2.5%", originalValue: "2.5%", modified: false },
          返佣金额: { value: "98000.00", originalValue: "98000.00", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6222****5678", originalValue: "6222****5678", modified: false },
          开户行: { value: "工商银行上海分行", originalValue: "工商银行上海分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(1, 9, 5), operator: "系统", remark: "复核日报导入" },
      { status: "reviewing", timestamp: ts(1, 10, 30), operator: "张运营", remark: "开始复核" },
    ],
  },
  {
    id: "R006",
    channelName: "中部渠道E",
    transactionNo: "TXN20260530002",
    amount: 156000.75,
    status: "approved",
    frozenAmount: 0,
    frozenDays: 0,
    frozenReleased: true,
    createdAt: ts(1, 9, 5),
    updatedAt: ts(0, 15, 10),
    reportDate: d(-1),
    remark: "",
    transactions: [
      {
        id: "TX006",
        receiptId: "R006",
        fields: {
          账户名称: { value: "中部渠道E商贸有限公司", originalValue: "中部渠道E商贸有限公司", modified: false },
          返佣比例: { value: "2.0%", originalValue: "2.0%", modified: false },
          返佣金额: { value: "156000.75", originalValue: "156000.75", modified: false },
          结算周期: { value: "2026-05", originalValue: "2026-05", modified: false },
          银行账号: { value: "6226****7890", originalValue: "6226****7890", modified: false },
          开户行: { value: "招商银行武汉分行", originalValue: "招商银行武汉分行", modified: false },
        },
      },
    ],
    statusTimeline: [
      { status: "pending", timestamp: ts(1, 9, 5), operator: "系统", remark: "复核日报导入" },
      { status: "reviewing", timestamp: ts(1, 11, 0), operator: "李风控", remark: "开始复核" },
      { status: "approved", timestamp: ts(0, 15, 10), operator: "李风控", remark: "复核通过" },
    ],
  },
]

export const mockChangeHistories: ChangeRecord[] = [
  {
    id: "CH001",
    receiptId: "R002",
    transactionId: "TX002",
    fieldName: "返佣比例",
    oldValue: "2.0%",
    newValue: "1.8%",
    operator: "李风控",
    timestamp: ts(2, 16, 45),
  },
]

export const mockExportRecords: ExportRecord[] = [
  {
    id: "EXP001",
    timestamp: ts(1, 17, 0),
    operator: "张运营",
    receiptCount: 2,
    receiptIds: ["R001", "R002"],
  },
]
