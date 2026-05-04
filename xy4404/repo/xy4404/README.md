# 社区剧场演出录音管理系统

一个本地自动化工具，用于管理社区剧场的演出录音、转写稿和授权文件。

## 功能特性

- **文件自动监听**: 自动监听素材文件夹，自动配对音频、转写稿和授权PDF
- **SQLite数据存储**: 所有数据存储在本地SQLite数据库中
- **本地HTTP API**: 提供RESTful API接口供前台调用
- **智能问题检测**: 自动识别文件名冲突、授权过期、转写稿缺页等问题
- **交接报告生成**: 自动生成Markdown格式的交接报告
- **示例数据**: 内置示例数据，方便测试和演示

## 项目结构

```
xy4404/
├── main.py              # 主程序入口
├── config.py            # 配置文件
├── database.py          # SQLite数据库操作
├── file_monitor.py      # 文件监听模块
├── file_matcher.py      # 文件配对逻辑
├── issue_detector.py    # 问题检测模块
├── report_generator.py  # 报告生成模块
├── api.py               # Flask HTTP API
├── requirements.txt     # Python依赖
├── materials/           # 素材文件夹（自动创建）
├── reports/             # 报告文件夹（自动创建）
└── theater_recordings.db # SQLite数据库（自动创建）
```

## 安装

### 1. 安装Python依赖

```bash
pip install -r requirements.txt
```

依赖包说明：
- `Flask`: Web框架，用于提供HTTP API
- `watchdog`: 文件系统监听库
- `python-dateutil`: 日期处理
- `PyPDF2`: PDF文件处理
- `python-docx`: Word文档处理

## 快速开始

### 1. 初始化示例数据

```bash
python main.py --init-samples
```

这将创建以下示例数据：
- `20240115_雷雨` - 完整材料，已公开
- `20240220_茶馆` - 完整材料，授权即将过期（10天后）
- `20231205_日出` - 缺少转写稿，已公开但授权已过期（需下架）
- `20240310_原野` - 只有转写稿，缺少音频和授权

### 2. 启动服务

```bash
python main.py
```

这将同时启动：
- 文件监听服务（监听 `materials/` 文件夹）
- HTTP API服务（默认地址：http://127.0.0.1:5000）

### 3. 生成交接报告

```bash
python main.py --report
```

报告将生成在 `reports/` 文件夹中，文件名格式为 `handoff_report_YYYYMMDD_HHMMSS.md`

### 4. 扫描问题

```bash
python main.py --scan
```

## 文件名命名规范

系统根据文件名自动识别文件类型和所属演出，请遵循以下命名规范：

### 命名格式

```
{演出名称}_{类型}.{扩展名}
```

### 类型标识

| 文件类型 | 标识后缀 | 支持格式 |
|----------|----------|----------|
| 音频文件 | `_audio` 或无 | .mp3, .wav, .flac, .m4a, .ogg, .aac, .wma |
| 转写稿 | `_transcript` 或 `_转写稿` | .txt, .docx, .doc, .pdf |
| 授权文件 | `_license` 或 `_授权` | .pdf |

### 演出名称格式

演出名称中可以包含日期，系统会自动识别：
- `20240115_雷雨` → 演出日期：2024-01-15
- `2024-01-15_雷雨` → 演出日期：2024-01-15
- `雷雨_20240115` → 演出日期：2024-01-15

### 命名示例

```
20240115_雷雨_audio.mp3           # 音频文件
20240115_雷雨_transcript.txt      # 转写稿
20240115_雷雨_license.pdf         # 授权文件
20240115_雷雨_转写稿.docx         # 中文标识转写稿
20240115_雷雨_授权.pdf            # 中文标识授权文件
```

## HTTP API接口

API服务默认运行在 `http://127.0.0.1:5000`

### 演出管理

#### 获取所有演出列表
```http
GET /api/performances
```

响应示例：
```json
{
  "success": true,
  "count": 4,
  "data": [
    {
      "id": 1,
      "performance_name": "20240115_雷雨",
      "performance_date": "2024-01-15",
      "status": "complete",
      "is_public": true,
      "needs_takedown": false,
      "files": {
        "audio_count": 1,
        "transcript_count": 1,
        "license_count": 1,
        "audio": [...],
        "transcripts": [...],
        "licenses": [...]
      }
    }
  ]
}
```

#### 获取单个演出详情
```http
GET /api/performances/<performance_id>
```

#### 更新演出信息
```http
PUT /api/performances/<performance_id>
Content-Type: application/json

{
  "performance_date": "2024-01-15",
  "is_public": true,
  "needs_takedown": false,
  "notes": "备注信息"
}
```

#### 标记可公开
```http
POST /api/performances/<performance_id>/public
Content-Type: application/json

{
  "is_public": true
}
```

#### 标记需下架
```http
POST /api/performances/<performance_id>/takedown
Content-Type: application/json

{
  "needs_takedown": true
}
```

### 问题查询

#### 查询缺失材料
```http
GET /api/missing
```

