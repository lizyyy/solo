# 测试健康门禁服务 (Test Health Gate)

一个本地后端服务，用于集中管理测试报告、覆盖率数据和 flaky 测试记录，提供模块/负责人维度的数据分析和健康门禁检查。

## 功能特性

- **测试报告导入**: 支持 pytest JUnit XML 格式
- **覆盖率分析**: 支持 coverage.py XML 格式，计算覆盖率缺口
- **Flaky 测试检测**: 解析 pytest-rerunfailures 日志，计算 flaky 风险
- **隔离名单管理**: 支持将不稳定用例加入/移出隔离名单，保留原因记录
- **多维度分析**: 按模块、负责人计算失败率、覆盖率缺口、flaky 风险
- **健康门禁**: 自动检查关键指标是否通过门禁
- **报告导出**: 支持 Markdown 报告和 JSON 明细导出

## 技术栈

- **语言**: Python 3.9+
- **框架**: Flask 3.0
- **ORM**: Flask-SQLAlchemy
- **数据库**: SQLite
- **XML 解析**: defusedxml (安全解析)

## 快速开始

### 1. 安装依赖

```bash
pip install -r requirements.txt
```

### 2. 启动服务

```bash
python run.py
```

服务将在 `http://localhost:5000` 启动。

### 3. 健康检查

```bash
curl http://localhost:5000/api/health
```

预期响应:
```json
{"status": "healthy", "message": "Test Health Gate is running"}
```

---

## 完整验证链 (Curl 示例)

以下是完整的验证流程，使用 `sample_data/` 目录下的示例数据。

### 步骤 1: 导入 pytest 测试报告

```bash
curl -X POST \
  http://localhost:5000/api/reports/import \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/pytest_report.xml" \
  -F "report_name=CI-Build-123" \
  -F "module=main" \
  -F "owner=team-a"
```

### 步骤 2: 导入覆盖率报告

```bash
curl -X POST \
  http://localhost:5000/api/coverage/import \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/coverage.xml" \
  -F "report_name=Coverage-Build-123"
```

### 步骤 3: 导入 flaky 重跑日志

```bash
curl -X POST \
  http://localhost:5000/api/flaky/import \
  -H "Content-Type: multipart/form-data" \
  -F "file=@sample_data/flaky_runs.log" \
  -F "ci_run_id=CI-123"
```

### 步骤 4: 查看所有测试报告

```bash
curl http://localhost:5000/api/reports
```

### 步骤 5: 查看失败的测试用例

```bash
curl "http://localhost:5000/api/reports/1/test-cases?status=failed"
```

### 步骤 6: 查看最新覆盖率

```bash
curl http://localhost:5000/api/coverage/latest
```

### 步骤 7: 查看低于目标覆盖率的文件

```bash
curl "http://localhost:5000/api/coverage/1/files?below_target=80"
```

### 步骤 8: 查看 flaky 测试列表

```bash
curl "http://localhost:5000/api/flaky?min_flaky_rate=30"
```

### 步骤 9: 将不稳定用例加入隔离名单

```bash
curl -X POST \
  http://localhost:5000/api/quarantine \
  -H "Content-Type: application/json" \
  -d '{
    "test_name": "auth.tests.test_login.TestLogin::test_locked_account",
    "reason": "Intermittent database connection timeout - needs investigation",
    "reason_category": "flaky_test",
    "module": "auth",
    "owner": "alice",
    "added_by": "devops",
    "expected_fix_date": "2024-02-01",
    "notes": "Happens 30% of the time during peak hours"
  }'
```

### 步骤 10: 查看隔离名单

```bash
curl http://localhost:5000/api/quarantine
```

### 步骤 11: 查看隔离名单统计

```bash
curl http://localhost:5000/api/quarantine/stats
```

### 步骤 12: 查看整体健康指标

```bash
curl "http://localhost:5000/api/metrics/overall?target_coverage=80&flaky_threshold=30"
```

### 步骤 13: 按模块查看指标

```bash
curl http://localhost:5000/api/metrics/by-module
```

### 步骤 14: 按负责人查看指标

```bash
curl http://localhost:5000/api/metrics/by-owner
```

### 步骤 15: 查看健康分数

```bash
curl "http://localhost:5000/api/metrics/health-score"
```

### 步骤 16: 执行健康门禁检查

```bash
curl "http://localhost:5000/api/export/health-gate?target_coverage=80&max_failure_rate=5&max_flaky_risk=50"
```

### 步骤 17: 预览 Markdown 报告

```bash
curl "http://localhost:5000/api/export/markdown/preview"
```

