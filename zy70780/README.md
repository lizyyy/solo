# Lockfile包来源哈希校验后端API

用于安全审计 lockfile 中包的来源 registry 和完整性哈希校验的后端服务。

## 核心功能

- **Lockfile 解析**: 支持 package-lock.json, yarn.lock, pnpm-lock.yaml, poetry.lock, Pipfile.lock
- **Registry 归并**: 自动识别并归并包来源 registry
- **哈希校验**: 从官方 registry 验证包的完整性哈希
- **异常来源标记**: 标记 registry 冲突和哈希不匹配的包
- **报告导出**: 完整的审计报告导出功能
- **人工修正**: 支持手工修正和处理记录
- **撤回/关闭**: 审计流程状态管理

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

或者使用 pyproject.toml:

```bash
pip install -e ".[dev]"
```

### 2. 启动服务

```bash
python main.py
```

服务将在 http://localhost:8000 启动

API 文档: http://localhost:8000/docs

### 3. 验证启动

```bash
curl http://localhost:8000/health
```

## 主流程 Curl 示例

### 步骤 1: 创建审计任务

```bash
curl -X POST http://localhost:8000/api/audits \
  -H "Content-Type: application/json" \
  -d '{
    "name": "my-project-audit",
    "lockfile_type": "package-lock.json",
    "created_by": "security-audit",
    "notes": "Q3 安全审计",
    "content": '{\"name\":\"test\",\"lockfileVersion\":2,\"packages\":{\"node_modules/express\":{\"version\":\"4.18.2\",\"resolved\":\"https://registry.npmjs.org/express/-/express-4.18.2.tgz\",\"integrity\":\"sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==\"}}}}'
  }'
```

### 步骤 2: 查询审计列表

```bash
curl http://localhost:8000/api/audits
```

### 步骤 3: 执行哈希校验

```bash
curl -X POST http://localhost:8000/api/audits/1/verify
```

### 步骤 4: 查询审计详情

```bash
curl http://localhost:8000/api/audits/1
```

### 步骤 5: 导出审计报告

```bash
curl -O http://localhost:8000/api/audits/1/export
```

## 人工修正流程

### 手工修正包来源

```bash
curl -X POST http://localhost:8000/api/audits/1/correct \
  -H "Content-Type: application/json" \
  -d '{
    "package_name": "express",
    "version": "4.18.2",
    "correct_registry": "https://registry.npmjs.org",
    "correct_hash": "sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ==",
    "handler": "security-engineer",
    "reason": "确认来源合法，属于内部镜像差异"
  }'
```

## 冲突处理流程

### 1. 更新异常状态

```bash
curl -X PATCH http://localhost:8000/api/exceptions/1 \
  -H "Content-Type: application/json" \
  -d '{
    "handler": "security-engineer",
    "conclusion": "确认是公司私有包，使用内网 registry",
    "resolved": true
  }'
```

### 2. 推进审计状态

```bash
curl -X PATCH http://localhost:8000/api/audits/1/status \
  -H "Content-Type: application/json" \
  -d '{
    "status": "needs_review",
    "notes": "异常包已人工确认，待复核"
  }'
```

### 3. 关闭审计

```bash
curl -X DELETE "http://localhost:8000/api/audits/1/close?notes=审计完成，所有异常已处理"
```

## 造数脚本

创建测试数据 `scripts/generate_test_data.py`:

