# 生鲜温度拒收阈值供应商统计后端API

## 项目概述

这是一个用于生鲜采购到货温度检测与拒收管理的后端API系统。系统通过导入验收单和温度枪记录，自动判断是否符合拒收标准，生成质检报告，并提供供应商统计分析功能。

## 核心功能

### 1. 基础数据管理
- **供应商管理**: 供应商信息的增删改查
- **品类管理**: 商品品类信息管理
- **拒收阈值配置**: 为每个品类配置温度范围、抽样数量、拒收异常数量阈值

### 2. 业务数据导入
- **到货单CSV批量导入**: 导入采购到货信息
- **温度记录CSV批量导入**: 导入温度检测记录

### 3. 核心业务规则
- **异常温度自动识别**: 根据阈值自动标记异常温度记录
- **拒收判断**: 当异常记录数量达到拒收阈值时，判定为拒收
- **质检报告生成**: 自动生成质检报告，包含检测结果和结论

### 4. 统计与导出
- **供应商统计**: 按供应商统计到货次数、拒收次数、拒收率等指标
- **异常样本管理**: 异常记录的查询和审核
- **Excel导出**: 质检报告和供应商统计报表导出

## 错误响应分类

系统提供清晰的错误响应机制，调用方可根据错误码进行相应处理：

| 错误码 | 说明 |
|--------|------|
| `missing_field` | 缺少必要字段 |
| `invalid_status` | 状态不允许操作 |
| `needs_manual_review` | 需要人工审核 |
| `already_processed` | 已处理，重复操作 |
| `resource_not_found` | 资源不存在 |
| `duplicate_data` | 数据重复 |

## 技术栈

- **Web框架**: FastAPI 0.104.1
- **ORM**: SQLAlchemy 2.0.23
- **数据库**: SQLite
- **数据处理**: Pandas 2.1.3
- **Excel导出**: OpenPyXL 3.1.2

## 项目结构

```
.
├── main.py              # FastAPI主应用，包含所有API接口
├── database.py          # 数据库模型和连接配置
├── test_api.py          # 自动化测试脚本
├── requirements.txt     # 依赖包列表
└── fresh_temperature.db # SQLite数据库文件（运行时生成）
```

## 数据模型

### Supplier（供应商）
- 供应商编码、名称、联系人、电话
- 支持软删除（is_active标记）

### Category（品类）
- 品类编码、名称、描述
- 每个品类可配置独立的拒收阈值

### RejectionThreshold（拒收阈值）
- 最低温度、最高温度
- 抽样数量
- 拒收异常数量阈值
- 生效时间

### ArrivalOrder（到货单）
- 到货单号、供应商、品类、到货日期
- 批次号、数量、单位
- 车牌号、司机姓名
- 状态：pending/inspected/completed

### TemperatureRecord（温度记录）
- 关联到货单
- 记录编号、测量时间、温度值
- 测量点、操作员
- 是否异常标记、是否已审核、审核备注

### InspectionReport（质检报告）
- 报告编号、关联到货单、供应商
- 质检日期、总抽样数、异常数量
- 是否超标、质检结果（通过/拒收）
- 结论、检测员、审核人
- 是否已处理标记

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行API服务

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 3. 访问API文档

启动服务后，访问以下地址查看交互式API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

### 4. 运行自检脚本

```bash
python test_api.py
```

该脚本会自动测试所有API功能，包括：
- 基础数据CRUD操作
- CSV批量导入
- 质检报告生成流程
- 供应商统计
- 异常记录管理
- Excel导出功能
- 错误响应分类

## API接口说明

### 基础数据接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/suppliers/` | 创建供应商 |
| GET | `/suppliers/` | 获取供应商列表 |
| POST | `/categories/` | 创建品类 |
| GET | `/categories/` | 获取品类列表 |
| POST | `/thresholds/` | 配置拒收阈值 |
| GET | `/thresholds/` | 获取阈值列表 |

