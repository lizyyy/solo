# 远程主机清单CLI (host-scanner)

运维交接必备工具：读取主机清单，并发探测TCP连通性，按标签分组统计，智能失败归因，生成多格式报告。

## ✨ 功能特性

- 📋 **清单读取** - 支持灵活的格式，自动识别主机名、端口、标签
- 🚀 **并发探测** - 基于 asyncio 的高性能并发 TCP 连接探测
- 🏷️ **标签分组** - 支持多标签，按标签维度统计成功率
- 🎯 **失败归因** - 智能分类：连接拒绝、超时、DNS失败、网络不可达等
- 📊 **多格式输出** - 终端彩色摘要、JSON、CSV、Markdown报告
- 🛡️ **坏数据保留** - 原始行号+错误原因，不丢任何数据
- 💡 **友好错误** - 不抛 traceback，用人类语言描述问题

## 📦 安装

### 方式一：pip 安装（推荐）

```bash
pip install .
```

### 方式二：依赖安装后直接运行

```bash
pip install -r requirements.txt
python -m host_scanner.cli --help
```

## 🔧 快速开始

### 1. 生成主机清单模板

```bash
host-scanner template
```

会生成 `hosts_template.txt`，按格式填写你的主机清单。

### 2. 验证清单格式

```bash
host-scanner validate hosts.txt
```

### 3. 执行连通性扫描

```bash
host-scanner scan hosts.txt
```

## 📖 使用说明

### scan - 执行扫描

```bash
host-scanner scan [OPTIONS] HOSTFILE

选项:
  -p, --port INTEGER        默认端口号 (默认: 22)
  -t, --timeout FLOAT       连接超时时间(秒) (默认: 3.0)
  -c, --concurrency INTEGER 最大并发数 (默认: 50)
  -o, --output-dir PATH     输出目录 (默认: ./reports)
  --no-console              不输出终端摘要
  --json/--no-json          是否输出JSON文件 (默认: 是)
  --csv/--no-csv            是否输出CSV文件 (默认: 是)
  --markdown/--no-markdown  是否输出Markdown报告 (默认: 是)
  -v, --verbose             显示详细错误信息
  --help                    显示帮助
```

**示例：**

```bash
# 基础扫描
host-scanner scan hosts.txt

# 自定义端口和超时
host-scanner scan hosts.txt -p 8080 -t 5.0

# 只输出JSON，不显示终端
host-scanner scan hosts.txt --no-console --no-csv --no-markdown

# 自定义输出目录
host-scanner scan hosts.txt -o ./my_reports
```

### validate - 验证清单格式

```bash
host-scanner validate hosts.txt
```

检查主机清单文件格式，显示有效主机和坏数据详情。

### template - 生成模板

```bash
host-scanner template
```

## 📄 输入文件格式

### 支持的格式

```
# 注释行（以 # // ; 开头）
主机名
主机名 端口
主机名 端口 标签1,标签2
```

**分隔符支持**：空格、逗号、分号、冒号

### 完整示例

```txt
# 生产环境主机
web01.example.com 80 web,production
web02.example.com 443 web,production

# 数据库
db01.example.com 3306 db,production
db02.example.com 3306 db,staging

# 缓存
cache01.example.com 6379 redis

# 仅主机名（使用默认端口22）
jump01.example.com
jump02.example.com

# 空行会被标记为坏数据

# 格式错误的行也会被保留
这是格式错误的一行
@invalid-host!
```

## 📂 输出说明

### 终端输出

- 📊 巡检概览（总数、成功/失败数、成功率、平均延迟、耗时）
- 📋 探测结果详情表格
- 🏷️ 按标签分组统计
- ⚠️ 坏数据记录（原始行号+错误原因）
- ❌ 失败主机详情

### 机器可读输出

**JSON 文件** - 完整结构化数据：
```json
{
  "total": 10,
  "successful": 8,
  "failed": 2,
  "bad_entries": 1,
  "avg_latency_ms": 25.5,
  "scan_duration_seconds": 3.2,
  "results": [...],
  "bad_entries": [...],
  "tags_summary": {...}
}
```

**CSV 文件** - Excel 友好格式：
- 探测结果工作表
- 坏数据记录工作表

### Markdown 报告

适合直接发给同事或贴到工单：
- 巡检概览
- 按标签分组统计
- 失败主机列表
- 探测结果详情
- 坏数据记录

## ❌ 错误码说明

| 退出码 | 说明 |
|--------|------|
| 0 | 全部成功，无坏数据 |
| 1 | 有探测失败或坏数据 |
| 2 | 文件错误（不存在、权限不足） |
| 3 | 扫描过程异常 |
| 130 | 用户中断（Ctrl+C） |

## 🏷️ 失败原因分类

| 错误类型 | 说明 |
|----------|------|
| 连接被拒绝 | 端口未开放或防火墙阻止 |
| 连接超时 | 主机不可达或网络延迟 |
| DNS解析失败 | 主机名不存在 |
| 网络不可达 | 路由问题 |
| 权限不足 | 需要管理员权限 |
| 无路由到主机 | 网络配置问题 |

## 🛡️ 坏数据处理

以下情况会被标记为坏数据，但**保留原始行号和内容**：

- 空行
- 格式无法解析
- 端口超出范围（1-65535）
- 无效端口格式
- 主机名为空

## 💡 使用技巧

1. **交接场景**：拿到一堆主机名，先全部填进去，跑一遍看哪些连通
2. **分组统计**：给不同环境/业务打标签，快速看到各组的健康度
3. **批量验证**：先 validate 再 scan，确保数据格式正确
4. **CI 集成**：通过退出码判断是否需要告警

## 📝 目录结构

```
.
├── host_scanner/
│   ├── __init__.py
│   ├── cli.py          # 命令行入口
│   ├── models.py       # 数据模型
│   ├── parser.py       # 清单解析
│   ├── scanner.py      # 连通探测
│   └── reporter.py     # 报告生成
├── requirements.txt
├── pyproject.toml
└── README.md
```

## 📜 License

MIT
