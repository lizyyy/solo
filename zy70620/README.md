# 物业催办外包派单完工复核后端API

小区业主报修管理系统，支持超时监控、重复催办合并、外包派单、完工证明复核等功能。

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **测试**: pytest
- **导出**: Excel (openpyxl)

## 功能特性

### 核心功能
1. **报修单管理** - 创建、查询、编辑、状态流转
2. **催办记录** - 创建催办、重复催办自动合并
3. **外包派单** - 外包商管理、派单、进度跟踪
4. **完工复核** - 提交完工证明、物业复核流程
5. **异常记录** - 人工修正、状态变更等操作留痕
6. **数据导出** - Excel格式报表导出
7. **统计分析** - 超时统计、状态分布等

### 业务规则
- **超时规则**: 每单可设置超时时间，超时自动标记
- **状态流转**: PENDING → PROCESSING → OUTSOURCED → COMPLETED → VERIFIED → CLOSED
- **重复检测**: 2小时内同楼栋同房号同类型报修自动标记重复
- **催办合并**: 同一报修单多次催办记录可合并

## 项目结构

```
property-maintenance/
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库连接配置
│   ├── models.py        # SQLAlchemy数据模型
│   ├── schemas.py       # Pydantic请求/响应模型
│   ├── services.py      # 核心业务逻辑
│   └── main.py          # FastAPI主程序
├── seed_data.py         # 测试数据生成脚本
├── test_main.py         # pytest测试用例
├── requirements.txt     # 依赖包
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API文档: http://localhost:8000/docs
- 可选文档: http://localhost:8000/redoc

### 3. 生成测试数据

```bash
python seed_data.py
```

### 4. 运行测试

```bash
pytest test_main.py -v
```

## API接口说明

### 报修单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/repair-orders/` | 创建报修单 |
| GET | `/api/repair-orders/` | 查询报修单列表 |
| GET | `/api/repair-orders/{id}` | 查询报修单详情 |
| PUT | `/api/repair-orders/{id}/status` | 状态流转 |
| PUT | `/api/repair-orders/{id}/correct` | 人工修正 |
| POST | `/api/repair-orders/{id}/close` | 关闭报修单 |
| POST | `/api/repair-orders/{id}/cancel` | 撤回报修单 |

### 催办记录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/reminders/` | 创建催办记录 |
| POST | `/api/reminders/merge/{order_id}` | 合并催办记录 |

### 外包派单接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/outsourcings/` | 创建外包派单 |
| PUT | `/api/outsourcings/{id}` | 更新外包派单 |

### 完工证明接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/completion-proofs/` | 提交完工证明 |
| POST | `/api/completion-proofs/{id}/verify` | 复核完工证明 |

### 处理人接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/handlers/` | 创建处理人 |
| GET | `/api/handlers/` | 获取处理人列表 |

### 其他接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/statistics/` | 获取统计数据 |
| POST | `/api/export/` | 导出报修单数据 |
| GET | `/api/exception-records/{order_id}` | 获取异常操作记录 |

## cURL主流程示例

### 1. 创建处理人

```bash
curl -X POST "http://localhost:8000/api/handlers/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张师傅",
    "phone": "13800138001",
    "department": "工程部",
    "is_outsourcer": false
  }'
```

### 2. 创建报修单

```bash
curl -X POST "http://localhost:8000/api/repair-orders/" \
  -H "Content-Type: application/json" \
  -d '{
    "building": "1号楼",
    "room_number": "101",
    "contact_name": "王先生",
    "contact_phone": "13900139001",
    "issue_type": "水电维修",
    "description": "厨房水龙头漏水严重",
    "urgency": "high",
    "timeout_hours": 24
  }'
```

### 3. 查询报修单列表

```bash
curl -X GET "http://localhost:8000/api/repair-orders/?status=pending"
```

### 4. 状态流转 (开始处理)

```bash
curl -X PUT "http://localhost:8000/api/repair-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "processing",
    "operator": "物业管理员",
    "remarks": "已指派张师傅处理"
  }'
```

### 5. 创建催办记录

```bash
curl -X POST "http://localhost:8000/api/reminders/" \
  -H "Content-Type: application/json" \
  -d '{
    "repair_order_id": 1,
    "reminder_method": "电话",
    "reminder_content": "业主催促尽快上门维修",
    "operator": "客服小王"
  }'
```

