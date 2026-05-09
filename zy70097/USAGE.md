# 设备能效基线管理系统 - 使用指南

## 项目概述

本系统用于解决工厂设备更换后，能效基线和节能收益统计失真的问题。核心特性：

1. **基线版本管理**：支持多版本基线，设备更换后可重新计算新基线
2. **设备分组**：支持按车间、生产线等维度管理设备
3. **产量归一**：计算节能收益时考虑产量波动
4. **异常剔除**：自动检测和标记异常数据
5. **收益计算**：基于基线版本计算节能收益
6. **审计导出**：导出详细报告用于业务复核
7. **后台任务**：支持失败重试，无需清库重来

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 配置环境变量

```bash
cp .env.example .env
# 编辑 .env 文件，根据需要修改配置
```

### 3. 生成示例数据（可选）

```bash
python scripts/seed_data.py
```

### 4. 启动应用

```bash
# 启动 Web 服务
python main.py

# 或者使用 uvicorn
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 启动 Celery Worker（用于后台任务）

```bash
# 需要先安装并启动 Redis
celery -A app.core.celery_app worker --loglevel=info
```

### 6. 访问 API 文档

打开浏览器访问：http://localhost:8000/docs

## 核心业务流程

### 场景：设备更换后的基线管理

#### 步骤1：设备信息维护

```bash
# 创建设备分组
curl -X POST "http://localhost:8000/api/equipment/groups/" \
  -H "Content-Type: application/json" \
  -d '{"name": "冲压车间", "code": "STAMPING_01"}'

# 创建旧设备
curl -X POST "http://localhost:8000/api/equipment/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "冲压机A（旧）",
    "code": "STAMP-001",
    "type": "冲压机",
    "status": "replaced"
  }'

# 创建新设备
curl -X POST "http://localhost:8000/api/equipment/" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "冲压机A（新）",
    "code": "STAMP-001-NEW",
    "type": "冲压机",
    "status": "active"
  }'
```

#### 步骤2：导入能耗和产量数据

```bash
# 批量导入能耗数据
curl -X POST "http://localhost:8000/api/energy/data/energy" \
  -H "Content-Type: application/json" \
  -d '[{
    "equipment_id": 1,
    "record_date": "2024-01-01T08:00:00",
    "energy_consumption": 15000
  }]'

# 通过 Excel 导入
curl -X POST "http://localhost:8000/api/energy/data/import/energy" \
  -F "file=@energy_data.xlsx"
```

#### 步骤3：检测和标记异常数据

```bash
curl -X POST "http://localhost:8000/api/energy/outliers/detect" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_ids": [1],
    "start_date": "2024-01-01T00:00:00",
    "end_date": "2024-06-30T23:59:59",
    "threshold": 3.0
  }'
```

#### 步骤4：计算基线版本

```bash
# 旧设备基线（更换前）
curl -X POST "http://localhost:8000/api/energy/baselines/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_ids": [1],
    "start_date": "2024-01-01T00:00:00",
    "end_date": "2024-06-30T23:59:59",
    "version_name": "旧设备基线（2024H1"
  }'

# 新设备基线（更换后）
curl -X POST "http://localhost:8000/api/energy/baselines/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_ids": [2],
    "start_date": "2024-07-01T00:00:00",
    "end_date": "2024-12-31T23:59:59",
    "version_name": "新设备基线（2024H2）"
  }'
```

#### 步骤5：激活基线版本

```bash
curl -X POST "http://localhost:8000/api/energy/baselines/1/activate?replace_reason=设备更换"
```

#### 步骤6：计算节能收益

```bash
curl -X POST "http://localhost:8000/api/energy/savings/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_ids": [2],
    "period_start": "2024-07-01T00:00:00",
    "period_end": "2024-07-31T23:59:59"
  }'
```

#### 步骤7：导出报告（用于业务复核）

```bash
# 导出基线报告
curl -X POST "http://localhost:8000/api/export/baseline" \
  -H "Content-Type: application/json" \
  -d '{
    "export_type": "baseline",
    "equipment_ids": [1, 2]
  }'

# 导出节能收益报告
curl -X POST "http://localhost:8000/api/export/saving" \
  -H "Content-Type: application/json" \
  -d '{
    "export_type": "saving",
    "period_start": "2024-07-01T00:00:00",
    "period_end": "2024-07-31T23:59:59"
  }'
