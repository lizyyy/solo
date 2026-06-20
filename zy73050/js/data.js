// ============================================================
// 塔吊维保工单回放 - 数据模型与常量
// 实际数据由后端 FastAPI + SQLite 加载（见 server.py /data/workorders.db）
// ============================================================

const STATUS = {
  CONFIRMED: 'confirmed',
  PENDING: 'pending',
  RETURNED: 'returned',
};

const STATUS_LABEL = {
  confirmed: '已确认',
  pending: '待补件',
  returned: '退回',
};

let WORKORDERS = [];
