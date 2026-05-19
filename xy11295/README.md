# 会展物料管理系统

用于管理会展期间桁架、灯具、屏幕等物料的借还，解决多个展位同时借用时总账对不上的问题。

## 功能特性

- ✅ 物料基础数据管理（桁架/灯具/屏幕）
- ✅ 展位及负责人管理
- ✅ 调拨单管理（借出）
- ✅ 归还记录管理
- ✅ 支持 CSV/YAML 批量导入
- ✅ 坏数据捕获（保留原始位置、错误原因、修改建议）
- ✅ 多条件筛选查询（负责人、时间、状态、异常类型）
- ✅ Excel/CSV 报表导出
- ✅ 库存自动扣减和归还
- ✅ 异常记录和追踪

## 技术栈

- Python 3.8+
- FastAPI - REST API 框架
- SQLAlchemy - ORM 框架
- SQLite - 本地数据库
- pandas - 数据处理
- PyYAML - YAML 解析
- openpyxl - Excel 处理

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问：
- API 文档：http://localhost:8000/docs
- ReDoc 文档：http://localhost:8000/redoc

## 使用流程

### 步骤 1: 导入基础数据

#### 导入物料表 (CSV)

使用 `sample_data/materials.csv` 作为模板：

```bash
# 通过 API 导入
curl -X POST "http://localhost:8000/api/import/materials" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/materials.csv"
```

**字段说明：**
- material_code: 物料编码（唯一）
- name: 物料名称
- type: 物料类型（桁架/灯具/屏幕）
- specification: 规格
- unit: 单位
- total_quantity: 总数量
- available_quantity: 可用数量
- location: 库存位置
- description: 描述

#### 导入展位数据 (YAML)

使用 `sample_data/booths.yaml` 作为模板：

```bash
curl -X POST "http://localhost:8000/api/import/booths" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/booths.yaml"
```

### 步骤 2: 导入调拨单

使用 `sample_data/transfers.yaml` 作为模板：

```bash
curl -X POST "http://localhost:8000/api/import/transfers" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/transfers.yaml"
```

**导入时会自动：**
- 校验物料编码是否存在
- 校验展位编码是否存在
- 检查库存是否充足
- 扣减可用库存

### 步骤 3: 导入归还记录

使用 `sample_data/returns.csv` 作为模板：

```bash
curl -X POST "http://localhost:8000/api/import/returns" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/returns.csv"
```

**归还时会自动：**
- 更新已归还数量
- 恢复物料库存
- 标记单据状态（部分归还/已归还）
- 记录异常信息

### 步骤 4: 查询与复核

#### 查询调拨记录

```bash
# 查询所有记录
curl "http://localhost:8000/api/transfers"

# 按负责人筛选
curl "http://localhost:8000/api/transfers?manager=张明"

# 按异常类型筛选
curl "http://localhost:8000/api/transfers?exception_type=%E6%8D%9F%E5%9D%8F"

# 按时间范围筛选
curl "http://localhost:8000/api/transfers?start_time=2024-05-01T00:00:00&end_time=2024-05-31T23:59:59"

# 按状态筛选
curl "http://localhost:8000/api/transfers?status=%E5%BE%85%E5%BD%92%E8%BF%98"
```

#### 查看导入错误

```bash
# 查看所有导入错误
curl "http://localhost:8000/api/import/errors"

# 按类型筛选
curl "http://localhost:8000/api/import/errors?import_type=material"
```

**每条错误记录包含：**
- 原始数据
- 错误原因
- 修改建议
- 所在行号
- 文件名

### 步骤 5: 导出报表

```bash
# 导出所有调拨记录 (Excel格式)
curl -o transfers.xlsx "http://localhost:8000/api/transfers/export"

# 导出 CSV 格式
curl -o transfers.csv "http://localhost:8000/api/transfers/export?format=csv"

# 按筛选条件导出
curl -o abnormal.xlsx "http://localhost:8000/api/transfers/export?exception_type=%E6%8D%9F%E5%9D%8F"

# 导出物料表
curl -o materials.xlsx "http://localhost:8000/api/materials/export"
```

