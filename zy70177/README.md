# 里程碑收款服务后端闭环系统

## 业务背景

在项目按里程碑收款的业务场景中，验收、开票和回款三个环节的状态经常出现不同步的问题：
- 里程碑已验收但未开票
- 发票已开具但未收到回款
- 回款已到账但未认领到对应的发票
- 多个环节状态不一致导致财务对账困难

本系统通过构建完整的业务闭环，解决这些状态不同步的问题。

## 核心功能

### 主干流程
1. **里程碑管理**：为项目设置收款里程碑，包含金额、截止日期等信息
2. **验收确认**：里程碑完成后提交验收申请，经确认后才能申请开票
3. **开票申请**：验收通过后创建开票申请，经审批后开具发票

### 完整性验证
4. **回款认领**：收到回款后，将回款认领到对应的发票
5. **延期预警**：自动检测逾期里程碑和付款延迟
6. **项目报表**：提供收款状态报表和发票回款报表，支持导出CSV

### 可复查机制
7. **审计日志**：所有关键业务操作都记录审计日志，支持历史追溯

## 技术架构

- **运行环境**：Node.js
- **Web框架**：Express.js
- **数据存储**：SQLite3（轻量级，重启后数据持久化）
- **依赖管理**：npm

## 项目结构

```
.
├── package.json           # 项目配置和依赖
├── server.js              # 主服务入口
├── src/
│   ├── database/
│   │   └── database.js    # 数据库连接和初始化
│   ├── routes/            # API路由层
│   │   ├── projects.js    # 项目管理
│   │   ├── milestones.js  # 里程碑管理
│   │   ├── acceptances.js # 验收确认
│   │   ├── invoices.js    # 开票管理
│   │   ├── payments.js    # 回款管理
│   │   ├── reports.js     # 报表导出
│   │   └── audit.js       # 审计日志
│   ├── services/          # 业务逻辑层
│   │   ├── project-service.js
│   │   ├── milestone-service.js
│   │   ├── acceptance-service.js
│   │   ├── invoice-service.js
│   │   ├── payment-service.js
│   │   ├── report-service.js
│   │   ├── alert-service.js
│   │   └── audit-service.js
│   └── rules/
│       └── business-rules.js # 核心业务规则
├── test/
│   ├── run-all-tests.js    # 基础流程测试
│   └── full-test.js        # 完整测试（含审计日志）
└── data/                   # 运行时数据目录
    ├── milestone_service.db    # SQLite数据库文件
    └── exports/            # 导出的报表文件
```

## 快速开始

### 前置条件

确保系统已安装：
- Node.js (推荐 v16 或更高版本)
- npm (随 Node.js 一起安装)

### 安装步骤

1. **克隆或下载项目**
   ```bash
   cd /path/to/project
   ```

2. **安装依赖**
   ```bash
   npm install
   ```

3. **启动服务**
   ```bash
   npm start
   ```
   或者使用开发模式（自动重启）：
   ```bash
   npm run dev
   ```

4. **验证服务**
   
   打开浏览器访问：http://localhost:3000/health
   
   应看到返回：
   ```json
   {
     "success": true,
     "message": "里程碑收款服务运行中",
     "version": "1.0.0",
     "timestamp": "当前时间戳"
   }
   ```

### 运行完整测试

在新的终端窗口中执行：

```bash
node test/full-test.js
```

这将运行完整的业务流程测试，包括：
1. 创建项目和里程碑
2. 提交并确认验收
3. 申请、审批、开具发票
4. 记录并认领回款
5. 检查延期预警
6. 验证审计日志
7. 导出业务报表

## API 接口概览

### 项目管理
- `GET /api/projects` - 获取所有项目
- `POST /api/projects` - 创建项目
- `GET /api/projects/:id` - 获取项目详情
- `PUT /api/projects/:id` - 更新项目
- `DELETE /api/projects/:id` - 删除项目
- `GET /api/projects/:id/milestones` - 获取项目里程碑
- `POST /api/projects/:id/milestones` - 创建项目里程碑
- `GET /api/projects/:id/progress` - 获取项目进度
- `GET /api/projects/:id/alerts` - 获取项目预警

### 里程碑管理
- `GET /api/milestones/:id` - 获取里程碑
- `GET /api/milestones/:id/details` - 获取里程碑详情（含验收和发票）
- `PUT /api/milestones/:id` - 更新里程碑
- `POST /api/milestones/:id/acceptances` - 提交验收申请
- `POST /api/milestones/:id/invoices` - 创建开票申请

### 验收确认
- `GET /api/acceptances/:id` - 获取验收记录
- `POST /api/acceptances/:id/confirm` - 确认验收通过
- `POST /api/acceptances/:id/reject` - 拒绝验收

