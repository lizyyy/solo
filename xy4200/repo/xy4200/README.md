# 陶片拼接复核站

考古发掘队本地 REST API 服务，用于陶片档案管理、拼接组维护、规则校验和人工复核。

## 功能特性

### 核心功能
- **陶片档案管理**: CRUD 操作，支持版本控制
- **拼接组管理**: 创建、提交、撤回、维护陶片组合
- **规则校验引擎**: 自动检测层位冲突、标签冲突、照片缺失等问题
- **状态机管理**: 规范的陶片和拼接组状态流转
- **审计日志**: 完整记录所有操作历史
- **数据导出**: 支持 Markdown 复核单、CSV 问题表、JSON 审计包

### 校验规则
1. **探方层位一致性检查**: 确保同一拼接组内陶片来自同一探方和层位
2. **边缘尺寸误差校验**: 检查拼接边缘尺寸是否在容限范围内
3. **纹饰/胎土标签冲突检测**: 校验纹饰和胎土类型是否一致
4. **照片缺失检查**: 检测陶片是否缺少照片
5. **拼接组闭环检测**: 检查拼接组逻辑完整性
6. **陶片重复引用检测**: 防止同一陶片被多组引用
7. **拼接组大小校验**: 确保拼接组非空且不超过最大限制

## 项目结构

```
xy4200/
├── app.py                 # 主应用入口
├── config.py              # 配置文件
├── requirements.txt       # 依赖包
├── models/                # 数据模型
│   ├── __init__.py
│   ├── pottery.py         # 陶片模型
│   ├── splice_group.py    # 拼接组模型
│   ├── audit_log.py       # 审计日志模型
│   ├── issue.py           # 问题记录模型
│   └── version.py         # 版本控制模型
├── services/              # 业务逻辑
│   ├── __init__.py
│   ├── import_parser.py   # 导入解析器
│   ├── rule_engine.py     # 规则引擎
│   ├── state_machine.py   # 状态机
│   ├── version_manager.py # 版本管理器
│   ├── audit_service.py   # 审计服务
│   └── export_service.py  # 导出服务
├── routes/                # REST API 路由
│   ├── __init__.py
│   ├── pottery_routes.py  # 陶片路由
│   ├── group_routes.py    # 拼接组路由
│   ├── import_routes.py   # 导入路由
│   ├── export_routes.py   # 导出路由
│   └── review_routes.py   # 复核路由
├── sample_data/           # 示例数据
│   ├── __init__.py
│   ├── init_db.py         # 数据库初始化脚本
│   ├── pottery_samples.json
│   ├── pottery_samples.csv
│   └── group_samples.json
├── tests/                 # 测试用例
│   ├── __init__.py
│   ├── conftest.py        # pytest 配置
│   ├── test_models.py     # 模型测试
│   ├── test_rule_engine.py # 规则引擎测试
│   ├── test_state_machine.py # 状态机测试
│   ├── test_import_parser.py # 导入解析测试
│   └── test_routes.py     # 路由测试
└── uploads/               # 上传文件目录
└── exports/               # 导出文件目录
```

## 快速开始

### 1. 环境准备

```bash
# 创建虚拟环境
python3 -m venv venv
source venv/bin/activate

# 安装依赖
pip install -r requirements.txt
```

### 2. 初始化数据库

```bash
# 创建数据库表（首次运行）
python -c "from app import create_app, db; app = create_app(); app.app_context().push(); db.create_all()"

# 导入示例数据
python -m sample_data.init_db
```

### 3. 启动服务

```bash
# 开发模式
export FLASK_APP=app.py
export FLASK_ENV=development
flask run --host=0.0.0.0 --port=5000

# 或者直接运行
python app.py
```

服务启动后访问: http://localhost:5000

## API 端点

### 陶片管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/pottery` | 获取陶片列表 |
| GET | `/api/pottery/<pottery_id>` | 获取单个陶片 |
| POST | `/api/pottery` | 创建陶片 |
| PUT | `/api/pottery/<pottery_id>` | 更新陶片 |
| DELETE | `/api/pottery/<pottery_id>` | 删除陶片 |
| POST | `/api/pottery/<pottery_id>/validate` | 校验陶片 |
| GET | `/api/pottery/<pottery_id>/versions` | 获取版本历史 |

