# 书目上架坏数据追踪器

一个面向小出版社发行助理的本地 REST API 服务，用于批量导入书目数据时自动检测、隔离和追踪坏数据。

## 功能特性

- **多格式数据导入**：支持 CSV 和 JSON 格式的书目主数据、渠道上架数据、印次价格表和人工修正表
- **智能坏数据检测**：
  - ISBN 格式验证和重复检测
  - 定价币种错误检测（支持常见币种别名识别）
  - 渠道分类丢失检测
  - 数据反弹检测（防止同一错误修了又反弹）
- **坏数据隔离追踪**：将坏数据按原文件、行号、字段、原因隔离到 SQLite 数据库
- **完整的 REST API**：
  - 查询接口（支持多种筛选条件）
  - 标记修复接口（支持单个和批量操作）
  - 重算接口
  - 导出接口
- **多种导出格式**：
  - 干净数据 CSV 导出
  - 坏数据 JSON 导出
  - Markdown 交付报告

## 项目结构

```
xy4561/
├── app/
│   ├── __init__.py          # Flask 应用工厂
│   ├── models.py            # 数据库模型
│   ├── schemas.py           # 序列化模式
│   ├── api.py               # REST API 路由
│   ├── validators.py        # 数据验证器
│   ├── importers.py         # 数据导入器
│   └── exporters.py         # 数据导出器
├── sample_data/             # 示例数据文件
│   ├── bibliography_sample.csv
│   ├── price_list_sample.csv
│   ├── channel_listing_sample.json
│   └── manual_correction_sample.csv
├── uploads/                  # 上传文件临时目录
├── exports/                  # 导出文件目录
├── config.py                # 配置文件
├── requirements.txt         # 依赖包列表
├── run.py                   # 应用入口
└── bibliography.db          # SQLite 数据库（运行时创建）
```

## 安装与启动

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 初始化数据库

首次运行时，数据库会自动创建。也可以使用命令：

```bash
flask init-db
```

重置数据库：

```bash
flask reset-db
```

## API 接口

### 健康检查

```
GET /api/health
```

### 数据导入

```
POST /api/import
Content-Type: multipart/form-data

参数：
- file: 上传的文件 (CSV 或 JSON)
- file_type: 文件类型 (可选，自动检测)
  - bibliography: 书目主数据
  - price_list: 印次价格表
  - channel_listing: 渠道上架数据
  - manual_correction: 人工修正表
  - auto: 自动检测 (默认)
```

### 查询接口

#### 导入会话

```
GET /api/sessions
GET /api/sessions/<session_id>
```

#### 书目数据

```
GET /api/bibliography
参数：
- isbn: ISBN 模糊查询
- category: 分类筛选
- publisher: 出版社模糊查询

GET /api/bibliography/<book_id>
```

#### 价格表

```
GET /api/price-lists
参数：
- isbn: ISBN 模糊查询
- currency: 币种筛选
- print_run: 印次模糊查询
```

#### 渠道上架

```
GET /api/channel-listings
参数：
- isbn: ISBN 模糊查询
- channel_name: 渠道名称模糊查询
- channel_category: 渠道分类模糊查询
```

#### 坏数据

```
GET /api/bad-data
参数：
- session_id: 导入会话 ID
- error_code: 错误代码
- fix_status: 修复状态 (pending/fixed/ignored)
- data_type: 数据类型
- isbn: ISBN 模糊查询

GET /api/bad-data/<bad_data_id>
```

#### 人工修正记录

```
GET /api/manual-corrections
参数：
- isbn: ISBN 模糊查询
- field_name: 字段名筛选
```

#### 统计信息

```
GET /api/stats
```

### 修复接口

#### 标记单个坏数据

```
PUT /api/bad-data/<bad_data_id>/fix
Content-Type: application/json

请求体：
{
  "fix_status": "fixed",      // pending, fixed, ignored
  "fix_note": "已修正ISBN格式",
  "fixed_by": "张三"
}
```

#### 批量标记坏数据

```
PUT /api/bad-data/batch-fix
Content-Type: application/json

请求体：
{
  "ids": [1, 2, 3],
  "fix_status": "fixed",
  "fix_note": "批量修复",
  "fixed_by": "系统"
}
```

### 重算接口

```
POST /api/recalculate
Content-Type: application/json

请求体 (可选)：
{
  "session_id": 1
}
```

### 导出接口

