module.exports = {
  PORT: 3001,
  RATES: {
    BASE_RATE: 50,
    RATE_PER_KM: 3,
    WAITING_RATE_PER_MINUTE: 2,
    WAITING_GRACE_MINUTES: 15,
    CANCELLATION: {
      BEFORE_DISPATCH: 0,
      AFTER_DISPATCH: 30,
      AFTER_ARRIVAL: 80
    },
    INTERCITY: {
      APPROVAL_THRESHOLD_KM: 100,
      PER_DIEM_FEE: 200,
      HIGHWAY_FEE_MULTIPLIER: 1.5
    },
    DRIVER_COMMISSION_RATE: 0.7
  },
  DEPARTMENTS: {
    SALES: '销售部',
    TECH: '技术部',
    HR: '人事部',
    FINANCE: '财务部',
    ADMIN: '行政部'
  },
  TRIP_STATUS: {
    PENDING: '待派单',
    DISPATCHED: '已派单',
    DRIVER_ARRIVED: '司机已到达',
    IN_PROGRESS: '行程中',
    COMPLETED: '已完成',
    CANCELLED: '已取消'
  },
  APPROVAL_STATUS: {
    NOT_REQUIRED: '无需审批',
    PENDING: '待审批',
    APPROVED: '已批准',
    REJECTED: '已拒绝'
  }
};