### 步骤 18: 下载 Markdown 报告

```bash
curl -o report.md "http://localhost:5000/api/export/markdown"
```

### 步骤 19: 下载 JSON 明细

```bash
curl -o details.json "http://localhost:5000/api/export/json?include_test_cases=true&include_coverage_files=true"
```

### 步骤 20: 将用例移出隔离名单

```bash
curl -X DELETE \
  "http://localhost:5000/api/quarantine/auth.tests.test_login.TestLogin::test_locked_account?deactivated_by=devops&deactivation_reason=Issue%20fixed%20in%20PR%20%23456"
```

---

## API 文档

### 测试报告 API (`/api/reports`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/reports` | 获取测试报告列表 |
| GET | `/api/reports/<id>` | 获取单个测试报告详情 |
| GET | `/api/reports/<id>/test-cases` | 获取报告中的测试用例 |
| POST | `/api/reports/import` | 导入 pytest XML 报告 |
| DELETE | `/api/reports/<id>` | 删除测试报告 |

**查询参数**:
- `module`: 按模块过滤
- `owner`: 按负责人过滤
- `limit`: 返回数量限制
- `status`: 测试用例状态过滤 (passed/failed/skipped/error)

### 覆盖率 API (`/api/coverage`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/coverage` | 获取覆盖率报告列表 |
| GET | `/api/coverage/<id>` | 获取单个覆盖率报告 |
| GET | `/api/coverage/<id>/files` | 获取覆盖率文件明细 |
| GET | `/api/coverage/latest` | 获取最新覆盖率报告 |
| POST | `/api/coverage/import` | 导入 coverage XML |
| DELETE | `/api/coverage/<id>` | 删除覆盖率报告 |

**查询参数**:
- `below_target`: 仅返回低于目标覆盖率的文件

### Flaky 测试 API (`/api/flaky`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/flaky` | 获取 flaky 测试列表 |
| GET | `/api/flaky/<id>` | 获取单个 flaky 记录 |
| GET | `/api/flaky/stats` | 获取 flaky 统计 |
| POST | `/api/flaky/import` | 导入 flaky 日志 |
| DELETE | `/api/flaky/<id>` | 删除 flaky 记录 |

**查询参数**:
- `min_flaky_rate`: 最小 flaky 率过滤
- `ci_run_id`: 按 CI 运行 ID 过滤

### 隔离名单 API (`/api/quarantine`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/quarantine` | 获取隔离名单 |
| GET | `/api/quarantine/<test_name>` | 检查单个用例状态 |
| GET | `/api/quarantine/stats` | 获取隔离统计 |
| POST | `/api/quarantine` | 加入隔离名单 |
| PUT | `/api/quarantine/<test_name>` | 更新隔离信息 |
| DELETE | `/api/quarantine/<test_name>` | 移出隔离名单 |

**查询参数**:
- `include_inactive`: 是否包含历史隔离记录
- `reason_category`: 按原因类别过滤

**请求体 (POST/PUT)**:
```json
{
  "test_name": "test_name",
  "reason": "隔离原因 (必填)",
  "reason_category": "flaky_test/environmental/known_issue",
  "module": "模块名",
  "owner": "负责人",
  "added_by": "添加人",
  "expected_fix_date": "预期修复日期",
  "notes": "备注"
}
```

### 指标 API (`/api/metrics`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/metrics` | 获取所有指标 |
| GET | `/api/metrics/overall` | 获取整体指标 |
| GET | `/api/metrics/failure-rate` | 获取失败率 |
| GET | `/api/metrics/coverage-gap` | 获取覆盖率缺口 |
| GET | `/api/metrics/flaky-risk` | 获取 flaky 风险 |
| GET | `/api/metrics/by-module` | 按模块分组指标 |
| GET | `/api/metrics/by-owner` | 按负责人分组指标 |
| GET | `/api/metrics/health-score` | 获取健康分数 |

**查询参数**:
- `target_coverage`: 目标覆盖率 (默认 80%)
- `flaky_threshold`: flaky 阈值 (默认 30%)
- `days`: 统计天数范围
- `module`: 模块过滤
- `owner`: 负责人过滤

### 导出 API (`/api/export`)

| 方法 | 路径 | 描述 |
|------|------|------|
| GET | `/api/export/markdown` | 下载 Markdown 报告 |
| GET | `/api/export/markdown/preview` | 预览 Markdown 报告 |
| GET | `/api/export/json` | 下载 JSON 明细 |
| GET | `/api/export/health-gate` | 执行健康门禁检查 |

