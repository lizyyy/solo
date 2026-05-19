# 民宿运营数据管理工具

一个命令行工具，用于管理民宿的房态、保洁记录、照片和客诉数据。

## 功能特性

- 📊 **数据导入**：支持CSV房态、JSON保洁记录、照片清单导入
- ❌ **错误处理**：保留原始位置、失败原因和修改建议
- 💾 **本地持久化**：使用SQLite存储，重启后数据不丢失
- 🔒 **敏感字段脱敏**：手机号、姓名等敏感信息统一脱敏
- 📈 **查询统计**：多维度查询和统计功能
- 📤 **数据导出**：支持CSV和JSON格式导出
- 📜 **操作历史**：完整的导入和操作历史记录

## 安装

```bash
# 使用poetry安装
poetry install

# 或者使用pip
pip install -e .
```

## 使用方法

### 查看帮助

```bash
homestay --help
```

### 数据导入

#### 导入房态CSV

```bash
homestay import-data room-status examples/rooms.csv
```

CSV格式要求：
- `room_number` / `房号`：房号（必填）
- `room_name` / `房间名`：房间名称
- `floor` / `楼层`：楼层
- `room_type` / `房型`：房型
- `status` / `状态`：状态

#### 导入保洁记录JSON

```bash
homestay import-data cleaning examples/cleaning.json
```

JSON格式要求（数组或单条记录）：
- `room_number` / `房号`：房号（必填）
- `cleaning_date` / `保洁日期`：保洁日期（必填）
- `cleaner_name` / `保洁员`：保洁员姓名
- `cleaner_phone` / `保洁员电话`：保洁员电话
- `quality_score` / `质量评分`：质量评分
- `has_complaint` / `有客诉`：是否有客诉
- `complaint_count` / `客诉次数`：客诉次数
- `rework_count` / `返工次数`：返工次数
- `notes` / `备注`：备注

#### 导入照片清单

```bash
homestay import-data photos examples/photos.txt
```

支持纯文本（每行一个文件路径）或JSON格式。

### 数据查询

#### 查询房间

```bash
homestay query rooms
homestay query rooms --room-number 101
homestay query rooms --json-output
```

#### 查询保洁记录

```bash
homestay query cleaning
homestay query cleaning --room-number 101
homestay query cleaning --start-date 2024-01-01 --end-date 2024-12-31
homestay query cleaning --has-complaint
```

#### 查询照片

```bash
homestay query photos
homestay query photos --approved
```

#### 查询导入历史

```bash
homestay query import-history
```

#### 查询错误记录

```bash
homestay query errors
homestay query errors --unresolved
homestay query errors --import-id 1
```

#### 查询操作历史

```bash
homestay query operation-history
```

### 标记错误已解决

```bash
homestay resolve-error 1
```

### 数据导出

#### 导出保洁记录

```bash
homestay export-data cleaning output/cleaning.csv
homestay export-data cleaning output/cleaning.json --format json
```

#### 导出错误记录

```bash
homestay export-data errors output/errors.csv --unresolved
```

### 查看统计信息

```bash
homestay stats
```

## 数据存储

数据库文件位于：
- macOS: `~/.homestay_admin/data.db`
- Windows: `C:\Users\<用户名>\.homestay_admin\data.db`
- Linux: `~/.homestay_admin/data.db`

## 敏感字段脱敏

系统自动对以下字段进行脱敏处理（查询、导出、日志均生效）：
- 手机号（如 `138****8001`）
- 身份证号
- 银行卡号
- 邮箱
- 姓名（如 `张*姨`）
- 地址

## 项目结构

```
homestay_admin/
├── __init__.py     # 包初始化
├── models.py       # 数据库模型
├── importer.py     # 数据导入服务
├── exporter.py     # 数据查询导出服务
├── masker.py       # 敏感字段脱敏工具
└── cli.py          # 命令行界面
```
