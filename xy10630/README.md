# 校园餐卡离线补账系统

一个全栈 Web 应用，用于校园餐卡的离线交易补账、充值、对账管理，支持重复扣款检测和退款审核流程。

## 技术栈

- **后端**: Node.js + Express + SQLite
- **前端**: React 18 + Ant Design + Vite
- **数据处理**: CSV 批量导入/导出

## 核心功能

### 数据管理
- 餐卡管理：支持餐卡创建、冻结、解冻、挂失
- 充值订单：人工充值、订单查询、导出
- 交易记录：离线交易导入、查询、导出
- 食堂对账：手工录入对账数据，自动计算差额

### 业务规则引擎
1. **挂失冻结变更**：完整的状态变更日志，冻结/挂失卡禁止操作
2. **重复扣款异常检测**：自动检测疑似重复交易，标记待人工处理
3. **退款复核机制**：大额退款需审核，完整记录审核链
4. **操作幂等性**：所有写入操作支持幂等键，防止重复提交
5. **失败原因记录**：完整的审计日志，记录所有操作结果和失败原因

### 导出与报告
- 支持交易记录、充值订单、重复扣款记录、审计日志的 CSV 导出
- 按时间范围、餐卡、食堂等条件筛选导出

## 快速开始

### 1. 安装依赖

```bash
# 安装后端依赖
npm install

# 安装前端依赖
cd client && npm install && cd ..
```

### 2. 初始化数据库

```bash
npm run init-db
```

### 3. 造测试数据

```bash
npm run seed
```

造数脚本会自动生成：
- 5 张测试餐卡（1 张冻结状态）
- 50 条随机交易记录
- 15 条随机充值记录
- 1 条冻结操作日志

### 4. 启动服务

#### 方式一：前后端分别启动（推荐用于开发）

```bash
# 启动后端服务（端口 3001）
npm run server

# 新终端窗口启动前端（端口 3000）
npm run client
```

#### 方式二：同时启动前后端

```bash
npm run dev
```

### 5. 访问系统

打开浏览器访问：http://localhost:3000

## 项目结构

```
campus-card-system/
├── server/
│   ├── controllers/        # 业务逻辑层
│   │   ├── cardController.js
│   │   ├── rechargeController.js
│   │   ├── transactionController.js
│   │   ├── refundController.js
│   │   └── reconciliationController.js
│   ├── middleware/         # 中间件
│   │   ├── audit.js           # 审计日志
│   │   └── businessRules.js   # 业务规则
│   ├── models/             # 数据模型
│   │   └── database.js
│   ├── routes/             # 路由定义
│   ├── scripts/            # 脚本
│   │   ├── initDB.js          # 数据库初始化
│   │   └── seedData.js        # 造数脚本
│   ├── data/               # 数据库文件目录
│   ├── uploads/            # 上传文件目录
│   └── index.js            # 服务入口
├── client/
│   ├── src/
│   │   ├── pages/          # 页面组件
│   │   ├── App.jsx         # 主应用
│   │   └── main.jsx        # 入口文件
│   ├── index.html
│   ├── package.json
│   └── vite.config.js
└── package.json
```

## API 接口说明

### 餐卡管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/cards | 查询餐卡列表 |
| GET | /api/cards/:id | 查询单张餐卡 |
| POST | /api/cards | 创建餐卡 |
| POST | /api/cards/freeze | 冻结餐卡 |
| POST | /api/cards/unfreeze | 解冻餐卡 |
| POST | /api/cards/lost | 挂失餐卡 |

### 充值订单

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/recharge | 查询充值订单列表 |
| POST | /api/recharge | 创建充值订单（支持幂等键） |

请求体示例：
```json
{
  "card_id": "C001",
  "amount": 100,
  "recharge_type": "manual",
  "operator": "admin",
  "idempotency_key": "unique_key_123"
}
```

