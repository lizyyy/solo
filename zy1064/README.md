# 优惠券叠加风险试算 API 服务

一个本地运行的优惠券叠加风险试算后端服务，帮助小电商运营在上线活动前，提前评估满减券、折扣码、会员价、包邮券等多种优惠叠加后的毛利风险。

## 功能特性

- **数据导入**：支持商品、优惠券、会员等级、购物车样例的 JSON 导入
- **优惠券规则**：支持门槛、品类限制、互斥组、可叠加顺序、包邮阈值
- **优惠计算**：单个购物车的最优优惠组合计算，考虑叠加顺序
- **批量模拟**：批量计算多个购物车的优惠效果
- **风险解释**：解释为什么某些券不能用、为什么某个组合风险高
- **持久化存储**：使用 SQLite 数据库持久化存储
- **报告导出**：支持 Markdown 和 JSON 两种风险报告导出
- **异常处理**：完善的错误处理，返回清晰的错误提示

## 技术栈

- **语言**：Go 1.21+
- **Web框架**：Gin
- **ORM**：GORM
- **数据库**：SQLite

## 快速开始

### 1. 编译项目

```bash
go build -o coupon-calc .
```

### 2. 启动服务

```bash
# 默认端口 8080
./coupon-calc

# 或指定端口
PORT=8888 ./coupon-calc
```

服务启动后，API 地址为：`http://localhost:8080/api/v1`

## API 接口

### 数据导入接口

#### 导入商品

```bash
curl -X POST http://localhost:8080/api/v1/products/import \
  -H "Content-Type: application/json" \
  -d @data/products.json
```

#### 导入优惠券

```bash
curl -X POST http://localhost:8080/api/v1/coupons/import \
  -H "Content-Type: application/json" \
  -d @data/coupons.json
```

#### 导入会员等级

```bash
curl -X POST http://localhost:8080/api/v1/memberships/import \
  -H "Content-Type: application/json" \
  -d @data/memberships.json
```

#### 导入购物车

```bash
curl -X POST http://localhost:8080/api/v1/carts/import \
  -H "Content-Type: application/json" \
  -d @data/carts.json
```

### 数据查询接口

#### 查询所有商品

```bash
curl http://localhost:8080/api/v1/products
```

#### 查询单个商品

```bash
curl http://localhost:8080/api/v1/products/1
```

#### 查询所有优惠券

```bash
curl http://localhost:8080/api/v1/coupons
```

#### 查询所有购物车

```bash
curl http://localhost:8080/api/v1/carts
```

### 优惠计算接口

#### 计算单个购物车

使用已导入的购物车 ID：

```bash
curl -X POST http://localhost:8080/api/v1/calculate/single \
  -H "Content-Type: application/json" \
  -d '{"cart_id": 1}'
```

或直接传入商品列表：

```bash
curl -X POST http://localhost:8080/api/v1/calculate/single \
  -H "Content-Type: application/json" \
  -d '{
    "membership_level": "gold",
    "items": [
      {"product_id": 1, "quantity": 2},
      {"product_id": 2, "quantity": 1}
    ]
  }'
```

#### 批量计算

计算所有已导入的购物车：

```bash
curl -X POST http://localhost:8080/api/v1/calculate/batch \
  -H "Content-Type: application/json" \
  -d '{"save_results": true}'
```

指定购物车 ID 列表：

```bash
curl -X POST http://localhost:8080/api/v1/calculate/batch \
  -H "Content-Type: application/json" \
  -d '{"cart_ids": [1, 2, 3], "save_results": true}'
```

### 报告导出接口

#### 导出 JSON 报告

```bash
curl http://localhost:8080/api/v1/reports/json
```

#### 导出 Markdown 报告

```bash
# 直接查看
curl http://localhost:8080/api/v1/reports/markdown

# 保存到文件
curl -o risk-report.md http://localhost:8080/api/v1/reports/markdown
```

## 完整使用示例

