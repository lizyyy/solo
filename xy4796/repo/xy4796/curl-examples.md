# Benchmark Tracker API - CURL Examples

## 基础信息

- **基础 URL**: `http://localhost:3000`
- **Content-Type**: `application/json`

---

## 健康检查

```bash
curl http://localhost:3000/health
```

---

## 获取 API 信息

```bash
curl http://localhost:3000/
```

---

## 导入 Benchmark 结果

### 方式 1：使用文件上传（文本格式）

```bash
curl -X POST http://localhost:3000/api/benchmarks/import \
  -F "file=@./data/example-text-benchmark.txt" \
  -F "run_id=my-benchmark-run-001" \
  -F "version=v1.0.0" \
  -F "package=github.com/example/service" \
  -F "notes=Initial benchmark run" \
  -F "format=text"
```

### 方式 2：使用文件上传（JSON 格式）

```bash
curl -X POST http://localhost:3000/api/benchmarks/import \
  -F "file=@./data/example-json-benchmark.jsonl" \
  -F "run_id=my-benchmark-run-002" \
  -F "version=v1.1.0" \
  -F "format=json"
```

### 方式 3：使用 raw content（文本格式）

```bash
curl -X POST http://localhost:3000/api/benchmarks/import \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "my-benchmark-run-003",
    "version": "v1.2.0",
    "package": "github.com/example/service",
    "notes": "Test benchmark",
    "format": "text",
    "content": "BenchmarkTest-8         	     100	  1250.5 ns/op	 256 B/op	   3 allocs/op"
  }'
```

### 方式 4：自动检测格式

```bash
curl -X POST http://localhost:3000/api/benchmarks/import \
  -F "file=@./data/example-text-benchmark.txt" \
  -F "run_id=auto-detect-test" \
  -F "format=auto"
```

### 带 pprof 摘要

```bash
curl -X POST http://localhost:3000/api/benchmarks/import \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "with-pprof-001",
    "version": "v2.0.0",
    "package": "github.com/example/service",
    "format": "text",
    "content": "BenchmarkTest-8         	     100	  1000 ns/op	 256 B/op	   3 allocs/op",
    "pprof_summary": {
      "cpu": {
        "top10": ["runtime.scanobject", "runtime.mallocgc", "runtime.memmove"]
      },
      "memory": {
        "top10": ["bytes.makeSlice", "strings.Builder", "encoding/json.Marshal"]
      }
    }
  }'
```

---

## 列出所有 Benchmark 运行

```bash
curl http://localhost:3000/api/benchmarks
```

### 按包名过滤

```bash
curl "http://localhost:3000/api/benchmarks?package=github.com/example/service"
```

### 按版本过滤

```bash
curl "http://localhost:3000/api/benchmarks?version=v1.0.0"
```

### 组合过滤

```bash
curl "http://localhost:3000/api/benchmarks?package=github.com/example/service&version=v1.0.0"
```

---

## 获取单个 Benchmark 运行详情

```bash
curl http://localhost:3000/api/benchmarks/v1.0.0-commit-abc123
```

---

## 比较两个 Benchmark 运行

### JSON 格式输出

```bash
curl -X POST http://localhost:3000/api/benchmarks/compare \
  -H "Content-Type: application/json" \
  -d '{
    "base_run_id": "v1.0.0-commit-abc123",
    "new_run_id": "v1.1.0-commit-def456",
    "threshold": 10,
    "notes": "Comparing v1.0.0 to v1.1.0"
  }'
```

### 文本格式输出（更易读）

```bash
curl -X POST http://localhost:3000/api/benchmarks/compare \
  -H "Content-Type: application/json" \
  -d '{
    "base_run_id": "v1.0.0-commit-abc123",
    "new_run_id": "v2.0.0-commit-ghi789",
    "threshold": 5,
    "format": "text"
  }'
```

### 使用自定义阈值（5%）

```bash
curl -X POST http://localhost:3000/api/benchmarks/compare \
  -H "Content-Type: application/json" \
  -d '{
    "base_run_id": "v2.0.0-commit-ghi789",
    "new_run_id": "v2.1.0-commit-jkl012",
    "threshold": 5,
    "notes": "Regression detection with 5% threshold"
  }'
```