### 拼接组管理

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/groups` | 获取拼接组列表 |
| POST | `/api/groups` | 创建拼接组 |
| GET | `/api/groups/<group_id>` | 获取单个拼接组 |
| PUT | `/api/groups/<group_id>` | 更新拼接组 |
| DELETE | `/api/groups/<group_id>` | 删除拼接组 |
| POST | `/api/groups/<group_id>/submit` | 提交拼接组 |
| POST | `/api/groups/<group_id>/withdraw` | 撤回拼接组 |
| POST | `/api/groups/<group_id>/validate` | 校验拼接组 |

### 导入功能

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | `/api/import/preview` | 预览导入数据 |
| POST | `/api/import/pottery` | 导入陶片数据 |
| POST | `/api/import/group` | 导入拼接组数据 |

### 导出功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/review-form/<group_id>` | 导出 Markdown 复核单 |
| GET | `/api/export/issues` | 导出 CSV 问题表 |
| GET | `/api/export/audit` | 导出 JSON 审计包 |
| GET | `/api/export/potteries` | 导出陶片数据 |
| GET | `/api/export/groups` | 导出拼接组数据 |

### 复核功能

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/review/rules` | 列出所有规则 |
| POST | `/api/review/validate/all` | 全量校验 |
| POST | `/api/review/group/<group_id>/start` | 开始复核 |
| POST | `/api/review/group/<group_id>/approve` | 审核通过 |
| POST | `/api/review/group/<group_id>/reject` | 审核驳回 |
| POST | `/api/review/group/<group_id>/send-back` | 退回修改 |
| GET | `/api/review/issues` | 问题列表 |
| POST | `/api/review/issues/<id>/resolve` | 解决问题 |
| GET | `/api/review/audit-logs` | 审计日志 |
| GET | `/api/review/state-flow` | 状态流转图 |

## Curl 验证流程

### 1. 基础验证

```bash
# 检查服务是否运行
curl http://localhost:5000/api/pottery
```

### 2. 陶片操作

```bash
# 创建陶片
curl -X POST http://localhost:5000/api/pottery \
  -H "Content-Type: application/json" \
  -d '{
    "pottery_id": "TP-CURL-001",
    "trench": "T01",
    "layer": "L03",
    "square": "A1",
    "length": 15.2,
    "width": 8.5,
    "thickness": 0.8,
    "decoration": "绳纹",
    "paste_type": "夹砂红陶",
    "photo_path": "/photos/test.jpg",
    "notes": "curl测试陶片"
  }'

# 获取陶片列表
curl http://localhost:5000/api/pottery

# 获取单个陶片
curl http://localhost:5000/api/pottery/TP-CURL-001

# 更新陶片
curl -X PUT http://localhost:5000/api/pottery/TP-CURL-001 \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "更新后的备注",
    "status": "under_review"
  }'
```

### 3. 拼接组操作

```bash
# 创建陶片1
curl -X POST http://localhost:5000/api/pottery \
  -H "Content-Type: application/json" \
  -d '{
    "pottery_id": "TP-GROUP-001",
    "trench": "T01",
    "layer": "L03",
    "decoration": "绳纹",
    "paste_type": "夹砂红陶",
    "photo_path": "/photos/g1.jpg"
  }'

# 创建陶片2
curl -X POST http://localhost:5000/api/pottery \
  -H "Content-Type: application/json" \
  -d '{
    "pottery_id": "TP-GROUP-002",
    "trench": "T01",
    "layer": "L03",
    "decoration": "绳纹",
    "paste_type": "夹砂红陶",
    "photo_path": "/photos/g2.jpg"
  }'

# 创建拼接组
curl -X POST http://localhost:5000/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "SG-CURL-001",
    "name": "curl测试拼接组",
    "description": "用于测试的拼接组",
    "guess_evidence": "同探方同层位同纹饰",
    "pottery_ids": ["TP-GROUP-001", "TP-GROUP-002"]
  }'

# 获取拼接组列表
curl http://localhost:5000/api/groups

# 提交拼接组
curl -X POST http://localhost:5000/api/groups/SG-CURL-001/submit

# 撤回拼接组
curl -X POST http://localhost:5000/api/groups/SG-CURL-001/withdraw
```

### 4. 规则校验

```bash
# 获取所有规则
curl http://localhost:5000/api/review/rules

# 校验单个拼接组
curl -X POST http://localhost:5000/api/groups/SG-CURL-001/validate

# 全量校验
curl -X POST http://localhost:5000/api/review/validate/all
```

### 5. 测试规则冲突检测

```bash
# 创建层位冲突的拼接组（用于测试规则引擎）

# 创建不同层位的陶片
curl -X POST http://localhost:5000/api/pottery \
  -H "Content-Type: application/json" \
  -d '{
    "pottery_id": "TP-LAYER-TEST-001",
    "trench": "T01",
    "layer": "L03",
    "decoration": "绳纹",
    "paste_type": "夹砂红陶",
    "photo_path": "/photos/lt1.jpg"
  }'

