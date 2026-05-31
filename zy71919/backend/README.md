# 环境音素材检索系统 - 后端

## 技术栈
- Python 3.9+
- FastAPI 0.109.x
- SQLAlchemy 2.0.x
- SQLite 3
- pandas + openpyxl

## 快速开始

### 1. 安装依赖
```bash
cd backend
pip3 install -r requirements.txt
```

### 2. 初始化数据库
```bash
python3 scripts/init_db.py
```

### 3. 插入测试数据 (可选)
```bash
python3 scripts/seed_data.py
```

### 4. 启动服务
```bash
# 方式1: 使用启动脚本
chmod +x run.sh
./run.sh

# 方式2: 直接启动
python3 -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

### 5. 访问 API 文档
- Swagger UI: http://localhost:8000/docs
- ReDoc: http://localhost:8000/redoc

## API 接口

### 素材管理
- `GET /api/v1/audio-tracks` - 获取原始音轨列表
- `GET /api/v1/audio-tracks/{id}` - 获取原始音轨详情
- `GET /api/v1/ad-scripts` - 获取广告口播表列表
- `GET /api/v1/ad-scripts/{id}` - 获取广告口播表详情
- `GET /api/v1/sound-materials` - 获取环境音素材列表
- `GET /api/v1/sound-materials/{id}` - 获取环境音素材详情
- `GET /api/v1/sound-materials/{id}/trace` - 获取素材溯源链路
- `GET /api/v1/matches` - 获取匹配结果列表
- `POST /api/v1/matches/auto-match` - 执行自动匹配
- `PUT /api/v1/matches/{id}` - 更新匹配关系
- `POST /api/v1/matches/batch-confirm` - 批量确认匹配
- `POST /api/v1/matches/batch-reject` - 批量驳回匹配

### 导入管理
- `POST /api/v1/audio-tracks/import` - 批量导入原始音轨
- `POST /api/v1/ad-scripts/import` - 批量导入广告口播表
- `POST /api/v1/sound-materials/import` - 批量导入环境音素材
- `GET /api/v1/import/batches` - 获取导入批次列表
- `GET /api/v1/import/batches/{id}` - 获取导入批次详情

### 导出管理
- `POST /api/v1/export/preview` - 导出预览（含一致性校验）
- `POST /api/v1/export` - 导出上线清单
- `GET /api/v1/export/records` - 获取导出记录列表
- `GET /api/v1/export/records/{id}/download` - 下载导出文件
- `GET /api/v1/export/records/{id}/verify` - 验证导出一致性

### 历史追溯
- `GET /api/v1/history` - 获取操作历史列表
- `GET /api/v1/history/{id}` - 获取操作历史详情
- `GET /api/v1/trace/{trace_id}` - 根据溯源ID追溯

## 核心特性

### 1. 幂等性保障
- 客户端请求携带 `X-Idempotency-Key` 请求头
- 服务端缓存响应，相同请求重复调用返回相同结果
- 数据库唯一约束防止重复数据

### 2. 溯源机制
- 每条数据携带 `trace_id` (ULID格式)
- 支持从素材追溯到匹配关系、广告口播、原始音轨
- 支持通过 `trace_id` 跨表追溯

### 3. 数据一致性
- 导出前校验屏幕显示数量与后端查询数量一致性
- 记录导出时的筛选条件哈希
- 支持历史导出数据一致性验证

### 4. 批量处理
- 支持批量导入原始音轨、广告口播、环境音素材
- 支持批量确认/驳回匹配结果
- 导入自动去重，重复数据不会重复入库

## 目录结构
```
backend/
├── app/
│   ├── __init__.py
│   ├── main.py                    # 应用入口
│   ├── api/
│   │   ├── __init__.py
│   │   └── v1/
│   │       ├── __init__.py
│   │       ├── router.py          # 路由聚合
│   │       ├── materials.py       # 素材管理API
│   │       ├── imports.py         # 导入管理API
│   │       ├── exports.py         # 导出管理API
│   │       ├── history.py         # 历史追溯API
│   │       └── health.py         # 健康检查API
│   ├── core/
│   │   ├── __init__.py
│   │   ├── config.py              # 配置管理
│   │   └── database.py            # 数据库连接
│   ├── models/
│   │   ├── __init__.py
│   │   └── models.py              # 数据模型
│   ├── schemas/
│   │   ├── __init__.py
│   │   ├── common.py              # 通用schema
│   │   ├── materials.py           # 素材schema
│   │   └── export.py              # 导出schema
│   ├── services/
│   │   ├── __init__.py
│   │   ├── material_service.py    # 素材管理服务
│   │   ├── import_service.py      # 导入服务
│   │   ├── export_service.py      # 导出服务
│   │   ├── history_service.py     # 历史服务
│   │   └── trace_service.py       # 溯源服务
│   ├── middleware/
│   │   ├── __init__.py
│   │   ├── request_id.py          # 请求ID中间件
│   │   └── idempotency.py         # 幂等性中间件
│   └── utils/
│       ├── __init__.py
│       └── common.py              # 工具函数
├── data/                          # 数据库文件目录
├── uploads/                       # 上传文件目录
├── exports/                       # 导出文件目录
├── scripts/
│   ├── init_db.py                 # 数据库初始化脚本
│   └── seed_data.py               # 测试数据脚本
├── requirements.txt
├── run.sh                         # 启动脚本
└── README.md
```
