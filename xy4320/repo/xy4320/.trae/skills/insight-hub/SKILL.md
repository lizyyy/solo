---
name: "insight-hub"
description: "本地文本数据整理工具：扫描目录、去重入库、智能归类、HTTP查询、周报导出。Invoke when user needs to manage text data like meeting transcripts, customer conversations, and product feedback."
---

# Insight Hub - 本地文本数据整理工具

## 功能概述
一个功能完整的本地命令行工具，用于管理会议录音转写、客服对话和产品反馈等文本数据。

## 核心功能

### 1. 数据扫描与入库
- 扫描指定目录中的 txt/json/csv 文件
- 支持增量扫描，只处理新增/修改的文件
- 智能去重（基于内容哈希和元数据）
- SQLite 本地存储

### 2. 智能归类
- **按客户归类**：识别客户名称/ID
- **按时间归类**：解析时间戳，按日期/周/月分组
- **按情绪词归类**：识别正面/负面/中性关键词
- **按待办归类**：识别待办事项标记（TODO/待办/需要跟进等）

### 3. HTTP 查询接口
- 轻量级 Flask/FastAPI 服务
- RESTful API 设计
- 支持按多维度查询：客户、时间、情绪、待办状态
- JSON 格式响应

### 4. Markdown 周报导出
- 自动汇总一周数据
- 标出**重复反馈**（相同主题多次出现）
- 标出**风险主题**（负面情绪集中的话题）
- 标出**未跟进事项**（待办状态未完成）
- 统计概览（总数、情绪分布、客户分布）

### 5. 异常处理
- 异常文件不中断任务
- 自动加入**失败队列**
- 支持手动/自动重试
- 详细的错误日志记录

## 技术栈
- **语言**: Python 3.8+
- **数据库**: SQLite (通过 SQLAlchemy)
- **Web框架**: FastAPI (轻量级高性能)
- **命令行**: Typer (现代 CLI 框架)
- **依赖管理**: requirements.txt

## 项目结构

```
insight-hub/
├── insight_hub/
│   ├── __init__.py
│   ├── cli.py              # 命令行入口
│   ├── config.py           # 配置管理
│   ├── database/
│   │   ├── __init__.py
│   │   ├── models.py       # 数据模型
│   │   └── database.py     # 数据库连接和操作
│   ├── scanner/
│   │   ├── __init__.py
│   │   ├── file_scanner.py # 文件扫描
│   │   ├── parsers/        # 各种格式解析器
│   │   │   ├── __init__.py
│   │   │   ├── txt_parser.py
│   │   │   ├── json_parser.py
│   │   │   └── csv_parser.py
│   │   └── deduplicator.py # 去重逻辑
│   ├── classifier/
│   │   ├── __init__.py
│   │   ├── customer_classifier.py  # 客户归类
│   │   ├── time_classifier.py      # 时间归类
│   │   ├── emotion_classifier.py   # 情绪分析
│   │   └── todo_classifier.py      # 待办识别
│   ├── api/
│   │   ├── __init__.py
│   │   ├── main.py         # FastAPI 主文件
│   │   └── routes.py       # API 路由
│   ├── exporter/
│   │   ├── __init__.py
│   │   └── weekly_report.py # 周报导出
│   ├── queue/
│   │   ├── __init__.py
│   │   └── failure_queue.py # 失败队列管理
│   └── utils/
│       ├── __init__.py
│       ├── logger.py       # 日志工具
│       └── helpers.py      # 辅助函数
├── requirements.txt
├── setup.py
└── config.yaml             # 配置文件示例
```

## 数据模型

### Document (文档)
- id: Integer, Primary Key
- file_path: String, 源文件路径
- file_hash: String, 内容哈希（去重用）
- file_type: Enum(txt/json/csv)
- content: Text, 原始内容
- customer_id: String, 客户标识
- customer_name: String, 客户名称
- timestamp: DateTime, 时间戳
- emotion: Enum(positive/negative/neutral), 情绪标签
- has_todo: Boolean, 是否有未完成待办
- created_at: DateTime, 入库时间
- updated_at: DateTime, 更新时间

