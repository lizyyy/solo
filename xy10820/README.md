# 供应商目录映射 API

一个全栈的供应商商品目录映射管理系统，用于处理供应商字段变化、内部目录更新、冲突处理和数据同步。

## 功能特性

### 数据模型
- **供应商管理**: 供应商基础信息维护
- **供应商商品**: 供应商提供的商品数据，支持字段版本控制
- **内部目录**: 内部标准商品目录
- **映射规则**: 字段映射规则配置，支持版本管理
- **映射关系**: 供应商商品与内部目录的映射关系
- **同步批次**: 批量导入和同步记录
- **冲突队列**: 数据变更冲突处理
- **待确认项**: 需要人工确认的数据变更
- **补偿日志**: 异常处理和补偿操作记录

### 核心机制
- **字段映射版本**: 跟踪每个商品的字段版本历史
- **冲突队列**: 自动检测数据变更冲突，支持人工处理
- **确认回写**: 待确认数据经过人工确认后回写
- **重复同步幂等**: 通过 idempotency_key 保证重复请求不产生重复数据
- **脏数据检测**: 自动检测缺失字段和数据格式问题
- **目录报告**: 生成同步统计报告和Excel导出

### API 接口
- **创建操作**: 供应商、商品、目录、映射、批量导入
- **查询操作**: 列表查询、详情查询、分页支持
- **状态推进**: 冲突解决、待确认项处理
- **异常处理**: 补偿日志记录
- **导出功能**: Excel报告导出

## 技术栈

### 后端
- **框架**: FastAPI
- **数据库**: SQLite (可扩展至 PostgreSQL/MySQL)
- **ORM**: SQLAlchemy 2.0
- **数据验证**: Pydantic 2.0
- **Excel处理**: Pandas + OpenPyXL

### 前端
- **框架**: React 18 + TypeScript
- **UI组件**: Ant Design 5
- **路由**: React Router DOM 6
- **HTTP客户端**: Axios
- **构建工具**: Vite
- **Excel处理**: XLSX (SheetJS)

## 快速开始

### 后端启动

1. 进入后端目录
```bash
cd backend
```

2. 创建虚拟环境并安装依赖
```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

3. 配置环境变量
```bash
cp .env.example .env
# 编辑 .env 文件配置
```

4. 启动服务
```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

API文档地址: http://localhost:8000/docs

### 前端启动

1. 进入前端目录
```bash
cd frontend
```

2. 安装依赖
```bash
npm install
```

3. 启动开发服务器
```bash
npm run dev
```

访问地址: http://localhost:3000

## 核心流程说明

### 1. 批量导入流程

**接口**: `POST /api/sync/import`

```json
{
  "supplier_id": 1,
  "idempotency_key": "import_20240115_v1",
  "products": [
    {"sku": "P001", "name": "商品1", "price": 100},
    {"sku": "P002", "name": "商品2", "price": 200}
  ]
}
```

**幂等性保证**: 使用相同的 `idempotency_key` 重复调用不会创建重复数据，系统会直接返回已存在的批次。

**脏数据检测**: 系统自动检查必填字段（sku, name）和数据格式（如价格必须为正数），标记脏数据。

### 2. 冲突处理流程

当导入的商品已存在且数据发生变化时：
1. 系统自动创建冲突记录
2. 在"冲突处理"页面可以查看新旧值对比
3. 选择"应用新值"或"保留旧值"
4. 处理后字段版本号自动 +1

**接口**: `PUT /api/sync/conflicts/{id}/resolve`

### 3. 待确认项处理流程

对于重要的数据变更，系统会创建待确认项：
1. 在"冲突处理" -> "待确认项"标签页查看
2. 可以选择"接受建议值"或"保留当前值"
3. 确认后数据自动更新

**接口**: `PUT /api/sync/pending/{id}/confirm`

### 4. 映射时间线

每个映射关系的变更都会记录时间线，包括：
- 创建时间
- 修改记录
- 操作人信息

**接口**: `GET /api/mappings/{id}/timeline`

### 5. 报告生成与导出

生成同步报告，包含：
- 批次汇总统计
- 成功/失败/冲突数量
- 冲突详情列表
- 待确认项列表

支持导出为 Excel 文件。

## 数据模型关系图

```
供应商 (Supplier)
  ├── 供应商商品 (SupplierProduct) [1:N]
  │     ├── 映射关系 (ProductMapping) [1:N]
  │     └── 冲突记录 (ConflictItem) [1:N]
  │
  └── 同步批次 (SyncBatch) [1:N]
        ├── 冲突记录 (ConflictItem) [1:N]
        └── 待确认项 (PendingConfirmation) [1:N]

内部目录 (InternalCatalog)
  └── 映射关系 (ProductMapping) [1:N]

映射规则 (MappingRule)
  └── 映射关系 (ProductMapping) [1:N]

映射关系 (ProductMapping)
  └── 时间线 (MappingTimeline) [1:N]
```