**查询参数**:
- `target_coverage`: 目标覆盖率
- `flaky_threshold`: flaky 阈值
- `max_failure_rate`: 最大允许失败率
- `max_flaky_risk`: 最大允许 flaky 风险
- `include_test_cases`: 是否包含测试用例明细
- `include_coverage_files`: 是否包含覆盖率文件明细
- `include_flaky_details`: 是否包含 flaky 明细

---

## 示例数据说明

`sample_data/` 目录包含以下示例数据:

### pytest_report.xml
- **测试总数**: 10 个
- **通过**: 7 个 (70%)
- **失败**: 2 个 (20%)
- **跳过**: 1 个 (10%)
- **模块**: auth, payment, user

### coverage.xml
- **行覆盖率**: 75.5% (低于 80% 目标)
- **分支覆盖率**: 68.8%
- **总行数**: 245 行
- **已覆盖**: 185 行

### flaky_runs.log
- **Flaky 测试**: 2 个
- `test_locked_account`: 5 次尝试，2 次失败，3 次通过
- `test_failed_payment`: 2 次尝试，1 次失败，1 次通过
- `test_get_profile`: 4 次尝试，全部失败 (非 flaky)

---

## 数据库模型

### TestReport
- 测试报告元数据
- 字段: report_name, test_suite, module, owner, total_tests, passed, failed, skipped, errors, duration

### TestCase
- 单个测试用例详情
- 字段: classname, name, full_name, module, owner, status, duration, error_type, error_message, error_traceback

### CoverageReport
- 覆盖率报告元数据
- 字段: report_name, module, owner, total_lines, covered_lines, line_coverage, branch_coverage

### CoverageFile
- 单个文件覆盖率
- 字段: file_path, module, owner, line_coverage, missed_lines_list

### FlakyRun
- Flaky 测试记录
- 字段: test_name, module, owner, run_count, pass_count, fail_count, flaky_rate, retry_count, error_messages

### Quarantine
- 隔离名单
- 字段: test_name, full_name, module, owner, reason, reason_category, added_by, expected_fix_date, is_active, deactivated_at

---

## 健康评分算法

健康分数 (0-100) 基于以下公式计算:

```
score = 100.0
score -= failure_rate * 0.5    # 失败率权重
score -= coverage_gap * 0.8    # 覆盖率缺口权重
score -= flaky_risk_score * 0.3 # flaky 风险权重
```

**健康状态**:
- 80-100: ✅ Healthy (健康)
- 60-79:  ⚠️ Warning (警告)
- 40-59:  🔶 Degraded (降级)
- 0-39:   🔴 Critical (严重)

---

## 门禁检查规则

健康门禁检查会验证以下条件:

1. **测试通过率**: `failure_rate <= max_failure_rate` (默认 5%)
2. **代码覆盖率**: `coverage_gap <= 0` (覆盖率 >= 目标覆盖率)
3. **Flaky 风险**: `flaky_risk_score <= max_flaky_risk` (默认 50)

**门禁结果**:
- `PASSED`: 所有条件满足
- `FAILED`: 任一条件不满足

---

## 与 CI 集成示例

在 CI 中使用此服务的示例脚本:

```bash
#!/bin/bash
set -e

# 基础 URL
BASE_URL="http://test-health-gate:5000"

# 1. 导入测试报告
curl -X POST "$BASE_URL/api/reports/import" \
  -F "file=@pytest-report.xml" \
  -F "module=$CI_PROJECT_NAME" \
  -F "owner=$CI_COMMIT_AUTHOR"

# 2. 导入覆盖率
curl -X POST "$BASE_URL/api/coverage/import" \
  -F "file=@coverage.xml"

# 3. 导入 flaky 日志 (如果有)
if [ -f "flaky.log" ]; then
  curl -X POST "$BASE_URL/api/flaky/import" \
    -F "file=@flaky.log" \
    -F "ci_run_id=$CI_PIPELINE_ID"
fi

# 4. 执行健康门禁检查
GATE_RESULT=$(curl -s "$BASE_URL/api/export/health-gate?target_coverage=80&max_failure_rate=5")

OVERALL_STATUS=$(echo "$GATE_RESULT" | python3 -c "import sys,json; print(json.load(sys.stdin)['health_gate']['overall_status'])")

# 5. 根据门禁结果决定是否继续
if [ "$OVERALL_STATUS" = "FAILED" ]; then
  echo "❌ 健康门禁检查失败!"
  echo "$GATE_RESULT" | python3 -m json.tool
  exit 1
fi

echo "✅ 健康门禁检查通过!"
```

---

## 许可证

MIT License
