# 用户访谈数据脱敏服务

一个为用户访谈团队设计的独立后端服务，用于自动识别和脱敏访谈内容中的敏感信息，支持完整的审核流程和操作审计。

## 功能特性

- **自动敏感信息识别**：识别姓名、电话、邮箱、身份证号、公司名称、地址等敏感信息
- **智能脱敏处理**：将敏感信息替换为统一的占位符
- **版本管理与回滚**：支持版本历史记录，可回滚一次脱敏结果
- **人工复核流程**：支持审核通过/不通过，待复核列表查询
- **可检索摘要生成**：自动生成脱敏内容的摘要和关键词
- **操作审计日志**：记录所有关键操作，支持审计追踪
- **数据导出功能**：支持导出指定日期的复核报告（JSON/CSV格式）
- **异步任务处理**：使用Celery实现后台任务队列

## 技术栈

- **Web框架**: Flask 2.3.3
- **ORM**: Flask-SQLAlchemy 3.0.5
- **序列化**: Flask-Marshmallow 0.15.0
- **任务队列**: Celery 5.3.4
- **消息代理**: Redis
- **数据库**: SQLite
- **测试框架**: pytest 7.4.2

## 项目结构

```
xy4391/
├── app/                          # 应用主目录
│   ├── __init__.py              # 应用初始化
│   ├── models/                  # 数据模型
│   │   ├── __init__.py
│   │   ├── interview.py         # 访谈相关模型
│   │   ├── authorization.py     # 授权表模型
│   │   └── audit.py             # 审计日志模型
│   ├── routes/                  # API路由
│   │   ├── __init__.py
│   │   ├── interview_routes.py  # 访谈管理路由
│   │   ├── review_routes.py     # 复核操作路由
│   │   └── export_routes.py     # 数据导出路由
│   ├── services/                # 业务服务
│   │   ├── __init__.py
│   │   ├── anonymization_service.py  # 脱敏服务
│   │   └── summary_service.py        # 摘要服务
│   └── tasks/                   # 后台任务
│       ├── __init__.py
│       └── processing_tasks.py  # 脱敏处理任务
├── sample_data/                 # 示例数据
│   ├── sample_interview_1.json
│   ├── sample_interview_2.json
│   ├── sample_authorization_1.json
│   └── sample_authorization_2.json
├── tests/                       # 测试文件
│   ├── __init__.py
│   ├── conftest.py              # pytest配置
│   ├── test_anonymization_service.py
│   └── test_api_routes.py
├── config.py                    # 配置文件
├── celery_app.py                # Celery应用配置
├── requirements.txt             # 依赖包
└── run.py                       # 应用入口
```

## 安装和运行

### 环境要求

- Python 3.8+
- Redis（用于Celery任务队列）

### 安装步骤

1. **克隆项目并进入目录**

```bash
cd /Users/mac/pro/solocoder/pro/xy4391/repo/xy4391
```

2. **创建虚拟环境并安装依赖**

```bash
# 创建虚拟环境
python3 -m venv venv

# 激活虚拟环境
source venv/bin/activate  # macOS/Linux
# 或
venv\Scripts\activate     # Windows

# 安装依赖
pip install -r requirements.txt
```

3. **确保Redis服务运行**

Celery需要Redis作为消息代理。确保Redis已安装并运行：

```bash
# macOS使用Homebrew
brew install redis
brew services start redis

# 或直接启动
redis-server
```

### 运行服务

1. **启动Flask应用**

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

2. **启动Celery Worker（新终端窗口）**

```bash
# 激活虚拟环境
source venv/bin/activate

# 启动Celery Worker
celery -A celery_app worker --loglevel=info
```

## API文档

### 1. 访谈管理接口

#### 上传访谈文件

```
POST /api/interviews/upload
```

**Form Data参数：**
- `interview_file`: 访谈转写JSON文件（必需）
- `authorization_file`: 受访者授权表文件（可选）
- `researcher_name`: 研究员姓名（可选）
- `interview_date`: 访谈日期（可选，格式：YYYY-MM-DD）

**响应示例：**
```json
{
  "message": "Interview uploaded successfully",
  "interview_id": 1,
  "task_id": "task-uuid",
  "status": "processing"
}
```

#### 获取访谈列表

```
GET /api/interviews
```

**Query参数：**
- `page`: 页码（默认1）
- `per_page`: 每页数量（默认10）
- `status`: 状态过滤（可选：pending, processing, completed, reviewed, rolled_back）
- `researcher`: 研究员姓名过滤（可选）

#### 获取单个访谈详情

```
GET /api/interviews/{interview_id}
```

#### 获取访谈脱敏摘要

```
GET /api/interviews/{interview_id}/summary
```

#### 获取访谈原始内容

```
GET /api/interviews/{interview_id}/original
```

#### 获取访谈脱敏内容

```
GET /api/interviews/{interview_id}/anonymized
```

### 2. 复核操作接口

#### 获取待复核列表

```
GET /api/review/pending
```

**Query参数：**
- `page`: 页码（默认1）
- `per_page`: 每页数量（默认10）
- `researcher`: 研究员姓名过滤（可选）

#### 审核通过

```
POST /api/review/{interview_id}/approve
```

**Request Body:**
```json
{
  "reviewer": "审核员姓名",
  "comments": "审核备注"
}
```