### FailureQueue (失败队列)
- id: Integer, Primary Key
- file_path: String, 失败文件路径
- error_message: Text, 错误信息
- retry_count: Integer, 重试次数
- last_attempt_at: DateTime, 最后尝试时间
- status: Enum(pending/failed), 状态
- created_at: DateTime, 创建时间

### ClassificationHistory (分类历史)
- id: Integer, Primary Key
- document_id: Integer, Foreign Key
- classifier_name: String, 分类器名称
- result: JSON, 分类结果
- confidence: Float, 置信度
- classified_at: DateTime, 分类时间

## 命令行接口

### 主命令: insight-hub

```bash
insight-hub [OPTIONS] COMMAND [ARGS]...
```

### 子命令

#### 1. scan - 扫描并入库文件
```bash
insight-hub scan /path/to/directory [OPTIONS]

Options:
  --recursive / --no-recursive  递归扫描子目录  [default: recursive]
  --force                        强制重新处理所有文件
  --dry-run                      仅预览，不实际入库
  --help                         显示帮助
```

#### 2. classify - 执行分类
```bash
insight-hub classify [OPTIONS]

Options:
  --type TEXT                    指定分类类型: customer, time, emotion, todo
  --all                          执行所有分类
  --document-id INTEGER          指定文档ID
  --help                         显示帮助
```

#### 3. query - 查询数据
```bash
insight-hub query [OPTIONS]

Options:
  --customer TEXT                按客户查询
  --start-date TEXT              开始日期 (YYYY-MM-DD)
  --end-date TEXT                结束日期 (YYYY-MM-DD)
  --emotion [positive|negative|neutral]  按情绪查询
  --has-todo / --no-has-todo    按待办状态查询
  --limit INTEGER                限制返回数量
  --output [json|table]          输出格式  [default: table]
  --help                         显示帮助
```

#### 4. server - 启动HTTP服务
```bash
insight-hub server [OPTIONS]

Options:
  --host TEXT                    主机地址  [default: 127.0.0.1]
  --port INTEGER                 端口  [default: 8000]
  --reload                       开发模式自动重载
  --help                         显示帮助
```

#### 5. export - 导出周报
```bash
insight-hub export weekly [OPTIONS]

Options:
  --week TEXT                    周数 (格式: YYYY-WW, 如 2024-18)
  --output PATH                  输出文件路径  [default: weekly_report.md]
  --customer TEXT                指定客户
  --help                         显示帮助
```

#### 6. queue - 管理失败队列
```bash
insight-hub queue [OPTIONS] COMMAND [ARGS]...

Commands:
  list        列出失败队列
  retry       重试失败项
  clear       清空失败队列
  remove      移除指定项
```

#### 7. stats - 查看统计
```bash
insight-hub stats [OPTIONS]

Options:
  --period [day|week|month]      统计周期
  --customer TEXT                 指定客户
  --help                          显示帮助
```

## API 接口

启动服务后访问 `http://localhost:8000/docs` 查看完整 API 文档。

### 主要端点

#### GET /api/documents
- 查询文档列表
- 参数: customer, start_date, end_date, emotion, has_todo, limit, offset
- 响应: 文档数组

#### GET /api/documents/{id}
- 获取单个文档详情

#### GET /api/stats
- 获取统计数据
- 参数: period, customer

#### GET /api/queue/failures
- 获取失败队列

#### POST /api/queue/retry
- 重试失败项
- 体: {ids: [1, 2, 3]} 或 {all: true}

#### GET /api/export/weekly
- 导出周报
- 参数: week, customer, format (json/markdown)

## 配置文件 (config.yaml)

