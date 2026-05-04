# 敏感内容审核服务 (Sensitive Content Audit Service)

一个本地可运行的敏感内容审核后端服务，专为运营和客服系统设计，提供完善的文本过滤能力。

## 功能特性

### 核心检测能力
- **精确匹配**: 精确匹配敏感词库中的词条
- **变体绕过防护**: 处理空格插入、符号插入、全半角、大小写等简单绕过方式
- **拼音/谐音检测**: 支持拼音和谐音变体检测
- **语义理解**: 基于上下文规则和短语变体的轻量语义匹配
- **白名单豁免**: 支持白名单词条和上下文豁免规则

### 词库管理
- SQLite 本地数据库存储
- 支持敏感词、同义词、变体、白名单、上下文规则
- CSV/JSON 格式导入导出
- 词库版本管理和回滚

### 检测接口
- 单条文本检测
- 批量文本检测
- 返回详细信息：命中词、分词结果、原文位置、分类、严重级别、原因解释、建议处理动作

### 人工复核
- 检测记录持久化存储
- 误报标记（可自动添加到白名单）
- 确认敏感（可自动添加到敏感词库）
- 复核状态追踪

### 报告导出
- JSON 格式导出
- CSV 格式导出
- Markdown 格式审核报告

## 技术栈

- **后端框架**: FastAPI (Python)
- **数据库**: SQLite + SQLAlchemy (异步)
- **中文分词**: jieba
- **拼音转换**: pypinyin
- **API 文档**: 自动生成 Swagger/OpenAPI

## 项目结构

```
sensitive-content-audit/
├── app/
│   ├── __init__.py
│   ├── config.py              # 配置文件
│   ├── database.py            # 数据库连接
│   ├── main.py                # 应用入口
│   ├── models/                # 数据模型
│   │   ├── __init__.py
│   │   ├── lexicon.py         # 词库模型
│   │   ├── detection.py       # 检测记录模型
│   │   └── review.py          # 复核记录模型
│   ├── schemas/               # Pydantic 模型
│   │   ├── __init__.py
│   │   ├── common.py
│   │   ├── lexicon.py
│   │   ├── detection.py
│   │   └── review.py
│   ├── core/                  # 核心业务逻辑
│   │   ├── __init__.py
│   │   ├── text_processor.py  # 文本处理（分词、归一化、拼音）
│   │   ├── semantic.py        # 语义匹配
│   │   └── detector.py        # 检测引擎
│   ├── api/                   # API 路由
│   │   ├── __init__.py
│   │   ├── detect.py          # 检测接口
│   │   ├── lexicon.py         # 词库管理
│   │   ├── history.py         # 历史记录
│   │   ├── review.py          # 人工复核
│   │   └── export.py          # 报告导出
│   └── utils/                 # 工具函数
│       ├── __init__.py
│       └── seed_loader.py     # 种子数据加载
├── data/
│   ├── seed/                  # 种子数据
│   │   ├── sensitive_words.csv
│   │   ├── whitelist.csv
│   │   └── test_texts.json
│   └── reports/               # 导出报告目录
├── tests/                     # 测试用例
│   ├── __init__.py
│   ├── test_text_processor.py
│   └── test_detector.py
├── requirements.txt
├── curl_examples.md           # CURL 示例
└── README.md
```

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化数据库和加载种子数据

```bash
python -m app.utils.seed_loader
```

### 3. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问 API 文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc
- OpenAPI JSON: http://localhost:8000/openapi.json

## 完整工作流示例

### 步骤 1: 启动服务并导入词库

```bash
# 1. 启动服务
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

# 2. 导入敏感词库（在另一个终端）
curl -X POST "http://localhost:8000/api/v1/lexicon/import/csv?category=other&severity=medium" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@data/seed/sensitive_words.csv"

# 3. 重新加载词库缓存
curl -X POST http://localhost:8000/api/v1/detect/reload
```

### 步骤 2: 检测文本

```bash
# 检测包含敏感词的文本
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去赌博，赢了很多钱"
  }'

# 检测变体绕过（空格插入）
curl -X POST http://localhost:8000/api/v1/detect/text \
  -H "Content-Type: application/json" \
  -d '{
    "text": "今天去赌 博，赢了很多钱"
  }'

# 批量检测
curl -X POST http://localhost:8000/api/v1/detect/batch \
  -H "Content-Type: application/json" \
  -d '{
    "texts": [
      "今天去赌博",
      "我是客服，有什么可以帮助您的",
      "你这个傻逼"
    ]
  }'
```

### 步骤 3: 查看检测历史和人工复核

```bash
# 查看待复核列表
curl "http://localhost:8000/api/v1/history/list?review_status=pending&page=1&page_size=10"

# 查看检测详情（替换 {id} 为实际 ID）
curl http://localhost:8000/api/v1/history/1

# 标记误报并添加到白名单
curl -X POST http://localhost:8000/api/v1/review/false-positive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 1,
    "reason": "这是在讨论法律问题，不是在宣传赌博",
    "reviewer": "operator_001",
    "add_to_whitelist": true
  }'

# 确认敏感内容
curl -X POST http://localhost:8000/api/v1/review/confirm-sensitive \
  -H "Content-Type: application/json" \
  -d '{
    "detection_id": 2,
    "comment": "确认是赌博宣传内容",
    "reviewer": "operator_001"
  }'
```

