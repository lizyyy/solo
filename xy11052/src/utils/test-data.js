const NORMAL_TEST_DATA = {
  description: "正常单 - 完整有效数据，应全部导入成功",
  items: [
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "环境卫生",
      problem_type: "地面清洁",
      problem_description: "入门处地砖有明显污渍，约0.5平米，影响顾客第一印象",
      problem_location: "门店入口左侧区域",
      photo_url: "https://example.com/photos/inspect20240115_001.jpg",
      requirement: "使用专用清洁剂彻底清除污渍，并用干拖布擦干，确保地面无残留",
      deadline: "2024-01-20",
      responsible_person: "店长张三",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    },
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "商品陈列",
      problem_type: "货架缺货",
      problem_description: "饮料货架第三层矿泉水SKU空缺约30分钟位，未及时补货",
      problem_location: "A区饮料货架",
      photo_url: "https://example.com/photos/inspect20240115_002.jpg",
      requirement: "立即补货，同时检查仓库库存，建立库存预警机制",
      deadline: "2024-01-18",
      responsible_person: "理货员李四",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    },
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "食品安全",
      problem_type: "临期商品",
      problem_description: "冷藏柜内发现5盒酸奶距离保质期不足24小时，未单独放置",
      problem_location: "冷藏展示柜第二层",
      photo_url: "https://example.com/photos/inspect20240115_003.jpg",
      requirement: "立即下架临期商品，执行临期商品提前3天标识制度",
      deadline: "2024-01-16",
      responsible_person: "食品员王五",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    }
  ]
};

const CONFLICT_TEST_DATA = {
  description: "冲突单 - 包含重复提交、报表不一致等边界情况",
  items: [
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "环境卫生",
      problem_type: "地面清洁",
      problem_description: "入门处地砖有明显污渍，约0.5平米，影响顾客第一印象",
      problem_location: "门店入口左侧区域",
      photo_url: "https://example.com/photos/inspect20240115_001.jpg",
      requirement: "使用专用清洁剂彻底清除污渍，并用干拖布擦干",
      deadline: "2024-01-20",
      responsible_person: "店长张三",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15",
      report_consistency_check: "fail"
    },
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "消防安全",
      problem_type: "灭火器检查",
      problem_description: "ABC干粉灭火器压力表指针在黄区，压力不足需更换",
      problem_location: "收银台后方消防器材架",
      photo_url: "https://example.com/photos/inspect20240115_004.jpg",
      requirement: "立即更换灭火器，确保压力在绿色安全区域",
      deadline: "2024-01-17",
      responsible_person: "安全员赵六",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    },
    {
      inspection_id: "INSPECT20240115001",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "服务规范",
      problem_type: "着装不规范",
      problem_description: "当班店员未佩戴工牌，影响品牌形象和顾客识别",
      problem_location: "收银台当班人员",
      photo_url: "https://example.com/photos/inspect20240115_005.jpg",
      requirement: "立即佩戴工牌，晨会强调着装规范要求",
      deadline: "2024-01-16",
      responsible_person: "店长张三",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    }
  ]
};

const MISSING_FIELDS_DATA = {
  description: "缺字段测试 - 包含各类必填字段缺失",
  items: [
    {
      inspection_id: "",
      store_id: "STORE001",
      store_name: "全家便利店(中关村店)",
      problem_category: "设备设施",
      problem_type: "空调故障",
      problem_description: "店内空调制冷效果差，顾客投诉较多",
      requirement: "联系维修人员检修，必要时更换",
      deadline: "2024-01-25",
      responsible_person: "店长张三",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    },
    {
      inspection_id: "INSPECT20240115002",
      store_id: "STORE002",
      store_name: "",
      problem_category: "价格标识",
      problem_type: "价签缺失",
      problem_description: "进口零食区有5个商品缺少价格标签",
      requirement: "立即打印并粘贴价签，每日开店前检查",
      deadline: "2024-01-16",
      responsible_person: "理货员李四",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    },
    {
      inspection_id: "INSPECT20240115002",
      store_id: "STORE002",
      store_name: "7-ELEVEN(国贸店)",
      problem_category: "环境卫生",
      problem_type: "",
      problem_description: "",
      requirement: "彻底清扫卫生间，每2小时巡检一次",
      deadline: "2024-01-16",
      responsible_person: "保洁员王五",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    }
  ]
};

const INVALID_DATE_DATA = {
  description: "日期格式错误测试",
  items: [
    {
      inspection_id: "INSPECT20240115002",
      store_id: "STORE002",
      store_name: "7-ELEVEN(国贸店)",
      problem_category: "商品陈列",
      problem_type: "排面不整齐",
      problem_description: "方便面区域商品排面倾斜，影响视觉效果",
      requirement: "整理排面，确保商品正面朝外整齐摆放",
      deadline: "2024/01/20",
      responsible_person: "理货员李四",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    }
  ]
};

const INVALID_CATEGORY_DATA = {
  description: "问题分类错误测试",
  items: [
    {
      inspection_id: "INSPECT20240115002",
      store_id: "STORE002",
      store_name: "7-ELEVEN(国贸店)",
      problem_category: "商品质量",
      problem_type: "包装破损",
      problem_description: "部分商品外包装有破损",
      requirement: "检查所有商品包装，及时下架破损商品",
      deadline: "2024-01-18",
      responsible_person: "理货员李四",
      inspector_id: "INS001",
      inspector_name: "王督导",
      inspection_date: "2024-01-15"
    }
  ]
};

const STATUS_TRANSITION_TESTS = [
  {
    description: "正常状态流转: pending → rectifying → submitted → approved → closed",
    steps: [
      { from: "pending", to: "rectifying", expected: true },
      { from: "rectifying", to: "submitted", expected: true },
      { from: "submitted", to: "approved", expected: true },
      { from: "approved", to: "closed", expected: true }
    ]
  },
  {
    description: "状态越级测试 - 应被拒绝",
    steps: [
      { from: "pending", to: "approved", expected: false, reason: "不能直接从待整改跳到验收通过" },
      { from: "pending", to: "closed", expected: false, reason: "不能直接关闭待整改项" },
      { from: "rectifying", to: "approved", expected: false, reason: "整改中不能直接验收通过" }
    ]
  },
  {
    description: "驳回后重新整改流程",
    steps: [
      { from: "submitted", to: "rejected", expected: true },
      { from: "rejected", to: "rectifying", expected: true },
      { from: "rectifying", to: "submitted", expected: true }
    ]
  }
];

module.exports = {
  NORMAL_TEST_DATA,
  CONFLICT_TEST_DATA,
  MISSING_FIELDS_DATA,
  INVALID_DATE_DATA,
  INVALID_CATEGORY_DATA,
  STATUS_TRANSITION_TESTS
};