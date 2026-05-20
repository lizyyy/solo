# 跨境电商关务处理 API

解决跨境电商导入混乱问题：自动整合订单金额、品类税率和海关退单原因，分离正常项、待确认项和失败项。

## 功能特性

### 核心处理规则
1. **币种换算** - 支持 USD、EUR、GBP、JPY、HKD、CNY 自动换算，汇率边界有明确说明
2. **税则JSON匹配** - 优先使用上传的税则JSON匹配HS编码和税率，匹配不到回退到内置默认
3. **品类归并** - 按 HS 编码自动归并到标准品类，未匹配标记待人工确认
4. **重复补税检测** - 同一批次内相同订单ID+相同金额自动识别为重复
5. **海关退单整合** - 退单记录自动关联到对应订单并标记为失败

### 处理结果分类
- **正常项** - 所有校验通过，可直接申报
- **待确认项** - 品类未匹配、税率差异过大等需要人工确认
- **失败项** - 海关退单、必填项缺失、不支持币种、重复申报等

### 幂等性保证
- 同一批次ID重复提交不会重复处理，直接返回已有结果
- 可查询历史批次处理结果

## 项目结构

```
.
├── main.py              # FastAPI 主入口
├── models.py            # 数据模型定义
├── processors.py        # 核心业务处理器
├── idempotency.py       # 幂等性管理器
├── requirements.txt     # 依赖清单
├── test_declarations.csv   # 测试用申报单数据
├── tariff_rules.json    # 测试用税则数据
├── return_receipts.json # 测试用退单回执
└── test_api.py          # API 测试脚本
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python3 main.py
```

或使用 uvicorn:

```bash
python3 -m uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

### 3. 运行测试

打开新终端，执行:

```bash
pip install requests  # 如未安装
python test_api.py
```

## API 接口说明

### 批次处理接口

**POST** `/api/v1/process/batch`

Form-data 参数:
- `batch_id` (必填) - 批次唯一标识（用于幂等）
- `declaration_csv` (必填) - 申报单CSV文件
- `tariff_json` (必填) - 税则规则JSON文件
- `return_receipt_json` (可选) - 退单回执JSON文件

### 获取批次结果

**GET** `/api/v1/batch/{batch_id}`

### 获取汇率配置

**GET** `/api/v1/rules/currency-rates`

### 获取品类配置

**GET** `/api/v1/rules/tariff-categories`

## 测试数据说明

测试用的 `test_declarations.csv` 包含以下场景覆盖:

| 订单ID | 场景说明 | 预期结果 |
|--------|----------|----------|
| ORD001 | 正常3C数码 | 正常项 |
| ORD002 | 正常服装鞋帽 | 正常项(大数量提醒) |
| ORD003 | EUR币种换算 | 正常项 |
| ORD004 | GBP币种换算 | 正常项 |
| ORD005 | 正常食品保健品 | 正常项(小额提醒) |
| ORD006 | 未知品类编码 | 待确认项 |
| ORD007 | 与ORD001相同金额 | 失败项(重复补税) |
| ORD008 | JPY小币种+申报税率差异大 | 待确认项 |
| ORD009 | 存在退单回执 | 失败项(海关退单) |
| ORD010 | HKD币种换算 | 正常项 |

## 边界情况说明

### 币种换算边界
- 不支持的币种 → 直接失败，列出当前支持币种
- 汇率 < 1 或 > 15 → 输出边界提醒
- 金额 ≤ 0 → 标记异常待确认

### 品类归并边界
- 未匹配到标准品类 → 归为"其他品类"，待人工确认
- 品类映射可在 CategoryMerger 中扩展

### 重复补税边界
- 同一批次内相同订单ID+相同金额 → 视为重复
- 重复记录保留原始数据，给出特殊申报建议

### 税率校验边界
- 申报税率与标准税率差异 > 5% → 待人工确认

## 数据格式要求

### 申报单 CSV 字段

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| order_id | string | 是 | 订单唯一标识 |
| sku_code | string | 是 | 商品SKU编码 |
| product_name | string | 是 | 商品名称 |
| category_code | string | 是 | 品类HS编码 |
| amount | float | 是 | 订单金额 |
| currency | string | 是 | 币种代码 |
| quantity | int | 是 | 数量 |
| declared_tariff_rate | float | 是 | 申报税率(0-1) |
| declaration_date | string | 是 | 申报日期 |
| consignee | string | 是 | 收货人 |
| destination_country | string | 是 | 目的国 |

### 税则 JSON 字段

```json
{
  "hs_code": "85171210",
  "category_name": "3C数码",
  "tariff_rate": 0.13,
  "description": "手机及通讯设备",
  "effective_date": "2024-01-01",
  "expiry_date": "2024-12-31"
}
```

### 退单回执 JSON 字段

```json
{
  "receipt_id": "RCP001",
  "order_id": "ORD009",
  "return_code": "T003",
  "return_reason": "商品归类错误",
  "suggestion": "确认正确HS编码后重新提交",
  "return_date": "2024-01-16"
}
```

## 运行验证示例

启动服务后，可通过 Swagger UI 交互式测试:

1. 访问 http://127.0.0.1:9000/docs
2. 点击 `POST /api/v1/process/batch`
3. 点击 "Try it out"
4. 填写 batch_id (如 TEST001)
5. 上传三个测试文件
6. 点击 "Execute" 查看结果

## 注意事项

- 幂等性存储为内存级别，服务重启后会丢失（生产环境建议改用 Redis/数据库）
- 汇率为固定内置值，生产环境建议对接实时汇率API
- 品类映射表可根据实际业务需求扩展
- 生产环境建议添加认证、限流、日志等中间件