```bash
# 1. 启动服务
./coupon-calc &

# 2. 导入基础数据
curl -X POST http://localhost:8080/api/v1/products/import -H "Content-Type: application/json" -d @data/products.json
curl -X POST http://localhost:8080/api/v1/coupons/import -H "Content-Type: application/json" -d @data/coupons.json
curl -X POST http://localhost:8080/api/v1/memberships/import -H "Content-Type: application/json" -d @data/memberships.json
curl -X POST http://localhost:8080/api/v1/carts/import -H "Content-Type: application/json" -d @data/carts.json

# 3. 批量计算所有购物车
curl -X POST http://localhost:8080/api/v1/calculate/batch \
  -H "Content-Type: application/json" \
  -d '{"save_results": true}'

# 4. 查看风险报告
curl http://localhost:8080/api/v1/reports/json

# 5. 导出 Markdown 报告
curl -o risk-report.md http://localhost:8080/api/v1/reports/markdown
```

## 风险等级说明

| 风险等级 | 毛利率范围 | 说明 |
|---------|-----------|------|
| 🔴 高风险 | < 5% | 极可能亏损，强烈建议调整活动策略 |
| 🟡 中风险 | 5% ~ 15% | 利润微薄，建议优化 |
| 🟢 低风险 | ≥ 15% | 利润安全 |

## 优惠券类型

| 类型 | 说明 | 关键字段 |
|-----|------|---------|
| `full_reduction` | 满减券 | `threshold`（门槛）、`discount_value`（减免金额） |
| `discount` | 折扣券 | `discount_rate`（折扣率，0.8 表示 8 折） |
| `free_shipping` | 包邮券 | `threshold`（包邮门槛，0 表示无门槛） |

## 优惠券规则配置

### 互斥组 (MutexGroup)

同一互斥组的优惠券不能同时使用。例如：
- `full_reduction` 组：满200减100 和 满100减50 互斥
- `discount` 组：全场8折 和 其他折扣码 互斥

### 叠加顺序 (StackOrder)

数值越小，优先级越高，先计算。建议：
1. 满减券 (1-10)
2. 折扣券 (11-20)
3. 包邮券 (90+)

### 品类限制 (CategoryLimit)

指定优惠券仅对特定品类商品生效。空字符串表示全场通用。

## 环境变量配置

| 变量名 | 默认值 | 说明 |
|-------|-------|------|
| `PORT` | 8080 | 服务端口 |
| `GIN_MODE` | debug | 运行模式 (debug/release) |
| `DB_PATH` | ./coupon_calc.db | SQLite 数据库路径 |
| `HIGH_RISK_MARGIN` | 0.05 | 高风险毛利率阈值 |
| `MEDIUM_RISK_MARGIN` | 0.15 | 中风险毛利率阈值 |

## 示例数据说明

`data/` 目录包含示例数据：

- `products.json`：6 个示例商品（服装、电子产品、美妆）
- `coupons.json`：8 个示例优惠券（满减、折扣、包邮）
- `memberships.json`：4 个会员等级（普通、银卡、金卡、白金）
- `carts.json`：5 个测试购物车，覆盖不同场景

## 错误处理

服务会返回清晰的错误响应：

```json
{
  "error": {
    "code": 400,
    "message": "金额无效",
    "details": "invalid amount: cannot be negative"
  }
}
```

常见错误码：
- `400`：请求参数错误
- `404`：资源不存在
- `422`：业务逻辑错误（如缺少成本价）
- `500`：服务器内部错误

## 计算结果示例

```json
{
  "success": true,
  "data": {
    "original_subtotal": 398.00,
    "membership_discount": 39.80,
    "total_discount": 139.80,
    "final_price": 258.20,
    "total_cost": 190.00,
    "gross_margin": 68.20,
    "gross_margin_rate": 0.2641,
    "risk_level": "low",
    "is_free_shipping": true,
    "explanation": "会员享受10%折扣；最优组合包含：满200减100、包邮券；毛利率26.41%，风险等级【低】",
    "applied_coupons": [
      {
        "coupon_id": 1,
        "code": "FULL100",
        "name": "满200减100",
        "discount": 100.00,
        "apply_order": 1
      }
    ],
    "inapplicable_coupons": [
      {
        "coupon_id": 2,
        "code": "FULL50",
        "name": "满100减50",
        "reason": "与已选用券 满200减100(FULL100) 互斥，属于同一互斥组 full_reduction"
      }
    ]
  }
}
```

## 许可证

MIT License