### 到货单与温度记录接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/arrival-orders/` | 创建到货单 |
| GET | `/arrival-orders/` | 获取到货单列表 |
| POST | `/temperature-records/` | 创建温度记录 |
| POST | `/import/arrival-orders/csv` | 批量导⼊到货单CSV |
| POST | `/import/temperature-records/csv` | 批量导⼊温度记录CSV |

### 质检流程接口

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | `/inspection/generate/{order_no}` | 生成质检报告 |
| POST | `/inspection/process/{report_no}` | 处理质检报告 |
| GET | `/inspection-reports/` | 获取质检报告列表 |

### 统计与导出接口

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | `/suppliers/stats` | 获取供应商统计 |
| GET | `/anomaly-records/` | 获取异常温度记录 |
| PUT | `/anomaly-records/{id}/review` | 审核异常记录 |
| GET | `/export/inspection-reports` | 导出质检报告Excel |
| GET | `/export/supplier-stats` | 导出供应商统计Excel |

## CSV导入格式

### 到货单CSV格式

| 字段 | 说明 | 示例 |
|------|------|------|
| order_no | 到货单号 | ORD20240101001 |
| supplier_code | 供应商编码 | SUP001 |
| category_code | 品类编码 | CAT001 |
| arrival_date | 到货日期 | 2024-01-01 08:00:00 |
| batch_no | 批次号 | BATCH001 |
| quantity | 数量 | 1000.0 |
| unit | 单位 | kg |
| vehicle_no | 车牌号（可选） | 京A12345 |
| driver_name | 司机姓名（可选） | 张三 |

### 温度记录CSV格式

| 字段 | 说明 | 示例 |
|------|------|------|
| order_no | 到货单号 | ORD20240101001 |
| record_no | 记录编号 | REC001 |
| measure_time | 测量时间 | 2024-01-01 08:30:00 |
| temperature | 温度值 | 5.5 |
| measure_point | 测量点（可选） | 货箱中部 |
| operator | 操作员（可选） | 检测员A |

## 业务流程示例

### 完整质检流程

1. **配置基础数据**
   - 创建供应商信息
   - 创建品类信息
   - 为品类配置拒收阈值（如：0-4℃，抽样5个，异常≥2个则拒收）

2. **导入业务数据**
   - 导入到货单CSV
   - 导入对应温度记录CSV

3. **生成质检报告**
   - 调用`/inspection/generate/{order_no}`
   - 系统自动：
     - 比对每条温度记录与阈值，标记异常
     - 统计异常数量
     - 异常数量达到拒收阈值则判定拒收
     - 生成质检报告，自动更新到货单状态

4. **处理报告**
   - 调用`/inspection/process/{report_no}`标记报告已处理

5. **统计分析**
   - 查询供应商拒收率统计
   - 导出Excel报表

## 典型错误场景处理

1. **数据导入时字段缺失**
   - 返回 `missing_field` 错误码
   - 处理：检查CSV文件列名是否正确

2. **生成报告时记录数不足**
   - 返回 `needs_manual_review` 错误码
   - 处理：补充温度记录或人工审核

3. **品类未配置阈值**
   - 返回 `needs_manual_review` 错误码
   - 处理：先配置该品类的拒收阈值

4. **重复生成报告**
   - 返回 `already_processed` 错误码
   - 处理：直接查询已生成的报告即可

## 自检脚本说明

运行 `python test_api.py` 可以验证所有功能正常工作。测试覆盖：
- 12个测试场景
- 所有API端点
- 边界条件和错误处理
- CSV导入导出
- 完整业务流程

测试通过后显示：所有测试通过！API功能正常运行

## 部署说明

1. 生产环境建议使用PostgreSQL或MySQL替代SQLite
2. 可使用Gunicorn作为WSGI服务器
3. 建议配置反向代理（Nginx）处理静态文件和SSL

```bash
# 生产启动示例
gunicorn main:app -w 4 -k uvicorn.workers.UvicornWorker -b 0.0.0.0:8000
```