```yaml
database:
  path: ~/.insight-hub/data.db

scanner:
  supported_formats:
    - .txt
    - .json
    - .csv
  default_encoding: utf-8

classifier:
  emotion:
    positive_keywords:
      - 满意
      - 好
      - 棒
      - 优秀
      - 好评
      - 喜欢
      - 开心
      - 高兴
    negative_keywords:
      - 失望
      - 差
      - 糟糕
      - 不满
      - 投诉
      - 生气
      - 烦
      - 问题
    neutral_threshold: 0.3
  
  todo:
    keywords:
      - TODO
      - todo
      - 待办
      - 需要
      - 应该
      - 必须
      - 要
    negative_keywords:
      - 已完成
      - 已处理
      - 已解决
      - done
      - DONE

queue:
  max_retry: 3
  retry_interval: 3600  # 秒

api:
  host: 127.0.0.1
  port: 8000

export:
  weekly:
    include_duplicates: true
    include_risks: true
    include_todos: true
    risk_emotion_threshold: negative
```

## 去重策略

1. **内容哈希去重**: 计算文件内容的 SHA256 哈希值
2. **元数据去重**: 相同文件名 + 相同大小 + 相同修改时间
3. **语义去重**: 对于文本内容，计算相似度（可选，基于 Levenshtein 距离）

## 情绪分类逻辑

1. 基于关键词匹配
2. 正面关键词计数 - 负面关键词计数 = 情绪分
3. 情绪分 > 阈值 → positive
4. 情绪分 < -阈值 → negative
5. 否则 → neutral

## 待办识别逻辑

1. 检查是否包含待办关键词
2. 检查是否包含否定/已完成关键词
3. 如果包含待办关键词且不包含已完成关键词 → has_todo = True

## 使用示例

### 1. 基本工作流

```bash
# 1. 扫描目录
insight-hub scan /data/meeting-transcripts

# 2. 执行分类
insight-hub classify --all

# 3. 启动服务
insight-hub server --port 8080

# 4. 导出周报
insight-hub export weekly --week 2024-18
```

### 2. 查询示例

```bash
# 按客户查询
insight-hub query --customer "客户A"

# 按时间范围查询
insight-hub query --start-date 2024-01-01 --end-date 2024-01-31

# 查看所有负面情绪的记录
insight-hub query --emotion negative

# 查看待办事项
insight-hub query --has-todo
```

### 3. 失败队列管理

```bash
# 查看失败队列
insight-hub queue list

# 重试所有失败项
insight-hub queue retry --all

# 重试特定项
insight-hub queue retry --id 1 --id 2

# 清空失败队列
insight-hub queue clear
```

## 开发指南

### 安装依赖

```bash
pip install -r requirements.txt
pip install -e .
```

### 运行测试

```bash
pytest tests/
```

### 添加新的文件格式解析器

1. 在 `scanner/parsers/` 下创建新的解析器类
2. 继承 `BaseParser` 基类
3. 实现 `parse()` 方法
4. 在 `file_scanner.py` 中注册新解析器

### 添加新的分类器

1. 在 `classifier/` 下创建新的分类器类
2. 实现 `classify()` 方法
3. 在 `cli.py` 中添加对应的命令选项

## 依赖列表 (requirements.txt)

```
typer>=0.9.0
fastapi>=0.100.0
uvicorn>=0.23.0
sqlalchemy>=2.0.0
pydantic>=2.0.0
pydantic-settings>=2.0.0
pyyaml>=6.0
python-dateutil>=2.8.0
rich>=13.0.0
httpx>=0.24.0
pytest>=7.0.0
python-multipart>=0.0.6
aiofiles>=23.0.0
```

## 注意事项

1. 首次运行会自动创建 SQLite 数据库
2. 配置文件默认位于 `~/.insight-hub/config.yaml`
3. 数据库默认位于 `~/.insight-hub/data.db`
4. 大文件处理会使用流式读取，避免内存溢出
5. 建议定期备份数据库文件

## 故障排查

### 常见问题

1. **文件编码问题**: 检查文件编码，配置文件中可设置 `default_encoding`
2. **JSON 解析错误**: 检查 JSON 格式是否正确，错误文件会进入失败队列
3. **CSV 解析错误**: 检查分隔符和引号使用
4. **数据库锁定**: 确保没有其他进程同时访问数据库
