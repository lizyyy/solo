# 档案馆低氧库房管理后端服务

## 项目简介

这是一个用于档案馆低氧库房开库前放行审批的后端服务系统。系统通过导入库房氧浓度/温湿度数据、门禁维修记录和调阅任务单，自动检测开库风险，支持人工复核，并能够导出开库放行单和审计包。

## 主要功能

### 1. 数据导入
- **库房氧浓度/温湿度 CSV 导入**：支持导入多时间点的环境监测数据
- **门禁维修 JSON 导入**：支持导入门禁系统维修记录
- **调阅单导入**：支持 CSV 和 JSON 两种格式的调阅任务单

### 2. 风险规则检测
系统自动检测以下五种风险类型：

| 风险类型 | 说明 | 严重程度 |
|---------|------|---------|
| 氧浓度回升不足 | 氧浓度未恢复到安全阈值（20.5%） | 中/高/严重 |
| 温湿度越界 | 温度（14-24°C）或湿度（40-60%）超出正常范围 | 中/高 |
| 门禁维修未闭环 | 门禁系统维修记录状态非"closed" | 中/高/严重 |
| 同一密集架重复调阅 | 同一密集架在同一天有多个调阅任务 | 中/高 |
| 人员资质不匹配 | 调阅人员资质不在有效列表中 | 中/高 |

### 3. 人工复核
- 支持三种复核决定：确认风险、驳回风险、升级处理
- 复核时必须提供复核意见
- 复核记录持久化保存

### 4. 导出功能
- **Markdown 开库放行单**：包含库房情况、调阅任务、风险清单、放行结论
- **JSON 审计包**：包含完整数据和审计信息

## 技术栈

- **运行环境**：Node.js 16+
- **Web 框架**：Express.js
- **文件上传**：Multer
- **数据验证**：Joi
- **日期处理**：Day.js
- **CSV 解析**：csv-parser
- **UUID 生成**：uuid

## 项目结构

```
xy4386/
├── src/
│   ├── config.js              # 系统配置
│   ├── index.js               # 主入口文件
│   ├── data/
│   │   └── store.js           # 数据持久化层
│   ├── routes/
│   │   ├── importRoutes.js    # 导入路由
│   │   ├── riskRoutes.js      # 风险路由
│   │   ├── reviewRoutes.js    # 复核路由
│   │   └── exportRoutes.js    # 导出路由
│   ├── services/
│   │   ├── importService.js   # 导入服务
│   │   ├── riskService.js     # 风险检测服务
│   │   ├── reviewService.js   # 复核服务
│   │   └── exportService.js   # 导出服务
│   └── utils/
│       ├── csvParser.js       # CSV 解析器
│       └── validator.js       # 数据验证器
├── examples/                   # 示例数据
│   ├── warehouse_data.csv
│   ├── warehouse_data_2.csv
│   ├── access_control_repairs.json
│   ├── retrieval_tasks.json
│   └── retrieval_tasks.csv
├── data/                       # 运行时数据存储
├── exports/                    # 导出文件存储
├── temp/                       # 临时文件
├── package.json
└── README.md
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

开发模式（带自动重启）：
```bash
npm run dev
```

服务启动后访问：
- 首页：http://localhost:3000
- 健康检查：http://localhost:3000/api/health

## API 接口说明

### 数据导入接口

#### 导入库房氧浓度/温湿度 CSV
```
POST /api/import/warehouse
Content-Type: multipart/form-data

参数:
- file: CSV 文件
```

**CSV 格式说明：**
| 字段 | 说明 | 示例 |
|------|------|------|
| warehouseId | 库房编号 | WH-001 |
| warehouseName | 库房名称 | 低氧库房一号 |
| timestamp | 时间戳 | 2026-05-04 00:00:00 |
| oxygen | 氧浓度(%) | 18.5 |
| temperature | 温度(°C) | 22 |
| humidity | 湿度(%) | 45 |

#### 导入门禁维修 JSON
```
POST /api/import/access-control
Content-Type: multipart/form-data

参数:
- file: JSON 文件
```

**JSON 格式说明：**
```json
{
  "repairs": [
    {
      "repairId": "REP-2026-001",
      "warehouseId": "WH-001",
      "repairDate": "2026-04-28",
      "description": "门禁读卡器故障",
      "status": "in_progress",
      "assignee": "张维修",
      "closedDate": null
    }
  ]
}
```

状态说明：`open`（待处理）、`in_progress`（进行中）、`closed`（已关闭）

#### 导入调阅单
```
POST /api/import/retrieval
Content-Type: multipart/form-data

参数:
- file: CSV 或 JSON 文件
```

**JSON 格式说明：**
```json
{
  "tasks": [
    {
      "taskId": "TASK-2026-0504-001",
      "warehouseId": "WH-001",
      "date": "2026-05-04",
      "rackId": "RACK-01-A",
      "personnel": [
        {
          "id": "EMP-001",
          "name": "张三",
          "qualification": "档案管理员"
        }
      ]
    }
  ]
}
```

有效资质：`档案管理员`、`高级档案管理员`、`库房管理员`、`调阅人员`

#### 批量导入所有类型数据
```
POST /api/import/all
Content-Type: multipart/form-data

参数:
- warehouse: 库房 CSV 文件（可多个）
- accessControl: 门禁维修 JSON 文件
- retrieval: 调阅单文件
```

### 风险检测接口

#### 重新计算所有风险
```
POST /api/risk/recalculate
Content-Type: application/json

请求体:
{
  "date": "2026-05-04"  // 可选，指定日期
}
```

#### 获取风险清单
```
GET /api/risk

