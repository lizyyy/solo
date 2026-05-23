# 校园借书预约 API

本地后端 API 服务，用于图书馆热门图书预约管理，支持多人排队、逾期未取处理和老师优先借阅。

## 功能特性

- **身份优先级**: 老师 > 教职工 > 学生
- **排队锁定**: 按优先级和时间排序，锁定后24小时取书窗口
- **逾期释放**: 超时未取自动释放并生成逾期记录
- **重复预约幂等**: 支持幂等键去重
- **流转报告**: 支持JSON和CSV格式导出
- **异常日志**: 错误路径保存原始输入和处理结果

## 项目结构

```
.
├── package.json          # 项目配置
├── src/
│   ├── server.js         # 服务器入口
│   ├── database.js       # 数据库模型
│   ├── routes.js         # API路由
│   └── service.js        # 核心业务逻辑
├── scripts/
│   └── init-sample-data.js  # 样例数据初始化
├── test/
│   └── self-check.js     # 自检脚本
└── data/                 # SQLite数据库目录
```

## 快速开始

### 1. 安装依赖

```bash
npm install
```

### 2. 初始化样例数据（可选，推荐）

```bash
npm run init-data
```

> **说明**: 
> - 样例数据使用固定ID，可重复调用（重复执行会重置所有数据）
> - 脚本会自动创建 `data` 目录，无需手动创建
> - 样例数据包含6位读者（2位老师、1位教职工、3位学生）和6本图书

### 3. 启动服务

```bash
npm start
```

服务将在 `http://localhost:3000` 启动

> **说明**: 即使不先执行 `init-data`，直接启动服务也会自动创建空数据库

### 4. 运行自检脚本

```bash
npm test
```

> **说明**: 自检脚本会自动清理旧数据、初始化样例数据、启动服务器并运行完整测试

## API 接口文档

### 基础地址

`http://localhost:3000/api`

### 预约管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/bookings` | 创建预约 |
| GET | `/bookings` | 查询预约列表 |
| GET | `/bookings/:id` | 查询单个预约 |
| POST | `/bookings/lock-next` | 锁定下一个预约 |
| POST | `/bookings/:id/fulfill` | 完成取书 |
| POST | `/bookings/:id/cancel` | 取消预约 |
| PATCH | `/bookings/:id/manual` | 人工修正预约 |

#### 创建预约示例

```bash
curl -X POST http://localhost:3000/api/bookings \
  -H "Content-Type: application/json" \
  -d '{
    "book_copy_id": "图书副本ID",
    "reader_id": "读者ID",
    "idempotency_key": "可选幂等键"
  }'
```

### 读者管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/readers` | 获取读者列表 |
| GET | `/readers/:id` | 获取单个读者信息 |

### 图书管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/books` | 获取图书列表 |
| GET | `/books/:id` | 获取单个图书信息 |
| GET | `/books/:id/queue` | 获取图书预约队列 |

### 报告与导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/reports/circulation` | 生成流转报告 |
| GET | `/export/circulation` | 导出流转数据 |

#### 导出示例

```bash
# JSON格式
curl http://localhost:3000/api/export/circulation?format=json

# CSV格式
curl http://localhost:3000/api/export/circulation?format=csv
```

### 逾期处理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/overdue/check` | 检查并释放逾期预约 |

### 系统

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/health` | 健康检查 |
| GET | `/error-logs` | 查看错误日志 |

## 数据模型

### 读者 (readers)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| name | TEXT | 姓名 |
| identity_type | TEXT | 身份类型: teacher/staff/student |
| department | TEXT | 部门/院系 |
| created_at | INTEGER | 创建时间 |
| updated_at | INTEGER | 更新时间 |

### 图书副本 (book_copies)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| isbn | TEXT | ISBN编号 |
| title | TEXT | 书名 |
| author | TEXT | 作者 |
| location | TEXT | 馆藏位置 |
| status | TEXT | 状态: available/reserved/borrowed/lost |
| created_at | INTEGER | 创建时间 |
| updated_at | INTEGER | 更新时间 |

### 预约队列 (booking_queue)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| book_copy_id | TEXT | 图书副本ID |
| reader_id | TEXT | 读者ID |
| priority | INTEGER | 优先级: teacher=2, staff=1, student=0 |
| status | TEXT | 状态: pending/locked/fulfilled/cancelled/expired |
| request_idempotency_key | TEXT | 幂等键(唯一) |
| window_start | INTEGER | 取书窗口开始时间 |
| window_end | INTEGER | 取书窗口结束时间 |
| position | INTEGER | 排队位置 |
| created_at | INTEGER | 创建时间 |
| updated_at | INTEGER | 更新时间 |

### 逾期记录 (overdue_records)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| booking_id | TEXT | 预约ID |
| book_copy_id | TEXT | 图书副本ID |
| reader_id | TEXT | 读者ID |
| overdue_type | TEXT | 类型: pickup/return |
| due_time | INTEGER | 到期时间 |
| actual_time | INTEGER | 实际时间 |
| released | BOOLEAN | 是否已释放 |
| created_at | INTEGER | 创建时间 |

### 流转报告 (circulation_reports)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| report_type | TEXT | 报告类型 |
| start_time | INTEGER | 统计开始时间 |
| end_time | INTEGER | 统计结束时间 |
| content | TEXT | JSON格式报告内容 |
| generated_at | INTEGER | 生成时间 |
| generated_by | TEXT | 生成者 |

### 错误日志 (error_logs)

| 字段 | 类型 | 说明 |
|------|------|------|
| id | TEXT | 主键 |
| api_path | TEXT | API路径 |
| http_method | TEXT | HTTP方法 |
| raw_input | TEXT | 原始输入(JSON) |
| error_message | TEXT | 错误信息 |
| processing_result | TEXT | 处理结果(JSON) |
| occurred_at | INTEGER | 发生时间 |

## 核心业务规则

1. **优先级排序**: 老师(2) > 教职工(1) > 学生(0)，同优先级按预约时间排序
2. **取书窗口**: 锁定后24小时，超时未取自动释放
3. **幂等处理**: 使用`idempotency_key`可防止重复预约
4. **逾期记录**: 逾期预约生成逾期记录供后续统计
5. **状态流转**: pending → locked → fulfilled / expired / cancelled

## 自检脚本覆盖范围

- ✅ 基础数据读取测试
- ✅ 正常流程测试（创建预约、锁定、完成）
- ✅ 重复请求幂等性测试
- ✅ 脏数据/异常测试
- ✅ 导出功能测试（内容一致性）
- ✅ 人工修正测试
- ✅ 取消预约测试

## 技术栈

- Node.js + Express
- SQLite3 (本地持久化)
- UUID
- json2csv (CSV导出)

## 许可证

MIT