#### 导出干净书目数据

```
GET /api/export/clean/bibliography
参数：
- isbn: ISBN 筛选
- category: 分类筛选
- publisher: 出版社筛选
```

#### 导出干净价格表

```
GET /api/export/clean/price-list
参数：
- isbn: ISBN 筛选
- currency: 币种筛选
```

#### 导出干净渠道上架数据

```
GET /api/export/clean/channel-listing
参数：
- isbn: ISBN 筛选
- channel_name: 渠道名称筛选
- listing_status: 上架状态筛选
```

#### 导出坏数据 JSON

```
GET /api/export/bad-data
参数：
- session_id: 导入会话 ID
- error_code: 错误代码
- fix_status: 修复状态
- data_type: 数据类型
- isbn: ISBN 筛选
```

#### 导出 Markdown 报告

```
GET /api/export/report
参数：
- session_id: 导入会话 ID
- error_code: 错误代码
- fix_status: 修复状态
```

#### 导出所有干净数据

```
GET /api/export/all-clean
```

## 坏数据错误代码

| 错误代码 | 描述 |
|---------|------|
| `ISBN_INVALID` | ISBN 格式无效 |
| `ISBN_DUPLICATE` | ISBN 重复 |
| `TITLE_MISSING` | 书名缺失 |
| `PRICE_INVALID` | 价格无效（<=0） |
| `PRICE_FORMAT` | 价格格式错误 |
| `CURRENCY_INVALID` | 币种无效 |
| `PRINT_RUN_MISSING` | 印次缺失 |
| `CHANNEL_NAME_MISSING` | 渠道名称缺失 |
| `CHANNEL_CATEGORY_MISSING` | 渠道分类缺失 |
| `FIELD_NAME_MISSING` | 字段名缺失 |
| `NEW_VALUE_MISSING` | 新值缺失 |
| `BIBLIOGRAPHY_NOT_FOUND` | 书目不存在 |
| `DATA_REBOUND` | 数据反弹检测 |
| `IMPORT_ERROR` | 导入错误 |

## 数据类型

- `bibliography` - 书目主数据
- `price_list` - 印次价格表
- `channel_listing` - 渠道上架数据
- `manual_correction` - 人工修正表

## 修复状态

- `pending` - 待处理
- `fixed` - 已修复
- `ignored` - 已忽略

## 快速开始

1. 启动服务：
```bash
python run.py
```

2. 导入示例书目数据：
```bash
curl -X POST http://localhost:5000/api/import \
  -F "file=@sample_data/bibliography_sample.csv" \
  -F "file_type=auto"
```

3. 查看导入会话：
```bash
curl http://localhost:5000/api/sessions
```

4. 查看坏数据：
```bash
curl http://localhost:5000/api/bad-data
```

5. 查看统计信息：
```bash
curl http://localhost:5000/api/stats
```

6. 导出 Markdown 报告：
```bash
curl http://localhost:5000/api/export/report -o report.md
```

## 验证脚本

提供完整的 curl 验证链，详见 `curl_commands.sh` 文件。

```bash
# 运行完整验证链
bash curl_commands.sh
```

## 注意事项

1. **ISBN 格式**：支持 ISBN-10 和 ISBN-13 格式，自动校验校验码
2. **币种识别**：支持常见币种别名（如 RMB 识别为 CNY，$ 识别为 USD 等）
3. **数据反弹**：系统会检测同一 ISBN 同一字段是否被修改后又恢复到之前被修正的旧值
4. **自动检测**：文件类型会根据字段名自动检测，也可手动指定

## 数据库说明

使用 SQLite 数据库，主要表包括：

- `bibliography` - 书目主数据表
- `price_list` - 印次价格表
- `channel_listing` - 渠道上架表
- `bad_data` - 坏数据追踪表（核心表）
- `import_session` - 导入会话表
- `manual_correction` - 人工修正记录表
- `fix_history` - 修复历史表

## 配置选项

在 `config.py` 中可配置：

- `SECRET_KEY` - Flask 密钥
- `SQLALCHEMY_DATABASE_URI` - 数据库连接
- `UPLOAD_FOLDER` - 上传目录
- `EXPORT_FOLDER` - 导出目录
- `ALLOWED_EXTENSIONS` - 允许的文件扩展名
- `VALID_CURRENCIES` - 有效币种列表
- `DEFAULT_CURRENCY` - 默认币种