### 6. 合并催办记录

```bash
curl -X POST "http://localhost:8000/api/reminders/merge/1?operator=管理员"
```

### 7. 外包派单

```bash
curl -X POST "http://localhost:8000/api/outsourcings/" \
  -H "Content-Type: application/json" \
  -d '{
    "repair_order_id": 1,
    "outsourcer_name": "专业水电维修公司",
    "outsourcer_contact": "13800138888",
    "promised_completion_time": "2024-01-15T18:00:00",
    "cost": 150.0,
    "remarks": "需要更换水龙头配件"
  }'
```

### 8. 提交完工证明

```bash
curl -X POST "http://localhost:8000/api/completion-proofs/" \
  -H "Content-Type: application/json" \
  -d '{
    "repair_order_id": 1,
    "proof_type": "照片+文字说明",
    "proof_content": "已更换新水龙头，测试正常无漏水",
    "image_urls": "http://example.com/before.jpg,http://example.com/after.jpg",
    "submitter": "外包维修师傅"
  }'
```

### 9. 复核完工证明

```bash
curl -X POST "http://localhost:8000/api/completion-proofs/1/verify" \
  -H "Content-Type: application/json" \
  -d '{
    "verifier": "物业主管",
    "is_verified": true,
    "verify_remarks": "已电话回访业主，确认维修完成，服务满意"
  }'
```

### 10. 获取统计数据

```bash
curl -X GET "http://localhost:8000/api/statistics/"
```

### 11. 导出Excel报表

```bash
curl -X POST "http://localhost:8000/api/export/" \
  -H "Content-Type: application/json" \
  -d '{"status": ["pending", "processing"], "is_timeout": true}' \
  -o repair_orders.xlsx
```

## 冲突路径测试示例

### 无效状态流转 (Pending → Completed)

```bash
# 应返回400错误
curl -X PUT "http://localhost:8000/api/repair-orders/1/status" \
  -H "Content-Type: application/json" \
  -d '{
    "target_status": "completed",
    "operator": "测试",
    "remarks": "跳过流程直接完成"
  }'
```

### 查询不存在的报修单

```bash
# 应返回404错误
curl -X GET "http://localhost:8000/api/repair-orders/99999"
```

### 重复创建外包派单

```bash
# 第一次成功，第二次应返回400错误
curl -X POST "http://localhost:8000/api/outsourcings/" \
  -H "Content-Type: application/json" \
  -d '{
    "repair_order_id": 1,
    "outsourcer_name": "测试公司",
    "outsourcer_contact": "13800000000"
  }'
```

## 数据模型说明

### RepairOrderStatus (报修单状态枚举)

```
PENDING      # 待处理
PROCESSING   # 处理中
OUTSOURCED   # 已外包
COMPLETED    # 已完成
VERIFIED     # 已复核
CLOSED       # 已关闭
CANCELLED    # 已撤回
```

### UrgencyLevel (紧急程度枚举)

```
LOW         # 低
MEDIUM      # 中
HIGH        # 高
EMERGENCY   # 紧急
```

## pytest测试说明

测试文件 `test_main.py` 包含以下测试用例:

- ✅ 处理人创建与查询
- ✅ 报修单创建、查询、详情
- ✅ 状态流转（正常流程 + 非法流转）
- ✅ 催办记录创建与合并
- ✅ 外包派单创建
- ✅ 完工证明提交与复核
- ✅ 人工修正功能
- ✅ 关闭/撤回报修单
- ✅ 统计数据查询
- ✅ Excel报表导出
- ✅ 按状态筛选报修单
- ✅ 异常操作记录查询

运行测试:

```bash
# 运行所有测试
pytest test_main.py -v

# 运行指定测试
pytest test_main.py::test_create_repair_order -v

# 生成覆盖率报告
pytest test_main.py --cov=app -v
```

## 数据库表说明

- `repair_orders` - 报修单主表
- `handlers` - 处理人/外包商表
- `reminders` - 催办记录表
- `outsourcings` - 外包派单表
- `completion_proofs` - 完工证明表
- `exception_records` - 异常操作记录表

## 部署建议

1. **生产环境使用 PostgreSQL** 替代 SQLite
2. **设置 CORS** 根据实际域名配置
3. **添加认证** 如 JWT 或 OAuth2
4. **日志记录** 配置日志系统
5. **数据备份** 定期备份数据库

## License

MIT
