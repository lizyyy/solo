# Webhook 夹具录制可重放系统

对接方只给一次真实回调，后续调试没有稳定夹具可以反复重放？这个系统就是为了解决这个问题！

## 功能特性

- ✅ HTTP 请求完整记录（方法、URL、头、载荷）
- ✅ 签名头独立保存，便于签名验证调试
- ✅ 载荷自动规范化（JSON 键排序）
- ✅ 状态机管理（pending → recorded → normalized → verified → replay_ready → replayed → closed/withdrawn）
- ✅ 人工修正功能，支持修正签名和载荷
- ✅ 异常路径记录，保留原始输入、处理人、结论
- ✅ 可执行重放脚本生成
- ✅ 录制报告导出
- ✅ SQLite 持久化存储

## 快速启动

### 1. 安装依赖

```bash
pip install -r requirements.txt

# 或者使用 poetry
poetry install
```

### 2. 启动服务

```bash
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

服务启动后访问:
- API 文档: http://localhost:8000/docs
- 健康检查: http://localhost:8000/health

## 造数脚本

项目内置造数脚本，快速生成演示数据：

```bash
# 生成 5 个夹具（默认）
python scripts/seed_data.py

# 生成 10 个夹具
python scripts/seed_data.py 10
```

脚本会自动：
- 创建 5 种不同类型的 webhook 事件
- 生成真实的 HMAC 签名
- 演示状态推进
- 生成录制报告和重放脚本

## CURL 主流程

### 1. 创建夹具

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/" \
  -H "Content-Type: application/json" \
  -d '{
    "request_method": "POST",
    "request_url": "https://api.example.com/webhook",
    "request_headers": {
      "Content-Type": "application/json",
      "User-Agent": "Webhook-Client/1.0"
    },
    "signature_headers": {
      "X-Signature": "sha256=abc123def456",
      "X-Timestamp": "1620000000"
    },
    "raw_payload": "{\"event_type\":\"payment.completed\",\"data\":{\"id\":\"pay_123\",\"amount\":100.00}}",
    "handler": "debugger"
  }'
```

### 2. 查询夹具列表

```bash
# 查询所有
curl "http://localhost:8000/api/v1/fixtures/"

# 按状态过滤
curl "http://localhost:8000/api/v1/fixtures/?status=recorded"

# 分页
curl "http://localhost:8000/api/v1/fixtures/?skip=0&limit=10"
```

### 3. 查询单个夹具详情

```bash
curl "http://localhost:8000/api/v1/fixtures/{fixture_id}/"
```

### 4. 状态推进

```bash
curl -X PATCH "http://localhost:8000/api/v1/fixtures/{fixture_id}/status/" \
  -H "Content-Type: application/json" \
  -d '{
    "status": "normalized",
    "handler": "tester"
  }'
```

状态流转:
```
pending → recorded → normalized → verified → replay_ready → replayed → closed
                                                          ↳ withdrawn
```

### 5. 人工修正

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/fix/" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_headers": {"X-Signature": "corrected_signature_123"},
    "raw_payload": "{\"fixed\": true}",
    "handler": "debugger",
    "conclusion": "修正签名计算错误"
  }'
```

### 6. 撤回夹具

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/withdraw/?handler=admin&conclusion=数据无效"
```

### 7. 关闭夹具

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/close/?handler=admin"
```

### 8. 添加异常记录

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/exceptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "exception_type": "signature_mismatch",
    "raw_input": "expected: abc123, got: def456",
    "handler": "debugger",
    "conclusion": "需要重新计算签名"
  }'
```

异常类型:
- `signature_mismatch` - 签名不匹配
- `payload_invalid` - 载荷无效
- `timestamp_expired` - 时间戳过期
- `duplicate` - 重复回调
- `other` - 其他

### 9. 解决异常

```bash
curl -X PATCH "http://localhost:8000/api/v1/exceptions/{exception_id}/resolve/?conclusion=已修复&handler=debugger"
```

### 10. 生成录制报告

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/report/"
```

### 11. 生成重放脚本

```bash
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/replay-script/" \
  -H "Content-Type: application/json" \
  -d '{
    "target_url": "https://test.example.com/webhook"
  }'
```

生成的脚本保存在 `fixtures/{fixture_id}/replay_{fixture_id}.py`，直接执行即可重放：

```bash
python fixtures/{fixture_id}/replay_{fixture_id}.py
```

### 12. 导出夹具数据

```bash
curl "http://localhost:8000/api/v1/fixtures/{fixture_id}/export/" -o fixture_export.json
```

## 冲突路径处理

### 1. 重复回调处理

检测到相同事件 ID 的重复回调：

```bash
# 添加异常记录
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/exceptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "exception_type": "duplicate",
    "raw_input": "duplicate event_id: evt_001",
    "handler": "debugger"
  }'