查询参数（可选）:
- warehouseId: 按库房筛选
- type: 按风险类型筛选
- status: 按状态筛选 (pending/reviewed)
- severity: 按严重程度筛选 (critical/high/medium/low)
```

#### 获取风险详情
```
GET /api/risk/:riskId
```

#### 获取风险统计摘要
```
GET /api/risk/summary
```

### 人工复核接口

#### 复核风险（人工改判）
```
POST /api/review
Content-Type: application/json

请求体:
{
  "riskId": "风险ID",
  "reviewerId": "复核人ID",
  "reviewerName": "复核人姓名",
  "decision": "confirm",  // confirm/dismiss/escalate
  "comments": "复核意见（必填）"
}
```

复核决定说明：
- `confirm`：确认风险（风险成立）
- `dismiss`：驳回风险（风险不成立）
- `escalate`：升级处理（需要更高层级审批）

#### 获取复核记录列表
```
GET /api/review

查询参数（可选）:
- riskId: 按风险ID筛选
- decision: 按复核决定筛选
```

#### 获取复核统计摘要
```
GET /api/review/summary
```

### 导出接口

#### 导出 Markdown 开库放行单
```
GET /api/export/markdown

查询参数:
- date: 指定日期（可选）
- download: true/false（可选，是否直接下载）
```

#### 导出 JSON 审计包
```
GET /api/export/json

查询参数:
- date: 指定日期（可选）
- download: true/false（可选，是否直接下载）
```

#### 同时导出两种格式
```
GET /api/export/both

查询参数:
- date: 指定日期（可选）
```

#### 获取开库放行结论
```
GET /api/export/release-decision
```

## 使用示例流程

### 1. 准备示例数据

项目 `examples/` 目录下提供了完整的示例数据：

- `warehouse_data.csv` - 库房一号数据（包含氧浓度不足和温湿度越界）
- `warehouse_data_2.csv` - 库房二号数据（正常数据）
- `access_control_repairs.json` - 门禁维修记录（包含未闭环维修）
- `retrieval_tasks.json` - 调阅任务（包含重复调阅和资质不匹配）
- `retrieval_tasks.csv` - CSV 格式调阅任务

### 2. 完整测试流程

```bash
# 1. 安装依赖
npm install

# 2. 启动服务
npm start

# 3. 导入库房数据
curl -X POST http://localhost:3000/api/import/warehouse \
  -F "file=@examples/warehouse_data.csv"

curl -X POST http://localhost:3000/api/import/warehouse \
  -F "file=@examples/warehouse_data_2.csv"

# 4. 导入门禁维修记录
curl -X POST http://localhost:3000/api/import/access-control \
  -F "file=@examples/access_control_repairs.json"

# 5. 导入调阅任务
curl -X POST http://localhost:3000/api/import/retrieval \
  -F "file=@examples/retrieval_tasks.json"

# 6. 执行风险检测
curl -X POST http://localhost:3000/api/risk/recalculate \
  -H "Content-Type: application/json" \
  -d '{"date": "2026-05-04"}'

# 7. 查看风险清单
curl http://localhost:3000/api/risk

# 8. 人工复核风险（假设风险ID为 xxx）
curl -X POST http://localhost:3000/api/review \
  -H "Content-Type: application/json" \
  -d '{
    "riskId": "风险ID",
    "reviewerId": "R001",
    "reviewerName": "王主管",
    "decision": "confirm",
    "comments": "经核实，氧浓度确实未恢复到安全水平"
  }'

# 9. 导出开库放行单
curl http://localhost:3000/api/export/markdown?date=2026-05-04

# 10. 导出审计包
curl http://localhost:3000/api/export/json?date=2026-05-04

# 11. 获取放行结论
curl http://localhost:3000/api/export/release-decision
```

### 3. 预期风险检测结果

使用示例数据时，系统将检测到以下风险：

1. **氧浓度回升不足**：WH-001 氧浓度 20.3% < 20.5% 阈值
2. **温湿度越界**：WH-001 部分记录温度 25-26°C，湿度 52-55%
3. **门禁维修未闭环**：REP-2026-001（in_progress）、REP-2026-002（open）
4. **同一密集架重复调阅**：RACK-01-A 有 TASK-001 和 TASK-002 两个任务
5. **人员资质不匹配**：EMP-003（王五）资质为"实习生"，不在有效列表中

## 配置说明

修改 `src/config.js` 可调整系统参数：

```javascript
{
  server: {
    port: 3000,      // 服务端口
    host: 'localhost' // 绑定地址
  },
  risk: {
    oxygen: {
      recoveryThreshold: 20.5,    // 氧浓度恢复阈值 (%)
      minAcceptableValue: 19.5,   // 最低可接受值 (%)
      recoveryTimeWindow: 24       // 恢复时间窗口 (小时)
    },
    temperature: {
      min: 14,    // 最低温度 (°C)
      max: 24     // 最高温度 (°C)
    },
    humidity: {
      min: 40,    // 最低湿度 (%)
      max: 60     // 最高湿度 (%)
    }
  },
  personnel: {
    validQualifications: [
      '档案管理员',
      '高级档案管理员',
      '库房管理员',
      '调阅人员'
    ]
  }
}
```

## 数据持久化

系统使用文件系统进行数据持久化：

- `data/warehouses.json` - 库房数据
- `data/tasks.json` - 调阅任务
- `data/risks.json` - 风险记录
- `data/reviews.json` - 复核记录

导出文件保存在：
- `exports/` - Markdown 放行单和 JSON 审计包

## 注意事项

1. 系统为本地开发设计，不包含用户认证和权限管理
2. 数据存储使用本地文件系统，不适合高并发生产环境
3. 示例数据中的日期为 2026-05-04，测试时可根据实际日期调整
4. 风险检测是在导入数据后手动触发，或通过 `/api/risk/recalculate` 接口触发

## 许可证

MIT License
