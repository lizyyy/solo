# 采购询价比价服务

一个轻量级的采购询价比价管理系统，解决多供应商报价比价时含税、运费和有效期不同导致的比价表算错问题。

## 核心特性

### 📋 询价单管理
- 创建、发布、更新、取消询价单
- 状态管理：草稿 → 已发布 → 报价中 → 比价中 → 已中标 / 已过期 / 已取消
- 采购项需求清单管理

### 📊 报价单管理
- 多供应商报价提交
- 报价版本追踪（每次修改自动创建版本快照）
- 价税运费自动计算
  - 含税单价 = 不含税单价 × (1 + 税率)
  - 支持不同税率（13%、6%等）
  - 支持运费按单或按件计算
- 有效期管理（生效时间、过期时间）

### ⚖️ 比价分析
- 自动比价排序（按含税含运费总价）
- 智能中标建议
- 与最优价格差计算（金额、百分比）
- 分项价格对比

### 📤 Excel 导出
- 比价汇总表（含推荐供应商）
- 分项对比表
- 报价详情表
- 单份报价单导出

### 📝 操作审计
- 完整操作日志（谁、何时、做了什么）
- 修改前/后快照
- 变更字段追踪
- 失败操作记录

### 🔄 后台任务
- 自动有效期检查（定时任务）
- 异步比价和导出
- 失败重试机制
- 任务状态追踪

## 技术栈

- **语言**: Python 3.8+
- **框架**: Flask 3.0
- **数据库**: SQLite（轻量级，文件存储）
- **ORM**: SQLAlchemy
- **Excel导出**: openpyxl
- **任务调度**: 内置调度器（可集成 APScheduler）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行服务

#### 方式一：带后台调度器（推荐）

```bash
python run_with_scheduler.py
```

服务会在 `http://localhost:5000` 启动，并自动运行：
- 后台任务处理器
- 有效期自动检查（每5分钟）

#### 方式二：仅 Web 服务

```bash
python run.py
```

### 3. 运行演示脚本

```bash
python test_demo.py
```

会演示完整流程：
1. 创建询价单 → 发布
2. 3个供应商提交报价
3. 供应商B修改报价（模拟人工改错）
4. 生成比价表
5. 导出Excel
6. 确定中标
7. 查看操作日志

## API 接口

### 询价单 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/inquiries` | 创建询价单 |
| GET | `/api/inquiries` | 查询询价单列表 |
| GET | `/api/inquiries/<id>` | 获取询价单详情 |
| PUT | `/api/inquiries/<id>` | 更新询价单 |
| POST | `/api/inquiries/<id>/publish` | 发布询价单 |
| POST | `/api/inquiries/<id>/cancel` | 取消询价单 |
| POST | `/api/inquiries/<id>/check-expiry` | 检查有效期 |
| GET | `/api/inquiries/<id>/logs` | 查看操作日志 |

### 报价单 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/quotes` | 创建报价单 |
| GET | `/api/quotes` | 查询报价单列表 |
| GET | `/api/quotes/<id>` | 获取报价单详情 |
| PUT | `/api/quotes/<id>` | 修改报价单 |
| POST | `/api/quotes/<id>/submit` | 提交报价 |
| GET | `/api/quotes/<id>/versions` | 查看版本历史 |
| POST | `/api/quotes/<id>/check-validity` | 检查报价有效性 |
| POST | `/api/quotes/<id>/export` | 导出报价单 |
| GET | `/api/quotes/<id>/logs` | 查看操作日志 |

### 比价 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/comparisons` | 生成比价表 |
| GET | `/api/comparisons` | 查询比价列表 |
| GET | `/api/comparisons/<id>` | 获取比价详情 |
| POST | `/api/comparisons/<id>/award` | 确定中标 |
| POST | `/api/comparisons/inquiry/<id>/export` | 导出比价表 |