# 人工标记撤回
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/withdraw/?handler=admin&conclusion=重复回调"
```

### 2. 签名冲突

签名验证失败但需要保留原始数据：

```bash
# 1. 记录异常
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/exceptions/" \
  -H "Content-Type: application/json" \
  -d '{
    "exception_type": "signature_mismatch",
    "raw_input": "HMAC verification failed",
    "handler": "debugger"
  }'

# 2. 人工修正签名
curl -X POST "http://localhost:8000/api/v1/fixtures/{fixture_id}/fix/" \
  -H "Content-Type: application/json" \
  -d '{
    "signature_headers": {"X-Signature": "correct_signature_here"},
    "handler": "debugger",
    "conclusion": "使用正确的密钥重新计算签名"
  }'
```

### 3. 并发状态更新

多个处理人同时更新状态：后写入的状态生效。系统会记录每次更新的 handler：

```bash
# Handler A 更新状态
curl -X PATCH "http://localhost:8000/api/v1/fixtures/{fixture_id}/status/" \
  -H "Content-Type: application/json" \
  -d '{"status": "normalized", "handler": "handlerA"}'

# Handler B 同时更新
curl -X PATCH "http://localhost:8000/api/v1/fixtures/{fixture_id}/status/" \
  -H "Content-Type: application/json" \
  -d '{"status": "verified", "handler": "handlerB"}'

# 最终状态以最后一次更新为准
curl "http://localhost:8000/api/v1/fixtures/{fixture_id}/"
```

## Pytest 测试

### 运行所有测试

```bash
# 基础运行
pytest

# 详细输出
pytest -v

# 显示覆盖率
pytest --cov=app --cov-report=term-missing

# 运行特定测试文件
pytest tests/test_fixtures.py -v

# 运行特定测试类
pytest tests/test_fixtures.py::TestFixtureCreate -v

# 运行单个测试用例
pytest tests/test_fixtures.py::TestFixtureCreate::test_create_fixture_success -v
```

### 测试用例覆盖

- ✅ **夹具创建**: 成功创建、载荷规范化、无效 JSON 处理
- ✅ **夹具查询**: 按 ID 查询、列表查询、状态过滤
- ✅ **状态管理**: 状态更新、404 处理
- ✅ **操作功能**: 人工修正、撤回、关闭
- ✅ **异常处理**: 添加异常、解决异常
- ✅ **报告导出**: 生成报告、重放脚本、数据导出
- ✅ **冲突场景**: 夹具 ID 唯一性、并发状态更新
- ✅ **健康检查**: 服务健康状态

## 目录结构

```
webhook-fixture/
├── app/                          # 应用代码
│   ├── __init__.py
│   ├── config.py                # 配置管理
│   ├── database.py              # 数据库模型和连接
│   ├── schemas.py               # Pydantic 模型
│   ├── services.py              # 业务逻辑
│   └── main.py                  # FastAPI 主入口
├── tests/                       # 测试用例
│   ├── __init__.py
│   ├── conftest.py              # pytest 配置
│   └── test_fixtures.py         # 夹具测试
├── scripts/                     # 工具脚本
│   ├── __init__.py
│   └── seed_data.py             # 造数脚本
├── fixtures/                    # 夹具文件存储
├── reports/                     # 报告文件存储
├── requirements.txt             # Python 依赖
├── pyproject.toml               # Poetry 配置
└── README.md                    # 本文档
```

## 夹具文件结构

每个夹具在 `fixtures/{fixture_id}/` 目录下包含：

```
fixtures/fixture_20240115_120000_abc123/
├── signature_headers.json       # 签名头 JSON
├── raw_payload.txt              # 原始载荷
├── normalized_payload.txt       # 规范化载荷
├── payload_hash.sha256         # 载荷哈希
└── replay_{fixture_id}.py      # 重放脚本
```

## 状态说明

| 状态 | 说明 |
|------|------|
| pending | 待处理 |
| recorded | 已录制 |
| normalized | 已规范化 |
| verified | 已验证 |
| replay_ready | 可重放 |
| replayed | 已重放 |
| closed | 已关闭 |
| withdrawn | 已撤回 |

## 开发说明

### 添加新的异常类型

在 `app/database.py` 中的 `FixtureExceptionType` 枚举添加新类型。

### 添加新的状态

在 `app/database.py` 中的 `FixtureStatus` 枚举添加新状态。

### 修改规范化逻辑

修改 `app/services.py` 中的 `normalize_payload` 函数。

## License

MIT
