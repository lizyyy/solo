module.exports = {
  port: process.env.PORT || 3000,
  dbPath: process.env.DB_PATH || './seal_risk.db',
  riskThreshold: {
    amount: 1000000,
  },
  sealTypes: {
    COMPANY_SEAL: '公司公章',
    CONTRACT_SEAL: '合同专用章',
    FINANCIAL_SEAL: '财务专用章',
    LEGAL_SEAL: '法人章',
  },
  contractCategories: {
    SALES: '销售合同',
    PURCHASE: '采购合同',
    SERVICE: '服务合同',
    COOPERATION: '合作协议',
  },
  approvalStatus: {
    DRAFT: '草稿',
    PENDING: '待审批',
    APPROVING: '审批中',
    APPROVED: '审批通过',
    REJECTED: '已驳回',
    WITHDRAWN: '已撤回',
    SEALED: '已用章',
    CANCELLED: '已取消',
  },
  riskLevels: {
    LOW: '低风险',
    MEDIUM: '中风险',
    HIGH: '高风险',
    CRITICAL: '严重风险',
  },
};
