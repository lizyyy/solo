# RabbitMQ 拓扑导出 CLI

一个用于分析和导出RabbitMQ拓扑结构的命令行工具，支持拓扑解析、绑定验证、孤儿队列检测，并生成可视化报告。

## ✨ 功能特性

- 🔍 **拓扑解析**: 解析JSON格式的RabbitMQ拓扑定义文件
- ✅ **绑定校验**: 验证Exchange-Queue绑定关系的有效性
- 🔎 **孤儿检测**: 自动发现孤立的Queue和Exchange
- 📊 **图表生成**: 生成Mermaid格式的拓扑可视化图
- 📋 **多格式报告**: 支持终端摘要、JSON、Markdown三种报告格式
- ❌ **错误追踪**: 保留坏行或异常样本的原始位置和原因
- 📁 **目录支持**: 支持批量解析整个目录下的拓扑文件

## 🚀 安装

### 方式一: pip安装（推荐）

```bash
pip install -e .
```

### 方式二: 直接运行

```bash
pip install -r requirements.txt
python -m rabbitmq_topology.cli --help
```

## 📖 快速开始

### 1. 生成示例拓扑数据

```bash
rabbitmq-topology sample > topology.json
```

### 2. 分析单个拓扑文件

```bash
rabbitmq-topology analyze topology.json
```

### 3. 分析整个目录

```bash
rabbitmq-topology analyze ./topologies/
```

### 4. 只验证不生成报告

```bash
rabbitmq-topology validate topology.json
```

### 5. 列出拓扑元素

```bash
rabbitmq-topology list topology.json -t queues
```

## 📋 命令详解

### analyze - 分析拓扑并生成报告

```bash
rabbitmq-topology analyze <输入路径> [选项]

参数:
  输入路径              单个JSON文件或包含JSON文件的目录

选项:
  -o, --output-dir      报告输出目录 (默认: ./reports)
  -n, --name            报告名称前缀 (默认: 按时间自动生成)
  --no-summary          不显示终端摘要
  --machine-readable    仅输出机器可读的JSON格式
  --strict              严格模式，发现任何问题时返回非0退出码
```

**退出码说明:**
- `0`: 拓扑验证通过
- `1`: 发现解析错误或拓扑问题（需配合`--strict`）

**示例:**

```bash
# 分析并指定输出目录
rabbitmq-topology analyze topology.json -o ./my-reports -n production

# 仅输出机器可读格式，便于CI/CD集成
rabbitmq-topology analyze topology.json --machine-readable

# 严格模式，失败时退出
rabbitmq-topology analyze topology.json --strict || echo "拓扑检查失败"
```

### validate - 验证拓扑

```bash
rabbitmq-topology validate <输入路径> [选项]

选项:
  --json               以JSON格式输出验证结果
  --no-exit-code       即使发现问题也不设置非0退出码
```

**退出码说明:**
- `0`: 拓扑验证通过
- `1`: 发现解析错误或拓扑问题

**示例:**

```bash
# 验证拓扑，如果有问题则中断脚本
rabbitmq-topology validate topology.json || exit 1

# JSON格式输出，便于程序处理
rabbitmq-topology validate topology.json --json | jq .
```

### list - 列出拓扑元素

```bash
rabbitmq-topology list <输入路径> [选项]

选项:
  -t, --type           项目类型: exchanges|queues|bindings|all (默认: all)
  -v, --vhost          按vhost过滤
```

### sample - 生成示例拓扑数据

```bash
rabbitmq-topology sample
```

## 📁 输入数据结构

### 拓扑JSON格式

```json
{
  "exchanges": [
    {
      "name": "order.exchange",
      "vhost": "/",
      "type": "topic",
      "durable": true,
      "auto_delete": false,
      "internal": false,
      "arguments": {}
    }
  ],
  "queues": [
    {
      "name": "order.create.queue",
      "vhost": "/",
      "durable": true,
      "auto_delete": false,
      "exclusive": false,
      "arguments": {}
    }
  ],
  "bindings": [
    {
      "source": "order.exchange",
      "destination": "order.create.queue",
      "destination_type": "queue",
      "routing_key": "order.create",
      "vhost": "/",
      "arguments": {}
    }
  ],
  "policies": [
    {
      "name": "ha-all",
      "vhost": "/",
      "pattern": ".*",
      "definition": {
        "ha-mode": "all",
        "ha-sync-mode": "automatic"
      },
      "priority": 0,
      "apply_to": "all"
    }
  ]
}
```

