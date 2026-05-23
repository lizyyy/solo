# 新能源客服后端服务

公共充电桩退款审核系统 - 订单追踪与处理系统

## 功能特性

- 批次管理 - 新增批次、标记处理、退回修改
- 数据导入 - 订单CSV、桩端日志JSON、支付回执
- 幂等处理 - 重复批次返回原结果
- 审核规则 - 未启动扣费、重复退款、跨平台订单检测
- 操作审计 - 记录前后值变更历史
- 全链路追踪 - 从明细到最终报告
- 多维度查询 - 按桩编号、支付渠道、客服筛选
- CSV导出 - 导出数量与查询结果一致

## 快速开始

### 安装依赖
npm install

### 启动服务
npm start

服务运行在 http://localhost:3000

### 健康检查
curl http://localhost:3000/api/health

### 运行测试
npm test

## API接口示例

### 1. 创建批次
curl -X POST http://localhost:3000/api/batches   -H Content-Type: application/json   -d '{"batch_no":"BATCH-001","name":"测试批次","handler":"测试员","operator":"admin"}'

### 2. 导入订单CSV
curl -X POST http://localhost:3000/api/import/orders   -F file=@orders.csv   -F batch_id=批次ID   -F operator=admin

### 3. 退款审核重算
curl -X POST http://localhost:3000/api/refund/recalculate   -H Content-Type: application/json   -d '{"batch_id":"批次ID","operator":"admin"}'

### 4. 处理订单
curl -X POST http://localhost:3000/api/orders/{订单ID}/process   -H Content-Type: application/json   -d '{"status":"approved","handler":"审核员","reason":"数据无误","operator":"admin"}'

状态值: pending(待处理) / approved(放行) / rejected(退回) / supplement(补材料)

### 5. 订单全链路追踪
curl http://localhost:3000/api/orders/{订单ID}/trace

### 6. 批次最终报告
curl http://localhost:3000/api/reports/batch/{批次ID}

## 数据库设计

batches - 处理批次
orders - 订单数据
charger_logs - 桩端日志
payment_receipts - 支付回执
processing_records - 处理记录
exception_records - 异常记录
operation_logs - 操作审计

## 技术栈

Node.js + Express + SQLite3 + multer + csv-parser + uuid
