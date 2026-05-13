const STATUS_TYPES = {
  CREATED: 'CREATED',
  COLLECTED: 'COLLECTED',
  IN_TRANSIT: 'IN_TRANSIT',
  ARRIVED: 'ARRIVED',
  DELIVERING: 'DELIVERING',
  DELIVERED: 'DELIVERED',
  FAILED: 'FAILED',
  RETURNED: 'RETURNED'
};

const STATUS_NAMES = {
  [STATUS_TYPES.CREATED]: '已下单',
  [STATUS_TYPES.COLLECTED]: '已揽收',
  [STATUS_TYPES.IN_TRANSIT]: '运输中',
  [STATUS_TYPES.ARRIVED]: '到达站点',
  [STATUS_TYPES.DELIVERING]: '派送中',
  [STATUS_TYPES.DELIVERED]: '已签收',
  [STATUS_TYPES.FAILED]: '派送失败',
  [STATUS_TYPES.RETURNED]: '已退回'
};

const STATUS_TRANSITIONS = {
  [STATUS_TYPES.CREATED]: [STATUS_TYPES.COLLECTED],
  [STATUS_TYPES.COLLECTED]: [STATUS_TYPES.IN_TRANSIT, STATUS_TYPES.ARRIVED],
  [STATUS_TYPES.IN_TRANSIT]: [STATUS_TYPES.IN_TRANSIT, STATUS_TYPES.ARRIVED, STATUS_TYPES.FAILED],
  [STATUS_TYPES.ARRIVED]: [STATUS_TYPES.ARRIVED, STATUS_TYPES.IN_TRANSIT, STATUS_TYPES.DELIVERING, STATUS_TYPES.FAILED],
  [STATUS_TYPES.DELIVERING]: [STATUS_TYPES.DELIVERED, STATUS_TYPES.FAILED],
  [STATUS_TYPES.DELIVERED]: [],
  [STATUS_TYPES.FAILED]: [STATUS_TYPES.DELIVERING, STATUS_TYPES.RETURNED],
  [STATUS_TYPES.RETURNED]: []
};

const ANOMALY_TYPES = {
  SIGNED_BEFORE_COLLECT: 'SIGNED_BEFORE_COLLECT',
  CITY_JUMP: 'CITY_JUMP',
  DUPLICATE_SCAN: 'DUPLICATE_SCAN',
  TIME_REVERSAL: 'TIME_REVERSAL',
  INVALID_STATUS_TRANSITION: 'INVALID_STATUS_TRANSITION',
  MISSING_COLLECT: 'MISSING_COLLECT'
};

const ANOMALY_NAMES = {
  [ANOMALY_TYPES.SIGNED_BEFORE_COLLECT]: '先签收后揽收',
  [ANOMALY_TYPES.CITY_JUMP]: '跨城市跳点',
  [ANOMALY_TYPES.DUPLICATE_SCAN]: '重复扫描',
  [ANOMALY_TYPES.TIME_REVERSAL]: '时间倒流',
  [ANOMALY_TYPES.INVALID_STATUS_TRANSITION]: '状态流转异常',
  [ANOMALY_TYPES.MISSING_COLLECT]: '缺失揽收记录'
};

const ANOMALY_SEVERITY = {
  [ANOMALY_TYPES.SIGNED_BEFORE_COLLECT]: 'high',
  [ANOMALY_TYPES.CITY_JUMP]: 'high',
  [ANOMALY_TYPES.DUPLICATE_SCAN]: 'medium',
  [ANOMALY_TYPES.TIME_REVERSAL]: 'medium',
  [ANOMALY_TYPES.INVALID_STATUS_TRANSITION]: 'medium',
  [ANOMALY_TYPES.MISSING_COLLECT]: 'high'
};

const ANOMALY_CAUSES = {
  [ANOMALY_TYPES.SIGNED_BEFORE_COLLECT]: [
    '系统时间同步错误',
    '扫描操作顺序混乱',
    '数据导入顺序错误',
    '分拣中心批量处理延迟'
  ],
  [ANOMALY_TYPES.CITY_JUMP]: [
    '物流网点编码错误',
    '分拣错误导致错发',
    'GPS定位漂移',
    '中转信息录入错误'
  ],
  [ANOMALY_TYPES.DUPLICATE_SCAN]: [
    '扫描设备重复触发',
    '操作人员重复扫描',
    '系统重试机制导致',
    '数据重复导入'
  ],
  [ANOMALY_TYPES.TIME_REVERSAL]: [
    '不同设备时间未同步',
    '系统时区设置错误',
    '数据延迟上报',
    '手动修改时间戳'
  ],
  [ANOMALY_TYPES.INVALID_STATUS_TRANSITION]: [
    '状态编码错误',
    '业务流程违规操作',
    '系统状态机配置错误',
    '人工干预操作'
  ],
  [ANOMALY_TYPES.MISSING_COLLECT]: [
    '揽收环节漏扫',
    '分拣中心直达跳过',
    '数据缺失或丢失',
    '特殊物流模式'
  ]
};

const ANOMALY_SUGGESTIONS = {
  [ANOMALY_TYPES.SIGNED_BEFORE_COLLECT]: [
    '检查各扫描设备的时间同步配置',
    '核查该包裹的实际操作流程',
    '验证数据导入的时间顺序',
    '联系分拣中心确认处理流程'
  ],
  [ANOMALY_TYPES.CITY_JUMP]: [
    '核实网点编码与城市映射关系',
    '检查分拣环节的路由配置',
    '查看GPS定位日志',
    '联系中转中心确认实际路径'
  ],
  [ANOMALY_TYPES.DUPLICATE_SCAN]: [
    '检查扫描设备是否存在重复触发问题',
    '优化数据去重逻辑',
    '增加操作确认提示',
    '核查导入数据是否存在重复'
  ],
  [ANOMALY_TYPES.TIME_REVERSAL]: [
    '统一所有设备的时间同步策略',
    '检查系统时区配置',
    '优化数据上报机制',
    '限制时间戳的人工修改权限'
  ],
  [ANOMALY_TYPES.INVALID_STATUS_TRANSITION]: [
    '核查状态编码映射配置',
    '检查业务操作流程是否合规',
    '验证状态机配置正确性',
    '查看是否存在人工干预记录'
  ],
  [ANOMALY_TYPES.MISSING_COLLECT]: [
    '联系揽收网点补录数据',
    '检查特殊物流模式配置',
    '核查分拣中心是否存在直达流程',
    '确认数据是否在传输过程中丢失'
  ]
};

const VALIDATION_RESULT = {
  VALID: 'valid',
  WARNING: 'warning',
  ERROR: 'error'
};

module.exports = {
  STATUS_TYPES,
  STATUS_NAMES,
  STATUS_TRANSITIONS,
  ANOMALY_TYPES,
  ANOMALY_NAMES,
  ANOMALY_SEVERITY,
  ANOMALY_CAUSES,
  ANOMALY_SUGGESTIONS,
  VALIDATION_RESULT
};