### 后台任务 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/jobs` | 创建后台任务 |
| GET | `/api/jobs` | 查询任务列表 |
| GET | `/api/jobs/failed` | 查询失败任务 |
| GET | `/api/jobs/<job_id>` | 获取任务详情 |
| POST | `/api/jobs/<job_id>/execute` | 执行任务 |
| POST | `/api/jobs/<job_id>/retry` | 重试失败任务 |

### 有效期 API

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/expiry/check-all` | 检查所有有效期 |
| GET | `/api/expiry/expiring-soon?days=7` | 查询即将过期 |

### 操作日志 API

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/logs?operation_by=xxx` | 查询用户操作日志 |
| GET | `/api/logs/failed` | 查询失败操作 |

## 数据模型

### 核心实体

#### 询价单 (Inquiry)
- 状态流转: DRAFT → PUBLISHED → QUOTING → COMPARING → AWARDED
- 可过期: 报价截止时间后自动过期

#### 报价单 (Quote)
- 状态流转: DRAFT → SUBMITTED / REVISED → AWARDED / REJECTED
- 自动计算: 含税价、税额、运费汇总、总价
- 版本管理: 每次修改创建快照

#### 报价版本 (QuoteVersion)
- 保存修改前完整快照
- 记录修改原因和修改人

#### 比价结果 (ComparisonResult)
- 自动排名: 按含税含运费总价排序
- 推荐供应商: 自动给出最优建议
- 价格差异: 计算与最优价格差

#### 后台任务 (BackgroundJob)
- 状态: PENDING → RUNNING → COMPLETED / FAILED / RETRYING
- 重试: 最多3次，间隔递增

#### 操作日志 (OperationLog)
- 类型: CREATE, UPDATE, SUBMIT, COMPARE, AWARD, EXPIRE, MANUAL_EDIT, RETRY
- 快照: 修改前后完整数据
- 变更字段: 具体哪些字段被修改

## 真实场景处理

### 1. 缺字段处理
- 严格的参数校验
- 返回详细错误信息（字段、原因、错误码）
- 示例：
```json
{
  "success": false,
  "error": "数据验证失败",
  "validation_errors": {
    "valid": false,
    "errors": [
      {"field": "title", "message": "title 为必填项", "code": "required_field_missing"}
    ]
  }
}
```

### 2. 重复请求处理
- 同一供应商同一询价单只允许一份提交的报价
- 如需修改，使用 revise 接口，自动创建版本
- 返回已存在报价单ID

### 3. 半路失败处理
- 后台任务支持重试（最多3次）
- 每次重试间隔递增（1分钟、2分钟、3分钟）
- 可手动触发重试
- 完整错误信息记录

### 4. 人工改错处理
- 修改报价自动创建版本记录
- 必须填写修改原因
- 操作日志记录变更字段
- 可查看历史版本对比

### 5. 数据持久化
- SQLite 文件存储
- 重启服务后数据不丢失
- 数据库文件: `instance/procurement.db`
- 导出文件: `exports/` 目录

## 使用示例

### cURL 示例

#### 创建询价单
```bash
curl -X POST http://localhost:5000/api/inquiries \
  -H "Content-Type: application/json" \
  -d '{
    "title": "办公电脑采购",
    "created_by": "procurement_manager",
    "department": "采购部",
    "project": "2024IT更新",
    "quote_deadline": "2026-05-17T00:00:00",
    "required_items": [
      {
        "item_no": "ITEM-001",
        "item_name": "笔记本电脑",
        "quantity": 10,
        "unit": "台"
      }
    ]
  }'
```

#### 提交报价
```bash
curl -X POST http://localhost:5000/api/quotes \
  -H "Content-Type: application/json" \
  -d '{
    "inquiry_id": 1,
    "vendor_id": "VENDOR-A",
    "vendor_name": "科技贸易有限公司",
    "tax_rate": 0.13,
    "valid_until": "2026-05-24T00:00:00",
    "total_freight": 500,
    "created_by": "vendor_a",
    "items": [
      {
        "item_name": "笔记本电脑",
        "unit": "台",
        "quantity": 10,
        "unit_price_excl_tax": 4500
      }
    ]
  }'
```

