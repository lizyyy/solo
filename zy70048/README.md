# 生产停线复盘服务

一个完整的生产停线事件管理系统，支持从停线记录、原因分析、责任确认、复产到复盘的全流程管理。

## 核心功能

### 1. 停线事件管理
- 创建停线事件作为流程入口
- 8个状态的状态机管理，确保流程规范
- 完整的状态历史记录和时间轴

### 2. 多来源原因分析（解决冲突问题）
- 支持设备、物料、人员、其他四大类原因
- **跨类别冲突检测**：当设备/物料/人员各有一条原因时，自动识别为冲突
- 类别内冲突检测：同一类别下多条待确认记录
- 支持确认/拒绝原因，选择主要原因

### 3. 责任确认与申诉
- 分配责任部门和责任人
- **支持申诉后重新分配**：申诉后状态变为APPEALED，可创建新的责任记录
- 终审锁定机制

### 4. 复产管理
- 开始复产、更新进度、完成复产
- 支持失败重试
- 自动计算实际停线时长

### 5. 复盘报告
- 起草报告、提交审批、审批通过/拒绝
- 审批通过后事件自动归档

## 状态流转

```
CREATED (已创建) 
  ↓
REASON_ANALYZING (原因分析中) ← 多来源原因提交，冲突检测
  ↓
REASON_CONFIRMED (原因已确认) ← 确认主要原因，拒绝冲突记录
  ↓
RESPONSIBILITY_ASSIGNED (责任已分配) ← 支持申诉回退
  ↓
RECOVERY_IN_PROGRESS (复产中) ← 支持失败重试
  ↓
RECOVERED (已复产)
  ↓
REVIEWING (复盘中) ← 报告审批流程
  ↓
COMPLETED (已完成) ← 事件归档
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动。

### 3. 运行完整测试

```bash
npm test
```

测试脚本会演示：
- 正常业务流程（从创建到完成）
- 错误场景（非法状态流转、重复提交）
- 边界场景（责任申诉、复产失败重试）

### 4. 健康检查

```bash
curl http://localhost:3000/api/health
```

## 完整使用示例

### 步骤1：创建停线事件

```bash
curl -X POST http://localhost:3000/api/line-stops \
  -H "Content-Type: application/json" \
  -d '{
    "lineCode": "LINE-A01",
    "lineName": "装配线A01",
    "operator": "张三",
    "initialDescription": "生产线突发停机",
    "estimatedDuration": 30
  }'
```

**响应**：返回事件ID和当前状态 CREATED

---

### 步骤2：提交多来源原因（模拟设备/物料/人员矛盾）

```bash
# 设备工程师提交原因
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/reasons \
  -H "Content-Type: application/json" \
  -d '{
    "category": "EQUIPMENT",
    "subCategory": "机械故障",
    "source": "设备日志系统",
    "reporter": "设备工程师-李四",
    "description": "主轴电机过载保护触发",
    "confidence": 0.85
  }'

# 物料员提交原因
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/reasons \
  -H "Content-Type: application/json" \
  -d '{
    "category": "MATERIAL",
    "subCategory": "质量问题",
    "source": "物料系统",
    "reporter": "物料员-王五",
    "description": "零件尺寸超差导致卡死",
    "confidence": 0.70
  }'

# 班长提交原因
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/reasons \
  -H "Content-Type: application/json" \
  -d '{
    "category": "PERSONNEL",
    "subCategory": "操作失误",
    "source": "人工记录",
    "reporter": "班长-赵六",
    "description": "操作员未按SOP执行",
    "confidence": 0.60
  }'
```

---

### 步骤3：检测原因冲突

```bash
curl http://localhost:3000/api/line-stops/{事件ID}/reasons/conflicts
```

**响应示例**：
```json
{
  "success": true,
  "data": {
    "totalReasons": 3,
    "activeReasons": 3,
    "activeCategories": ["EQUIPMENT", "MATERIAL", "PERSONNEL"],
    "hasConflicts": true,
    "conflicts": [
      {
        "type": "CROSS_CATEGORY",
        "categories": ["EQUIPMENT", "MATERIAL", "PERSONNEL"],
        "message": "存在 3 个类别的有效原因，存在冲突可能",
        "detail": "停线事件通常只有一个主要原因。不同类别的原因需要人工判断哪个是真正的根因"
      }
    ],
    "suggestion": "请人工分析各来源记录的可信度，选择主要原因并将其他原因标记为拒绝"
  }
}
```

---

### 步骤4：确认/拒绝原因

```bash
# 确认设备原因为主要原因
curl -X POST http://localhost:3000/api/line-stops/reasons/{原因ID1}/confirm \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "生产经理-孙七",
    "isPrimary": true
  }'