```

## 后台任务管理

### 提交异步任务

```bash
# 提交基线计算任务
curl -X POST "http://localhost:8000/api/tasks/baseline/calculate" \
  -H "Content-Type: application/json" \
  -d '{
    "equipment_ids": [1],
    "start_date": "2024-01-01T00:00:00",
    "end_date": "2024-06-30T23:59:59",
    "version_name": "基线版本1"
  }'
```

### 查看任务状态

```bash
curl "http://localhost:8000/api/tasks/task_xxx"
```

### 重试失败任务

```bash
# 普通重试
curl -X POST "http://localhost:8000/api/tasks/task_xxx/retry"

# 强制重试（超过最大重试次数后）
curl -X POST "http://localhost:8000/api/tasks/task_xxx/retry?force=true"
```

## API 端点列表

### 设备管理

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/equipment/ | 创建设备 |
| GET | /api/equipment/ | 获取设备列表 |
| GET | /api/equipment/{id} | 获取单个设备 |
| PUT | /api/equipment/{id} | 更新设备 |
| DELETE | /api/equipment/{id} | 删除设备 |
| POST | /api/equipment/groups/ | 创建设备分组 |
| GET | /api/equipment/groups/ | 获取分组列表 |

### 能源管理

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/energy/data/energy | 批量创建能耗数据 |
| POST | /api/energy/data/production | 批量创建产量数据 |
| POST | /api/energy/data/import/energy | 导入能耗数据文件 |
| POST | /api/energy/data/import/production | 导入产量数据文件 |
| POST | /api/energy/outliers/detect | 检测异常数据 |
| POST | /api/energy/outliers/mark | 标记异常数据 |
| POST | /api/energy/baselines/calculate | 计算基线版本 |
| POST | /api/energy/baselines/{id}/activate | 激活基线版本 |
| POST | /api/energy/savings/calculate | 计算节能收益 |

### 数据导出

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/export/baseline | 导出基线报告 |
| POST | /api/export/saving | 导出节能收益报告 |
| POST | /api/export/energy-data | 导出能耗数据 |
| POST | /api/export/production-data | 导出产量数据 |
| POST | /api/export/audit | 导出审计日志 |

### 任务管理

| 方法 | 端点 | 描述 |
|------|------|------|
| POST | /api/tasks/baseline/calculate | 提交基线计算任务 |
| POST | /api/tasks/savings/calculate | 提交收益计算任务 |
| POST | /api/tasks/export | 提交导出任务 |
| GET | /api/tasks/ | 获取任务列表 |
| GET | /api/tasks/{task_id} | 获取任务状态 |
| POST | /api/tasks/{task_id}/retry | 重试失败任务 |
| GET | /api/tasks/{task_id}/result | 获取任务结果 |

## 导出文件说明

### 基线报告包含：
- 基线版本ID、版本号、版本名称
- 基线类型（设备/分组）
- 设备/分组名称
- 基准能效值、标准差
- 数据点数量、剔除异常点数量
- 基线状态、是否激活
- 基线周期、创建时间
- 计算方法明细

### 节能收益报告包含：
- 收益记录ID、设备名称
- 基线版本、基线能效值
- 统计周期、计算时间
- 实际能耗、基准能耗、节能量、节能率
- 归一化产量、数据点数量
- 合计行（汇总数据）

## 失败重试机制

### 任务状态流转：
- pending：等待执行
- running：正在执行
- completed：执行成功
- failed：执行失败（超过最大重试次数）
- retrying：正在重试

### 重试策略：
1. 自动重试：最多3次，每次间隔60秒
2. 手动重试：通过API调用，可强制重试
3. 重试时不会重复创建已成功的记录
4. 可查看错误信息和堆栈跟踪

## 数据模型

### 关键模型：
- Equipment：设备信息
- EquipmentGroup：设备分组
- BaselineVersion：基线版本
- EnergyData：能耗数据
- ProductionData：产量数据
- EnergySaving：节能收益记录
- BackgroundTask：后台任务
- AuditLog：审计日志

## 配置项

### 核心配置：
- OUTLIER_THRESHOLD：异常检测阈值（默认3.0）
- MIN_DATA_POINTS：最小数据点数量（默认10）
- MAX_RETRY_ATTEMPTS：最大重试次数（默认3）
- RETRY_DELAY_SECONDS：重试间隔（默认60秒）
