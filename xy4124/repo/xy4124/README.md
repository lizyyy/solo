# 影厅密钥排片卫士

为独立电影院排片经理提供的本地纯后端 API，用于验证排片、KDM 密钥、设备匹配等，避免临开场才发现密钥过期、错厅放映或版本语言不匹配的问题。

## 功能特性

- **数据存储**：使用 SQLite 本地存储影片版本、影厅设备、KDM、排片、放映检查和审计日志
- **规则引擎**：
  - 时间冲突检查
  - 片长缓冲检查
  - KDM 覆盖窗口检查
  - 设备格式/语言/字幕匹配检查
  - 设备状态检查
- **导入导出**：
  - 导入排片 CSV 时自动执行所有校验规则
  - 导出风险清单 CSV
  - 导出 Markdown 交接班报告
- **放映前检查**：提供放行/阻断原因
- **审计日志**：记录所有操作
- **REST API + OpenAPI**：完整的 API 文档

## 技术栈

- **运行时**：Node.js 18+
- **语言**：TypeScript
- **Web 框架**：Express
- **数据库**：SQLite (better-sqlite3)
- **测试框架**：Vitest
- **API 文档**：Swagger/OpenAPI

## 项目结构

```
.
├── src/
│   ├── index.ts              # 应用入口
│   ├── openapi.ts             # OpenAPI 配置
│   ├── models/                # 数据模型
│   │   ├── index.ts
│   │   ├── common.ts          # 通用类型
│   │   ├── film.ts            # 影片版本
│   │   ├── auditorium.ts      # 影厅设备
│   │   ├── kdm.ts             # KDM 密钥
│   │   ├── schedule.ts        # 排片
│   │   ├── projectionCheck.ts # 放映检查
│   │   └── audit.ts           # 审计日志
│   ├── storage/               # 存储层
│   │   ├── index.ts
│   │   ├── database.ts        # 数据库连接和初始化
│   │   └── repositories.ts    # 数据访问层
│   ├── rules/                 # 规则引擎
│   │   ├── index.ts
│   │   ├── engine.ts          # 规则实现
│   │   └── engine.test.ts     # 规则测试
│   ├── services/              # 业务服务
│   │   └── projectionService.ts
│   ├── routes/                # API 路由
│   │   ├── index.ts
│   │   ├── filmVersions.ts
│   │   ├── auditoriums.ts
│   │   ├── kdms.ts
│   │   ├── schedules.ts
│   │   ├── importExport.ts
│   │   └── audit.ts
│   └── importExport/          # 导入导出
│       ├── index.ts
│       ├── csv.ts             # CSV 处理
│       └── markdown.ts        # Markdown 报告生成
├── data/                      # 数据库文件目录 (运行时生成)
├── package.json
├── tsconfig.json
├── vitest.config.ts
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 启动开发服务器

```bash
npm run dev
```

服务器将在 `http://localhost:3000` 启动。

### 3. 访问 API 文档

启动后访问：
- Swagger UI: http://localhost:3000/api-docs
- OpenAPI 规范: http://localhost:3000/api-docs.json
- 健康检查: http://localhost:3000/api/health

### 4. 运行测试

```bash
npm test
```

### 5. 类型检查

```bash
npm run typecheck
```

### 6. 构建生产版本

```bash
npm run build
```

## API 使用指南

### 基础数据录入

在使用排片功能前，需要先录入基础数据：

#### 1. 添加影厅设备

```bash
curl -X POST http://localhost:3000/api/v1/auditoriums \
  -H "Content-Type: application/json" \
  -H "X-Actor: admin" \
  -d '{
    "auditoriumId": "aud-001",
    "auditoriumName": "1号厅",
    "seatCount": 150,
    "supportedFormats": {
      "aspectRatios": ["1.85", "2.39"],
      "soundFormats": ["dolby_5_1", "dolby_7_1", "dolby_atmos"]
    },
    "status": "operational"
  }'
```

#### 2. 添加影片版本