### 开票管理
- `GET /api/invoices` - 获取所有发票
- `GET /api/invoices/:id` - 获取发票详情
- `GET /api/invoices/:id/summary` - 获取发票回款汇总
- `POST /api/invoices/:id/approve` - 审批开票申请
- `POST /api/invoices/:id/issue` - 开具发票
- `POST /api/invoices/:id/reject` - 拒绝开票申请

### 回款管理
- `GET /api/payments` - 获取所有回款
- `POST /api/payments` - 记录回款
- `GET /api/payments/summary` - 获取回款认领汇总
- `GET /api/payments/unassigned-invoices` - 获取未回款发票
- `GET /api/payments/:id` - 获取回款详情
- `GET /api/payments/:id/details` - 获取回款及认领明细
- `POST /api/payments/:id/assign` - 回款认领到发票

### 报表与预警
- `GET /api/reports/collection-status` - 获取收款状态报表
- `GET /api/reports/milestone-collection` - 获取里程碑收款明细
- `GET /api/reports/invoice-payment` - 获取发票回款报表
- `GET /api/reports/alerts` - 获取仪表盘预警
- `GET /api/reports/export/collection` - 导出收款状态报表（CSV）
- `GET /api/reports/export/invoice-payment` - 导出发票回款报表（CSV）

### 审计日志
- `GET /api/audit` - 获取所有审计日志
- `GET /api/audit/tables` - 获取可查询的表名
- `GET /api/audit/:table/:id` - 获取指定记录的历史变更

## 核心业务规则

### 状态流转规则

**里程碑状态**：
- `pending` (待处理) → `accepted` (已验收) → `invoiced` (已开票) → `paid` (已付款)

**验收状态**：
- `pending` (待处理) → `confirmed` (已确认) / `rejected` (已拒绝)

**发票状态**：
- `pending` (待审批) → `approved` (已审批) → `issued` (已开具) → `paid` (已付款)
- 或 `pending` → `rejected` (已拒绝)

### 关键验证规则

1. **开票申请规则** (`canApplyForInvoice`)
   - 必须：里程碑状态为 `accepted` 或 验收状态为 `confirmed`
   - 目的：防止未验收就开票

2. **回款认领规则** (`canAssignPayment`)
   - 必须：发票状态为 `issued`
   - 目的：防止对未开具的发票进行回款

3. **开票金额验证** (`validateInvoiceAmount`)
   - 开票金额必须 > 0
   - 开票金额 ≤ 里程碑金额
   - 目的：防止超额开票

4. **回款金额验证** (`validatePaymentAssignment`)
   - 回款金额必须 > 0
   - 回款金额 ≤ 发票剩余未回款金额
   - 目的：防止超额回款

5. **逾期检测规则** (`isMilestoneOverdue`)
   - 基于当前日期与里程碑截止日期比较
   - 逾期等级：
     - `attention` (关注)：逾期 1-29 天
     - `warning` (警告)：逾期 30-89 天
     - `critical` (严重)：逾期 ≥ 90 天

## 数据存储说明

### 数据库结构

系统使用 SQLite 数据库，数据文件位于 `data/milestone_service.db`，包含以下表：

1. **projects** - 项目表
2. **milestones** - 里程碑表（含验收状态、开票状态、已收款金额）
3. **acceptances** - 验收记录表
4. **invoices** - 发票表
5. **payments** - 回款记录表
6. **payment_assignments** - 回款认领关联表
7. **audit_logs** - 审计日志表

### 数据持久化

- 所有数据自动保存到 SQLite 数据库
- 服务重启后数据不会丢失
- 可以使用任何 SQLite 客户端工具直接查询数据库

### 导出报表

系统支持导出两种 CSV 格式的报表，文件保存在 `data/exports/` 目录：

1. **收款状态报表** (`收款状态报表_YYYY-MM-DD.csv`)
   - 包含字段：项目名称、客户、里程碑、计划日期、金额、已收款、进度%、验收状态、开票状态、里程碑状态、是否逾期、逾期天数
   - 用途：查看每个里程碑的整体收款进度

2. **发票回款报表** (`发票回款报表_YYYY-MM-DD.csv`)
   - 包含字段：项目名称、客户、里程碑、发票号、开票金额、已认领、剩余金额、进度%、发票状态、开票日期
   - 用途：追踪每张发票的回款情况

## 业务流程示例

### 完整收款流程

1. **创建项目**
   ```bash
   curl -X POST http://localhost:3000/api/projects \
     -H "Content-Type: application/json" \
     -d '{
       "name": "智能客服系统",
       "code": "PRJ-001",
       "client": "科技公司",
       "amount": 1000000,
       "start_date": "2026-01-01",
       "end_date": "2026-12-31"
     }'
   ```

2. **创建里程碑**
   ```bash
   curl -X POST http://localhost:3000/api/projects/1/milestones \
     -H "Content-Type: application/json" \
     -d '{
       "name": "需求分析完成",
       "description": "完成需求调研",
       "amount": 300000,
       "due_date": "2026-03-01"
     }'
   ```