#### 审核不通过

```
POST /api/review/{interview_id}/reject
```

**Request Body:**
```json
{
  "reviewer": "审核员姓名",
  "reason": "拒绝原因"
}
```

#### 回滚脱敏结果

```
POST /api/review/{interview_id}/rollback
```

**Request Body:**
```json
{
  "user": "操作人姓名",
  "reason": "回滚原因"
}
```

#### 获取版本历史

```
GET /api/review/{interview_id}/versions
```

#### 获取指定版本内容

```
GET /api/review/{interview_id}/versions/{version_number}
```

### 3. 数据导出接口

#### 导出复核报告

```
GET /api/export/review-report
```

**Query参数：**
- `date`: 单日期导出（格式：YYYY-MM-DD）
- `start_date`: 开始日期（格式：YYYY-MM-DD）
- `end_date`: 结束日期（格式：YYYY-MM-DD）
- `format`: 导出格式（可选：json, csv，默认json）
- `include_details`: 是否包含详细内容（可选：true, false，默认false）

**示例：**
```
# 导出指定日期的JSON报告
GET /api/export/review-report?date=2026-04-15

# 导出日期范围的CSV报告
GET /api/export/review-report?start_date=2026-04-01&end_date=2026-04-30&format=csv
```

#### 导出审计日志

```
GET /api/export/audit-logs
```

**Query参数：**
- `start_date`: 开始日期
- `end_date`: 结束日期
- `action`: 操作类型过滤
- `format`: 导出格式（json, csv）

## 使用示例

### 1. 上传访谈文件

```bash
curl -X POST http://localhost:5000/api/interviews/upload \
  -F "interview_file=@sample_data/sample_interview_1.json" \
  -F "authorization_file=@sample_data/sample_authorization_1.json" \
  -F "researcher_name=张研究员" \
  -F "interview_date=2026-04-15"
```

### 2. 查询待复核列表

```bash
curl http://localhost:5000/api/review/pending
```

### 3. 审核通过访谈

```bash
curl -X POST http://localhost:5000/api/review/1/approve \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "李审核员", "comments": "脱敏完成，数据正确"}'
```

### 4. 回滚脱敏结果

```bash
curl -X POST http://localhost:5000/api/review/1/rollback \
  -H "Content-Type: application/json" \
  -d '{"user": "张研究员", "reason": "脱敏不彻底，需要重新处理"}'
```

### 5. 导出复核报告

```bash
# 导出JSON格式
curl http://localhost:5000/api/export/review-report?date=2026-04-15

# 导出CSV格式
curl -o report.csv http://localhost:5000/api/export/review-report?format=csv
```

## 数据模型

### 访谈状态流转

```
pending (待处理) 
    ↓
processing (处理中) 
    ↓
completed (已完成，待复核) 
    ↓
reviewed (已审核通过) 或 rolled_back (已回滚)
```

### 敏感信息类型

系统支持识别以下类型的敏感信息：

| 类型 | 占位符 | 示例 |
|------|--------|------|
| 姓名 | [姓名] | 李明 → [姓名] |
| 电话 | [电话] | 13812345678 → [电话] |
| 邮箱 | [邮箱] | test@example.com → [邮箱] |
| 身份证号 | [身份证号] | 110101199001011234 → [身份证号] |
| 公司 | [公司] | 北京科技有限公司 → [公司] |
| 地址 | [地址] | 北京市海淀区... → [地址] |

## 运行测试

项目包含完整的测试套件，使用pytest框架。

```bash
# 运行所有测试
pytest

# 运行测试并显示覆盖率
pytest --cov=app

# 运行特定测试文件
pytest tests/test_anonymization_service.py
pytest tests/test_api_routes.py

# 运行测试并显示详细输出
pytest -v
```

## 配置说明

主要配置项位于 `config.py` 文件中：

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| `SQLALCHEMY_DATABASE_URI` | 数据库连接 | SQLite |
| `UPLOAD_FOLDER` | 文件上传目录 | ./uploads |
| `MAX_CONTENT_LENGTH` | 最大文件大小 | 16MB |
| `ALLOWED_EXTENSIONS` | 允许的文件类型 | json, txt, csv |
| `CELERY_BROKER_URL` | Celery代理 | redis://localhost:6379/0 |
| `ANONYMIZATION_PLACEHOLDERS` | 脱敏占位符 | 见配置文件 |

## 注意事项

1. **Redis依赖**：Celery任务队列需要Redis服务运行，确保Redis已启动
2. **姓名识别**：当前姓名识别基于上下文关键词，实际应用中建议集成专业NLP库（如jieba、HanLP）
3. **权限控制**：当前版本未实现用户认证，生产环境建议添加JWT或OAuth认证
4. **文件存储**：当前版本将文件内容直接存储在数据库，大文件建议使用文件系统或对象存储

## 扩展建议

- **集成NLP库**：使用jieba、spaCy等库提高敏感信息识别准确率
- **添加用户认证**：实现JWT/OAuth2认证机制
- **文件存储优化**：使用S3/OSS等对象存储服务
- **WebSocket实时通知**：处理完成后实时通知用户
- **批量处理优化**：支持大文件流式处理
- **多语言支持**：支持英文等其他语言的敏感信息识别

## 许可证

本项目仅供内部使用。