```python
import json
import sys
sys.path.insert(0, '.')

from main import app, parser
from database import SessionLocal
import schemas
import crud

db = SessionLocal()

# 创建一个 package-lock.json 测试内容
test_lockfile = {
    "name": "test-project",
    "lockfileVersion": 2,
    "packages": {
        "node_modules/express": {
            "version": "4.18.2",
            "resolved": "https://registry.npmjs.org/express/-/express-4.18.2.tgz",
            "integrity": "sha512-5/PsL6iGPdfQ/lKM1UuielYgv3BUoJfz1aUwU9vHZ+J7gyvwdQXFEBIEIaxeGf0GIcreATNyBExtalisDbuMqQ=="
        },
        "node_modules/lodash": {
            "version": "4.17.21",
            "resolved": "https://registry.npmjs.org/lodash/-/lodash-4.17.21.tgz",
            "integrity": "sha512-v2kDEe57lecTulaDIuNTPy3Ry4gLGJ6Z1O3vE1krgXZNrsQ+LFTGHVxVjcXPs17LhbZVGedAJv8XZ1tvj5FvSg=="
        },
        "node_modules/react": {
            "version": "18.2.0",
            "resolved": "https://registry.npmmirror.com/react/-/react-18.2.0.tgz",
            "integrity": "sha512-/3IjMdb2L9QbBdWiW5e3P2/npwMBaU9mHCSCUzNln0ZCYbcfTsGbTJrU/kGemdH2IWmB2ioZ+zkxtmq6g09fGQ=="
        },
        "node_modules/suspicious-pkg": {
            "version": "1.0.0",
            "resolved": "https://unknown-registry.com/suspicious-pkg/-/suspicious-pkg-1.0.0.tgz",
            "integrity": "sha512-fakehashfakehashfakehashfakehashfakehashfakehashfakehashfakehash=="
        }
    }
}

audit_create = schemas.LockfileAuditCreate(
    name="test-audit-001",
    lockfile_type="package-lock.json",
    content=json.dumps(test_lockfile),
    created_by="test-script",
    notes="自动生成的测试数据，包含正常包和异常包"
)

audit, _ = crud.create_lockfile_audit(db, audit_create)

packages, errors = parser.parse(audit_create.content, audit_create.lockfile_type)
for pkg in packages:
    package_create = schemas.PackageAuditCreate(**pkg)
    crud.create_package_audit(db, package_create, audit.id)

print(f"Created test audit with ID: {audit.id}")
print(f"Packages: {len(packages)}")
for pkg in packages:
    print(f"  - {pkg['package_name']}@{pkg['version']} from {pkg['registry']}")

db.close()
```

运行:

```bash
mkdir -p scripts
# 保存上面的脚本到 scripts/generate_test_data.py
python scripts/generate_test_data.py
```

## Pytest 测试

创建 `test_main.py`:

```bash
pytest test_main.py -v
```

## 项目结构

```
.
├── main.py              # FastAPI 应用入口
├── models.py            # SQLAlchemy 数据模型
├── schemas.py           # Pydantic 数据结构
├── crud.py              # 数据库 CRUD 操作
├── database.py          # 数据库连接配置
├── parser.py            # Lockfile 解析器
├── auditor.py           # 哈希校验审计器
├── pyproject.toml       # 项目配置
├── requirements.txt     # 依赖列表
├── test_main.py         # 测试用例
└── README.md            # 项目文档
```

## API 接口列表

| 方法 | 路径 | 描述 |
|------|------|------|
| POST | /api/audits | 创建审计任务 |
| GET | /api/audits | 查询审计列表 |
| GET | /api/audits/{id} | 获取审计详情 |
| PATCH | /api/audits/{id}/status | 更新审计状态 |
| POST | /api/audits/{id}/verify | 执行哈希校验 |
| POST | /api/audits/{id}/correct | 人工修正包信息 |
| DELETE | /api/audits/{id}/close | 关闭审计 |
| GET | /api/audits/{id}/export | 导出审计报告 |
| GET | /api/audits/{id}/exceptions | 获取异常列表 |
| PATCH | /api/exceptions/{id} | 更新异常处理 |
| GET | /health | 健康检查 |

## 状态枚举

### 审计状态 (AuditStatus)
- pending: 待处理
- processing: 处理中
- completed: 已完成
- needs_review: 待复核
- resolved: 已解决
- closed: 已关闭

### 包状态 (PackageStatus)
- normal: 正常
- abnormal: 异常
- conflict: 冲突
- unverified: 未校验
