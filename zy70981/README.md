# 市政运维数据整合 API

统一处理路灯告警、人工巡查和维修反馈数据，解决导入混乱问题。

## 功能特性

- ✅ **多源数据整合**：支持路灯告警CSV、巡查JSON、维修单上传
- ✅ **智能分类**：自动分为正常项、待确认项、失败项
- ✅ **去重机制**：同一批材料再次提交不重复生效
- ✅ **业务规则**：覆盖同杆多灯聚合、误报过滤、修复复测
- ✅ **透明可追溯**：每条记录保留原始字段和处理建议
- ✅ **边界说明**：同杆多灯等特殊情况提供可读说明

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

开发模式（自动重启）：
```bash
npm run dev
```

生产模式：
```bash
npm run build && npm start
```

服务启动后访问：http://localhost:3000

## API 接口

### 健康检查
```bash
curl http://localhost:3000/api/health
```

### 查看所有业务规则
```bash
curl http://localhost:3000/api/rules
```

### 上传文件处理

**路灯告警 (CSV):**
```bash
curl -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm
```

**人工巡查 (JSON):**
```bash
curl -X POST -F "file=@test-data/inspections.json" http://localhost:3000/api/upload/inspection
```

**维修反馈 (JSON):**
```bash
curl -X POST -F "file=@test-data/maintenance.json" http://localhost:3000/api/upload/maintenance
```

### 直接处理JSON数据

```bash
curl -X POST http://localhost:3000/api/process/alarm \
  -H "Content-Type: application/json" \
  -d '[{
    "alarmId": "TEST001",
    "poleId": "P001",
    "lampId": "L001",
    "alarmTime": "2026-05-27T08:30:00+08:00",
    "alarmType": "灯不亮",
    "alarmLevel": "high",
    "location": "测试路1号"
  }]'
```

### 单条记录处理说明

```bash
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{
    "sourceType": "alarm",
    "record": {
      "alarmId": "TEST001",
      "poleId": "P001",
      "lampId": "L001",
      "alarmTime": "2026-05-27T08:30:00+08:00",
      "alarmType": "网络超时",
      "alarmLevel": "medium",
      "location": "测试路1号"
    }
  }'
```

### 查看批次记录
```bash
curl http://localhost:3000/api/batches
```

### 清空批次记录（测试用）
```bash
curl -X DELETE http://localhost:3000/api/batches
```

## 业务规则说明

### 1. 数据校验规则 (data_validation)
- 检查必填字段是否完整
- 验证时间格式是否正确
- **不通过 → 退回补材料 (failed)**

### 2. 重复记录检查 (duplicate_check)
- 检查批次内是否有相同记录
- **不通过 → 退回补材料 (failed)**

### 3. 同杆多灯聚合 (same_pole_multi_lamp)
- 同一杆号下≥3盏灯同时告警 → 疑似整杆故障
- **触发 → 待人工确认 (pending)**
- 建议：先排查电源或线路问题

### 4. 误报过滤 (false_positive_filter)
- 通信类告警（网络超时、通信中断）→ 常见误报
- 低级别告警含"疑似""可能"等词汇 → 低置信度
- **触发 → 待人工确认 (pending)**
- 建议：观察5分钟或现场确认

### 5. 修复复测 (repair_retest)
- 已完成维修单必须有：维修后照片、完成时间、维修人员
- 有费用产生必须记录耗材明细
- **不通过 → 退回补材料 (failed)**

## 响应格式说明

处理结果返回三个分类：

```json
{
  "summary": {
    "total": 7,
    "normal": 3,
    "pending": 2,
    "failed": 1,
    "duplicates": 1
  },
  "categories": {
    "normal": [...],
    "pending": [...],
    "failed": [...]
  },
  "boundaryCases": [
    {
      "description": "同杆多灯边界：同一杆号下3盏及以上灯同时上报...",
      "records": [...]
    }
  ]
}
```

### 单条记录说明示例（用于向他人解释）

