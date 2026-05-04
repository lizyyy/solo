# pcheck - JSON to Protobuf/MessagePack 迁移评估工具

一个用于评估从 JSON 迁移到 Protobuf 或 MessagePack 风险和性能的 CLI 工具。

## 功能特性

- **兼容性检查**：检测字段删除/重命名、类型收窄、必填字段缺失、未知字段、默认值漂移、枚举扩展、时间精度变化等风险
- **性能对比**：回放历史 payload 样本，对比 JSON、Protobuf、MessagePack 的体积、编码/解码耗时
- **多格式报告**：支持导出 Markdown、JSON、CSV 格式的迁移评估报告
- **多格式支持**：支持 YAML 和 Protobuf 两种 schema 格式

## 快速开始

### 编译

```bash
go build -o pcheck .
```

### 基本用法

#### 1. 检查新旧 schema 兼容性

```bash
./pcheck check --old-schema data/seed/old_schema.yaml --new-schema data/seed/schema.yaml -f markdown
```

#### 2. 对比性能

```bash
./pcheck compare -p data/seed/payloads.jsonl -i 3
```

#### 3. 生成完整的迁移评估报告

```bash
./pcheck report --old-schema data/seed/old_schema.yaml -n data/seed/schema.yaml -p data/seed/payloads.jsonl -f markdown -o report.md
```

## 命令详解

### `check` - 兼容性检查

检查新旧 schema 之间的兼容性风险。

**参数：**
- `--old-schema`：旧版 schema 文件（必需）
- `--new-schema`：新版 schema 文件（必需）
- `-p, --payloads`：历史 payload 文件（jsonl 格式）
- `-r, --rules`：规则配置文件
- `-m, --message`：指定要检查的 message 类型
- `--all`：检查所有 messages
- `-f, --format`：输出格式（json/markdown/csv）
- `-o, --output`：输出文件路径

**示例：**

```bash
# 只检查 schema，不验证 payload
./pcheck check --old-schema old.yaml --new-schema new.yaml

# 同时验证历史 payload
./pcheck check --old-schema old.yaml --new-schema new.yaml -p payloads.jsonl

# 导出 Markdown 报告
./pcheck check --old-schema old.yaml --new-schema new.yaml -f markdown -o issues.md
```

### `compare` - 性能对比

回放历史 payload，对比不同编码格式的性能。

**参数：**
- `-p, --payloads`：历史 payload 文件（必需）
- `-i, --iterations`：每个 payload 的迭代次数（默认 10）
- `-s, --sample-size`：采样大小（0 = 全部，默认 100）
- `--no-json`：跳过 JSON 对比
- `--no-protobuf`：跳过 Protobuf 对比
- `--no-msgpack`：跳过 MessagePack 对比
- `-f, --format`：输出格式
- `-o, --output`：输出文件路径

**示例：**

```bash
# 完整对比
./pcheck compare -p payloads.jsonl

# 只对比 Protobuf 和 MessagePack
./pcheck compare -p payloads.jsonl --no-json

# 减少迭代次数（更快但精度稍低）
./pcheck compare -p payloads.jsonl -i 1
```

### `report` - 生成完整报告

运行兼容性检查和性能对比，生成完整的迁移评估报告。

**参数：**
- `--old-schema`：旧版 schema 文件
- `-n, --new-schema`：新版 schema 文件（必需）
- `-p, --payloads`：历史 payload 文件（必需）
- `-r, --rules`：规则配置文件
- `-j, --project`：项目名称（报告中显示）
- `-i, --iterations`：性能测试迭代次数（默认 5）
- `-s, --sample-size`：采样大小（默认 50）
- `--skip-benchmark`：跳过性能测试
- `-f, --format`：输出格式
- `-o, --output`：输出文件路径

**示例：**

```bash
# 完整评估
./pcheck report --old-schema old.yaml -n new.yaml -p payloads.jsonl -f markdown -o report.md

# 只检查兼容性，跳过性能测试
./pcheck report -n new.yaml -p payloads.jsonl --skip-benchmark -f json
```

## 数据文件格式

### Schema 文件（YAML 格式）

```yaml
name: user_service
version: "2.0"

messages:
  - name: UserCreated
    description: 事件描述
    fields:
      - name: user_id
        number: 1
        type: string
        required: true
        description: 字段描述
      
      - name: status
        number: 2
        type: enum
        required: true
        enum_ref: UserStatus
        default: "ACTIVE"

enums:
  - name: UserStatus
    values:
      - name: ACTIVE
        number: 1
      - name: INACTIVE
        number: 2
```

### Payload 文件（JSONL 格式）

每行一个 JSON 对象：

```json
{"user_id": "usr_001", "email": "john@example.com", "status": "ACTIVE"}
{"user_id": "usr_002", "email": "jane@example.com", "status": "INACTIVE"}
```

### 规则配置文件