# 拒绝物料原因
curl -X POST http://localhost:3000/api/line-stops/reasons/{原因ID2}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "生产经理-孙七",
    "rejectReason": "经核实，零件尺寸在公差范围内，排除物料原因"
  }'

# 拒绝人员原因
curl -X POST http://localhost:3000/api/line-stops/reasons/{原因ID3}/reject \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "生产经理-孙七",
    "rejectReason": "操作记录显示操作员按SOP执行，排除人为因素"
  }'
```

**结果**：事件状态变为 REASON_CONFIRMED

---

### 步骤5：分配责任

```bash
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/responsibilities \
  -H "Content-Type: application/json" \
  -d '{
    "responsibleDepartment": "设备部",
    "responsiblePerson": "李四",
    "reason": "设备日常维护不到位",
    "severity": "MAJOR",
    "correctiveAction": "更换电机，检查传动系统",
    "preventiveAction": "建立定期维护计划",
    "confirmedBy": "生产经理-孙七"
  }'
```

**结果**：事件状态变为 RESPONSIBILITY_ASSIGNED

---

### 步骤6（可选）：责任申诉

如果工程师对责任分配有异议：

```bash
curl -X POST http://localhost:3000/api/line-stops/responsibilities/{责任ID}/appeal \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "工程师B",
    "appealReason": "设备故障是由于物料质量问题导致，非维护责任"
  }'
```

**结果**：
- 责任状态变为 APPEALED
- 事件状态回退到 REASON_CONFIRMED
- **可以重新分配责任**

---

### 步骤7：重新分配责任（申诉后）

```bash
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/responsibilities \
  -H "Content-Type: application/json" \
  -d '{
    "responsibleDepartment": "物料部",
    "responsiblePerson": "物料员C",
    "reason": "物料质量问题导致设备损坏",
    "confirmedBy": "生产经理-孙七"
  }'
```

---

### 步骤8：开始复产

```bash
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/recovery \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "设备工程师-李四",
    "actions": "1. 断开电源 2. 检查电机 3. 更换过热部件",
    "verificationItems": [
      {"item": "电机温度", "result": "正常", "expected": "<80°C"}
    ]
  }'
```

**结果**：事件状态变为 RECOVERY_IN_PROGRESS

---

### 步骤9：完成复产

```bash
curl -X POST http://localhost:3000/api/line-stops/recovery/{复产ID}/complete \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "设备工程师-李四",
    "remarks": "所有检查项通过，设备运行正常"
  }'
```

**结果**：
- 事件状态变为 RECOVERED
- 自动计算实际停线时长

---

### 步骤10：创建复盘报告

```bash
curl -X POST http://localhost:3000/api/line-stops/{事件ID}/reports \
  -H "Content-Type: application/json" \
  -d '{
    "summary": "2024年5月8日装配线A01停线事件",
    "rootCause": "设备维护计划执行不到位",
    "impactAnalysis": "影响产量约500件",
    "correctiveActions": "立即更换受损电机",
    "preventiveActions": "修订维护计划，增加巡检频率",
    "learnedLessons": "预防性维护比事后维修更重要",
    "preparedBy": "质量工程师-周八"
  }'
```

---

### 步骤11：审批复盘报告

```bash
# 提交审批
curl -X POST http://localhost:3000/api/line-stops/reports/{报告ID}/submit \
  -H "Content-Type: application/json" \
  -d '{"operator": "质量工程师-周八"}'

# 审批通过
curl -X POST http://localhost:3000/api/line-stops/reports/{报告ID}/approve \
  -H "Content-Type: application/json" \
  -d '{
    "operator": "生产总监-吴九",
    "comments": "报告分析深入，预防措施可行"
  }'
```

**结果**：事件状态变为 COMPLETED（已完成归档）

---

### 步骤12：查看完整汇总

```bash
# 查看事件汇总
curl http://localhost:3000/api/line-stops/{事件ID}/summary

