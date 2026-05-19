# 团长运营对账系统

处理生鲜缺货后的退款、换货、补券对账自动化系统。

## 功能特性

- ✅ **数据导入**: 支持订单CSV、缺货清单Excel、补偿规则JSON
- ✅ **错误处理**: 坏数据保留原始位置、失败原因、修改建议
- ✅ **本地持久化**: SQLite数据库存储，重启服务数据不丢失
- ✅ **敏感字段脱敏**: 手机号、用户ID在存储、返回、导出时自动脱敏
- ✅ **对账处理**: 自动匹配规则，支持退款/换货/优惠券三种补偿方式
- ✅ **历史记录**: 支持查询所有历史批次处理记录
- ✅ **结果导出**: 支持将对账结果导出为CSV文件

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 启动服务

```bash
python3 main.py
```

服务将在 `http://localhost:8000` 启动，API文档可访问 `http://localhost:8000/docs`

### 3. 运行完整测试流程

在新终端执行：

```bash
chmod +x test_flow.sh
./test_flow.sh
```

## API接口说明

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/orders | 导入订单CSV |
| POST | /api/import/out-of-stock | 导入缺货清单Excel |
| POST | /api/import/rules | 导入补偿规则JSON |
| POST | /api/reconciliation/process/{batch_id} | 执行对账处理 |
| GET | /api/results/{batch_id} | 查询对账结果 |
| GET | /api/errors/{batch_id} | 查询导入错误记录 |
| GET | /api/batches | 查询所有历史批次 |
| GET | /api/export/{batch_id} | 导出对账结果为CSV |

## 数据格式说明

### 订单CSV字段

| 字段 | 说明 |
|------|------|
| order_id | 订单ID(必填) |
| user_id | 用户ID |
| user_name | 用户姓名 |
| user_phone | 手机号(必填，格式校验) |
| product_id | 商品ID |
| product_name | 商品名称 |
| quantity | 数量(>0) |
| price | 单价 |
| total_amount | 总金额 |
| order_time | 下单时间 |
| status | 订单状态 |

### 缺货清单Excel字段

| 字段 | 说明 |
|------|------|
| product_id | 商品ID(必填) |
| product_name | 商品名称 |
| stock_quantity | 库存数量(>=0) |

### 补偿规则JSON字段

| 字段 | 说明 |
|------|------|
| rule_id | 规则ID(必填) |
| rule_type | 规则类型 |
| condition_type | 条件类型(quantity/amount) |
| condition_value | 条件阈值 |
| compensation_type | 补偿类型(refund/exchange/coupon) |
| compensation_value | 补偿值 |
| description | 规则说明 |

## 敏感字段脱敏

- **手机号**: 138****8001
- **用户ID**: UI***56

脱敏在数据存入数据库、API返回、文件导出时都会执行，确保敏感信息安全。

## 错误记录查询

每个导入批次都会产生错误记录，包含：
- 错误所在行号
- 原始数据
- 错误原因
- 修改建议

可通过 `/api/errors/{batch_id}` 查询。
