# 病理切片二读 API

病理科疑难切片二读管理系统 - 初读意见、二读结论、借片流转一体化管理后端服务。

## 技术栈

- **Web 框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据验证**: Pydantic

## 项目结构

```
.
├── app/
│   ├── __init__.py
│   ├── database.py      # 数据库模型和连接
│   ├── schemas.py       # Pydantic 数据模型
│   ├── services.py      # 业务逻辑层
│   └── main.py          # API 入口
├── scripts/
│   └── seed_data.py     # 造数脚本
├── requirements.txt     # 依赖列表
└── README.md
```

## 核心功能

### 状态机

```
PENDING → FIRST_READ → SECOND_READ_IN_PROGRESS → SECOND_READ_COMPLETED → REVISED → REPORTED
                                 ↓                    ↓                    ↓
                             CANCELLED            CANCELLED            CANCELLED
```

### 主要特性

1. **二读记录管理**: 导入、校验、处理、撤销、复核
2. **借片追踪**: 借出、归还、逾期检查
3. **意见版本**: 自动版本化，保留历史记录
4. **超时提醒**: 二读超期、借片超期
5. **重复提交去重**: 同一份材料补交两次只显示一条有效结果
6. **报告导出**: 完整诊断报告生成

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
- API 首页: http://localhost:8000
- Swagger 文档: http://localhost:8000/docs
- ReDoc 文档: http://localhost:8000/redoc

### 3. 造数（生成测试数据）

```bash
python scripts/seed_data.py
```

### 4. 自检

```bash
curl -X POST http://localhost:8000/api/self-test
```

## API 使用示例 (cURL)

### 1. 导入二读记录

```bash
curl -X POST "http://localhost:8000/api/second-reads/import" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_number": "BL-2024-005",
    "first_read_doctor": "张医生",
    "first_read_opinion": "结肠息肉，不除外恶变可能",
    "first_read_date": "2024-05-20T10:00:00",
    "second_read_doctor": "李主任",
    "deadline": "2024-05-27T17:00:00"
  }'
```

### 2. 查看二读列表

```bash
curl "http://localhost:8000/api/second-reads"
```

按状态筛选:
```bash
curl "http://localhost:8000/api/second-reads?status=first_read"
```

### 3. 查看二读详情

```bash
curl "http://localhost:8000/api/second-reads/1"
```

### 4. 提交二读意见

```bash
curl -X PUT "http://localhost:8000/api/second-reads/1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "second_read_opinion": "确认：结肠中分化腺癌，建议根治术",
    "second_read_date": "2024-05-22T14:30:00"
  }'
```

### 5. 提交修订意见

```bash
curl -X PUT "http://localhost:8000/api/second-reads/1/process" \
  -H "Content-Type: application/json" \
  -d '{
    "revision_opinion": "补充：淋巴结未见转移，pTNM分期：T2N0M0",
    "revision_date": "2024-05-22T16:00:00"
  }'
```

### 6. 复核审批

```bash
curl -X POST "http://localhost:8000/api/reviews" \
  -H "Content-Type: application/json" \
  -d '{
    "second_read_id": 1,
    "reviewer": "医务科",
    "review_opinion": "同意诊断意见，可以发报告",
    "is_approved": true
  }'
```

### 7. 撤销记录

```bash
curl -X POST "http://localhost:8000/api/second-reads/1/cancel?reason=切片编号错误"
```

### 8. 借片登记

```bash
curl -X POST "http://localhost:8000/api/borrows" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_number": "BL-2024-002",
    "borrower": "外院王医生",
    "borrower_department": "病理科",
    "borrow_date": "2024-05-22T09:00:00",
    "due_date": "2024-05-29T17:00:00",
    "notes": "会诊借用"
  }'
```

### 9. 归还切片

```bash
curl -X PUT "http://localhost:8000/api/borrows/1/return" \
  -H "Content-Type: application/json" \
  -d '{
    "return_date": "2024-05-28T15:00:00"
  }'
```

### 10. 查看借片记录

```bash
curl "http://localhost:8000/api/borrows"
```

### 11. 查看意见版本历史

```bash
curl "http://localhost:8000/api/opinion-versions/BL-2024-001"
```

### 12. 超时提醒检查

```bash
curl "http://localhost:8000/api/alerts/overdue"
```

### 13. 生成诊断报告

```bash
curl "http://localhost:8000/api/reports/1"
```

### 14. 健康检查

```bash
curl "http://localhost:8000/api/health"
```

## 失败路径示例

### 场景1: 重复导入（去重机制）

第一次导入:
```bash
curl -X POST "http://localhost:8000/api/second-reads/import" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_number": "TEST-DUP-001",
    "first_read_doctor": "张医生",
    "first_read_opinion": "测试重复导入",
    "first_read_date": "2024-05-20T10:00:00"
  }'
```

第二次导入相同内容（会被识别为重复）:
```bash
curl -X POST "http://localhost:8000/api/second-reads/import" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_number": "TEST-DUP-001",
    "first_read_doctor": "张医生",
    "first_read_opinion": "测试重复导入",
    "first_read_date": "2024-05-20T10:00:00"
  }'
```

**预期结果**: 返回状态 `duplicate`，提示记录已存在。

### 场景2: 撤销已报告的记录（不允许）

1. 创建记录 → 2. 提交二读 → 3. 复核通过（发报告）→ 4. 尝试撤销

步骤4会失败，返回错误：`已报告的记录不能撤销`

### 场景3: 重复借片（切片已借出）

1. 登记借片 → 2. 再次登记借同一切片

步骤2会失败，返回错误：`该切片正在借出中`

### 场景4: 数据校验失败（初读日期在未来）

```bash
curl -X POST "http://localhost:8000/api/second-reads/import" \
  -H "Content-Type: application/json" \
  -d '{
    "slide_number": "TEST-DATE-001",
    "first_read_doctor": "张医生",
    "first_read_opinion": "测试日期校验",
    "first_read_date": "2030-01-01T10:00:00"
  }'
```

**预期结果**: 返回 400 错误，提示 `初读日期不能晚于当前时间`

## 数据库表说明

| 表名 | 说明 |
|------|------|
| slides | 切片基本信息 |
| second_reads | 二读主记录（含状态机） |
| borrow_records | 借片流转记录 |
| opinion_versions | 诊断意见版本历史 |
| review_records | 复核审批记录 |
| import_records | 导入记录（用于去重） |

## 自检说明

运行自检接口会自动执行以下流程：
1. 创建测试二读记录
2. 提交二读意见
3. 生成诊断报告
4. 撤销测试记录

所有步骤通过则 `all_passed` 为 `true`。

## 注意事项

1. 数据库文件 `pathology.db` 会自动在项目根目录创建
2. 意见版本自动递增，每次提交新意见都会生成新版本
3. 重复导入通过 MD5 哈希（切片号+医生+意见前100字）识别
4. 状态转换严格遵循状态机，非法转换会被拒绝
