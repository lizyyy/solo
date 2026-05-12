# 养老院护理交接 API

一个围绕清晰状态流转设计的养老院护理交接系统后端 API。

## 功能特性

### 核心功能
- **老人档案管理**：支持高风险等级标记、归档
- **护理事项管理**：用药、生命体征、活动等类型，支持接班确认
- **班次交接流程**：早晚班完整交接链条，支持撤销
- **家属备注查询**：重要事项标记
- **风险升级提醒**：高风险老人自动产生提醒

### 边界情况处理
- ✅ **未接班确认就关闭事项**：需要接班确认的事项不能直接关闭
- ✅ **用药重复确认**：同一护理事项不能重复标记完成
- ✅ **高风险老人缺少提醒**：班次开始时自动检查并产生高风险提醒
- ✅ **已归档交接被修改**：已归档的老人档案禁止修改
- ✅ **重复导入/提交**：同日期同类型班次不能重复创建
- ✅ **重复请求幂等性**：支持 `X-Idempotency-Key` 请求头防重复

## 技术栈

- **后端框架**：Node.js + Express
- **数据库**：SQLite (better-sqlite3)
- **状态管理**：数据库级状态约束

## 快速开始

### 安装依赖
```bash
npm install
```

### 启动服务
```bash
npm start
```
服务运行在 http://localhost:3000

### 运行演示
在服务启动后，新开一个终端运行：
```bash
npm run demo
```

演示将完整展示：
- 早晚班交接流程
- 各种边界情况的系统拦截
- 审计查询功能

## API 接口

### 老人档案 `/api/elders`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询老人列表 |
| GET | /:id | 查询单个老人 |
| POST | / | 创建老人档案 |
| PUT | /:id | 修改老人档案 |
| POST | /:id/archive | 归档老人 |
| GET | /:id/family-notes | 查询家属备注 |
| POST | /:id/family-notes | 添加家属备注 |

### 护理事项 `/api/care-items`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询护理事项列表 |
| GET | /:id | 查询单个事项 |
| POST | / | 创建护理事项 |
| POST | /:id/complete | 标记完成 |
| POST | /:id/close-without-ack | 无需确认关闭（仅非确认型事项） |
| POST | /:id/cancel | 取消事项 |
| GET | /:id/logs | 操作日志 |

### 班次与交接 `/api/shifts`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | / | 查询班次列表 |
| GET | /:id | 查询单个班次 |
| POST | / | 创建班次 |
| POST | /:id/start | 开始班次 |
| POST | /:id/handover/submit | 提交交接 |
| POST | /:id/handover/acknowledge | 确认接班 |
| POST | /:id/handover/revoke | 撤销交接（未确认时） |
| GET | /:id/handover | 查询交接记录 |
| GET | /:id/risk-alerts | 查询本班风险提醒 |
| POST | /risk-alerts/:id/acknowledge | 确认提醒 |

### 审计查询 `/api/audit`
| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /operation-logs | 所有操作日志 |
| GET | /blocked-operations | 被系统拦截的操作 |
| GET | /pending-items-summary | 未完成事项汇总 |
| GET | /handover-history | 交接历史 |
| GET | /risk-alerts-summary | 风险提醒汇总 |

## 状态流转设计

### 护理事项状态
```
pending (待处理)
    ↓
in_progress (进行中)
    ↓
    ├→ completed (已完成)
    ├→ cancelled (已取消)
    └→ closed_without_ack (无需确认关闭)
```

### 班次状态
```
scheduled (已排期)
    ↓
active (进行中)
    ↓
handover_submitted (已提交交接)
    ↓
    ├→ handover_acknowledged (交接已确认)
    └→ 撤销 → active (回到进行中)
```

## 幂等性使用

在请求头中添加 `X-Idempotency-Key`：
```bash
curl -X POST http://localhost:3000/api/care-items \
  -H "Content-Type: application/json" \
  -H "X-Idempotency-Key: your-unique-key-123" \
  -d '{"elder_id": "...", "title": "..."}'
```

重复相同幂等键的请求会被识别并返回成功，不会重复执行。

## 数据模型

### elders（老人表）
- id, name, room_number, bed_number
- risk_level: normal/high/critical
- status: active/archived
- medical_conditions, allergies

### care_items（护理事项表）
- id, elder_id, type, title, description
- scheduled_time, frequency
- requires_acknowledgment: boolean
- status: pending/in_progress/completed/cancelled/closed_without_ack

### shifts（班次表）
- id, type: morning/night, date, nurse_name
- started_at, ended_at
- status: scheduled/active/handover_submitted/handover_acknowledged/completed

### shift_handover（交接记录表）
- id, shift_id, next_shift_id
- submitted_by, submitted_at
- acknowledged_by, acknowledged_at
- status: draft/submitted/acknowledged/revoked
- request_id (幂等键)

## 演示场景

运行 `npm run demo` 可以看到以下场景：

1. 创建3位老人（含2位高风险）
2. 添加护理事项和家属备注
3. 夜班开始，完成部分事项
4. 演示边界情况拦截：
   - 重复完成护理事项
   - 未接班确认就关闭事项
   - 重复创建班次
5. 完整交接流程：提交 → 撤销 → 重新提交 → 确认接班
6. 演示幂等性请求
7. 演示归档后禁止修改
8. 各类审计查询统计

## 目录结构

```
.
├── src/
│   ├── server.js          # 主服务入口
│   ├── database.js        # 数据库初始化
│   ├── middleware.js      # 中间件
│   └── routes/
│       ├── elders.js      # 老人档案路由
│       ├── care-items.js  # 护理事项路由
│       ├── shifts.js      # 班次交接路由
│       └── audit.js       # 审计查询路由
├── demo/
│   └── run-demo.js        # 演示脚本
├── data/                  # SQLite 数据目录
├── package.json
└── README.md
```