```yaml
compatibility_checks:
  field_deletion: true
  field_renaming: true
  type_narrowing: true
  required_fields: true
  unknown_fields: true
  default_value_drift: true
  enum_extension: true
  timestamp_precision: true
  repeated_change: true

performance_checks:
  compare_json: true
  compare_protobuf: true
  compare_msgpack: true
  sample_size: 100
  iterations: 10

ignored_fields:
  - internal_id
  - debug_info

custom_mappings:
  - old_field: legacy_id
    new_field: user_id
    transformation: string
```

### 客户端版本文件（CSV）

```csv
version,min_schema,max_schema,supported,deprecated,description
1.0.0,1.0,1.0,true,false,"Initial release"
2.0.0,2.0,2.0,true,false,"Major release"
```

## 检测的风险类型

| 风险类型 | 严重程度 | 描述 |
|---------|---------|------|
| `field_deleted` | High | 字段被删除 |
| `field_renamed` | High | 字段被重命名 |
| `type_narrowed` | High | 类型收窄（如 int64 → int32，可能数据丢失） |
| `required_missing` | Critical | 新增必填字段，老客户端不提供 |
| `unknown_field` | Info | payload 包含 schema 未定义的字段 |
| `default_value_drift` | Medium | 默认值变更 |
| `enum_extended` | Medium/High | 枚举值新增或删除 |
| `timestamp_precision` | Medium | 时间精度变化（毫秒 vs 秒） |
| `repeated_changed` | Medium/High | 数组/单值关系变化 |

## 性能指标

工具会测量以下指标：

- **体积**：编码后的字节数
- **编码时间**：序列化耗时
- **解码时间**：反序列化耗时
- **成功率**：编码/解码是否成功

## 输出示例

### 检查报告（Markdown）

```markdown
# Compatibility Check Report

## Summary
| Severity | Count |
|----------|-------|
| Critical | 0 |
| High | 2 |
| Medium | 3 |
| Info | 1 |

## Issues
- 🟠 **[high]** Field 'UserCreated.legacy_id' has been removed
  - Message: UserCreated
  - Field: legacy_id

- 🟡 **[medium]** Field 'UserCreated.status' type changed from 'string' to 'enum'
  - Message: UserCreated
  - Field: status
```

### 性能对比输出

```
=== Benchmark Results ===

JSON:
  Average Size: 209 bytes
  Avg Encode: 7.871µs
  Avg Decode: 3.813µs
  Success: 10/10

Protobuf:
  Average Size: 90 bytes (43.2% of JSON)
  Avg Encode: 1.428µs (5.5x faster)
  Avg Decode: 1.881µs (2.0x faster)
  Success: 10/10

MessagePack:
  Average Size: 170 bytes (81.3% of JSON)
  Avg Encode: 2.156µs (3.7x faster)
  Avg Decode: 3.133µs (1.2x faster)
  Success: 10/10
```

## 项目结构

```
.
├── cmd/                    # CLI 命令
│   ├── root.go            # 根命令
│   ├── check.go           # check 命令
│   ├── compare.go         # compare 命令
│   └── report.go          # report 命令
├── internal/
│   ├── schema/            # Schema 解析
│   │   ├── parser.go      # 统一解析接口
│   │   ├── yaml_schema.go # YAML 解析
│   │   └── proto_schema.go # Proto 解析
│   ├── payload/           # Payload 加载
│   │   └── loader.go      # JSONL/CSV/YAML 加载
│   ├── compatibility/     # 兼容性检查
│   │   └── checker.go     # 核心检查逻辑
│   ├── benchmark/         # 性能对比
│   │   └── comparer.go    # 编码器和对比逻辑
│   └── report/            # 报告生成
│       └── generator.go   # 多格式报告生成
├── pkg/
│   └── types/             # 公共类型定义
├── data/
│   └── seed/              # 示例数据
│       ├── schema.yaml    # 新版 schema
│       ├── old_schema.yaml # 旧版 schema
│       ├── schema.proto   # Proto 格式 schema
│       ├── payloads.jsonl # 正常 payload 样本
│       ├── payloads_invalid.jsonl # 异常 payload 样本
│       ├── rules.yaml     # 规则配置
│       └── client-versions.csv # 客户端版本
├── main.go                # 入口文件
├── go.mod
└── README.md
```

## 使用场景

### 场景 1：规划 schema 变更

在修改 schema 前，检查变更的兼容性风险：

```bash
./pcheck check --old-schema current.yaml --new-schema proposed.yaml -f markdown -o risk-assessment.md
```

### 场景 2：评估迁移收益

在决定是否从 JSON 迁移到 Protobuf 之前，量化性能收益：

```bash
./pcheck compare -p historical-payloads.jsonl -i 10 -f json -o performance.json
```

### 场景 3：生产环境验证

在生产环境迁移前，使用真实流量样本验证：

```bash
./pcheck report -n new-schema.yaml -p production-sample.jsonl -f markdown -o migration-report.md
```

## 最佳实践

1. **使用真实样本**：尽可能使用生产环境的真实 payload 数据
2. **足够的样本量**：样本量至少 100 条以获得统计意义
3. **多次迭代**：性能测试使用 3-10 次迭代减少波动
4. **版本控制**：将 schema 和规则文件纳入版本控制
5. **CI/CD 集成**：在 CI 流程中加入检查，防止破坏性变更

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request！