### 交易记录

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/transactions | 查询交易列表 |
| POST | /api/transactions | 创建交易记录（支持幂等键） |
| POST | /api/import/transactions | CSV 批量导入交易 |

### 重复扣款处理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/transactions/duplicates | 查询重复扣款记录 |
| POST | /api/transactions/duplicates/handle | 处理重复扣款 |

处理请求示例：
```json
{
  "dedup_id": "dedup_xxx",
  "action": "refund",  // 或 confirm_normal
  "handler": "admin",
  "remark": "确认重复，已退款"
}
```

### 退款管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/refund | 查询退款记录 |
| POST | /api/refund | 申请退款 |
| POST | /api/refund/review | 审核退款 |

### 对账与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/reconciliation | 查询对账记录 |
| POST | /api/reconciliation | 创建对账记录 |
| GET | /api/reconciliation/export | 数据导出 |
| GET | /api/reconciliation/audit | 查询审计日志 |
| GET | /api/reconciliation/dashboard | 获取统计数据 |

导出参数示例：
```
GET /api/reconciliation/export?type=transactions&start_date=2024-01-01&end_date=2024-01-31
```

type 可选值：`transactions` | `recharge` | `duplicate` | `audit`

## 功能演示说明

系统内置四条演示路径，可在左侧菜单的"演示路径"页面查看：

### 路径一：成功流程
- 模拟正常充值操作
- 校验餐卡状态正常
- 余额变更成功
- 记录审计日志

### 路径二：规则拦截
- 对冻结状态的餐卡发起充值
- 系统检测到卡状态异常
- 拒绝操作并返回错误
- 记录失败审计日志

### 路径三：人工修正
- 短时间内同卡、同设备、同金额连续两笔交易
- 系统自动检测疑似重复扣款
- 标记为待人工处理状态
- 在"重复扣款处理"页面可人工确认处理

### 路径四：重复提交（幂等性）
- 使用相同幂等键发送两次充值请求
- 第一次请求正常执行
- 第二次请求直接返回首次结果，不重复扣款
- 验证幂等性机制生效

## 数据库表设计

### cards（餐卡表）
| 字段 | 类型 | 说明 |
|------|------|------|
| card_id | TEXT | 卡号（主键） |
| student_id | TEXT | 学号 |
| student_name | TEXT | 学生姓名 |
| balance | REAL | 余额 |
| status | TEXT | 状态：normal/frozen/lost |
| created_at | DATETIME | 创建时间 |
| updated_at | DATETIME | 更新时间 |

### recharge_orders（充值订单表）
| 字段 | 类型 | 说明 |
|------|------|------|
| order_id | TEXT | 订单ID |
| card_id | TEXT | 卡号 |
| amount | REAL | 金额 |
| recharge_type | TEXT | 充值类型 |
| status | TEXT | 状态 |
| operator | TEXT | 操作人 |
| remark | TEXT | 备注 |
| idempotency_key | TEXT | 幂等键（唯一） |
| created_at | DATETIME | 创建时间 |

### offline_transactions（交易记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| tx_id | TEXT | 交易ID |
| card_id | TEXT | 卡号 |
| amount | REAL | 金额 |
| canteen_id | TEXT | 食堂ID |
| canteen_name | TEXT | 食堂名称 |
| device_id | TEXT | 设备ID |
| tx_time | DATETIME | 交易时间 |
| status | TEXT | 状态 |
| idempotency_key | TEXT | 幂等键（唯一） |
| remark | TEXT | 备注 |

### freeze_logs（冻结日志表）
| 字段 | 类型 | 说明 |
|------|------|------|
| log_id | TEXT | 日志ID |
| card_id | TEXT | 卡号 |
| operation_type | TEXT | 操作类型 |
| reason | TEXT | 原因 |
| operator | TEXT | 操作人 |
| before_status | TEXT | 变更前状态 |
| after_status | TEXT | 变更后状态 |
| effective_time | DATETIME | 生效时间 |
| remark | TEXT | 备注 |

