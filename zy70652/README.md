# 社群分账退款冲抵佣金阶梯后端API

## 功能概述

这是一个完整的社群团购分账系统，实现了订单合并、退款冲抵、佣金阶梯计算、重复订单去重等核心功能。**特别强调：所有主流程和异常路径都有完整的审计日志，保留了原始输入、处理人、处理结论，确保操作可追溯。**

## 核心特性

- **订单管理**：订单创建、查询、重复订单自动去重
- **退款管理**：退款创建、处理、退款冲抵佣金
- **佣金阶梯**：基于净订单金额的阶梯佣金计算
- **分账结算**：自动计算订单总额、退款总额、净订单金额、服务费、佣金
- **人工修正**：支持对结算单进行人工调整
- **撤回关闭**：支持关闭结算单并释放相关订单和退款
- **审计日志**：记录所有操作的原始输入、处理人、处理结论（成功和失败都有日志）
- **报告导出**：导出Excel格式的结算报告

## 审计日志覆盖范围

| 操作 | 成功日志 | 失败日志 | 说明 |
|------|---------|---------|-----|
| 创建订单 | ✓ | ✓ | 包含重复订单、团长不存在等 |
| 创建退款 | ✓ | ✓ | 包含退款单号重复、订单不存在等 |
| 处理退款 | ✓ | ✓ | 包含退款已处理、退款不存在等 |
| 创建结算单 | ✓ | ✓ | 包含团长不存在等 |
| 计算结算 | ✓ | ✓ | 包含结算单不存在、状态不正确等 |
| 确认结算 | ✓ | ✓ | 包含结算单不存在、状态不正确等 |
| 关闭结算 | ✓ | ✓ | 包含结算单不存在、已关闭等 |
| 人工修正 | ✓ | ✓ | 包含结算单不存在、状态不正确等 |

## 技术栈

- FastAPI - Web框架
- SQLAlchemy - ORM
- SQLite - 数据库
- openpyxl - Excel导出
- pytest - 测试框架

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 初始化示例数据

```bash
curl -X POST http://localhost:8000/init-sample-data/
```

## 业务流程示例（curl）

### 主流程：创建结算完整流程

```bash
# 1. 创建团长
curl -X POST http://localhost:8000/leaders/ \
  -H "Content-Type: application/json" \
  -d '{"leader_code":"TEST001","name":"王团长","phone":"13900001111","email":"wang@example.com"}'

# 2. 创建订单（必须带 processed_by 处理人）
curl -X POST http://localhost:8000/orders/ \
  -H "Content-Type: application/json" \
  -d '{"order_no":"ORDTEST001","leader_id":1,"user_name":"测试用户","user_phone":"13800000001","total_amount":599.0,"product_count":2,"processed_by":"order_operator"}'

# 3. 创建退款（必须带 processed_by 处理人）并处理
curl -X POST http://localhost:8000/refunds/ \
  -H "Content-Type: application/json" \
  -d '{"refund_no":"REFTEST001","order_id":1,"refund_amount":99.0,"refund_reason":"测试退款","processed_by":"refund_operator"}'

curl -X PUT "http://localhost:8000/refunds/1/process?processed_by=approve_operator"

# 4. 创建结算单（必须带 processed_by 处理人）
curl -X POST http://localhost:8000/settlements/ \
  -H "Content-Type: application/json" \
  -d '{"leader_id":1,"start_date":"2025-01-01T00:00:00","end_date":"2026-12-31T23:59:59","processed_by":"settlement_operator"}'

# 5. 计算结算
curl -X POST http://localhost:8000/settlements/calculate \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":1,"processed_by":"finance"}'

# 6. 确认处理结算
curl -X POST http://localhost:8000/settlements/process \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":1,"processed_by":"finance_manager"}'

# 7. 导出报告
curl -X GET http://localhost:8000/settlements/1/export -o settlement_report.xlsx

# 8. 查看审计日志
curl -X GET http://localhost:8000/settlements/1/audit-logs
```

### 异常路径示例（都会记录审计日志）

```bash
# 场景1：重复订单号（自动记录失败日志）
curl -X POST http://localhost:8000/orders/ \
  -H "Content-Type: application/json" \
  -d '{"order_no":"ORDTEST001","leader_id":1,"user_name":"另一个用户","user_phone":"13800000002","total_amount":599.0,"product_count":1,"processed_by":"operator_b"}'

# 场景2：人工修正佣金
curl -X POST http://localhost:8000/adjustments/ \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":1,"adjustment_type":"add_commission","amount":50.0,"reason":"特殊奖励","processed_by":"manager"}'

# 场景3：关闭/撤回结算单
curl -X POST http://localhost:8000/settlements/close \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":1,"processed_by":"admin","close_reason":"数据错误，需要重新计算"}'

# 场景4：对草稿状态的结算单进行修正（会失败并记录日志）
curl -X POST http://localhost:8000/adjustments/ \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":2,"adjustment_type":"add_commission","amount":100.0,"reason":"测试","processed_by":"manager"}'

# 场景5：对已处理的结算单重复计算（会失败并记录日志）
curl -X POST http://localhost:8000/settlements/calculate \
  -H "Content-Type: application/json" \
  -d '{"settlement_id":1,"processed_by":"finance"}'

# 查看所有审计日志
curl -X GET http://localhost:8000/audit-logs/
```

## 核心计算公式

```
净订单金额 = 订单总金额 - 退款总金额
平台服务费 = 净订单金额 × 服务费率（有上下限）
应发佣金 = 净订单金额 × 阶梯佣金率
实发佣金 = 应发佣金 - 退款总金额（保底为0）
```

## 佣金阶梯规则示例

| 订单金额区间 | 佣金率 |
|-------------|--------|
| 0 - 1000元 | 8% |
| 1000 - 5000元 | 10% |
| 5000元以上 | 12% |

## 运行测试

```bash
pytest test_main.py -v
```

测试用例覆盖：
- 主流程完整测试
- 重复订单检测及审计日志
- 无效团长的订单创建及审计日志
- 退款重复处理及审计日志
- 无效订单的退款创建及审计日志
- 结算单状态错误的计算/处理及审计日志
- 草稿状态结算单的修正及审计日志
- 结算单关闭及审计日志

## API接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /leaders/ | 创建团长 |
| GET | /leaders/ | 查询团长列表 |
| GET | /leaders/{id} | 查询单个团长 |
| POST | /commission-rules/ | 创建佣金规则 |
| POST | /orders/ | 创建订单（带processed_by） |
| GET | /orders/{id} | 查询订单 |
| POST | /refunds/ | 创建退款（带processed_by） |
| PUT | /refunds/{id}/process | 处理退款（带processed_by） |
| POST | /settlements/ | 创建结算单（带processed_by） |
| GET | /settlements/{id} | 查询结算单 |
| POST | /settlements/calculate | 计算结算（带processed_by） |
| POST | /settlements/process | 确认处理结算（带processed_by） |
| POST | /settlements/close | 关闭结算单（带processed_by） |
| POST | /adjustments/ | 人工修正（带processed_by） |
| GET | /settlements/{id}/audit-logs | 查看结算单审计日志 |
| GET | /audit-logs/ | 查看所有审计日志 |
| GET | /settlements/{id}/export | 导出Excel报告 |
