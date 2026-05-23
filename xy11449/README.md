# 充电桩巡检权限追责台账 API

解决离线告警恢复后工单还挂着、月报故障时长偏大的问题。实现桩端告警、巡检表、客服投诉单、处理人、导出数据互相印证。

## 核心特性

- **多源数据互证**: 桩端告警、巡检表、客服投诉单、临时补录单互相印证
- **完整工作流**: 草稿→提交→驳回→二次确认→冻结→导出
- **幂等去重**: 重复请求更新同一条事实，不重复计算
- **证据链完整**: 导入时保留来源文件、原始行号、原始数据，改判不覆盖证据
- **变更可追溯**: 所有人工修改记录变更原因、前后值、操作人
- **角色视图**: 片区经理关注角色视图、变更原因、敏感字段处理
- **脱敏导出**: 导出前冻结，支持敏感字段脱敏
- **异常不吞**: 边界情况（重复提交、撤回、部分失败、人工改判）明确报错

## 目录结构

```
src/
├── models/types.ts          # 核心类型定义
├── store/fileStore.ts       # 文件存储层
├── utils/crypto.ts          # 加密、去重、脱敏工具
├── importers/               # 数据导入模块
│   ├── baseImporter.ts      # 基础导入器
│   ├── pileAlarmImporter.ts # 桩端告警导入
│   ├── inspectionImporter.ts # 巡检表导入
│   └── complaintImporter.ts # 投诉单导入
├── services/                # 业务逻辑层
│   ├── ledgerService.ts     # 台账核心服务
│   └── exportService.ts     # 导出和报告服务
├── api/ledger.ts            # REST API 接口
├── cli/index.ts             # 命令行工具
└── server.ts                # API 服务器入口
```

## 快速开始

### 安装依赖

```bash
npm install
```

### 运行演示

```bash
npx ts-node scripts/demo.ts
```

### 启动 API 服务

```bash
npm run dev
```

服务地址: http://localhost:3000

### CLI 命令

```bash
# 导入数据
npx ts-node src/cli/index.ts import alarm data/raw/sample_alarms.json
npx ts-node src/cli/index.ts import inspection data/raw/sample_inspections.json
npx ts-node src/cli/index.ts import complaint data/raw/sample_complaints.json

# 查看记录
npx ts-node src/cli/index.ts record list
npx ts-node src/cli/index.ts record show <id>

# 工作流操作
npx ts-node src/cli/index.ts record submit <id>
npx ts-node src/cli/index.ts record reject <id> "原因"
npx ts-node src/cli/index.ts record confirm <id>
npx ts-node src/cli/index.ts record freeze <id> "月报导出前冻结"
npx ts-node src/cli/index.ts record withdraw <id> "需要补充信息"

# 查看变更历史
npx ts-node src/cli/index.ts record diff <id>

# 一键执行完整工作流
npx ts-node src/cli/index.ts workflow <id>

# 报告和统计
npx ts-node src/cli/index.ts report
npx ts-node src/cli/index.ts stats

# 导出
npx ts-node src/cli/index.ts export json -a  # 脱敏导出 JSON
npx ts-node src/cli/index.ts export csv      # 导出 CSV
```

## API 接口

请求头:
- `X-Operator`: 操作人姓名
- `X-Role`: 角色 (operator/team_leader/area_manager/auditor/admin)

### 导入数据

```bash
POST /api/import/pile_alarm
POST /api/import/inspection_form
POST /api/import/customer_complaint

Body:
{
  "data": [...],
  "sourceName": "API批量导入"
}
```

### 记录操作

```bash
GET    /api/records                    # 列表
GET    /api/records/:id                # 详情
GET    /api/records/:id/diff           # 变更历史
GET    /api/records/:id/audit          # 审计日志

POST   /api/records/:id/submit         # 提交
POST   /api/records/:id/reject         # 驳回
POST   /api/records/:id/confirm        # 二次确认
POST   /api/records/:id/freeze         # 冻结
POST   /api/records/:id/withdraw       # 撤回

PATCH  /api/records/:id                # 人工改判
PATCH  /api/records/:id/fault-status   # 更新故障状态
```

### 统计和导出

```bash
GET    /api/statistics                 # 统计
GET    /api/report                     # 报告
POST   /api/export                     # 导出
```

## 核心概念

### FactKey (事实键)

基于 `桩ID + 时间(小时级) + 事件类型` 生成，确保同一事实不会重复创建台账记录。

### 证据链 (SourceEvidence)

每条台账记录关联多条证据，每条证据保留：
- 来源文件
- 原始行号
- 原始数据
- 解析后的标准值
- 导入人、导入时间
- 校验和（防篡改）

### 状态流转

```
draft --------> submitted --------> secondary_confirmed --------> frozen --------> archived
  ↑               ↓   ↑                   ↓
  └──────── rejected ─┘                   └───────────────────> rejected
```

### 变更日志 (ChangeLog)

记录每个字段的变更：
- 字段名
- 旧值、新值
- 变更原因
- 是否人工改判
- 操作人、操作时间

### 角色权限

| 角色 | 权限 |
|------|------|
| OPERATOR | 查看、提交 |
| TEAM_LEADER | 提交、撤回 |
| AREA_MANAGER | 二次确认、冻结、查看变更摘要 |
| AUDITOR | 查看完整审计日志 |
| ADMIN | 人工改判 |

## 边界情况处理

- **重复提交**: 抛出明确错误，不静默失败
- **撤回后再提交**: 支持，保留撤回记录
- **部分失败**: 导入失败记录详细错误信息，不影响成功的记录
- **人工改判**: 记录变更原因和前后值，原始证据保留
- **导出前冻结**: 冻结后不可修改，确保导出数据一致

## 退出码 (CLI)

- `0`: 成功
- `1`: 失败（错误信息输出到 stderr）