# 查看状态历史时间轴
curl http://localhost:3000/api/line-stops/{事件ID}/history
```

## API 参考

### 停线事件

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/line-stops | 创建停线事件 |
| GET | /api/line-stops | 查询事件列表（支持分页、状态筛选） |
| GET | /api/line-stops/:id | 查看事件详情 |
| GET | /api/line-stops/:id/summary | 查看完整汇总 |
| GET | /api/line-stops/:id/history | 查看状态历史 |
| GET | /api/line-stops/constants | 查看状态常量和流转规则 |

### 原因管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/line-stops/:id/reasons | 提交停线原因 |
| GET | /api/line-stops/:id/reasons | 查看原因列表 |
| GET | /api/line-stops/:id/reasons/conflicts | 检测原因冲突 |
| POST | /api/line-stops/reasons/:id/confirm | 确认原因 |
| POST | /api/line-stops/reasons/:id/reject | 拒绝原因 |

### 责任管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/line-stops/:id/responsibilities | 分配责任 |
| GET | /api/line-stops/:id/responsibilities | 查看责任记录 |
| POST | /api/line-stops/responsibilities/:id/appeal | 申诉责任 |
| POST | /api/line-stops/responsibilities/:id/finalize | 终审责任 |

### 复产管理

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/line-stops/:id/recovery | 开始复产 |
| GET | /api/line-stops/:id/recovery | 查看复产记录 |
| PUT | /api/line-stops/recovery/:id | 更新复产进度 |
| POST | /api/line-stops/recovery/:id/complete | 完成复产 |
| POST | /api/line-stops/recovery/:id/fail | 标记复产失败 |

### 复盘报告

| 方法 | 路径 | 功能 |
|------|------|------|
| POST | /api/line-stops/:id/reports | 创建复盘报告 |
| GET | /api/line-stops/:id/reports | 查看报告列表 |
| PUT | /api/line-stops/reports/:id | 更新报告 |
| POST | /api/line-stops/reports/:id/submit | 提交审批 |
| POST | /api/line-stops/reports/:id/approve | 审批通过 |
| POST | /api/line-stops/reports/:id/reject | 审批拒绝 |

## 错误处理

服务会返回清晰的错误信息，包含：
- `code`：错误代码
- `message`：错误说明
- `details`：详细信息（如有）

**示例**：
```json
{
  "success": false,
  "error": {
    "code": "STATE_TRANSITION_ERROR",
    "message": "无法执行「分配责任」: 当前状态「事件已创建，待分析原因(CREATED)」不允许此操作",
    "details": {
      "allowedStatuses": "REASON_CONFIRMED(原因已确认，待分配责任)"
    }
  }
}
```

## 项目结构

```
src/
├── config/           # 配置文件
├── controllers/      # API 控制器
├── middleware/       # 中间件（验证、错误处理）
├── models/           # 数据模型
├── routes/           # API 路由
├── services/         # 核心业务逻辑
├── utils/            # 工具函数和常量
└── app.js            # 应用入口

tests/
└── api-test.js       # 完整测试脚本

data/                 # SQLite 数据库文件
logs/                 # 日志文件
```

## 关键设计

### 防错机制

1. **非法状态流转拦截** - 每个操作都有状态前置检查
2. **重复提交保护** - 同一来源同类原因只能有一个待确认记录
3. **已完成操作幂等** - 重复确认/审批不会报错
4. **参数验证** - 所有请求参数使用 Joi 验证
5. **乐观锁** - 每个模型有 version 字段

### 冲突检测

- **跨类别冲突**：设备/物料/人员各有一条时，标记为冲突
- **类别内冲突**：同一类别下多条待确认记录
- 提供清晰的冲突说明和处理建议

### 申诉流程

- 申诉后责任状态变为 APPEALED
- 事件状态回退到 REASON_CONFIRMED
- 可以创建新的责任记录替代
- 旧的申诉记录保留作为历史

## 可扩展性

- **新增业务规则**：在 `services/` 中扩展
- **新增数据模型**：在 `models/` 中添加
- **新增 API 端点**：在 `routes/` 和 `controllers/` 中添加
- **替换数据库**：修改 `config/database.js`（当前使用 SQLite，可切换到 MySQL/PostgreSQL）

## 许可证

MIT
