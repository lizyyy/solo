# 楼宇维保管理系统后端服务

## 项目简介

这是一套专为楼宇维保公司设计的后端管理系统，支持设备台账、巡检照片、合同管理一体化。系统能够自动检测异常情况（过期未检、同设备多合同、照片缺失、无有效合同），生成可读的处理说明，并提供完整的审计追踪功能。

## 技术栈

- **框架**: FastAPI
- **数据库**: SQLite
- **ORM**: SQLAlchemy
- **数据处理**: Pandas + OpenPyXL

## 核心功能

### 1. 数据导入
- 设备台账 Excel 导入
- 合同期限表 Excel 导入
- 巡检照片清单 Excel 导入

### 2. 批次管理
- 创建维保批次
- 批量生成维保记录
- 查看批次详情和统计

### 3. 记录管理
- 按楼层、区域、维保人员、状态等条件查询
- 异常自动检测和标记
- 记录处理（通过/退回/要求补材料）
- 完整的操作历史审计

### 4. 异常类型
- **过期未检**: 维保日期已过期
- **同设备多合同**: 同一设备有多份有效合同
- **照片缺失**: 无巡检现场照片
- **无有效合同**: 设备未签署维保合同

### 5. 数据导出
- 维保记录明细导出（Excel）
- 单条记录证明文件导出（含操作历史）
- 异常统计汇总

## 安装与运行

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 初始化演示数据

```bash
python init_data.py
```

### 3. 启动服务

```bash
python main.py
```

或使用 uvicorn：

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### 4. 访问接口文档

- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口说明

### 批次管理

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/batches | 创建新批次 |
| GET | /api/batches | 获取批次列表 |
| GET | /api/batches/{id} | 获取批次详情 |
| GET | /api/batches/{id}/records | 获取批次下的记录 |
| POST | /api/batches/{id}/generate-records | 批量生成维保记录 |

### 记录管理

| 方法 | 路径 | 说明 |
|------|------|------|
| GET | /api/records | 查询记录列表（支持筛选） |
| POST | /api/records/query | 高级查询 |
| GET | /api/records/{id} | 获取记录详情 |
| POST | /api/records/{id}/handle | 处理记录 |
| GET | /api/records/{id}/audit-logs | 获取操作历史 |

### 数据导入

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/import/equipment | 导入设备台账 |
| POST | /api/import/contract | 导入合同表 |
| POST | /api/import/photos | 导入照片清单 |

### 数据导出

| 方法 | 路径 | 说明 |
|------|------|------|
| POST | /api/export/records | 导出维保记录 |
| GET | /api/export/records/{id}/proof | 导出单条记录证明 |
| GET | /api/export/exceptions/summary | 异常统计汇总 |

## Excel 导入模板格式

### 设备台账模板

| 设备编号 | 设备名称 | 设备类型 | 楼层 | 区域 | 位置 | 安装日期 | 维保人员 | 上次维保日期 | 下次维保日期 |
|---------|---------|---------|------|------|------|----------|---------|-------------|-------------|
| ELEV-001 | 1号客梯 | 电梯 | 1-20层 | A栋 | A栋东侧 | 2020-05-15 | 张三 | 2026-01-10 | 2026-02-10 |

### 合同表模板

| 合同编号 | 设备编号 | 供应商 | 开始日期 | 结束日期 | 金额 | 联系人 | 联系电话 |
|---------|---------|--------|----------|----------|------|--------|----------|
| CT-2026-001 | ELEV-001 | XX电梯公司 | 2026-01-01 | 2026-12-31 | 50000 | 李经理 | 13800138001 |

### 照片清单模板

| 设备编号 | 文件名 | 文件路径 | 拍摄日期 | 拍摄人 | 描述 |
|---------|--------|----------|----------|--------|------|
| ELEV-001 | photo.jpg | /photos/ | 2026-01-10 | 张三 | 维保现场照片 |

## 使用流程示例

1. **导入基础数据**
   - 导入设备台账
   - 导入合同信息
   - 导入照片清单

2. **创建批次**
   ```bash
   POST /api/batches
   {
     "name": "2026年2月份维保",
     "description": "月度例行维保",
     "created_by": "管理员"
   }
   ```

3. **生成记录**
   ```bash
   POST /api/batches/1/generate-records
   ```

4. **查看异常**
   - 系统自动标记有异常的记录
   - 查看可读的异常说明

5. **处理记录**
   ```bash
   POST /api/records/1/handle
   {
     "action": "approve",  # approve/return/request_info
     "handled_by": "审核员",
     "reason": "资料齐全",
     "notes": "同意放行"
   }
   ```

6. **导出数据**
   - 按筛选条件导出所有记录
   - 导出单条记录作为证明文件

## 数据库模型

- **Equipment**: 设备台账
- **Contract**: 合同信息
- **InspectionPhoto**: 巡检照片
- **Batch**: 维保批次
- **MaintenanceRecord**: 维保记录（核心）
- **RecordException**: 记录异常明细
- **AuditLog**: 操作审计日志

## 状态流转

- **pending**: 待处理
- **processing**: 处理中
- **approved**: 已通过
- **returned**: 已退回
- **needs_more_info**: 需补材料

## 项目结构

```
.
├── main.py              # 应用入口
├── database.py          # 数据库连接
├── models.py            # 数据模型
├── schemas.py           # Pydantic 模型
├── services.py          # 业务逻辑
├── requirements.txt     # 依赖列表
├── init_data.py         # 演示数据初始化
├── routers/
│   ├── __init__.py
│   ├── batches.py       # 批次管理路由
│   ├── records.py       # 记录管理路由
│   ├── import_data.py   # 数据导入路由
│   └── export.py        # 数据导出路由
└── README.md
```