curl -X POST http://localhost:5000/api/pottery \
  -H "Content-Type: application/json" \
  -d '{
    "pottery_id": "TP-LAYER-TEST-002",
    "trench": "T01",
    "layer": "L04",
    "decoration": "绳纹",
    "paste_type": "夹砂红陶",
    "photo_path": "/photos/lt2.jpg"
  }'

# 创建包含不同层位陶片的拼接组
curl -X POST http://localhost:5000/api/groups \
  -H "Content-Type: application/json" \
  -d '{
    "group_id": "SG-LAYER-CONFLICT",
    "name": "层位冲突测试组",
    "description": "用于测试层位冲突检测",
    "guess_evidence": "测试用",
    "pottery_ids": ["TP-LAYER-TEST-001", "TP-LAYER-TEST-002"]
  }'

# 校验该拼接组（应该检测到层位冲突）
curl -X POST http://localhost:5000/api/groups/SG-LAYER-CONFLICT/validate
```

### 6. 复核流程

```bash
# 假设已有提交的拼接组 SG-CURL-002

# 开始复核
curl -X POST http://localhost:5000/api/review/group/SG-CURL-002/start \
  -H "Content-Type: application/json" \
  -d '{"reviewer": "张三"}'

# 审核通过
curl -X POST http://localhost:5000/api/review/group/SG-CURL-002/approve \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "张三",
    "notes": "层位一致，纹饰胎土匹配，拼接证据充分"
  }'

# 或者审核驳回
curl -X POST http://localhost:5000/api/review/group/SG-CURL-002/reject \
  -H "Content-Type: application/json" \
  -d '{
    "reviewer": "张三",
    "notes": "边缘尺寸不匹配，需要重新核实"
  }'
```

### 7. 导出功能

```bash
# 导出复核单
curl -o review-form.md http://localhost:5000/api/export/review-form/SG-CURL-001

# 导出问题表
curl -o issues.csv http://localhost:5000/api/export/issues

# 导出审计包
curl -o audit-package.json http://localhost:5000/api/export/audit

# 导出陶片数据
curl -o potteries.json http://localhost:5000/api/export/potteries

# 导出拼接组数据
curl -o groups.json http://localhost:5000/api/export/groups
```

### 8. 问题管理和审计查询

```bash
# 获取问题列表
curl http://localhost:5000/api/review/issues

# 获取审计日志
curl http://localhost:5000/api/review/audit-logs

# 获取状态流转图
curl http://localhost:5000/api/review/state-flow
```

## 测试

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_rule_engine.py -v

# 运行带覆盖率的测试
pytest --cov=. tests/
```

### 测试覆盖

- `test_models.py`: 数据模型创建、查询、更新
- `test_rule_engine.py`: 规则引擎校验逻辑
- `test_state_machine.py`: 状态机转换逻辑
- `test_import_parser.py`: CSV/JSON 导入解析
- `test_routes.py`: API 路由端点测试

## 配置说明

在 `config.py` 中可以调整以下参数：

```python
class Config:
    SQLALCHEMY_DATABASE_URI = 'sqlite:///pottery.db'
    SQLALCHEMY_TRACK_MODIFICATIONS = False
    
    UPLOAD_FOLDER = 'uploads'
    EXPORT_FOLDER = 'exports'
    
    RULE_CONFIG = {
        'edge_size_tolerance': 0.2,
        'max_group_size': 100,
        'min_group_size': 1
    }
```

## 状态机说明

### 陶片状态流转

```
pending ──start_review──> under_review
   │                           │
   │                    ┌──────┴──────┐
   │                    │             │
   │                approve         reject
   │                    │             │
   │                    v             v
   │                 approved      rejected
   │                    │
   └─archive────────────┴─archive──────────> archived
```

### 拼接组状态流转

```
draft ──submit──> submitted
  │                   │
  │            ┌──────┴──────┐
  │            │             │
  │         withdraw      start_review
  │            │             │
  │            v             v
  │        withdrawn     under_review
  │                           │
  │                    ┌──────┴──────┐
  │                    │             │
  │                approve         reject
  │                    │             │
  │                    v             v
  │                 approved      rejected
  │                    │
  └─archive────────────┴─archive──────────> archived
```

## 注意事项

1. 本服务设计为本地使用，暂未实现用户认证机制
2. 数据库使用 SQLite，适合单用户本地部署
3. 照片存储路径为相对路径，需确保文件实际存在
4. 规则校验结果仅供参考，最终复核需人工确认

## 许可证

MIT License