**导出的 Excel 包含 3 个 Sheet：**
1. 调拨记录 - 完整的单据明细
2. 统计汇总 - 各状态单据数量统计
3. 异常统计 - 各异常类型影响统计

## API 接口列表

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/materials | 导入物料表CSV |
| POST | /api/import/booths | 导入展位YAML |
| POST | /api/import/transfers | 导入调拨单YAML |
| POST | /api/import/returns | 导入归还记录CSV |
| GET | /api/transfers | 查询调拨记录 |
| GET | /api/transfers/export | 导出调拨记录 |
| POST | /api/transfers | 创建调拨单 |
| POST | /api/returns | 创建归还记录 |
| GET | /api/materials | 获取所有物料 |
| GET | /api/materials/export | 导出物料表 |
| GET | /api/booths | 获取所有展位 |
| GET | /api/import/errors | 获取导入错误日志 |

## 样例数据说明

`sample_data/` 目录下包含：

| 文件 | 说明 | 特征 |
|------|------|------|
| materials.csv | 正常物料数据 | 9条记录，3种物料类型 |
| materials_with_errors.csv | 包含错误的物料数据 | 用于测试错误捕获功能 |
| booths.yaml | 展位数据 | 5个展位，各有负责人 |
| transfers.yaml | 调拨单数据 | 6条正常借出记录 |
| returns.csv | 归还记录 | 包含正常归还和异常（损坏、丢失） |

## 测试错误处理

使用带错误的物料表测试错误捕获：

```bash
curl -X POST "http://localhost:8000/api/import/materials" \
  -H "accept: application/json" \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/materials_with_errors.csv"
```

预期会捕获以下错误类型：
- 物料编码重复
- 物料编码为空
- 物料类型不合法
- 可用数量大于总数量
- 物料名称为空

## 状态说明

### 调拨单状态

- **待归还** - 物料已借出，尚未归还
- **部分归还** - 归还了部分数量
- **已归还** - 全部归还完成
- **异常** - 归还过程中发现异常

### 异常类型

- **无异常** - 正常状态
- **损坏** - 物料损坏
- **丢失** - 物料丢失
- **数量不符** - 归还数量与调拨数量不符
- **质量问题** - 发现质量问题
- **超期未还** - 超过预计归还时间

## 目录结构

```
.
├── main.py              # 主程序入口
├── models.py            # 数据库模型
├── schemas.py           # Pydantic 数据模型
├── crud.py              # 数据库操作
├── database.py          # 数据库连接
├── exporter.py          # 导出功能
├── importers/           # 导入模块
│   ├── __init__.py
│   ├── material_importer.py
│   ├── transfer_importer.py
│   └── return_importer.py
├── sample_data/         # 样例数据
│   ├── materials.csv
│   ├── materials_with_errors.csv
│   ├── booths.yaml
│   ├── transfers.yaml
│   └── returns.csv
├── exports/             # 导出文件目录
├── uploads/             # 上传文件临时目录
├── requirements.txt     # 依赖列表
└── README.md            # 本文档
```

## 常见问题

### Q: 导入时提示物料编码不存在？
A: 请先导入物料表，确保调拨单中使用的物料编码都存在于物料表中。

### Q: 导入时提示库存不足？
A: 系统会自动检查库存，确保可用数量大于等于调拨数量。可以先查看物料库存情况。

### Q: 如何查看导入失败的记录？
A: 调用 `/api/import/errors` 接口可以查看所有导入错误，包含原始数据和修改建议。

### Q: 数据库文件在哪里？
A: 数据库文件为 `exhibition_material.db`，位于项目根目录，首次启动时自动创建。

## 许可证

MIT License
