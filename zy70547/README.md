# 第三方额度熔断API

基于业务优先级的第三方接口额度熔断管理系统，适用于短信、地图等需要配额管理的场景。

## 核心功能

### 1. 额度管理
- 按时间窗口配置供应商总额度
- 实时额度消耗与统计
- 支持多供应商、多业务标签

### 2. 优先级熔断机制
- **警告阈值(默认80%)**: 拒绝低优先级(priority > 5)请求
- **熔断阈值(默认95%)**: 拒绝中低优先级(priority > 3)请求
- **高优先级绿色通道**: 核心业务始终可用

### 3. 数据可追溯
- 失败请求保留原始输入、处理依据、最终结论
- 熔断事件完整记录
- 支持导出额度使用报告

### 4. 人工管理
- 人工修正已用额度
- 基于使用记录重新计算额度
- 操作留痕可审计

## 项目结构

```
├── models.py              # 数据模型定义
├── database.py            # 数据库配置
├── service.py             # 核心业务逻辑
├── main.py                # FastAPI接口
├── test_quota_circuit_breaker.py  # 测试脚本
└── requirements.txt       # 依赖列表
```

## 数据模型

| 模型 | 说明 | 关键字段 |
|------|------|----------|
| Supplier | 供应商 | name, code, is_active |
| QuotaWindow | 额度窗口 | total_quota, used_quota, start_time, end_time |
| BusinessTag | 业务标签 | name, code, priority |
| QuotaUsage | 使用记录 | request_id, amount, raw_input, processing_rule, conclusion, status |
| CircuitBreakerEvent | 熔断事件 | status, reason, triggered_at |
| QuotaReport | 报告 | content, generated_at, generated_by |

## 快速开始

### 1. 安装依赖

```bash
pip3 install -r requirements.txt
```

### 2. 运行服务

```bash
python3 main.py
```

服务启动后访问: http://localhost:8000/docs

### 3. 运行测试

```bash
python3 test_quota_circuit_breaker.py
```

## API接口说明

### 供应商管理
- `POST /suppliers` - 创建供应商
- `GET /suppliers` - 获取供应商列表

### 业务标签管理
- `POST /business-tags` - 创建业务标签
- `GET /business-tags` - 获取业务标签列表

### 额度窗口管理
- `POST /quota-windows` - 创建额度窗口
- `GET /quota-windows/{supplier_id}/current` - 获取当前有效窗口

### 额度管理
- `POST /quota/consume` - 消耗额度（核心接口）
- `GET /quota/usage-history` - 查询使用历史

### 熔断管理
- `GET /circuit-breaker/{supplier_id}/status` - 查询熔断状态
- `GET /circuit-breaker/events` - 查询熔断事件

### 人工管理
- `POST /quota/manual-correct` - 人工修正额度
- `POST /quota/recalculate/{quota_window_id}` - 重新计算额度

### 报告管理
- `GET /reports/export/{supplier_id}` - 导出额度报告

## 使用示例

### 初始化配置

```python
# 1. 创建供应商
POST /suppliers
{
    "name": "短信服务商",
    "code": "SMS_PROVIDER",
    "description": "阿里云短信服务"
}

# 2. 创建业务标签（配置优先级）
POST /business-tags
{
    "name": "验证码",
    "code": "VERIFY_CODE",
    "priority": 1,  # 数字越小优先级越高
    "description": "高优先级验证码短信"
}

# 3. 创建额度窗口
POST /quota-windows
{
    "supplier_id": 1,
    "window_type": "DAILY",
    "total_quota": 10000,
    "warning_threshold": 0.8,
    "circuit_breaker_threshold": 0.95,
    "start_time": "2024-01-01T00:00:00",
    "end_time": "2024-01-02T00:00:00"
}
```

### 消耗额度

```python
POST /quota/consume
{
    "supplier_code": "SMS_PROVIDER",
    "business_tag_code": "VERIFY_CODE",
    "amount": 1,
    "request_id": "unique_request_id_123",  # 用于幂等
    "raw_input": "{\"phone\": \"13800138000\"}"
}
```

成功响应:
```json
{
    "success": true,
    "usage_id": 1,
    "conclusion": "SUCCESS",
    "remaining_quota": 9999
}
```

熔断响应:
```json
{
    "success": false,
    "rejected": true,
    "reason": "Circuit breaker threshold exceeded, low priority request rejected",
    "conclusion": "REJECTED"
}
```

## 熔断规则详解

### 优先级定义
- `priority <= 3`: 高优先级（核心业务，如验证码）
- `3 < priority <= 5`: 中优先级（重要业务，如营销短信）
- `priority > 5`: 低优先级（次要业务，如通知）

### 触发条件
1. **正常状态 (usage < 80%)**: 所有请求正常通过
2. **警告状态 (80% <= usage < 95%)**: 拒绝低优先级请求
3. **熔断状态 (usage >= 95%)**: 拒绝中低优先级请求
4. **恢复机制**: 额度降至90%以下时自动进入半开状态

### 失败数据保留
所有请求（包括失败的）都会记录：
- `raw_input`: 原始请求数据
- `processing_rule`: 当时的熔断规则和使用比例
- `conclusion`: 处理结论
- `status`: 最终状态

## 测试覆盖

| 测试场景 | 说明 |
|----------|------|
| 正常流程消耗 | 额度正常扣减 |
| 警告阈值熔断 | 80%时低优先级被拒 |
| 熔断阈值触发 | 95%时中低优先级被拒 |
| 高优先级绿色通道 | 熔断状态高优先级仍可用 |
| 供应商不存在 | 异常处理 |
| 业务标签不存在 | 异常处理 |
| 额度不足 | 异常处理 |
| 重复请求幂等 | 相同request_id只扣一次 |
| 人工修正额度 | 手动调整已用额度 |
| 人工修正后重算 | 基于记录重新统计 |
| 导出报告 | 完整报告生成 |
| 失败路径数据保留 | 失败请求完整记录 |

## 持久化说明

使用SQLite数据库，数据文件为 `quota_circuit_breaker.db`，服务重启后：
- 所有历史使用记录可查
- 额度窗口状态保持
- 熔断事件完整保留
- 人工操作记录可追溯

## 运行效果

启动服务后，访问 http://localhost:8000/docs 可以看到完整的API文档并进行在线测试。