### 字段说明

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| exchanges | Array | 否 | Exchange定义列表 |
| queues | Array | 否 | Queue定义列表 |
| bindings | Array | 否 | 绑定关系列表 |
| policies | Array | 否 | 策略定义列表 |

#### Exchange 类型

- `direct`: 直连交换机
- `topic`: 主题交换机
- `fanout`: 扇出交换机
- `headers`: 头交换机
- `x-consistent-hash`: 一致性哈希交换机

## 📊 报告输出

报告默认输出到 `./reports/` 目录，包含以下文件：

```
reports/
├── topology_20240115_143022.json          # 机器可读完整报告
├── topology_20240115_143022.md            # Markdown格式报告
└── topology_20240115_143022_diagram.mmd   # Mermaid拓扑图
```

### JSON报告结构

```json
{
  "metadata": {
    "generated_at": "2024-01-15T14:30:22",
    "report_name": "topology_20240115_143022"
  },
  "topology": {
    "exchanges_count": 2,
    "queues_count": 3,
    "bindings_count": 3,
    "policies_count": 1,
    "exchanges": [...],
    "queues": [...],
    "bindings": [...],
    "policies": [...]
  },
  "validation": {
    "orphan_queues": [],
    "orphan_exchanges": [],
    "invalid_bindings": [],
    "duplicate_bindings": [],
    "warnings": []
  },
  "parse_errors": [
    {
      "line_number": 5,
      "field": "exchanges",
      "error_type": "ExchangeParseError",
      "message": "Exchange解析失败: ...",
      "raw_data": "{...}"
    }
  ]
}
```

### Mermaid拓扑图

生成的 `.mmd` 文件可以在以下平台查看：

- [Mermaid Live Editor](https://mermaid.live/)
- GitHub / GitLab Markdown
- VS Code Mermaid插件

## 🔍 验证说明

### 孤儿Queue/Exchange

- **孤儿Queue**: 没有任何Binding指向的Queue
- **孤儿Exchange**: 没有任何Binding来源或指向的Exchange

### 无效Binding

- 源Exchange不存在
- 目标Queue/Exchange不存在

### 重复Binding

- 完全相同的（source, destination, routing_key）组合出现多次

## 💡 使用场景

### 场景1: 迁移前拓扑审查

```bash
# 导出生产环境拓扑
rabbitmqadmin export production.json

# 分析拓扑
rabbitmq-topology analyze production.json
```

### 场景2: CI/CD集成

```bash
# 在流水线中验证拓扑，失败时退出
rabbitmq-topology validate topology.json --json | jq '.validation.invalid_bindings | length' | xargs test 0 -eq
```

### 场景3: 批量分析多个环境

```bash
# 目录结构
topologies/
├── dev.json
├── staging.json
└── production.json

# 批量分析
rabbitmq-topology analyze ./topologies/ -o ./reports
```

## ⚠️ 错误处理

当遇到坏数据或解析错误时，工具会：

1. **不抛出异常**，继续处理剩余数据
2. **保留错误位置**：记录行号、字段名
3. **保存原始数据**：保留错误样本的原始内容
4. **汇总报告**：在最终报告中列出所有错误

**示例错误输出:**

```
❌ 解析错误 (2个):
  - [JSONDecodeError] [第15行]: 无效的JSON语法
    原始数据: "queues": [ missing bracket...

  - [ExchangeParseError] [第3行]: 缺少必填字段: name
    原始数据: {"vhost": "/", "type": "topic"}
```

## 🔧 开发

### 运行测试

```bash
python -m pytest tests/ -v
```

### 项目结构

```
rabbitmq-topology-cli/
├── rabbitmq_topology/
│   ├── __init__.py          # 版本信息
│   ├── cli.py               # CLI入口
│   ├── models.py            # 数据模型
│   ├── parser.py            # 拓扑解析器
│   ├── validator.py         # 拓扑验证器
│   ├── reporter.py          # 报告生成器
│   └── diagram.py           # 图表生成器
├── tests/
│   └── test_*.py
├── setup.py
├── requirements.txt
└── README.md
```

## 📄 License

MIT License