#### 生成比价
```bash
curl -X POST http://localhost:5000/api/comparisons \
  -H "Content-Type: application/json" \
  -d '{
    "inquiry_id": 1,
    "operation_by": "procurement_manager"
  }'
```

#### 确定中标
```bash
curl -X POST http://localhost:5000/api/comparisons/1/award \
  -H "Content-Type: application/json" \
  -d '{
    "quote_id": 1,
    "operation_by": "procurement_manager",
    "reason": "价格最优"
  }'
```

## 目录结构

```
.
├── app/
│   ├── __init__.py          # 应用工厂
│   ├── models.py            # 数据模型
│   ├── routes.py            # 基础路由
│   ├── api.py               # API 路由
│   └── services/            # 业务服务
│       ├── __init__.py
│       ├── inquiry_service.py       # 询价单服务
│       ├── quote_service.py         # 报价单服务
│       ├── comparison_service.py    # 比价服务
│       ├── export_service.py        # 导出服务
│       ├── validation_service.py    # 验证服务
│       ├── operation_log_service.py # 日志服务
│       ├── background_job_service.py # 后台任务服务
│       └── expiry_service.py        # 有效期服务
├── instance/                # SQLite 数据库
├── exports/                 # 导出的 Excel 文件
├── config.py                # 配置
├── run.py                   # 启动入口
├── run_with_scheduler.py    # 带调度器启动
├── scheduler.py             # 后台调度器
├── test_demo.py             # 演示脚本
├── requirements.txt         # 依赖
└── README.md
```

## 配置选项

在 `config.py` 中可调整：

```python
BACKGROUND_JOB_MAX_RETRIES = 3     # 最大重试次数
BACKGROUND_JOB_RETRY_DELAY = 60     # 重试延迟（秒）
VALIDITY_CHECK_INTERVAL = 300       # 有效期检查间隔（秒）
CURRENCY = 'CNY'                     # 默认货币
TAX_RATE_DEFAULT = 0.13             # 默认税率
```

## 健康检查

```bash
curl http://localhost:5000/health
```

响应：
```json
{
  "status": "healthy",
  "timestamp": "2026-05-10T11:00:00.000000"
}
```

## 常见问题

### Q: 数据存储在哪里？
A: SQLite 数据库文件在 `instance/procurement.db`，可以用任何 SQLite 客户端打开查看。

### Q: 导出的 Excel 文件在哪里？
A: 在 `exports/` 目录下，文件名格式为 `比价表_{询价单号}_{时间戳}.xlsx`。

### Q: 如何查看历史数据？
A: 
- 操作日志: `/api/inquiries/<id>/logs` 或 `/api/logs?operation_by=xxx`
- 报价版本: `/api/quotes/<id>/versions`
- 比价历史: `/api/comparisons?inquiry_id=<id>`

### Q: 后台任务失败了怎么办？
A: 
1. 查看失败任务: `GET /api/jobs/failed`
2. 手动重试: `POST /api/jobs/<job_id>/retry`
3. 查看错误信息: 任务详情中 `error_message` 字段

### Q: 报价有效期过了会怎样？
A: 
- 自动检查（默认每5分钟）
- 过期报价在比价时会被排除
- 状态变更记录在操作日志中
- 可查询即将过期: `/api/expiry/expiring-soon?days=7`

## 扩展建议

如需进一步扩展，可考虑：

1. **用户认证**: 集成 JWT 或 OAuth2
2. **权限管理**: 基于角色的访问控制
3. **邮件通知**: 询价发布、报价截止提醒
4. **数据备份**: 定期导出数据库
5. **报表分析**: 采购趋势、供应商评分
6. **API 文档**: 集成 Swagger/OpenAPI
