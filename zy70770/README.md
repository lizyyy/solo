# .env轮换计划引用扫描后端API

基于 FastAPI + SQLite 的环境变量轮换管理系统，支持变量依赖扫描、批次分组、回滚值遮蔽、负责人汇总、报告输出等核心功能。

## 功能特性

### 核心功能
- **.env文件导入** - 解析并导入.env文件，自动识别变量间引用关系
- **变量依赖扫描** - 自动检测变量间的依赖关系，计算依赖层级
- **轮换批次管理** - 按批次分组管理变量轮换，自动包含依赖变量
- **回滚值遮蔽** - 敏感变量的回滚值自动脱敏显示
- **人工复核机制** - 敏感或高依赖变量自动标记需要人工复核
- **负责人汇总** - 按负责人统计批次和变量数量
- **报告生成导出** - 生成完整的轮换计划报告，支持JSON导出
- **状态流转控制** - 严格的批次和变量状态机，防止误操作

### 错误响应码
| 错误码 | 说明 |
|--------|------|
| `MISSING_FIELD` | 缺少必填字段 |
| `INVALID_STATUS` | 当前状态不允许此操作 |
| `REVIEW_REQUIRED` | 需要人工复核后才能继续 |
| `ALREADY_PROCESSED` | 批次已处理或正在处理中 |
| `NOT_FOUND` | 资源不存在 |
| `DUPLICATE_ENTRY` | 重复条目 |
| `INVALID_OPERATION` | 无效操作 |

## 项目结构

```
.
├── main.py              # FastAPI主应用，包含所有API路由和业务逻辑
├── database.py          # 数据库模型和连接配置
├── schemas.py           # Pydantic数据模型（请求/响应）
├── self_test.py         # 自检脚本
├── requirements.txt     # 依赖包列表
└── README.md           # 项目文档
```

## 数据库模型

- **EnvFile** - .env文件元数据
- **EnvVariable** - 环境变量详情
- **VariableReference** - 变量引用关系
- **ResponsiblePerson** - 负责人信息
- **RotationBatch** - 轮换批次
- **RotationItem** - 批次中的具体轮换项

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 运行自检脚本

```bash
python self_test.py
```

自检脚本会自动验证以下功能：
- .env文件导入和变量解析
- 变量依赖扫描和引用检测
- 敏感变量自动标记
- 负责人创建和筛选
- 轮换批次创建和依赖自动包含
- 回滚值遮蔽功能
- 批次执行和回滚
- 人工复核机制
- 报告生成和导出
- 错误响应码定义

### 3. 启动API服务

```bash
python main.py
```

或使用 uvicorn 直接运行：

```bash
uvicorn main:app --host 0.0.0.0 --port 8000 --reload
```

### 4. 访问API文档

启动后访问以下地址查看交互式API文档：
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API接口说明

### 环境变量管理
- `POST /api/env/import` - 导入.env文件
- `GET /api/env/files` - 查询.env文件列表
- `GET /api/env/variables` - 查询变量列表
- `GET /api/variables/{variable_id}/dependencies` - 查询变量依赖关系

### 负责人管理
- `POST /api/responsible-persons` - 创建负责人
- `GET /api/responsible-persons` - 查询负责人列表

### 轮换批次管理
- `POST /api/batches/group` - 创建轮换批次
- `GET /api/batches` - 查询批次列表
- `GET /api/batches/{batch_id}/items` - 查询批次详情
- `PUT /api/batches/{batch_id}/approve` - 批量批准批次中所有需要复核的项
- `PUT /api/batches/{batch_id}/execute` - 执行批次
- `PUT /api/batches/{batch_id}/rollback` - 回滚批次

### 轮换项管理
- `GET /api/batches/items/{item_id}` - 查询单个轮换项详情
- `PUT /api/batches/items/{item_id}` - 更新轮换项（包括批准状态、备注、新值等）

### 报告导出
- `POST /api/reports/generate` - 生成轮换报告

### 引用关系
- `GET /api/references` - 查询变量引用关系

## 使用示例

### 1. 导入.env文件

```bash
curl -X POST "http://localhost:8000/api/env/import" \
  -H "Content-Type: application/json" \
  -d '{
    "file_path": "/path/to/your/.env",
    "project_name": "MyProject",
    "environment": "production",
    "auto_scan_references": true
  }'
```

### 2. 创建负责人

```bash
curl -X POST "http://localhost:8000/api/responsible-persons" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "张三",
    "email": "zhangsan@example.com",
    "department": "运维部"
  }'
```

### 3. 创建轮换批次

```bash
curl -X POST "http://localhost:8000/api/batches/group" \
  -H "Content-Type: application/json" \
  -d '{
    "batch_name": "2024Q1密钥轮换",
    "variable_ids": [1, 2, 3],
    "description": "第一季度数据库密钥轮换",
    "responsible_person_id": 1,
    "auto_detect_dependencies": true
  }'
```

### 4. 查看批次详情和待复核项

```bash
# 查看批次下的所有轮换项
curl -X GET "http://localhost:8000/api/batches/1/items"

# 查看单个轮换项详情
curl -X GET "http://localhost:8000/api/batches/items/1"
```

### 5. 人工复核批准

#### 方式一：逐个批准轮换项

```bash
# 批准单个轮换项（设置状态为 APPROVED，添加复核备注）
curl -X PUT "http://localhost:8000/api/batches/items/1" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "APPROVED",
    "review_note": "已核对密码，确认无误",
    "new_value": "new_secure_password_123"
  }'
```

#### 方式二：批量批准整个批次

```bash
# 一键批准批次中所有需要复核的轮换项
curl -X PUT "http://localhost:8000/api/batches/1/approve"
```

### 6. 执行批次轮换

```bash
# 所有需要复核的项都批准后，可以执行批次
curl -X PUT "http://localhost:8000/api/batches/1/execute"
```

### 7. 如遇问题可回滚

```bash
curl -X PUT "http://localhost:8000/api/batches/1/rollback"
```

### 8. 生成轮换报告

```bash
curl -X POST "http://localhost:8000/api/reports/generate" \
  -H "Content-Type: application/json" \
  -d '{"format": "json"}'
```

## 状态流转

### 批次状态
```
PENDING (待处理)
    ↓
APPROVED (已批准) ← REVIEW_REQUIRED (需要复核)
    ↓
PROCESSING (处理中)
    ↓
COMPLETED (已完成) → ROLLED_BACK (已回滚)
```

## 核心规则说明

1. **变量依赖自动检测**：创建批次时自动将依赖变量加入批次，确保轮换完整性
2. **敏感变量自动识别**：变量名包含 password、secret、token、key、auth 等关键词时自动标记为敏感
3. **人工复核触发条件**：变量为敏感变量 或 依赖层级 > 0 时自动标记需要复核
4. **状态流转校验**：严格校验状态变更合法性，防止跨状态操作
5. **回滚值遮蔽**：API返回时敏感变量的回滚值自动脱敏，只显示首尾字符

## 开发说明

- 数据库默认使用 SQLite，文件名为 `env_rotation.db`，首次运行自动创建
- 自检脚本使用内存数据库，不影响实际数据
- 支持中文文件名和内容，请确保系统编码为 UTF-8

## 许可证

MIT License
