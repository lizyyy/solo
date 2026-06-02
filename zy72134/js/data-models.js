// ========== 数据模型定义 ==========
// 注意：所有常量只通过 window.DataModels 导出，避免全局作用域污染
(function() {
  // 押金规则（可以调）
  const DEPOSIT_RULES = {
    baseDeposit: 200,           // 基础押金
    oldMasterPenalty: 50,       // 旧版母带扣款
    unauthorizedPenalty: 100,   // 未授权扣款
    duplicatePenalty: 30,       // 重复曲目扣款（警告性）
    latePenaltyPerHour: 20,     // 超时每小时扣款
    maxPenalty: 200             // 最高扣款不超过押金
  };

  // 状态枚举
  const STATUS = {
    PENDING: 'pending',         // 待处理
    CONFIRMED: 'confirmed',     // 已确认
    NEEDS_REVIEW: 'needs_review', // 需人工确认
    SETTLED: 'settled',         // 已结算
    ERROR: 'error'              // 处理出错
  };

  // 异常类型
  const ANOMALY_TYPES = {
    OLD_MASTER: 'old_master',           // 旧版母带
    DUPLICATE: 'duplicate',             // 重复曲目
    UNAUTHORIZED: 'unauthorized',       // 缺授权
    EMPTY_FIELD: 'empty_field',         // 空值
    RENAMED: 'renamed',                 // 人工改名
    BOUNDARY: 'boundary',               // 边界记录
    CORRUPT_FILE: 'corrupt_file',       // 损坏文件
    OLD_STANDARD: 'old_standard'        // 旧口径（从排练群截图补的）
  };

  // 状态显示文本（同事间口语化
  const STATUS_LABELS = {
    pending: '待处理',
    confirmed: '正常过',
    needs_review: '等人工拍板',
    settled: '已结算',
    error: '这条崩了'
  };

  // 异常显示文本
  const ANOMALY_LABELS = {
    old_master: '旧版母带',
    duplicate: '重复报了',
    unauthorized: '缺授权',
    empty_field: '有地方空着',
    renamed: '人工改过名',
    boundary: '边界情况',
    corrupt_file: '文件读不了',
    old_standard: '群截图旧口径'
  };

  // 异常严重程度
  const SEVERITY = {
    WARN: 'warn',
    ERROR: 'error',
    REVIEW: 'review'
  };

  // ========== 工厂函数 ==========
  function createTrackRecord(data = {}) {
    const now = new Date().toISOString();
    return {
      id: data.id || generateId(),
      fileName: data.fileName || '',
      trackName: data.trackName || '',
      artist: data.artist || '',
      teacher: data.teacher || '林老师',
      durationMinutes: data.durationMinutes || 0,
      roomNumber: data.roomNumber || '',
      bookingDate: data.bookingDate || '',
      bookingTime: data.bookingTime || '',
      depositAmount: data.depositAmount || DEPOSIT_RULES.baseDeposit,
      licenseStatus: data.licenseStatus || 'pending',
      isOldMaster: data.isOldMaster || false,
      isRenamed: data.isRenamed || false,
      source: data.source || 'system',
      sourceNote: data.sourceNote || '',
      annotations: data.annotations || [],
      anomalies: data.anomalies || [],
      settlement: data.settlement || null,
      status: data.status || STATUS.PENDING,
      createdAt: data.createdAt || now,
      processedBy: data.processedBy || '',
      processedAt: data.processedAt || '',
      version: data.version || 1,
      processingNotes: data.processingNotes || [],
      rawData: data.rawData || null
    };
  }

  function createAnnotation(content, type = 'manual', author = '当前处理人') {
    return {
      id: generateId(),
      content: content,
      author: author,
      timestamp: new Date().toISOString(),
      type: type
    };
  }

  function createAnomaly(type, reason, relatedField = '', severity = SEVERITY.WARN) {
    return {
      id: generateId(),
      type: type,
      reason: reason,
      severity: severity,
      relatedField: relatedField,
      resolved: false,
      resolutionNote: ''
    };
  }

  function createSettlement(trackId) {
    return {
      id: generateId(),
      trackId: trackId,
      originalDeposit: DEPOSIT_RULES.baseDeposit,
      deductions: [],
      refundAmount: DEPOSIT_RULES.baseDeposit,
      status: 'normal',
      settlementDate: new Date().toISOString()
    };
  }

  function createDeduction(reason, amount, note = '') {
    return {
      reason: reason,
      amount: amount,
      note: note
    };
  }

  // ========== 工具函数 ==========
  function generateId() {
    return 'track_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 9);
  }

  function formatCurrency(amount) {
    return '¥' + amount.toFixed(2);
  }

  function formatDate(isoString) {
    if (!isoString) return '-';
    const d = new Date(isoString);
    return d.toLocaleDateString('zh-CN') + ' ' + d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' });
  }

  function getAnomalyLabel(type) {
    return ANOMALY_LABELS[type] || type;
  }

  function getStatusLabel(status) {
    return STATUS_LABELS[status] || status;
  }

  // 导出（挂在window上给其他脚本用
  window.DataModels = {
    DEPOSIT_RULES,
    STATUS,
    ANOMALY_TYPES,
    SEVERITY,
    STATUS_LABELS,
    ANOMALY_LABELS,
    createTrackRecord,
    createAnnotation,
    createAnomaly,
    createSettlement,
    createDeduction,
    generateId,
    formatCurrency,
    formatDate,
    getAnomalyLabel,
    getStatusLabel
  };
})();
