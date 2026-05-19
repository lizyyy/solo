# 团长运营对账系统

处理生鲜缺货后的退款、换货、补券等对账问题的后端系统。

## 功能特性

- ✅ **批量导入订单** - 支持JSON格式批量导入订单数据
- ✅ **自动规则校验** - 4大核心校验规则自动拦截异常订单
- ✅ **人工复核** - 支持对自动校验结果进行人工调整
- ✅ **多维度筛选** - 按团长、时间、状态、异常类型筛选
- ✅ **报表导出** - 导出与查询结果一致的Excel报表
- ✅ **完整审计日志** - 每条记录的所有校验规则及原因清晰可见

## 核心校验规则

| 规则类型 | 规则名称 | 校验内容 |
|---------|---------|---------|
| stockout | 部分缺货校验 | 缺货数量与补偿方式/金额匹配 |
| duplicate | 重复补偿校验 | 同一客户同一商品当日无重复补偿 |
| coupon | 券过期校验 | 优惠券有效期大于7天 |
| consistency | 账单一致性校验 | 实际发货数量与金额匹配 |

## 快速开始

### 1. 环境要求

- Python 3.8+
- pip

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 启动服务

```bash
python -m app.main
```

服务将在 `http://localhost:8000` 启动

### 4. 导入样例数据

新开一个终端窗口：

```bash
pip install requests
python sample_data.py
```

### 5. 查看接口文档

打开浏览器访问：
- Swagger UI: `http://localhost:8000/docs`
- ReDoc: `http://localhost:8000/redoc`

## API 接口说明

### 批量导入订单

```http
POST /api/orders/import
Content-Type: application/json

[
  {
    "order_no": "ORD202401010001",
    "group_leader": "李团长",
    "customer_name": "张三",
    "customer_phone": "13800138001",
    "product_name": "有机蔬菜礼盒",
    "product_sku": "VEG001",
    "order_quantity": 5,
    "order_amount": 250.0,
    "actual_quantity": 5,
    "actual_amount": 250.0,
    "compensation_type": null,
    "compensation_amount": null,
    "coupon_code": null,
    "coupon_expire_date": null,
    "operator": "admin"
  }
]
```

### 查询订单列表

```http
GET /api/orders?group_leader=李团长&is_pass=false&page=1&page_size=20
```

**参数说明：**
- `group_leader`: 团长姓名
- `status`: 状态 (pending/reviewed/exported)
- `is_pass`: 是否通过 (true/false)
- `rule_type`: 异常规则类型 (stockout/duplicate/coupon/consistency)
- `start_date`: 开始时间 (ISO格式)
- `end_date`: 结束时间 (ISO格式)
- `page`: 页码
- `page_size`: 每页数量

### 查询订单详情

```http
GET /api/orders/{order_id}
```

### 获取订单审核日志

```http
GET /api/orders/{order_id}/logs
```

### 人工复核订单

```http
POST /api/orders/{order_id}/review
Content-Type: application/json

{
  "is_pass": true,
  "review_reason": "经核实，补偿金额在合理范围内",
  "operator": "admin"
}
```

### 获取汇总统计

```http
GET /api/summary?group_leader=王团长
```

返回数据：
- 总订单数
- 通过数、拦截数
- 通过率
- 总补偿金额
- 各规则拦截数量分布

### 导出报表

```http
GET /api/export?is_pass=false
```

导出与查询条件一致的Excel报表，包含：
- 订单基本信息
- 补偿信息
- 审核状态
- 拦截规则及原因

### 辅助接口

```http
GET /api/group-leaders          # 获取所有团长列表
GET /api/rule-types             # 获取所有规则类型
GET /api/batches                # 获取导入批次列表
```

## 使用示例

### 使用 curl 导入订单

```bash
curl -X POST "http://localhost:8000/api/orders/import" \
  -H "Content-Type: application/json" \
  -d '[{
    "order_no": "TEST001",
    "group_leader": "测试团长",
    "customer_name": "测试用户",
    "customer_phone": "13800000000",
    "product_name": "测试商品",
    "product_sku": "TEST001",
    "order_quantity": 10,
    "order_amount": 500,
    "actual_quantity": 8,
    "actual_amount": 400,
    "compensation_type": "refund",
    "compensation_amount": 100,
    "operator": "admin"
  }]'
```

### 使用 curl 导出拦截订单

```bash
curl -X GET "http://localhost:8000/api/export?is_pass=false" \
  -o "拦截订单报表.xlsx"
```

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py          # 数据库配置
│   ├── models.py            # 数据模型
│   ├── schemas.py           # Pydantic模式
│   ├── rule_engine.py       # 规则引擎
│   └── main.py              # API主程序
├── requirements.txt         # 依赖列表
├── sample_data.py           # 样例数据脚本
└── README.md
```

## 样例数据说明

运行 `python sample_data.py` 将导入8条测试订单，包含：

### ✅ 正常通过的订单 (4条)
- **ORD202401010001**: 无缺货，完整发货
- **ORD202401010002**: 部分缺货，退款金额合理
- **ORD202401010003**: 券补偿，优惠券有效期正常
- **ORD202401010004**: 全部缺货，换货处理

### ❌ 被拦截的异常订单 (4条)
- **ORD202401010005**: 优惠券即将过期（仅剩3天）
- **ORD202401010006**: 补偿金额异常偏高（缺货金额40，补偿200）
- **ORD202401010007**: 无缺货但申请退款补偿
- **ORD202401010008**: 账单数据不一致（发货3件金额仅100）

## 补偿方式说明

- `refund`: 退款
- `exchange`: 换货
- `coupon`: 补券

## 数据库说明

系统使用SQLite本地数据库，数据文件将自动生成：
- `group_leader.db`: 主数据库文件

## 常见问题

### Q: 如何添加新的校验规则？
A: 在 `app/rule_engine.py` 中继承 `BaseRule` 类，实现 `validate` 方法，然后在 `RuleEngine.__init__` 中添加新规则实例。

### Q: 如何支持Excel导入？
A: 可以在前端处理Excel文件解析，转换为JSON格式后调用 `/api/orders/import` 接口。

### Q: 数据可以保存多久？
A: SQLite本地存储，只要数据库文件不删除，数据永久保存。
