# 港口调度系统 API

> 解决船期导入混乱问题，提供智能验证、分类管理、重复检测功能

## 功能特性

- ✅ **多格式导入** - 支持 CSV 船期表、JSON 泊位配置、CSV 潮汐表
- 🧠 **智能验证** - 5 条核心规则覆盖吃水限制、跨日窗口、临时插队等
- 📊 **结果分类** - 自动分为正常项、待确认项、失败项
- 🔒 **重复检测** - 同批次数据再次提交自动去重
- 📝 **失败溯源** - 保留原始数据并提供处理建议
- 🔄 **支持重跑** - 清除批次后可重新导入

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动

### 3. 运行测试（新终端窗口）

```bash
npm test
```

## API 端点

### 导入数据（文件上传）

```bash
POST /api/import
Content-Type: multipart/form-data

参数:
  schedules: 船期CSV文件 (必需)
  berths: 泊位JSON文件 (必需)
  tides: 潮汐CSV文件 (可选)
```

**示例:**
```bash
curl -X POST http://localhost:3000/api/import \
  -F "schedules=@sample-data/schedules.csv" \
  -F "berths=@sample-data/berths.json" \
  -F "tides=@sample-data/tides.csv"
```

### 导入数据（JSON）

```bash
POST /api/import/json
Content-Type: application/json

{
  "schedules": [...],
  "berths": [...],
  "tides": [...]
}
```

### 获取所有批次

```bash
GET /api/batches
```

### 获取批次详情

```bash
GET /api/batches/{batchId}
```

### 清除批次（允许重跑）

```bash
DELETE /api/batches/{batchId}
```

### 获取验证规则列表

```bash
GET /api/rules
```

## 验证规则

| 规则名称 | 检查内容 |
|---------|---------|
| 吃水限制规则 | 船舶吃水 vs 泊位深度 + 潮汐 |
| 跨日窗口规则 | 作业时长、跨日夜间作业审批 |
| 临时插队规则 | 优先级船舶冲突检测与确认 |
| 货种匹配规则 | 泊位允许货种验证 |
| 维护期冲突规则 | 泊位维护计划检查 |

## 数据格式

### 船期 CSV 字段

| 字段 | 说明 | 示例 |
|------|------|------|
| vesselName | 船名 | 中远上海号 |
| vesselImo | IMO编号 | 9757127 |
| vesselAgent | 船代 | 中远船代 |
| arrivalTime | 到港时间 | 2026-05-25T08:00:00 |
| departureTime | 离港时间 | 2026-05-25T20:00:00 |
| berthId | 泊位ID | B01 |
| draft | 吃水(米) | 11.5 |
| cargoType | 货种 | 集装箱 |
| isPriority | 是否优先级 | true/false |
| confirmedByAgent | 船代确认 | true/false |

### 泊位 JSON 字段

```json
{
  "id": "B01",
  "name": "1号集装箱泊位",
  "maxDepth": 15.0,
  "minDepth": 12.0,
  "allowedCargoTypes": ["集装箱", "散货"],
  "isAvailable": true,
  "maintenanceStart": "2026-05-28T00:00:00",
  "maintenanceEnd": "2026-05-30T23:59:59"
}
```

### 潮汐 CSV 字段

| 字段 | 说明 |
|------|------|
| date | 日期 (YYYY-MM-DD) |
| time | 时间 (HH:mm) |
| height | 潮高(米) |
| type | 潮型 (HIGH/LOW) |

## 返回结果示例

```json
{
  "success": true,
  "data": {
    "batchId": "uuid",
    "totalProcessed": 9,
    "normal": [
      {
        "record": { ... },
        "originalData": { ... },
        "suggestions": []
      }
    ],
    "pending": [
      {
        "record": { ... },
        "originalData": { ... },
        "errorReason": "跨日作业，需确认夜班安排",
        "suggestions": ["通知夜班调度", "确认拖轮 availability"]
      }
    ],
    "failed": [
      {
        "record": { ... },
        "originalData": { ... },
        "errorReason": "泊位 B99 不存在",
        "suggestions": ["请检查泊位编号是否正确"]
      }
    ],
    "duplicates": 0,
    "importTime": "2026-05-20T..."
  },
  "message": "导入完成：成功 X 条，待确认 X 条，失败 X 条，重复 X 条"
}
```

## 复跑说明

如需重新导入同一批数据：

1. 获取批次ID（从导入返回结果或 `/api/batches`）
2. 调用清除接口：
```bash
curl -X DELETE http://localhost:3000/api/batches/{batchId}
```
3. 重新导入

## 生产构建

```bash
npm run build
npm start
```

## 项目结构

```
port-scheduling-api/
├── src/
│   ├── types.ts                    # 类型定义
│   ├── server.ts                   # API 服务器
│   └── services/
│       ├── validation.service.ts   # 验证规则引擎
│       └── import.service.ts       # 导入服务
├── sample-data/                    # 示例数据
│   ├── schedules.csv
│   ├── berths.json
│   └── tides.csv
├── test/
│   └── import-test.js              # 测试脚本
├── package.json
└── tsconfig.json
```