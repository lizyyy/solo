# 市政运维后端服务 - 可追踪记录管理系统

## 功能概述

为市政运维部门提供一套完整的可追踪记录管理系统，支持告警CSV、巡查JSON、维修单的数据接入，提供完整的处理流程追踪和历史追溯能力。

## 核心特性

- **多源数据接入**: 支持告警CSV、巡查JSON、维修单导入
- **批次管理**: 所有数据按批次管理，可追溯来源
- **完整处理流程**: 标记处理、退回修改、复测验证
- **特殊业务处理**:
  - 同杆多灯合并处理
  - 误报过滤并记录原因
  - 修复复测结果记录
- **多维历史查询**: 按灯杆编号、维修队、复测结果查询
- **完整追溯链路**: 每条记录保留原因、处理人、时间戳
- **数据导出**: 导出明细与查询结果数量一致
- **复测结果溯源**: 可追踪复测记录的完整来源

## 快速开始

### 安装依赖

```bash
npm install
```

### 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

### 开发模式

```bash
npm run dev
```

### 验证测试

项目包含完整的功能验证脚本：

```bash
# 先启动服务
npm start

# 另开终端运行验证脚本
node test_all.js
```

验证脚本会测试所有核心功能：
- 健康检查
- 数据导入（告警CSV、巡查JSON、维修单）
- 标记处理、退回修改
- 修复复测
- 多维查询（灯杆编号、维修队、复测结果）
- 完整追溯链路
- 数据导出及数量一致性验证

## API 接口文档

### 1. 健康检查

```
GET /api/health
```

### 2. 批次管理

#### 创建批次

```
POST /api/batches
Content-Type: application/json

{
  "source_type": "alarm_csv",
  "source_name": "5月告警数据",
  "created_by": "张三",
  "remark": "备注信息"
}
```

#### 查询批次列表

```
GET /api/batches?source_type=alarm_csv&created_by=张三&limit=10&offset=0
```

#### 查询单个批次

```
GET /api/batches/:batch_no
```

### 3. 数据导入

#### 导入告警CSV

```
POST /api/import/alarm-csv
Content-Type: multipart/form-data

file: [CSV文件]
created_by: 张三
source_name: 5月告警数据
```

CSV字段支持中英文:
- pole_no / 灯杆编号
- light_no / 灯具编号
- alarm_type / 告警类型
- alarm_level / 告警级别
- location / 位置
- description / 描述
- maintenance_team / 维修队
- handler / 处理人
- report_time / 上报时间

#### 导入巡查JSON

```
POST /api/import/inspection-json
Content-Type: application/json

{
  "data": [
    {
      "pole_no": "LG001",
      "light_no": "LD001",
      "issue_type": "灯罩破损",
      "level": "一般",
      "location": "人民路1号",
      "description": "灯罩有裂纹",
      "maintenance_team": "一队",
      "inspector": "李四",
      "inspection_time": "2024-05-20 10:30:00"
    }
  ],
  "created_by": "张三",
  "source_name": "5月巡查数据"
}
```

#### 导入维修单

```
POST /api/import/work-order
Content-Type: application/json

{
  "order_data": {
    "order_no": "WX20240520001",
    "pole_no": "LG001",
    "light_no": "LD001",
    "repair_type": "灯泡更换",
    "location": "人民路1号",
    "description": "灯泡不亮",
    "maintenance_team": "一队",
    "worker": "王五",
    "repair_time": "2024-05-20 14:30:00"
  },
  "created_by": "张三"
}
```

### 4. 记录管理

#### 查询记录列表

```
GET /api/records?pole_no=LG001&maintenance_team=一队&recheck_result=pass&status=pending&limit=10&offset=0
```

查询参数:
- `pole_no`: 灯杆编号
- `maintenance_team`: 维修队
- `recheck_result`: 复测结果 (pass/fail)
- `status`: 状态 (pending/processing/completed/returned/false_alarm/rechecked)
- `batch_id`: 批次ID
- `record_type`: 记录类型 (alarm/inspection/repair)
- `limit`: 每页数量
- `offset`: 偏移量

响应包含:
- `total`: 总记录数
- `count`: 当前返回数量
- `match_count`: 数量是否一致

#### 查询单条记录

```
GET /api/records/:record_no
```

#### 查询记录完整追溯信息

```
GET /api/records/:record_no/trace
```