#### 查询问题列表
```http
GET /api/issues
```

#### 标记问题已解决
```http
POST /api/issues/<issue_id>/resolve
```

#### 问题统计
```http
GET /api/issues/summary
```

#### 查询即将过期的授权
```http
GET /api/licenses/expiring?warning_days=30
```

### 系统操作

#### 扫描所有问题
```http
POST /api/scan
```

#### 获取统计信息
```http
GET /api/stats
```

响应示例：
```json
{
  "success": true,
  "data": {
    "total_performances": 4,
    "complete_performances": 2,
    "partial_performances": 1,
    "incomplete_performances": 1,
    "public_performances": 2,
    "needs_takedown": 1,
    "open_issues": 3
  }
}
```

#### 健康检查
```http
GET /api/health
```

## 问题检测说明

系统会自动检测以下类型的问题：

### 1. 授权过期 (`license_expiry`)
- 检测授权文件中即将过期的授权
- 默认提前30天预警
- 严重程度：
  - 7天内过期：🔴 严重 (critical)
  - 14天内过期：🟠 错误 (error)
  - 30天内过期：🟡 警告 (warning)

### 2. 缺失文件 (`missing_files`)
- 检测缺少音频、转写稿或授权文件的演出

### 3. 文件名冲突 (`filename_conflict`)
- 检测相同文件名的重复文件

### 4. 转写稿缺页 (`missing_pages`)
- 检测页数较少（<2页）的转写稿，可能存在缺页

### 5. 已公开但授权过期 (`public_with_expired_license`)
- 检测已标记为公开但授权已过期的演出，建议下架

## 配置说明

可以通过修改 `config.py` 文件调整配置：

```python
class Config:
    # 数据库路径
    SQLITE_DB_PATH = os.path.join(BASE_DIR, 'theater_recordings.db')
    
    # 素材文件夹路径
    MATERIALS_FOLDER = os.path.join(BASE_DIR, 'materials')
    
    # 报告文件夹路径
    REPORTS_FOLDER = os.path.join(BASE_DIR, 'reports')
    
    # 支持的文件格式
    AUDIO_EXTENSIONS = {'.mp3', '.wav', '.flac', '.m4a', '.ogg', '.aac', '.wma'}
    TRANSCRIPT_EXTENSIONS = {'.txt', '.docx', '.doc', '.pdf'}
    LICENSE_EXTENSIONS = {'.pdf'}
    
    # 授权过期预警天数
    LICENSE_EXPIRY_WARNING_DAYS = 30
    
    # API服务配置
    FLASK_HOST = '127.0.0.1'
    FLASK_PORT = 5000
    DEBUG = True
```

## 命令行参数

```bash
python main.py [OPTIONS]

选项:
  --monitor        仅启动文件监听
  --api            仅启动API服务
  --report         生成交接报告
  --scan           扫描所有问题
  --init-samples   初始化示例数据
  --output, -o     指定报告输出路径
```

## 使用场景示例

### 场景1：日常管理
1. 将新的音频、转写稿、授权文件放入 `materials/` 文件夹
2. 系统自动监听并配对文件，写入数据库
3. 通过API或生成的报告查看状态

### 场景2：志愿者交接
1. 运行 `python main.py --report` 生成交接报告
2. 报告中包含：
   - 所有演出清单
   - 即将过期的授权
   - 缺失材料的演出
   - 需下架的演出
   - 操作建议

### 场景3：问题排查
1. 运行 `python main.py --scan` 扫描所有问题
2. 或调用 `POST /api/scan` 接口
3. 查看问题列表，逐一处理

## 数据库表结构

### performances (演出表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| performance_name | TEXT | 演出名称（唯一） |
| performance_date | DATE | 演出日期 |
| is_public | INTEGER | 是否可公开 |
| needs_takedown | INTEGER | 是否需下架 |
| status | TEXT | 状态 (incomplete/partial/complete) |
| notes | TEXT | 备注 |

### audio_files (音频文件表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| performance_id | INTEGER | 关联演出ID |
| file_name | TEXT | 文件名 |
| file_path | TEXT | 文件路径 |
| file_size | INTEGER | 文件大小 |
| format | TEXT | 格式 |

### transcripts (转写稿表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| performance_id | INTEGER | 关联演出ID |
| file_name | TEXT | 文件名 |
| page_count | INTEGER | 页数 |
| format | TEXT | 格式 |

### licenses (授权表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| performance_id | INTEGER | 关联演出ID |
| file_name | TEXT | 文件名 |
| license_type | TEXT | 授权类型 |
| start_date | DATE | 授权开始日期 |
| end_date | DATE | 授权结束日期 |

### issues (问题表)
| 字段 | 类型 | 说明 |
|------|------|------|
| id | INTEGER | 主键 |
| performance_id | INTEGER | 关联演出ID |
| issue_type | TEXT | 问题类型 |
| issue_description | TEXT | 问题描述 |
| severity | TEXT | 严重程度 |
| resolved | INTEGER | 是否已解决 |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