### 步骤 4: 导出审核报告

```bash
# 导出 Markdown 报告
curl -o report.md http://localhost:8000/api/v1/export/report/markdown

# 导出 CSV 报告
curl -o report.csv http://localhost:8000/api/v1/export/report/csv

# 导出 JSON 报告
curl -o report.json http://localhost:8000/api/v1/export/report/json
```

## API 接口概览

### 检测接口 (`/api/v1/detect`)
- `POST /text` - 单条文本检测
- `POST /batch` - 批量文本检测
- `POST /reload` - 重新加载词库
- `GET /stats` - 获取检测统计

### 词库管理 (`/api/v1/lexicon`)
- `GET/POST/PUT/DELETE /words` - 敏感词 CRUD
- `GET/POST/DELETE /synonyms` - 同义词管理
- `GET/POST/DELETE /whitelist` - 白名单管理
- `GET/POST /context-rules` - 上下文规则管理
- `POST /import/csv` - 导入 CSV 词库
- `POST /import/json` - 导入 JSON 词库
- `GET/POST /versions` - 词库版本管理

### 历史记录 (`/api/v1/history`)
- `GET /list` - 获取检测历史列表
- `GET /{id}` - 获取检测详情
- `GET /stats/summary` - 获取统计概览
- `DELETE /{id}` - 删除检测记录

### 人工复核 (`/api/v1/review`)
- `GET /list` - 获取复核记录列表
- `POST /submit` - 提交复核
- `POST /false-positive` - 标记误报
- `POST /confirm-sensitive` - 确认敏感

### 报告导出 (`/api/v1/export`)
- `GET /report/json` - 导出 JSON 报告
- `GET /report/csv` - 导出 CSV 报告
- `GET /report/markdown` - 导出 Markdown 报告

## 敏感词分类和严重级别

### 分类 (Category)
- `political` - 政治敏感
- `violent` - 暴力恐怖
- `pornographic` - 色情低俗
- `gambling` - 赌博相关
- `fraud` - 诈骗欺诈
- `abusive` - 辱骂攻击
- `discriminatory` - 歧视性内容
- `terrorist` - 恐怖主义
- `drug` - 毒品相关
- `other` - 其他

### 严重级别 (Severity)
- `critical` - 必须拦截，上报风控系统
- `high` - 建议拦截，需要人工确认
- `medium` - 建议人工审核，可暂存待审
- `low` - 建议人工复核，可正常发布

## 检测结果字段说明

每次检测返回以下信息：

```json
{
  "request_id": "uuid",
  "original_text": "原始文本",
  "normalized_text": "归一化后的文本",
  "segments": [
    {"word": "分词结果", "start": 0, "end": 2, "length": 2}
  ],
  "is_sensitive": true,
  "highest_severity": "high",
  "total_hits": 1,
  "hits": [
    {
      "hit_word": "命中的词",
      "matched_word": "匹配的敏感词",
      "start_position": 0,
      "end_position": 2,
      "match_type": "exact",
      "category": "gambling",
      "severity": "high",
      "description": "原因解释",
      "suggestion": "建议处理动作",
      "context_before": "上下文前",
      "context_after": "上下文后",
      "confidence": 1.0
    }
  ],
  "processing_time_ms": 50,
  "lexicon_version": "1.0.0"
}
```

### 匹配类型 (Match Type)
- `exact` - 精确匹配
- `regex` - 正则匹配
- `synonym` - 同义词匹配
- `pinyin` - 拼音匹配
- `semantic_context` - 语义上下文匹配
- `phrase_variant` - 短语变体匹配

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_text_processor.py -v
pytest tests/test_detector.py -v
```

## 更多示例

详细的 CURL 示例请参考 [curl_examples.md](./curl_examples.md)

## 配置说明

配置文件位于 `app/config.py`，可通过环境变量或 `.env` 文件覆盖：

```python
# 数据库路径
DB_PATH = "data/audit.db"

# 敏感词分类
SENSITIVE_CATEGORIES = [
    "political", "violent", "pornographic", "gambling",
    "fraud", "abusive", "discriminatory", "terrorist", "drug", "other"
]

# 严重级别
SEVERITY_LEVELS = ["low", "medium", "high", "critical"]
```

## 注意事项

1. **首次使用**: 请先运行 `python -m app.utils.seed_loader` 初始化数据库和加载种子数据
2. **词库更新**: 新增敏感词后，需要调用 `POST /api/v1/detect/reload` 重新加载缓存
3. **性能考虑**: 对于高并发场景，建议增加缓存层和批量检测优化
4. **误报处理**: 建议定期复核检测结果，标记误报到白名单以提高准确率
5. **敏感词质量**: 敏感词库的质量直接影响检测效果，建议根据实际业务场景持续优化

## 许可证

MIT License