```bash
curl -X POST http://localhost:3000/api/v1/film-versions \
  -H "Content-Type: application/json" \
  -H "X-Actor: admin" \
  -d '{
    "filmId": "film-001",
    "filmTitle": "流浪地球3",
    "versionId": "ver-001",
    "versionName": "中文2D版",
    "audioLanguage": "zh-CN",
    "subtitleLanguage": "zh-CN",
    "subtitleType": "embedded",
    "aspectRatio": "2.39",
    "soundFormat": "dolby_5_1",
    "runtimeMinutes": 142,
    "dcpHash": "dcp-hash-001"
  }'
```

#### 3. 添加 KDM 密钥

```bash
curl -X POST http://localhost:3000/api/v1/kdms \
  -H "Content-Type: application/json" \
  -H "X-Actor: admin" \
  -d '{
    "kdmId": "kdm-001",
    "filmId": "film-001",
    "versionId": "ver-001",
    "auditoriumId": "aud-001",
    "validity": {
      "start": "2026-05-01T00:00:00.000Z",
      "end": "2026-05-10T23:59:59.000Z"
    },
    "cplId": "cpl-001",
    "issuer": "发行方",
    "issuerOrg": "发行公司",
    "contentTitleText": "流浪地球3"
  }'
```

### 排片管理

#### 单条添加排片

```bash
curl -X POST http://localhost:3000/api/v1/schedules \
  -H "Content-Type: application/json" \
  -H "X-Actor: scheduler" \
  -d '{
    "scheduleId": "SCH-20260502-001",
    "filmId": "film-001",
    "versionId": "ver-001",
    "auditoriumId": "aud-001",
    "showTime": {
      "start": "2026-05-02T14:00:00.000Z",
      "end": "2026-05-02T16:30:00.000Z"
    },
    "preShowMinutes": 10,
    "bufferMinutesBefore": 5,
    "bufferMinutesAfter": 10
  }'
```

**响应示例（包含检查结果）：**

```json
{
  "schedule": { ... },
  "checkResult": {
    "scheduleId": "SCH-20260502-001",
    "overallStatus": "pass",
    "checks": [
      {
        "ruleId": "time_conflict",
        "ruleName": "时间冲突检查",
        "status": "pass",
        "message": "时间无冲突"
      },
      {
        "ruleId": "runtime_buffer",
        "ruleName": "片长缓冲检查",
        "status": "pass",
        "message": "时长充足"
      },
      {
        "ruleId": "kdm_coverage",
        "ruleName": "KDM覆盖窗口检查",
        "status": "pass",
        "message": "KDM覆盖有效"
      },
      {
        "ruleId": "device_format_match",
        "ruleName": "设备格式匹配检查",
        "status": "pass",
        "message": "设备格式匹配"
      },
      {
        "ruleId": "device_status",
        "ruleName": "设备状态检查",
        "status": "pass",
        "message": "设备状态正常"
      },
      {
        "ruleId": "language_subtitle_match",
        "ruleName": "语言字幕匹配检查",
        "status": "pass",
        "message": "语言字幕信息完整"
      }
    ],
    "checkedAt": "2026-05-02T08:00:00.000Z"
  }
}
```

#### 放映前手动检查

```bash
curl -X POST http://localhost:3000/api/v1/schedules/SCH-20260502-001/check \
  -H "X-Actor: projectionist"
```

#### 批量检查所有排片

```bash
curl -X POST http://localhost:3000/api/v1/schedules/check-all \
  -H "X-Actor: scheduler"
```

### CSV 导入排片

**CSV 文件格式示例** (`schedules.csv`)：

```csv
filmId,filmTitle,versionId,versionName,auditoriumId,auditoriumName,startTime,endTime,preShowMinutes,bufferMinutesBefore,bufferMinutesAfter
film-001,流浪地球3,ver-001,中文2D版,aud-001,1号厅,2026-05-02T14:00:00.000Z,2026-05-02T16:30:00.000Z,10,5,10
film-001,流浪地球3,ver-001,中文2D版,aud-001,1号厅,2026-05-02T19:00:00.000Z,2026-05-02T21:30:00.000Z,10,5,10
```

