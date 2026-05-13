# 餐厅排号拼桌过号系统

一个完整的餐厅排号管理系统，包含桌台管理、排号管理、拼桌管理、过号处理和报表导出功能。

## 功能特性

- 📊 **异常看板**: 实时显示桌台状态和排号队列
- 🎫 **排号管理**: 新建、呼叫、入座、过号、恢复等操作
- 🔗 **拼桌管理**: 拼桌兼容性校验、申请和审批流程
- 📋 **过号处理**: 过号记录、恢复排队功能
- 📈 **报表导出**: 按时间、状态、操作人筛选，导出Excel报表
- 📝 **操作日志**: 保留所有修改记录，可追溯责任人和时间

## 技术栈

- **后端**: Node.js + Express + SQLite3
- **前端**: React + Ant Design + Axios
- **报表**: ExcelJS

## 快速开始

### 1. 安装依赖

```bash
npm run install-all
```

### 2. 初始化数据库（包含演示数据）

```bash
npm run init-db
```

### 3. 启动后端服务

```bash
npm start
# 或开发模式
npm run dev
```

后端服务运行在 http://localhost:3001

### 4. 启动前端服务（新终端）

```bash
npm run client
```

前端服务运行在 http://localhost:3000

## 一键启动（推荐）

```bash
npm run setup
npm start
# 另一个终端
npm run client
```

## 数据库结构

系统使用SQLite数据库，文件位于 `data/restaurant.db`，包含以下表：

- `table_types`: 桌台类型（二人桌、四人桌、六人桌、八人桌）
- `tables`: 桌台信息（编号、类型、状态）
- `queue_numbers`: 排号记录（顾客信息、状态、时间）
- `merge_preferences`: 拼桌申请记录
- `skip_records`: 过号记录
- `operation_logs`: 操作日志（所有修改记录）
- `reservations`: 预约记录

## 业务流程

### 排号流程
1. 顾客取号 → 状态：等待中
2. 呼叫顾客 → 状态：呼叫中
3. 顾客入座 → 状态：已入座
4. 用餐结束 → 状态：已完成

### 过号处理
1. 顾客未到 → 标记过号
2. 顾客返回 → 恢复排队

### 拼桌流程
1. 检查两桌兼容性（人数总和不超过桌台容量）
2. 创建拼桌申请
3. 审批拼桌（批准/拒绝）

## 演示数据

系统初始化时会自动插入以下演示数据：

### 桌台类型
- 二人桌（2人）
- 四人桌（4人）
- 六人桌（6人）
- 八人桌（8人）

### 桌台
- A1, A2, A3（二人桌）
- B1, B2, B3, B4（四人桌）
- C1, C2（六人桌）
- D1（八人桌）

### 排号
- A001, A002（二人桌，等待中）
- B001（四人桌，呼叫中）
- B002（四人桌，等待中）
- B003（四人桌，已入座）
- C001（六人桌，过号）
- D001（八人桌，等待中）

## API接口

### 桌台类型
- `GET /api/table-types` - 获取所有桌台类型
- `POST /api/table-types` - 创建桌台类型
- `PUT /api/table-types/:id` - 更新桌台类型
- `DELETE /api/table-types/:id` - 删除桌台类型

### 桌台
- `GET /api/tables` - 获取所有桌台
- `GET /api/tables/available` - 获取可用桌台
- `POST /api/tables` - 创建桌台
- `PUT /api/tables/:id` - 更新桌台
- `PUT /api/tables/:id/status` - 更新桌台状态

### 排号
- `GET /api/queues` - 获取排号列表（支持筛选）
- `POST /api/queues` - 创建排号
- `PUT /api/queues/:id/call` - 呼叫
- `PUT /api/queues/:id/seat` - 入座
- `PUT /api/queues/:id/complete` - 完成
- `PUT /api/queues/:id/cancel` - 取消
- `PUT /api/queues/:id/skip` - 过号
- `PUT /api/queues/:id/restore` - 恢复过号

### 拼桌
- `GET /api/merges` - 获取拼桌申请
- `GET /api/merges/check-compatibility` - 检查兼容性
- `POST /api/merges` - 创建拼桌申请
- `PUT /api/merges/:id/approve` - 批准拼桌
- `PUT /api/merges/:id/reject` - 拒绝拼桌

### 报表
- `GET /api/reports` - 获取报表数据（支持筛选）
- `GET /api/reports/export` - 导出Excel报表
- `GET /api/reports/turnover-suggestions` - 翻台建议

## 注意事项

- 数据库文件位于 `data/restaurant.db`，重启服务数据不会丢失
- 所有修改操作都会记录操作日志，包含修改前后的值
- 报表支持按时间范围、状态、操作人筛选导出
