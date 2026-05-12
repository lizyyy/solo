# 巡店问题整改 CLI 工具

一个本地可运行的巡店问题整改追踪系统，围绕区域督导巡店发现问题后，追踪门店整改、复查、逾期和扣分展开。

## 功能特性

- **数据导入**：支持导入门店信息、巡店记录、巡店问题、整改反馈、复查结果
- **状态追踪**：实时查看问题状态（待整改、整改中、已提交、待复查、已通过、复查不通过、已逾期、已闭环）
- **历史记录**：每个问题的完整整改历史、复查历史、审计日志
- **幂等处理**：重复导入相同数据会自动跳过，不会重复创建
- **扣分机制**：逾期未整改扣2分，复查不通过扣1分
- **评分系统**：基于门店问题闭环率和扣分情况计算月度评分
- **业务闭环验证**：报告明确展示已闭环、未闭环、扣分原因，让业务人员无需看源码即可判断业务状态

## 快速开始

### 环境要求
- Node.js >= 14.0.0

### 本地启动

1. **初始化系统**
```bash
node src/index.js init
```

2. **生成样例数据**
```bash
node scripts/generate-data.js
```

3. **运行完整演示**
```bash
node scripts/demo.js
```

## 命令说明

### init - 初始化系统
```bash
node src/index.js init [--force]
```
- `--force`: 强制重新初始化，会清空所有数据

### import - 导入数据
```bash
node src/index.js import <type> <file> [--operator <name>]
```

支持的导入类型：
- `stores` - 门店信息
- `inspections` - 巡店记录
- `issues` - 巡店问题
- `corrections` - 整改反馈
- `reinspections` - 复查结果

示例：
```bash
node src/index.js import stores data/stores.json --operator 系统管理员
node src/index.js import issues data/issues.json --operator 张督导
```

### check - 检查问题状态
```bash
node src/index.js check [--verbose]
```
- `--verbose`: 显示详细列表

### detail - 查看问题详情
```bash
node src/index.js detail <issueId> [--history]
```
- `--history`: 显示审计日志

### report - 生成月度报告
```bash
node src/index.js report [--month <YYYY-MM>]
```

## 数据格式

### 门店信息 (stores.json)
```json
[
  {
    "id": "store_001",
    "code": "SH001",
    "name": "上海南京路店",
    "manager": "李明",
    "phone": "13800138001",
    "address": "上海市黄浦区南京东路100号",
    "region": "华东区"
  }
]
```

### 巡店记录 (inspections.json)
```json
[
  {
    "id": "inspect_001",
    "storeId": "store_001",
    "inspectionDate": "2026-05-10",
    "inspector": "张督导",
    "remark": "常规巡店"
  }
]
```

### 巡店问题 (issues.json)
```json
[
  {
    "id": "issue_001",
    "inspectionId": "inspect_001",
    "category": "陈列",
    "description": "货架第三层商品陈列不整齐",
    "severity": "普通",
    "dueDays": 3,
    "photoUrls": ["https://example.com/photo1.jpg"],
    "remark": "需要重新理货"
  }
]
```

问题类别（固定）：陈列、卫生、价格牌、安全隐患

### 整改反馈 (corrections.json)
```json
[
  {
    "issueId": "issue_001",
    "description": "已重新整理货架",
    "photoUrls": ["https://example.com/corr1.jpg"],
    "submittedBy": "李明（店长）"
  }
]
```

### 复查结果 (reinspections.json)
```json
[
  {
    "issueId": "issue_001",
    "inspector": "张督导",
    "result": "通过",
    "comment": "整改到位",
    "photoUrls": ["https://example.com/reinspect1.jpg"]
  }
]
```

结果选项：通过、不通过

## 主要演示路径

### 成功闭环路径
1. 初始化系统
2. 导入3家门店信息
3. 导入2条巡店记录
4. 导入4个问题（陈列、卫生、价格牌、安全隐患）
5. 上海店提交2个问题的整改（带照片）
6. 督导复查，2个问题全部通过
7. 生成报告，显示上海店100分，闭环率100%

### 失败路径（整改照片缺失）
1. 北京店尝试提交整改，但 photoUrls 为空数组
2. 系统提示：整改照片缺失，至少需要1张整改照片
3. 北京店补充照片后重新提交

### 失败路径（复查不通过）
1. 北京店提交价格牌问题的整改
2. 督导复查时发现价格牌只更新了一张
3. 复查结果设为"不通过"
4. 系统自动扣1分
5. 报告显示北京店99分，有1个问题未闭环

### 幂等性演示
1. 首次导入4个问题，全部成功
2. 再次导入相同的问题（inspectionId + category + description 相同）
3. 系统自动跳过，提示"同一次巡店中相同问题已存在"

## 业务规则

### 扣分规则
- **逾期未整改**：截止日期后未提交整改，扣 2 分
- **复查不通过**：督导复查结果为"不通过"，扣 1 分
- **基础评分**：100 分

### 状态流转
```
待整改 → 已提交整改 → 复查通过 → 已闭环
   ↓              ↓
  逾期        复查不通过 → （需重新整改）
```

### 幂等规则
- 门店：通过 id 或 code 判断重复
- 巡店记录：通过 id 判断重复
- 问题：通过 inspectionId + category + description 判断重复（同一次巡店中相同问题）
- 整改：通过 issueId + submittedBy + description 判断重复
- 复查：通过 issueId + inspector + result + comment 判断重复

## 目录结构

```
.
├── src/
│   ├── index.js              # CLI 入口
│   ├── config.js             # 配置管理
│   ├── storage.js            # 数据存储
│   ├── utils.js              # 工具函数
│   ├── commands/
│   │   ├── init.js           # init 命令
│   │   ├── import.js         # import 命令
│   │   ├── check.js          # check 命令
│   │   ├── detail.js         # detail 命令
│   │   └── report.js         # report 命令
│   └── services/
│       ├── storeService.js   # 门店服务
│       ├── inspectionService.js  # 巡店/问题服务
│       ├── correctionService.js  # 整改服务
│       ├── reinspectionService.js # 复查服务
│       └── reportService.js  # 报表服务
├── data/                     # 样例数据目录
├── scripts/
│   ├── demo.js              # 完整演示脚本
│   └── generate-data.js     # 样例数据生成脚本
├── package.json
└── README.md
```

## 数据存储

所有数据存储在当前目录下的 `.inspection-data/` 目录中：
- `stores.json` - 门店信息
- `inspections.json` - 巡店记录
- `issues.json` - 巡店问题
- `corrections.json` - 整改反馈
- `reinspections.json` - 复查结果
- `audit-logs.json` - 审计日志（记录所有操作及前后差异）

## 审计日志

所有操作都会记录审计日志，包含：
- 操作类型
- 操作者
- 操作时间
- 目标 ID
- 操作前数据
- 操作后数据
- 操作详情

人工修改时，会保留完整的前后差异供追溯。