### duplicate_deductions（重复扣款记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| dedup_id | TEXT | 记录ID |
| card_id | TEXT | 卡号 |
| original_tx_id | TEXT | 原始交易ID |
| duplicate_tx_id | TEXT | 重复交易ID |
| detected_time | DATETIME | 检测时间 |
| status | TEXT | 状态：detected/resolved |
| confidence | REAL | 置信度 |
| match_criteria | TEXT | 匹配条件 |
| handler | TEXT | 处理人 |
| handle_time | DATETIME | 处理时间 |
| handle_result | TEXT | 处理结果 |
| remark | TEXT | 备注 |

### refund_records（退款记录表）
| 字段 | 类型 | 说明 |
|------|------|------|
| refund_id | TEXT | 退款ID |
| card_id | TEXT | 卡号 |
| related_tx_id | TEXT | 关联交易ID |
| related_order_id | TEXT | 关联订单ID |
| amount | REAL | 退款金额 |
| refund_type | TEXT | 退款类型 |
| reason | TEXT | 退款原因 |
| operator | TEXT | 申请人 |
| reviewer | TEXT | 审核人 |
| status | TEXT | 状态：pending/approved/rejected |
| review_time | DATETIME | 审核时间 |
| review_remark | TEXT | 审核意见 |
| created_at | DATETIME | 创建时间 |

### audit_logs（审计日志表）
| 字段 | 类型 | 说明 |
|------|------|------|
| log_id | TEXT | 日志ID |
| operation_type | TEXT | 操作类型 |
| entity_type | TEXT | 实体类型 |
| entity_id | TEXT | 实体ID |
| operator | TEXT | 操作人 |
| before_data | TEXT | 操作前数据 |
| after_data | TEXT | 操作后数据 |
| result | TEXT | 结果：success/failed |
| fail_reason | TEXT | 失败原因 |
| created_at | DATETIME | 创建时间 |

### canteen_reconciliation（食堂对账表）
| 字段 | 类型 | 说明 |
|------|------|------|
| recon_id | TEXT | 对账ID |
| canteen_id | TEXT | 食堂ID |
| canteen_name | TEXT | 食堂名称 |
| recon_date | DATE | 对账日期 |
| total_transactions | INTEGER | 上报笔数 |
| total_amount | REAL | 上报金额 |
| system_amount | REAL | 系统金额 |
| difference | REAL | 差额 |
| status | TEXT | 状态 |
| operator | TEXT | 操作人 |
| remark | TEXT | 备注 |
| created_at | DATETIME | 创建时间 |

## 业务规则配置

### 重复扣款检测阈值
在 `server/middleware/businessRules.js` 中可配置：
- 时间窗口：默认 5 分钟
- 匹配条件：同卡 + 同设备 + 同金额

### 退款审核阈值
在 `server/middleware/businessRules.js` 中可配置：
- 默认阈值：500 元
- 超过阈值的退款需要审核

## 常见问题

### Q: 如何重置数据库？
A: 删除 `server/data/campus_card.db` 文件，重新运行 `npm run init-db` 和 `npm run seed`。

### Q: 批量导入的 CSV 格式要求？
A: CSV 文件需包含以下列：
- card_id（卡号）
- amount（金额）
- canteen_id（食堂ID）
- canteen_name（食堂名称）
- device_id（设备ID）
- tx_time（交易时间，ISO 格式）
- remark（可选，备注）

### Q: 数据导出后如何查看？
A: 导出的 CSV 文件可使用 Excel、Numbers 或任何文本编辑器打开查看。

### Q: 如何自定义业务规则？
A: 修改 `server/middleware/businessRules.js` 中的相关配置即可。

## 开发说明

### 热重载
后端使用 nodemon，前端使用 Vite，修改代码后会自动重新加载。

### 数据库调试
可使用任何 SQLite 客户端工具打开 `server/data/campus_card.db` 查看数据。

### 日志查看
后端日志直接输出到控制台，包含所有 API 请求和数据库操作。
