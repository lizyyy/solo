# 新能源订单数据处理 API

## 项目概述
这是一个新能源充电订单数据处理系统，用于解决新能源客服导入混乱的问题。系统支持上传订单CSV、桩端日志JSON、支付回执文件，自动将数据分类为正常项、待确认项、失败项三类返回。

## 核心功能
- 支持多源数据上传（订单CSV、桩端日志JSON、支付回执JSON
- 自动数据分类：正常项、待确认项、失败项
- 失败记录保留原始字段和建议处理方式
- 防重复提交机制（基于MD5哈希的批次去重）
- 桩编号关联追踪

## 规则引擎覆盖
1. **未启动扣费**：充电失败但已扣费且未退款
2. **重复退款**：同一订单多笔退款记录
3. **跨平台订单**：数据来源不一致
4. **桩端日志缺失**：已完成订单无对应桩端日志
5. **人工修正标记**：特定异常数据（如桩A05-B12的订单ORD202405150003）

## 技术栈
- FastAPI: Web框架
- Pydantic: 数据模型
- Python-multipart: 文件上传处理
- CORS中间件: 跨域支持

## 快速开始

### 1. 安装依赖
```bash
pip install -r requirements.txt
```

### 2. 启动服务
```bash
python main.py
```
服务将在 http://localhost:8000 启动

### 3. 健康检查
```bash
curl http://localhost:8000/api/health
```

### 4. 数据处理接口（完整流程）
```bash
curl -X POST "http://localhost:8000/api/process" \
  -F "order_csv=@sample_orders.csv" \
  -F "charging_log=@sample_charging_logs.json" \
  -F "payment_receipt=@sample_payments.json"
```

## API文档
启动服务后访问 http://localhost:8000/docs 查看交互式API文档

## 返回结果说明
```json
{
  "batch_id": "xxx",
  "total_records": 100,
  "normal_count": 80,
  "pending_count": 10,
  "failed_count": 10,
  "normal_items": [...],
  "pending_items": [...],
  "failed_items": [...]
}
```

### 失败记录字段
- `record_id`: 记录ID
- `record_type`: 记录类型
- `raw_data`: 原始数据
- `error_type`: 错误类型
- `error_message`: 错误详情
- `suggested_action`: 建议处理方式
- `pile_number`: 关联桩编号

## 样例数据说明
- `sample_orders.csv`: 6条订单样例，包含正常、失败、待确认等各种情况
- `sample_charging_logs.json`: 5条桩端日志样例
- `sample_payments.json`: 7条支付记录样例，包含重复退款场景

### 特殊样例
- 订单ORD202405150002：未启动扣费场景（充电失败但已扣费25元）
- 订单ORD202405150003：人工修正场景（桩A05-B12，充电量与金额不匹配）
- 订单ORD202405150004：重复退款场景（2笔退款记录）
- 订单ORD202405150006：待确认场景（无支付记录）

## 防重复提交
同一批数据再次提交会返回409错误，提示批次已处理。可通过 `/api/batches` 查看已处理批次列表。

## 项目结构
```
.
├── main.py              # FastAPI主程序
├── models.py            # 数据模型定义
├── parser.py            # 文件解析和数据标准化
├── rules.py             # 规则引擎
├── requirements.txt     # Python依赖
├── sample_orders.csv    # 订单样例数据
├── sample_charging_logs.json  # 桩端日志样例
├── sample_payments.json # 支付回执样例
├── test_api.sh         # API测试脚本
└── README.md            # 本说明文档
```
