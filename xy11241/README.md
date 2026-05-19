# 公益书库管理系统

一个完整的后端API系统，用于管理公益书库的书籍入库、批量导入、敏感数据处理和审计日志。

## 功能特性

### ✅ 核心功能
- **ISBN校验**：支持ISBN-10和ISBN-13格式验证，自动标准化ISBN
- **无ISBN处理**：支持没有ISBN的书籍，使用"书名+品相+年级"作为唯一标识
- **同ISBN多品相管理**：同一ISBN不同品相/年级作为独立记录
- **重复导入自动处理**：检测到重复书籍时自动累加数量，不重复创建
- **品相标准化**：固定品相选项（全新、九成新、八成新、七成新、六成新、五成新及以下）
- **年级标准化**：固定年级选项（一年级到高三 + 通用）

### ✅ 批量处理
- **部分成功机制**：批量导入时成功的记录入库，失败的记录单独标记
- **失败重试安全**：重试时不会破坏已成功的记录
- **导入批次管理**：每个批量操作生成独立批次，可追溯查询
- **详细原因记录**：每条成功/失败记录都有明确的处理原因

### ✅ 敏感数据保护
- **API响应脱敏**：返回的手机号、身份证号等敏感字段自动脱敏
- **导出文件脱敏**：CSV/Excel导出时敏感字段自动处理
- **日志脱敏**：系统日志中的敏感信息自动屏蔽
- **三层保护**：API层、导出层、日志层都有脱敏处理，不依赖前端

### ✅ 数据导出
- 支持CSV格式导出书籍列表
- 支持Excel格式导出书籍列表
- 支持Excel格式导出版清单
- 支持Excel格式导出导入批次记录

### ✅ 审计日志
- 记录所有操作类型
- 记录操作人信息
- 记录操作时间和IP地址
- 记录变更前后的值

## 技术栈

- **Web框架**：FastAPI 0.109.0
- **ORM**：SQLAlchemy 2.0
- **数据库**：SQLite（本地文件数据库，无需额外安装）
- **数据验证**：Pydantic 2.5
- **Excel处理**：openpyxl + pandas
- **日志处理**：Python logging（内置过滤器）

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8000` 启动。

### 3. 查看API文档

启动后访问以下地址查看交互式API文档：

- **Swagger UI**：http://localhost:8000/docs
- **ReDoc**：http://localhost:8000/redoc

### 4. 运行测试

```bash
python test_data.py
```

## API接口说明

### 书籍管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/api/v1/books/` | 新增单本书籍 |
| GET | `/api/v1/books/` | 获取书籍列表（支持按年级、品相、状态筛选） |
| GET | `/api/v1/books/{id}` | 获取单本书籍详情 |
| PUT | `/api/v1/books/{id}` | 更新书籍信息 |
| DELETE | `/api/v1/books/{id}` | 删除书籍 |
| POST | `/api/v1/books/batch-import` | 批量导入书籍 |

### 导入批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/books/import/batches` | 获取导入批次列表 |
| GET | `/api/v1/books/import/batches/{batch_no}` | 获取批次详情和所有记录 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/export/books/csv` | 导出书籍为CSV |
| GET | `/api/v1/export/books/excel` | 导出书籍为Excel |
| GET | `/api/v1/export/shelf-list/excel` | 导出版清单为Excel |
| GET | `/api/v1/export/import-records/excel/{batch_no}` | 导出导入记录为Excel |

### 统计和其他

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/api/v1/books/statistics/overview` | 获取统计概览 |
| GET | `/api/v1/books/shelf/list` | 获取上架清单 |
| GET | `/api/v1/meta/allowed-values` | 获取允许的品相和年级值 |
| GET | `/api/v1/logs/operations` | 获取操作日志 |

## 使用示例

### 新增单本书籍

```bash
curl -X POST "http://localhost:8000/api/v1/books/" \
  -H "Content-Type: application/json" \
  -d '{
    "title": "Python编程：从入门到实践",
    "isbn": "978-7-115-42802-8",
    "author": "Eric Matthes",
    "condition": "九成新",
    "grade": "高一",
    "book_count": 2,
    "donor_name": "张三",
    "donor_phone": "13800138000"
  }'
```

