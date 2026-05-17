# 支付清结算服务分账失败补偿登记系统

专门解决分账失败补偿登记中**重复点击、异步回调、人工补录导致旧证据被覆盖**的问题。

## 核心特性

- ✅ **证据版本控制**：每次状态变更自动递增版本号，保留完整历史证据
- ✅ **防重复登记**：交易号 + 分账方 + 补偿批次联合唯一约束
- ✅ **完整历史追踪**：记录每次操作的前后状态、操作人、操作时间、来源
- ✅ **冲突记录展示**：专门展示上游超时异步成功导致的重复补偿全过程
- ✅ **导入坏行标记**：记录导入失败的数据及错误原因
- ✅ **CSV 导出**：支持完整数据导出

## 状态定义

| 状态码 | 中文名称 | 说明 |
|--------|----------|------|
| PENDING | 待分账 | 初始状态，等待分账处理 |
| COMPENSATING | 补偿中 | 正在进行补偿处理 |
| COMPENSATED | 已补偿 | 补偿成功完成 |
| MANUAL_REQUIRED | 需人工 | 需要人工介入审核或处理 |
| CONFLICT | 冲突 | 检测到重复补偿或数据冲突 |
| IMPORT_ERROR | 导入失败 | 批量导入时数据校验失败 |

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化数据库（包含示例数据）

```bash
npm run init-db
```

会自动创建以下示例数据：

| 类型 | 说明 |
|------|------|
| 完整流转记录 | 商户A（待分账）、商户B（补偿中）、商户C（已补偿）、商户D（需人工） |
| 冲突记录 | 商户E：上游超时 → 异步成功 → 重复补偿 → 对账发现 → 人工处理完整流程 |
| 导入坏行 | 商户F：金额为负导致导入失败 |

### 3. 启动服务

```bash
npm start
```

服务启动后访问：**http://localhost:3000**

## API 接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/records | 列表查询（支持分页、按交易号/批次/状态筛选） |
| GET | /api/records/:id | 获取单条记录详情 |
| GET | /api/records/:id/history | 获取记录的历史变更 |
| POST | /api/records | 新建补偿登记（自动防重复） |
| PUT | /api/records/:id/status | 变更状态（自动生成新版本证据） |
| GET | /api/export | 导出数据（?format=csv 导出CSV） |
| GET | /api/stats | 获取各状态统计数量 |

## 数据库设计

### compensation_records 表（主表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| transaction_no | VARCHAR(64) | 交易号 |
| batch_no | VARCHAR(64) | 补偿批次号 |
| recipient_id | VARCHAR(64) | 分账方ID |
| recipient_name | VARCHAR(128) | 分账方名称 |
| recipient_type | VARCHAR(32) | 分账方类型 |
| amount | DECIMAL(18,2) | 分账金额 |
| fail_reason | TEXT | 失败原因 |
| status | VARCHAR(32) | 当前状态 |
| evidence | TEXT | 证据数据（JSON格式） |
| evidence_version | INTEGER | 证据版本号 |
| operator | VARCHAR(64) | 操作人 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

**唯一约束**：(transaction_no, recipient_id, batch_no) - 防止重复登记

### compensation_history 表（历史表）

| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| record_id | INTEGER | 关联主表ID |
| transaction_no | VARCHAR(64) | 交易号（冗余） |
| batch_no | VARCHAR(64) | 批次号（冗余） |
| recipient_id | VARCHAR(64) | 分账方ID（冗余） |
| old_status | VARCHAR(32) | 变更前状态 |
| new_status | VARCHAR(32) | 变更后状态 |
| old_evidence | TEXT | 变更前证据 |
| new_evidence | TEXT | 变更后证据 |
| evidence_version | INTEGER | 版本号 |
| operation_type | VARCHAR(32) | 操作类型（INIT/STATUS_CHANGE/CONFLICT_DETECT等） |
| operator | VARCHAR(64) | 操作人 |
| operation_remark | TEXT | 操作备注 |
| source | VARCHAR(32) | 来源（SYSTEM/API/RECONCILIATION/IMPORT等） |
| created_at | DATETIME | 创建时间 |

## 项目结构

```
.
├── package.json          # 项目配置
├── server.js             # 后端服务（Express）
├── data/
│   └── settlement.db     # SQLite 数据库文件（自动生成）
├── scripts/
│   └── init-db.js        # 数据库初始化脚本
└── public/
    └── index.html        # 前端页面
```

## 验收清单

### 数据完整性
- [ ] 列表页显示所有 6 条记录（4 条流转 + 1 条冲突 + 1 条坏行）
- [ ] 统计卡片区正确显示各状态数量

### 冲突记录验证
- [ ] 冲突记录详情页显示完整时间线
- [ ] 上游超时 → 异步成功 → 重复补偿 → 对账发现 → 处理完成 5 个阶段
- [ ] 历史记录标签页可查看到 3 次状态变更记录

### 历史记录验证
- [ ] 每条记录点击详情都能看到历史变更
- [ ] 证据版本号正确递增
- [ ] 操作人、操作时间、来源信息完整

### 防重复验证
- [ ] 新建登记时使用已存在的交易号+分账方+批次会提示冲突
- [ ] 返回 409 状态码和明确错误信息

### 导出验证
- [ ] 点击导出按钮正确下载 CSV 文件
- [ ] CSV 文件包含所有字段，中文正常显示

## 注意事项

- 首次运行必须先执行 `npm run init-db` 初始化数据库
- 数据库文件位于 `data/settlement.db`，可直接备份
- 无外部服务依赖，纯本地运行