```
记录编号: ALM001
数据类型: 路灯告警
处理结果: 待人工确认

规则执行明细:
  1. ✅ 数据校验规则
     数据格式校验通过
  2. ✅ 重复记录检查规则
     本批次内无重复记录
  3. ❌ 同杆多灯聚合规则
     该杆号(P001)下有3盏灯同时上报，疑似整杆故障或电源问题
     建议: 建议先排查电源或线路问题，再逐灯检修，已自动标记为待人工确认
  4. ✅ 误报过滤规则
     未发现明显误报特征

最终建议: 建议先排查电源或线路问题，再逐灯检修，已自动标记为待人工确认
```

## 测试数据说明

`test-data/` 目录包含测试用例：

- **alarms.csv** - 路灯告警测试数据
  - ALM001-003：同杆多灯场景（P001有3盏灯告警）
  - ALM004：网络超时误报
  - ALM005：低置信度告警（含"疑似"）
  - ALM006：正常告警
  - ALM007：数据缺失（缺少灯号和位置）

- **inspections.json** - 人工巡查测试数据
  - INSP001：正常异常记录
  - INSP002：正常设备
  - INSP003：无照片的损坏记录

- **maintenance.json** - 维修反馈测试数据
  - ORD001：完整的已完成维修单
  - ORD002：缺少照片的维修单
  - ORD003：有费用但无材料记录
  - ORD004：处理中的维修单

## 复跑验证步骤

完整验证流程：

```bash
# 1. 安装依赖
npm install

# 2. 启动服务（新终端）
npm run dev

# 3. 测试告警CSV导入（触发同杆多灯、误报过滤）
curl -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm

# 4. 重复提交同一文件，验证去重
curl -X POST -F "file=@test-data/alarms.csv" http://localhost:3000/api/upload/alarm

# 5. 测试巡查JSON导入
curl -X POST -F "file=@test-data/inspections.json" http://localhost:3000/api/upload/inspection

# 6. 测试维修单导入（触发修复复测规则）
curl -X POST -F "file=@test-data/maintenance.json" http://localhost:3000/api/upload/maintenance

# 7. 查看批次记录
curl http://localhost:3000/api/batches

# 8. 单条记录说明演示
curl -X POST http://localhost:3000/api/explain \
  -H "Content-Type: application/json" \
  -d '{"sourceType":"alarm","record":{"alarmId":"DEMO001","poleId":"P001","lampId":"L001","alarmTime":"2026-05-27T08:30:00+08:00","alarmType":"网络超时","alarmLevel":"medium","location":"演示路1号"}}'
```

## 项目结构

```
.
├── src/
│   ├── types/           # 类型定义
│   ├── services/        # 业务逻辑
│   │   ├── BatchManager.ts    # 批次管理和去重
│   │   ├── RuleEngine.ts      # 规则引擎
│   │   └── DataProcessor.ts   # 数据处理
│   ├── utils/           # 工具函数
│   │   └── fileParser.ts     # 文件解析
│   ├── routes/          # API路由
│   └── server.ts        # 服务入口
├── test-data/           # 测试数据
├── data/                # 运行时数据（自动创建）
└── temp/                # 临时文件（自动创建）
```

## 数据字典

### 路灯告警 (alarm)
| 字段 | 必填 | 说明 |
|------|------|------|
| alarmId | 是 | 告警编号 |
| poleId | 是 | 杆号 |
| lampId | 是 | 灯号 |
| alarmTime | 是 | 告警时间 (ISO格式) |
| alarmType | 是 | 告警类型 |
| alarmLevel | 是 | 告警级别 (low/medium/high/critical) |
| location | 是 | 位置 |
| description | 否 | 描述 |

### 人工巡查 (inspection)
| 字段 | 必填 | 说明 |
|------|------|------|
| inspectionId | 是 | 巡查编号 |
| poleId | 是 | 杆号 |
| inspector | 是 | 巡查员 |
| inspectionTime | 是 | 巡查时间 |
| status | 是 | 状态 (normal/abnormal/damaged) |
| location | 是 | 位置 |

### 维修反馈 (maintenance)
| 字段 | 必填 | 说明 |
|------|------|------|
| orderId | 是 | 维修单号 |
| poleId | 是 | 杆号 |
| repairType | 是 | 维修类型 |
| reporter | 是 | 报修人 |
| reportTime | 是 | 报修时间 |
| status | 是 | 状态 (pending/processing/completed/cancelled) |
| location | 是 | 位置 |
