# 校服尺码标准化班级汇总系统

后端 API 服务，用于处理班主任提交的校服尺码数据，进行标准化处理、重复合并、班级汇总，并生成厂家可用的订购报告。

## 功能特性

### 核心功能
- **表头识别**：自动识别 Excel/CSV 文件中的关键字段（姓名、班级、尺码等）
- **尺码标准化**：将各种格式的尺码（如"加大"、"160cm"、"M号"）统一转换为标准格式
- **重复学生合并**：自动识别同一学生的多条记录并合并
- **班级汇总**：按班级汇总各尺码数量
- **异常处理**：识别尺码冲突、非标准格式等异常并记录

### API 接口
- `POST /api/import` - 导入校服尺码数据
- `GET /api/batches` - 获取导入批次列表
- `GET /api/records` - 获取尺码记录列表（支持筛选）
- `GET /api/exceptions` - 获取异常列表
- `PUT /api/exceptions/{id}/resolve` - 标记异常为已解决
- `GET /api/summary` - 按班级汇总尺码数据
- `POST /api/export` - 导出订购报告
- `GET /api/reports` - 获取报告列表
- `GET /api/reports/{id}/download` - 下载报告

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检

```bash
python test_self_check.py
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问 API 文档

启动后访问：http://localhost:8000/docs

## 数据模型

### ClassInfo（班级信息）
- id: 主键
- grade: 年级
- class_name: 班级名称
- teacher_name: 班主任姓名

### Student（学生）
- id: 主键
- class_id: 所属班级ID
- student_no: 学号
- name: 姓名
- gender: 性别
- height: 身高
- weight: 体重

### SizeRecord（尺码记录）
- id: 主键
- student_id: 学生ID
- import_batch_id: 导入批次ID
- original_size: 原始尺码
- standardized_size: 标准尺码
- is_duplicate: 是否重复
- is_supplement: 是否补订
- quantity: 数量

### ImportBatch（导入批次）
- id: 主键
- file_name: 文件名
- status: 状态
- total_records: 总记录数
- processed_records: 已处理记录数
- has_exceptions: 是否有异常
- created_by: 创建人

### ExceptionNote（异常备注）
- id: 主键
- size_record_id: 尺码记录ID
- import_batch_id: 导入批次ID
- exception_type: 异常类型
- message: 异常信息
- is_resolved: 是否已解决
- resolved_by: 解决人

### OrderReport（订购报告）
- id: 主键
- report_type: 报告类型
- file_name: 文件名
- file_path: 文件路径
- generated_by: 生成人
- total_students: 学生总数
- total_quantity: 总数量

## 错误响应类型

调用方可根据 `error_type` 区分错误：

| 错误类型 | 说明 | HTTP 状态码 |
|---------|------|------------|
| `invalid_file_format` | 无效的文件格式 | 400 |
| `file_read_error` | 文件读取失败 | 400 |
| `missing_fields` | 缺少必要字段 | 400 |
| `processing_error` | 数据处理错误 | 500 |
| `not_found` | 记录不存在 | 404 |
| `already_resolved` | 异常已处理过 | 409 |
| `invalid_status` | 状态不允许操作 | 409 |
| `no_data` | 没有可导出的数据 | 400 |
| `export_failed` | 报告导出失败 | 500 |

## 标准尺码映射

支持的中文尺码描述：

| 中文描述 | 标准尺码 |
|---------|---------|
| 小号、小 | S |
| 中号、中 | M |
| 大号、大 | L |
| 加大 | XL |
| 特大、超大 | XXL |
| 加小、超小 | XS |

数字尺码（110-190）自动提取数字部分作为标准尺码。

## 使用示例

### 导入数据

```bash
curl -X POST "http://localhost:8000/api/import" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data.csv"
```

### 导出报告

```bash
curl -X POST "http://localhost:8000/api/export?batch_id=1"
```

### 查看汇总

```bash
curl "http://localhost:8000/api/summary?batch_id=1"
```

## 目录结构

```
.
├── main.py              # FastAPI 主应用
├── database.py          # 数据库模型
├── size_processor.py    # 核心业务逻辑
├── test_self_check.py   # 自检脚本
├── requirements.txt     # 依赖列表
├── sample_data.csv      # 示例数据
├── school_uniform.db    # SQLite 数据库（运行后生成）
├── uploads/             # 上传文件目录
├── reports/             # 报告输出目录
└── test_output/         # 测试输出目录
```

## 技术栈

- **Web 框架**: FastAPI
- **数据库**: SQLite + SQLAlchemy ORM
- **数据处理**: Pandas
- **Excel 导出**: openpyxl + xlsxwriter
- **ASGI 服务器**: uvicorn

## 注意事项

1. 首次运行会自动创建 SQLite 数据库文件
2. 上传的文件和生成的报告会保存在本地目录
3. 建议定期清理 `uploads/` 和 `reports/` 目录
4. 生产环境建议使用更强大的数据库（如 PostgreSQL）