**导入 API：**

```bash
curl -X POST http://localhost:3000/api/v1/import-export/schedules/import \
  -H "Content-Type: application/json" \
  -H "X-Actor: scheduler" \
  -d '{
    "csv": "filmId,filmTitle,versionId,versionName,auditoriumId,auditoriumName,startTime,endTime,preShowMinutes,bufferMinutesBefore,bufferMinutesAfter\nfilm-001,流浪地球3,ver-001,中文2D版,aud-001,1号厅,2026-05-02T14:00:00.000Z,2026-05-02T16:30:00.000Z,10,5,10"
  }'
```

### 导出功能

#### 导出风险清单 CSV

```bash
curl -o risk_report.csv http://localhost:3000/api/v1/import-export/risks/export \
  -H "X-Actor: scheduler"
```

#### 导出 Markdown 交接班报告

```bash
curl -o handover_report.md http://localhost:3000/api/v1/import-export/handover-report?date=2026-05-02 \
  -H "X-Actor: scheduler"
```

#### 导出排片表 CSV

```bash
curl -o schedules.csv http://localhost:3000/api/v1/import-export/schedules/export \
  -H "X-Actor: scheduler"
```

### 审计日志

```bash
# 获取最近 100 条日志
curl http://localhost:3000/api/v1/audit-logs

# 按时间范围查询
curl "http://localhost:3000/api/v1/audit-logs?start=2026-05-01T00:00:00.000Z&end=2026-05-02T23:59:59.000Z"

# 按实体查询
curl http://localhost:3000/api/v1/audit-logs/entity/schedule/SCH-20260502-001
```

## 检查状态说明

| 状态 | 说明 |
|------|------|
| `pass` | 放行 - 所有检查通过 |
| `warn` | 警告 - 存在潜在问题，建议关注 |
| `block` | 阻断 - 存在严重问题，必须解决 |

## 规则引擎说明

系统包含以下自动检查规则：

### 1. 时间冲突检查 (`time_conflict`)
检查当前排片是否与同影厅其他排片时间重叠。

### 2. 片长缓冲检查 (`runtime_buffer`)
验证排片时长是否包含：预告时间 + 前置缓冲 + 影片片长 + 后置缓冲。

### 3. KDM 覆盖窗口检查 (`kdm_coverage`)
确认排片时间完全在 KDM 密钥有效期内。

### 4. 设备格式匹配检查 (`device_format_match`)
检查影片的宽高比和音效格式是否与影厅设备兼容。

### 5. 设备状态检查 (`device_status`)
验证影厅设备是否处于可运营状态（运营/维护/离线）。

### 6. 语言字幕匹配检查 (`language_subtitle_match`)
确认影片语言信息完整。

## 环境变量

| 变量名 | 默认值 | 说明 |
|--------|--------|------|
| `PORT` | `3000` | 服务端口 |
| `DB_PATH` | `./data/cinema-guardian.db` | SQLite 数据库路径 |

## 数据库结构

系统使用 SQLite 数据库，包含以下表：

| 表名 | 说明 |
|------|------|
| `film_versions` | 影片版本信息 |
| `auditorium_devices` | 影厅设备信息 |
| `kdms` | KDM 密钥信息 |
| `schedules` | 排片信息 |
| `projection_checks` | 放映检查记录 |
| `audit_logs` | 操作审计日志 |

## 常见问题

### Q: 如何重置数据库？

删除 `data` 目录下的数据库文件，服务重启时会自动创建新数据库。

### Q: 如何添加新的检查规则？

在 `src/rules/engine.ts` 中实现新的 `Rule` 对象，并将其添加到 `defaultRules` 数组。

### Q: 是否支持多影院？

当前版本是单影院设计。如需支持多影院，可在各表中添加 `cinema_id` 字段进行扩展。

## 许可证

MIT License