---

## 获取比较结果详情

### JSON 格式

```bash
curl http://localhost:3000/api/benchmarks/compare/1
```

### 文本格式

```bash
curl "http://localhost:3000/api/benchmarks/compare/1?format=text"
```

---

## 列出所有比较记录

```bash
curl http://localhost:3000/api/benchmarks/comparisons
```

---

## 添加审计标签

```bash
curl -X POST http://localhost:3000/api/audit/tags \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "v1.1.0-commit-def456",
    "tag": "approved",
    "created_by": "developer@example.com",
    "notes": "Performance improvement verified - 30% faster JSON serialization"
  }'
```

### 常用标签示例

```bash
# 标记为基线版本
curl -X POST http://localhost:3000/api/audit/tags \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "v1.0.0-commit-abc123",
    "tag": "baseline",
    "created_by": "team-lead",
    "notes": "Official baseline for all future comparisons"
  }'

# 标记需要审查
curl -X POST http://localhost:3000/api/audit/tags \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "v2.1.0-commit-jkl012",
    "tag": "needs_review",
    "created_by": "ci-bot",
    "notes": "Regression detected - requires manual review"
  }'

# 标记已拒绝
curl -X POST http://localhost:3000/api/audit/tags \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "v2.1.0-commit-jkl012",
    "tag": "rejected",
    "created_by": "senior-dev",
    "notes": "Regression confirmed - do not merge"
  }'
```

---

## 获取运行的所有标签

```bash
curl http://localhost:3000/api/audit/tags/v1.1.0-commit-def456
```

---

## 更新运行备注

```bash
curl -X PUT http://localhost:3000/api/audit/notes/v1.0.0-commit-abc123 \
  -H "Content-Type: application/json" \
  -d '{
    "notes": "Updated notes: This is the official baseline for Q1 2024 performance comparisons."
  }'
```

---

## 完整工作流示例

### 1. 先启动服务并导入种子数据

```bash
# 启动服务（新终端）
npm start

# 导入种子数据（另一个终端）
npm run seed
```

### 2. 导入新的 benchmark 结果

```bash
# 导入优化前的版本
curl -X POST http://localhost:3000/api/benchmarks/import \
  -F "file=@./data/example-text-benchmark.txt" \
  -F "run_id=before-optimization" \
  -F "version=v3.0.0" \
  -F "notes=Before optimization"

# 导入优化后的版本
curl -X POST http://localhost:3000/api/benchmarks/import \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "after-optimization",
    "version": "v3.1.0",
    "package": "github.com/example/service",
    "notes": "After cache optimization",
    "format": "text",
    "content": "BenchmarkProcessData-8         	     100	   875.35 ns/op	 179 B/op	   2 allocs/op"
  }'
```

### 3. 比较两个版本

```bash
curl -X POST http://localhost:3000/api/benchmarks/compare \
  -H "Content-Type: application/json" \
  -d '{
    "base_run_id": "before-optimization",
    "new_run_id": "after-optimization",
    "threshold": 10,
    "format": "text"
  }'
```

### 4. 添加标签

```bash
# 标记优化后的版本为已批准
curl -X POST http://localhost:3000/api/audit/tags \
  -H "Content-Type: application/json" \
  -d '{
    "run_id": "after-optimization",
    "tag": "approved",
    "created_by": "performance-engineer",
    "notes": "30% improvement in ns/op, 30% reduction in B/op - optimization verified"
  }'
```

### 5. 查看运行详情

```bash
curl http://localhost:3000/api/benchmarks/after-optimization
```

---

## 提示

1. **run_id**: 可以是任意字符串，建议使用有意义的标识符如 `git-commit-hash`、`version-timestamp` 等
2. **threshold**: 默认值为 10%，可以根据需要调整
3. **format**: 比较时使用 `format=text` 可以获得更易读的输出
4. **tags**: 可以使用任意标签，建议的标签包括：`baseline`、`approved`、`needs_review`、`rejected`、`investigating`
