# Protobuf 字段保留检查工具

防止 Protobuf 字段编号复用导致的跨版本兼容性问题的 CLI 工具。

## 功能特性

- 📝 **Proto 文件解析** - 完整解析 proto 文件，提取字段、reserved 声明等信息
- 🔍 **风险检测** - 自动检测 5 种类型的风险：
  - 字段编号复用（严重）
  - 删除字段未添加 reserved（高）
  - 字段使用 reserved 范围内的编号（严重）
  - 字段编号重复定义（严重）
  - 字段名与 reserved 名称冲突（高）
- 📊 **多格式报告** - 支持终端摘要、JSON 机器可读格式、Markdown 报告（适合分享）
- 🔄 **历史对比** - 支持与历史版本 proto 对比，支持本地文件和 Git 历史
- 🚀 **CI 友好** - 支持 `--fail-on-critical` 选项，发现严重问题时非零退出

## 安装

```bash
pip install -e .
```

依赖：
- Python 3.8+
- click
- rich

## 快速开始

### 1. 基本检查

```bash
# 检查单个 proto 文件
proto-reserved-checker check test_protos/bad_example.proto
```

### 2. 版本对比检查

```bash
# 与历史版本对比（发现字段删除后未加 reserved）
proto-reserved-checker check test_protos/user_v2.proto --historical test_protos/user_v1.proto
```

### 3. 生成报告

```bash
# 生成 JSON 和 Markdown 报告
proto-reserved-checker check test_protos/user_v2.proto \
    --historical test_protos/user_v1.proto \
    --json-output report.json \
    --markdown-output report.md
```

### 4. Git 历史对比

```bash
# 与 Git 历史版本对比
proto-reserved-checker check your.proto --git-ref HEAD~1
proto-reserved-checker check your.proto --git-ref main
proto-reserved-checker check your.proto --git-ref v1.0.0
```

### 5. CI 中使用

```bash
# 发现严重风险时失败
proto-reserved-checker check your.proto --git-ref main --fail-on-critical
```

## 命令说明

### check - 主检查命令

```
proto-reserved-checker check PROTO_FILE [OPTIONS]

参数:
  PROTO_FILE                  要检查的 proto 文件路径

选项:
  -h, --historical PATH       历史版本 proto 文件路径
  -g, --git-ref TEXT          Git 引用 (commit, branch, tag)
  -j, --json-output PATH      JSON 报告输出路径
  -m, --markdown-output PATH  Markdown 报告输出路径
  -d, --detailed              显示详细信息
  --fail-on-critical          发现严重风险时非零退出
```

### parse - 解析显示

```
proto-reserved-checker parse PROTO_FILE [OPTIONS]

选项:
  -o, --output PATH   输出文件路径
```

### compare - 直接对比两个版本

```
proto-reserved-checker compare PROTO_FILE HISTORICAL_PROTO [OPTIONS]
```

### list-risks - 列出所有风险类型

```
proto-reserved-checker list-risks
```

## 示例输出

### 终端输出

```
============================================================
  Protobuf 字段保留检查报告
============================================================
  检查时间: 2024-01-15 10:30:00
  文件: user_v2.proto
  历史版本: user_v1.proto

  📊 风险统计:
    总计: 2 个风险项
    🔴 严重: 1
    🟠 高:   1
    🟡 中:   0
    🟢 低:   0

  📋 按风险类型分布:
    - 字段编号复用（兼容性破坏）: 1
    - 删除字段未添加 reserved: 1

  ⚠️  风险详情:

  🔴 [1] 字段编号 3 被复用: 原字段 'email' 已删除，但未添加 reserved，新字段 'avatar_url' 使用了该编号
      文件: user_v2.proto:10
      消息: User
      代码: string avatar_url = 3;

  🟠 [2] 已删除字段 'email' (编号 3) 未添加 reserved 声明
      文件: user_v2.proto:5
      消息: User
      代码: message User {

  💡 建议:
    - 请立即修复严重风险，防止兼容性问题
    - 建议尽快修复高优先级风险
    - 删除字段后务必添加 reserved 声明

============================================================
```

### Markdown 报告

包含完整的风险详情、问题代码片段、修复建议和 Protobuf reserved 最佳实践说明，适合直接发送给团队成员。

## 项目结构

```
proto-reserved-checker/
├── proto_reserved_checker/
│   ├── __init__.py      # 版本信息
│   ├── parser.py        # Proto 文件解析器
│   ├── detector.py      # 风险检测引擎
│   ├── reporter.py      # 报告生成器
│   └── cli.py           # CLI 入口
├── test_protos/         # 测试用 proto 文件
│   ├── user_v1.proto    # 原始版本（有 email 字段）
│   ├── user_v2.proto    # 有问题版本（删除 email 未加 reserved，复用编号）
│   ├── bad_example.proto # 各种问题示例
│   └── good_example.proto # 正确写法示例
├── pyproject.toml       # 项目配置
└── README.md
```

## 核心模块说明

### parser.py - Proto 解析器

- `ProtoParser` - 解析 proto 文件，支持:
  - 语法、包名、导入
  - 消息定义和嵌套消息
  - 字段信息（编号、名称、类型、标签）
  - reserved 编号范围和名称
  - enum 类型解析

### detector.py - 风险检测器

- `RiskDetector` - 检测各类风险:
  - `detect_duplicate_field_numbers` - 编号重复
  - `detect_fields_in_reserved_range` - 使用保留编号
  - `detect_reserved_name_conflicts` - 保留名称冲突
  - `detect_field_number_reuse` - 字段编号复用（需历史对比）
  - `detect_missing_reserved_for_deleted` - 缺失 reserved 声明（需历史对比）

### reporter.py - 报告生成器

- `Reporter` - 生成三种格式报告:
  - `generate_terminal_summary` - 终端友好输出
  - `generate_json_report` - 机器可读 JSON
  - `generate_markdown_report` - 美观的 Markdown 报告

## Protobuf Reserved 最佳实践

1. **删除字段立即加 reserved**
   ```protobuf
   // 错误：删除了 email 字段但没加 reserved
   message User {
       int64 id = 1;
       string name = 2;
       // string email = 3;  // 删除了！
   }

   // 正确
   message User {
       reserved 3;
       reserved "email";

       int64 id = 1;
       string name = 2;
   }
   ```

2. **不要复用编号** - 即使字段被删除，旧数据中仍可能存在该字段

3. **同时保留编号和名称** - 防止未来误用相同名称

4. **可以使用范围**
   ```protobuf
   message Foo {
       reserved 2, 15, 9 to 11;
       reserved "foo", "bar";
   }
   ```

## License

MIT