返回内容:
- 记录基本信息
- 处理历史列表
- 关联记录（同杆多灯）
- 误报过滤信息

#### 查询记录处理历史

```
GET /api/records/:record_no/history
```

### 5. 记录处理

#### 标记处理

```
POST /api/records/process
Content-Type: application/json

{
  "record_no": "REC-20240520103000-ABC1",
  "status": "processing",
  "action_reason": "已派单给维修队",
  "action_by": "张三",
  "remark": "紧急处理"
}
```

#### 退回修改

```
POST /api/records/return
Content-Type: application/json

{
  "record_no": "REC-20240520103000-ABC1",
  "return_reason": "灯杆编号不明确，需要补充信息",
  "action_by": "张三",
  "remark": "请补充具体位置信息"
}
```

### 6. 特殊业务处理

#### 同杆多灯合并处理

```
POST /api/special/multi-light
Content-Type: application/json

{
  "main_record_no": "REC-20240520103000-ABC1",
  "related_record_nos": ["REC-20240520103001-ABC2", "REC-20240520103002-ABC3"],
  "action_by": "张三",
  "reason": "同一灯杆多个灯具故障，合并处理"
}
```

#### 误报过滤

```
POST /api/special/false-alarm
Content-Type: application/json

{
  "record_no": "REC-20240520103000-ABC1",
  "filter_reason": "传感器误触发，现场检查正常",
  "filter_by": "李四",
  "confidence_score": 0.95
}
```

#### 修复复测

```
POST /api/special/recheck
Content-Type: application/json

{
  "record_no": "REC-20240520103000-ABC1",
  "recheck_result": "pass",
  "recheck_by": "王五",
  "recheck_reason": "修复完成，现场验证正常"
}
```

### 7. 数据导出

#### 导出记录列表

```
GET /api/export/records?pole_no=LG001&maintenance_team=一队
```

支持与列表查询相同的筛选参数，导出数量与查询结果一致。

#### 导出单条记录明细（含完整追溯）

```
GET /api/export/records/:record_no/detail
```

导出内容包含:
- 记录基本信息
- 完整处理历史
- 关联记录（同杆多灯）
- 误报过滤信息

#### 导出复测追溯报告

```
GET /api/export/recheck-trace?recheck_result=pass
```

专门用于复测结果溯源，包含:
- 记录编号
- 灯杆编号
- 来源类型
- 来源批次
- 复测结果
- 复测人
- 复测时间
- 复测原因
- 原始状态

## 数据模型

### 核心表结构

1. **batches** - 批次表
2. **records** - 记录表
3. **processing_history** - 处理历史表
4. **multi_light_relations** - 同杆多灯关系表
5. **false_alarm_filters** - 误报过滤表

### 状态说明

- `pending`: 待处理
- `processing`: 处理中
- `completed`: 已完成
- `returned`: 退回修改
- `false_alarm`: 误报
- `rechecked`: 已复测

## 向领导解释说明的关键点

1. **可解释性**: 每条记录的每一步操作都记录了原因、处理人、时间，随时可以解释为什么放行、退回或要求补材料

2. **复测可追溯**: 复测结果可以完整追溯到原始数据来源、导入批次、处理过程

3. **数据一致性**: 导出数量与查询结果完全一致，避免数据不一致问题

4. **重启不丢失**: 使用SQLite文件数据库，服务重启后所有历史数据都可以查询

5. **特殊场景全覆盖**:
   - 同杆多灯: 支持关联记录，合并处理
   - 误报过滤: 记录过滤原因和置信度
   - 修复复测: 完整记录复测结果和原因

## 目录结构

```
├── src/
│   ├── app.js                 # 主应用入口
│   ├── routes/
│   │   └── api.js             # API路由
│   ├── controllers/
│   │   └── recordController.js # 控制器
│   ├── services/
│   │   ├── batchService.js    # 批次服务
│   │   ├── recordService.js   # 记录服务
│   │   ├── historyService.js  # 历史追溯服务
│   │   ├── specialService.js  # 特殊业务服务
│   │   ├── importService.js   # 导入服务
│   │   └── exportService.js   # 导出服务
│   ├── database/
│   │   ├── db.js              # 数据库连接
│   │   ├── schema.js          # 数据库schema
│   │   └── init.js            # 初始化脚本
│   └── utils/
│       └── generator.js       # 工具函数
├── data/                      # 数据库文件目录
├── uploads/                   # 上传文件临时目录
└── package.json
```