3. **提交验收申请**
   ```bash
   curl -X POST http://localhost:3000/api/milestones/1/acceptances \
     -H "Content-Type: application/json" \
     -d '{
       "user_id": "user_001",
       "remarks": "需求文档已提交"
     }'
   ```

4. **确认验收**
   ```bash
   curl -X POST http://localhost:3000/api/acceptances/1/confirm \
     -H "Content-Type: application/json" \
     -d '{
       "confirmed_by": "manager_001",
       "remarks": "验收通过"
     }'
   ```

5. **创建开票申请**
   ```bash
   curl -X POST http://localhost:3000/api/milestones/1/invoices \
     -H "Content-Type: application/json" \
     -d '{
       "invoice_no": "INV-001",
       "amount": 300000,
       "remarks": "需求分析阶段"
     }'
   ```

6. **审批开票**
   ```bash
   curl -X POST http://localhost:3000/api/invoices/1/approve \
     -H "Content-Type: application/json" \
     -d '{ "approved_by": "finance_001" }'
   ```

7. **开具发票**
   ```bash
   curl -X POST http://localhost:3000/api/invoices/1/issue \
     -H "Content-Type: application/json" \
     -d '{
       "issued_by": "finance_002",
       "issued_date": "2026-03-05"
     }'
   ```

8. **记录回款**
   ```bash
   curl -X POST http://localhost:3000/api/payments \
     -H "Content-Type: application/json" \
     -d '{
       "project_id": 1,
       "amount": 300000,
       "payment_date": "2026-03-15",
       "bank_reference": "BANK-001",
       "payer": "科技公司",
       "remarks": "需求分析尾款"
     }'
   ```

9. **回款认领**
   ```bash
   curl -X POST http://localhost:3000/api/payments/1/assign \
     -H "Content-Type: application/json" \
     -d '{
       "invoice_id": 1,
       "amount": 300000,
       "assigned_by": "finance_001"
     }'
   ```

10. **查看项目进度**
    ```bash
    curl http://localhost:3000/api/projects/1/progress
    ```

11. **检查延期预警**
    ```bash
    curl http://localhost:3000/api/reports/alerts
    ```

12. **导出报表**
    ```bash
    curl http://localhost:3000/api/reports/export/collection
    ```

13. **查看审计日志**
    ```bash
    # 查看里程碑1的历史变更
    curl http://localhost:3000/api/audit/milestones/1
    
    # 查看所有审计日志
    curl http://localhost:3000/api/audit
    ```

## 审计日志说明

### 记录的操作类型

- `create` - 创建记录
- `update` - 更新记录
- `delete` - 删除记录
- `confirm` - 确认（验收）
- `reject` - 拒绝（验收/发票）
- `approve` - 审批（发票）
- `issue` - 开具（发票）
- `assign` - 认领（回款）

### 审计日志字段

- `table_name` - 操作的表名
- `record_id` - 操作的记录ID
- `action` - 操作类型
- `old_value` - 变更前的值（JSON格式）
- `new_value` - 变更后的值（JSON格式）
- `user_id` - 操作用户
- `created_at` - 操作时间

### 使用场景

1. **追溯历史**：查看任何记录的完整变更历史
2. **责任追踪**：确定是谁在什么时间做了什么操作
3. **审计合规**：满足财务审计的可追溯要求
4. **问题排查**：分析状态变更的原因和过程

## 运行环境说明

### 默认配置

- **端口**：3000
- **数据库路径**：`data/milestone_service.db`
- **导出目录**：`data/exports/`

### 自定义配置

可以通过环境变量修改配置：

```bash
# 修改端口
PORT=8080 npm start
```

## 故障排查

### 问题：端口被占用

**症状**：启动时报错 `Error: listen EADDRINUSE`

**解决**：
```bash
# 查找占用端口的进程
lsof -ti :3000

# 终止进程
lsof -ti :3000 | xargs -r kill -9
```

### 问题：依赖安装失败

**症状**：`npm install` 报错

**解决**：
```bash
# 清理缓存
npm cache clean --force

# 删除 node_modules 重新安装
rm -rf node_modules package-lock.json
npm install
```

### 问题：数据不持久化

**症状**：重启服务后数据丢失

**检查**：
1. 确认 `data/` 目录有写入权限
2. 确认 `data/milestone_service.db` 文件存在
3. 确认服务正常关闭（不要强制杀死进程）

## 最佳实践

1. **定期备份**：定期备份 `data/milestone_service.db` 文件
2. **导出报表**：每月导出发票回款报表进行财务核对
3. **审计追踪**：重要操作后通过审计日志确认记录正确
4. **逾期监控**：定期查看 `/api/reports/alerts` 预警信息
5. **状态同步**：确保每个里程碑按顺序完成：验收 → 开票 → 回款

## 版本信息

- 版本：1.0.0
- 更新日期：2026-05-10
