# 门店品控数据管理系统

一个基于FastAPI的品控数据管理系统，用于管理门店的菜品留样记录、冰箱温度日志和废弃时间追踪。

## 功能特性

- ✅ **Excel/CSV数据导入**: 支持留样台账Excel和温度日志CSV导入
- ✅ **数据验证与错误记录**: 坏数据不会直接丢弃，会保留原始位置、失败原因和修改建议
- ✅ **多条件查询**: 支持按负责人、时间范围、状态、异常类型、门店名称等筛选
- ✅ **报告导出**: 导出与查询结果一致的Excel报告
- ✅ **本地持久化**: SQLite数据库存储，重启服务后数据不丢失
- ✅ **导入历史**: 完整记录每次导入的批次信息
- ✅ **统计摘要**: 实时查看数据统计和异常分布

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 生成测试数据

```bash
python generate_test_data.py
```

这将生成：
- `留样台账.xlsx` - 包含15条正常记录 + 1条故意错误的数据
- `温度日志.csv` - 包含20条正常记录 + 1条故意错误的数据

### 3. 启动服务

```bash
python main.py
```

服务将在 `http://localhost:8001` 启动

### 4. 运行端到端测试

打开另一个终端窗口：

```bash
python test_api.py
```

测试脚本将自动完成以下操作：
- 导入留样台账Excel
- 导入温度日志CSV
- 查看导入错误记录（含原因和建议）
- 查看导入历史
- 按不同条件查询数据
- 查看统计摘要
- 导出Excel报告

## API接口

### 导入接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/import/sample` | POST | 导入留样台账Excel |
| `/api/import/temperature` | POST | 导入温度日志CSV |

### 查询接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/records` | GET | 查询品控记录，支持多条件筛选 |
| `/api/import/errors/{batch_id}` | GET | 查看指定批次的导入错误 |
| `/api/import/history` | GET | 查看导入历史 |

### 导出接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/export/report` | GET | 导出Excel报告，支持筛选条件 |

### 统计接口

| 接口 | 方法 | 说明 |
|------|------|------|
| `/api/stats/summary` | GET | 获取统计摘要 |

## 查询参数说明

`/api/records` 和 `/api/export/report` 支持以下查询参数：

| 参数 | 类型 | 说明 |
|------|------|------|
| `responsible_person` | string | 负责人姓名 |
| `start_date` | date | 开始日期 (YYYY-MM-DD) |
| `end_date` | date | 结束日期 (YYYY-MM-DD) |
| `status` | string | 状态: 正常/异常 |
| `anomaly_type` | string | 异常类型 |
| `record_type` | string | 记录类型: 留样台账/温度日志 |
| `store_name` | string | 门店名称 |

## 使用示例

### 1. 导入Excel

```bash
curl -X POST "http://localhost:8001/api/import/sample" \
  -F "file=@留样台账.xlsx" \
  -F "imported_by=品控经理"
```

### 2. 查询异常记录

```bash
curl "http://localhost:8001/api/records?status=异常"
```

### 3. 按负责人查询

```bash
curl "http://localhost:8001/api/records?responsible_person=张三"
```

### 4. 导出报告

```bash
curl -o 品控报告.xlsx "http://localhost:8001/api/export/report?status=异常"
```

### 5. 查看导入错误

```bash
curl "http://localhost:8001/api/import/errors/{batch_id}"
```

## 文件格式要求

### 留样台账Excel列名

| 列名 | 必须 | 说明 |
|------|------|------|
| 门店名称 | 是 | 不能为空 |
| 负责人 | 是 | 不能为空 |
| 日期 | 是 | YYYY-MM-DD 或 YYYY/MM/DD |
| 菜品名称 | 否 | |
| 留样时间 | 否 | YYYY-MM-DD HH:MM:SS |
| 废弃时间 | 否 | 必须晚于留样时间 |
| 备注 | 否 | |

### 温度日志CSV列名

| 列名 | 必须 | 说明 |
|------|------|------|
| 门店名称 | 是 | 不能为空 |
| 负责人 | 是 | 不能为空 |
| 日期 | 是 | YYYY-MM-DD 或 YYYY/MM/DD |
| 冰箱编号 | 否 | |
| 温度 | 是 | 数值，单位°C |
| 备注 | 否 | |

## 数据持久化

系统使用SQLite数据库 (`quality_control.db`) 存储所有数据，包括：
- 品控记录
- 导入错误日志（含原始数据、错误原因、修改建议）
- 导入历史记录

重启服务后，所有数据都会保留。

## API文档

启动服务后访问：
- Swagger UI: `http://localhost:8001/docs`
- ReDoc: `http://localhost:8001/redoc`

## 项目结构

```
.
├── main.py              # FastAPI主应用
├── database.py          # 数据库模型
├── requirements.txt     # 依赖列表
├── generate_test_data.py # 测试数据生成
├── test_api.py          # API测试脚本
└── quality_control.db   # SQLite数据库（自动生成）
```