### 批量导入书籍

```bash
curl -X POST "http://localhost:8000/api/v1/books/batch-import" \
  -H "Content-Type: application/json" \
  -d '{
    "operator_name": "志愿者小李",
    "operator_phone": "13900139000",
    "books": [
      {
        "title": "三国演义",
        "isbn": "9787020008729",
        "condition": "七成新",
        "grade": "高二",
        "book_count": 2
      },
      {
        "title": "红楼梦",
        "isbn": "9787020002208",
        "condition": "八成新",
        "grade": "高三",
        "book_count": 1
      }
    ]
  }'
```

### 导出版清单

```bash
curl -X GET "http://localhost:8000/api/v1/export/shelf-list/excel?grade=高一&status=待上架" \
  -o shelf_list.xlsx
```

## 允许的品相值

- 全新
- 九成新
- 八成新
- 七成新
- 六成新
- 五成新及以下

## 允许的年级值

- 一年级、二年级、三年级、四年级、五年级、六年级
- 初一、初二、初三
- 高一、高二、高三
- 通用

## 敏感字段处理

系统自动对以下字段进行脱敏处理：

- **donor_phone**（捐赠人电话）：138****8000
- **donor_idcard**（捐赠人身份证）：110101********1234
- **operator_phone**（操作员电话）：139****9000

脱敏处理在以下三个层面都生效：
1. API响应
2. 导出文件（CSV/Excel）
3. 系统日志

## 批量导入处理逻辑

1. 为每个批次生成唯一的批次号
2. 逐条处理书籍数据：
   - 验证ISBN格式（如有）
   - 验证品相和年级值
   - 检查是否为重复书籍（ISBN+品相+年级 或 书名+品相+年级）
   - 如果重复，累加数量；否则创建新记录
3. 记录每条数据的处理结果（成功/失败/重复）和原因
4. 更新批次统计信息（成功数、失败数）
5. 所有记录都保存在导入记录表中，可追溯查询

**重要**：即使部分数据失败，已成功的数据也不会回滚，保证数据完整性。

## 项目结构

```
.
├── main.py                 # 应用入口
├── requirements.txt        # 依赖列表
├── test_data.py           # 测试脚本
├── README.md              # 项目文档
└── app/
    ├── __init__.py
    ├── config.py          # 配置文件
    ├── database.py        # 数据库连接
    ├── models.py          # 数据模型
    ├── schemas.py         # Pydantic验证模型
    ├── crud.py            # 业务逻辑
    ├── utils.py           # 工具函数（ISBN验证、脱敏等）
    └── routers/
        ├── __init__.py
        ├── books.py       # 书籍管理接口
        ├── logs.py        # 日志管理接口
        └── export.py      # 数据导出接口
```

## 数据库表结构

### books（书籍表）
- id, isbn, isbn_normalized, title, author, publisher
- condition, grade, book_count, status
- donor_name, donor_phone, donor_idcard, remarks
- created_at, updated_at

### import_batches（导入批次表）
- id, batch_no, total_count, success_count, failed_count
- operator_name, operator_phone, status, error_message
- created_at, completed_at

### import_records（导入记录表）
- id, batch_id, book_id, row_number
- is_success, is_duplicate, action_taken, reason
- isbn, title, condition, grade, created_at

### operation_logs（操作日志表）
- id, operation_type, operator_name, operator_phone
- target_type, target_id, old_value, new_value, change_reason
- ip_address, user_agent, created_at

## 注意事项

1. 数据库文件 `book_library.db` 会在首次启动时自动创建
2. 敏感数据的脱敏处理在后端三层完成，不依赖前端
3. 批量导入失败重试时，不会重复处理已成功的记录
4. ISBN验证支持带横杠和不带横杠的格式，会自动标准化
5. 无ISBN的书籍使用"书名+品相+年级"作为重复判断依据

## 许可证

公益项目，自由使用。