## API 端点列表

### 供应商管理
- `GET /api/suppliers/` - 获取供应商列表
- `GET /api/suppliers/{id}` - 获取供应商详情
- `POST /api/suppliers/` - 创建供应商
- `PUT /api/suppliers/{id}` - 更新供应商

### 商品管理
- `GET /api/products/supplier/{supplier_id}` - 获取供应商商品列表
- `GET /api/products/{id}` - 获取商品详情

### 内部目录
- `GET /api/catalog/` - 获取内部目录列表
- `GET /api/catalog/{id}` - 获取目录项详情
- `POST /api/catalog/` - 创建目录项

### 映射管理
- `GET /api/mappings/` - 获取映射列表
- `GET /api/mappings/{id}` - 获取映射详情
- `GET /api/mappings/{id}/timeline` - 获取映射时间线
- `POST /api/mappings/` - 创建映射
- `PUT /api/mappings/{id}` - 更新映射
- `GET /api/mappings/rules/` - 获取映射规则
- `POST /api/mappings/rules/` - 创建映射规则

### 同步管理
- `POST /api/sync/import` - 批量导入商品
- `GET /api/sync/batches/` - 获取同步批次列表
- `GET /api/sync/batches/{batch_id}` - 获取批次详情
- `GET /api/sync/batches/{batch_id}/conflicts` - 获取批次冲突
- `GET /api/sync/conflicts/` - 获取冲突列表
- `PUT /api/sync/conflicts/{id}/resolve` - 解决冲突
- `GET /api/sync/pending/` - 获取待确认项
- `PUT /api/sync/pending/{id}/confirm` - 确认待处理项
- `POST /api/sync/report` - 生成报告
- `POST /api/sync/report/export` - 导出Excel报告

## 测试场景建议

### 1. 幂等性测试
- 使用相同的 `idempotency_key` 发送两次导入请求
- 验证只产生一个批次记录

### 2. 冲突检测测试
- 导入相同 SKU 但不同数据的商品
- 验证冲突记录被正确创建
- 验证字段版本号递增

### 3. 脏数据检测测试
- 导入缺少 sku 或 name 的商品
- 导入价格为负数的商品
- 验证 `is_dirty` 标记为 True

### 4. 补偿机制测试
- 在导入过程中模拟异常
- 验证补偿日志被正确记录
- 可通过补偿日志进行重试

### 5. 报告导出测试
- 导入多批次数据
- 生成报告并验证统计数据正确性
- 导出 Excel 并验证内容

## 项目结构

```
.
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py              # FastAPI 主入口
│   │   ├── database.py          # 数据库配置
│   │   ├── models.py            # SQLAlchemy 模型
│   │   ├── schemas.py           # Pydantic 模型
│   │   ├── services.py          # 业务逻辑
│   │   └── routers/             # API 路由
│   │       ├── suppliers.py
│   │       ├── products.py
│   │       ├── catalog.py
│   │       ├── mappings.py
│   │       └── sync.py
│   ├── requirements.txt
│   ├── .env.example
│   └── supplier_mapping.db      # SQLite数据库（运行后生成）
├── frontend/
│   ├── src/
│   │   ├── api.ts               # API 客户端
│   │   ├── App.tsx              # 主应用组件
│   │   ├── main.tsx             # 入口文件
│   │   └── pages/               # 页面组件
│   │       ├── Suppliers.tsx    # 供应商管理
│   │       ├── Products.tsx     # 供应商商品
│   │       ├── Catalog.tsx      # 内部目录
│   │       ├── Mappings.tsx     # 映射管理
│   │       ├── SyncBatches.tsx  # 同步批次
│   │       ├── Conflicts.tsx    # 冲突处理
│   │       └── Reports.tsx      # 报表导出
│   ├── package.json
│   ├── tsconfig.json
│   ├── vite.config.ts
│   └── index.html
└── README.md
```

## 扩展建议

1. **用户认证**: 添加 JWT 认证，支持多用户登录和权限控制
2. **消息队列**: 使用 Redis/RabbitMQ 处理异步导入任务
3. **数据质量规则**: 可配置的数据质量检查规则
4. **自动映射**: 基于机器学习的商品自动匹配
5. **Webhook**: 数据变更时通知外部系统
6. **审计日志**: 完整的操作审计记录
