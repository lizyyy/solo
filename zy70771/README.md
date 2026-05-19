# Nginx 路由命中顺序冲突解释排查 CLI

一个用于检测 Nginx location 规则匹配顺序和冲突的 Python 命令行工具。

## 功能特性

- ✅ **配置解析**: 解析 Nginx 配置文件，提取 server 块和 location 规则
- ✅ **路径匹配模拟**: 精确模拟 Nginx 的匹配算法
  - 精确匹配 (=)
  - 前缀匹配 (^~ 和普通前缀)
  - 正则匹配 (~ 和 ~*)
- ✅ **规则排序**: 按优先级排序显示所有 location 规则
- ✅ **冲突检测**: 自动检测以下类型的冲突
  - 规则被覆盖 (shadowed_rule)
  - 正则顺序问题 (regex_order_issue)
  - 前缀规则重叠 (overlapping_prefix)
  - 不可达的正则规则 (unreachable_regex)
  - 匹配歧义 (ambiguous_match)
- ✅ **冲突解释**: 详细说明冲突原因和影响范围
- ✅ **报告导出**: 支持 JSON (机器可读) 和 TXT (人类可读) 格式

## 文件结构

```
.
├── main.py              # CLI 主程序
├── nginx_parser.py      # 配置解析模块
├── matcher.py           # 路径匹配引擎
├── conflict_detector.py # 冲突检测模块
├── reporter.py          # 报告生成模块
├── requirements.txt     # 依赖列表
└── examples/            # 样例配置文件
    ├── normal.conf      # 正常配置
    ├── conflict.conf    # 有冲突的配置
    ├── edge_case.conf   # 边界情况配置
    ├── dirty.conf       # 脏数据/有语法问题
    ├── empty.conf       # 空配置
    └── test_paths.txt   # 测试路径列表
```

## 使用方法

### 基本用法

```bash
python main.py -c examples/normal.conf
```

### 列出所有 server 块

```bash
python main.py -c examples/edge_case.conf --list-servers
```

### 测试特定路径

```bash
python main.py -c examples/normal.conf -t /api/test -t /static/image.jpg
```

### 批量测试路径

```bash
python main.py -c examples/conflict.conf -b examples/test_paths.txt
```

### 显示详细匹配过程

```bash
python main.py -c examples/edge_case.conf -t /admin/index.php -v
```

### 导出报告

```bash
# JSON 格式 (机器可读)
python main.py -c examples/conflict.conf -o report.json

# TXT 格式 (人类可读)
python main.py -c examples/conflict.conf -o report.txt
```

### 指定 server 块

```bash
python main.py -c examples/edge_case.conf --server 1
```

### 仅测试匹配，不检测冲突

```bash
python main.py -c examples/normal.conf --no-conflict
```

## 命令行参数

| 参数 | 说明 |
|------|------|
| `-c, --config` | Nginx 配置文件路径 (必需) |
| `-s, --server` | 指定要检测的 server 块索引 (从 0 开始) |
| `--list-servers` | 列出所有 server 块信息 |
| `-t, --test-path` | 测试单个路径匹配 (可多次使用) |
| `-b, --batch-test` | 从文件批量测试路径 (每行一个路径) |
| `--no-conflict` | 不进行冲突检测 |
| `-o, --output` | 输出报告文件路径 (支持 .json 和 .txt) |
| `-v, --verbose` | 显示详细匹配过程 |

## Nginx 匹配优先级说明

Nginx 的 location 匹配遵循以下优先级顺序:

1. **精确匹配 `=`**: 完全匹配成功后立即停止
2. **前缀匹配 `^~`**: 最长前缀匹配，匹配成功后停止正则检查
3. **正则匹配 `~` / `~*`**: 按配置顺序匹配，第一个匹配成功的停止
4. **普通前缀匹配**: 最长前缀匹配，不影响正则匹配

## 冲突类型说明

### 1. 规则被覆盖 (shadowed_rule)
高优先级规则完全覆盖了低优先级规则，导致后者永远不会被命中。

### 2. 正则顺序问题 (regex_order_issue)
多个正则表达式存在重叠匹配区域，配置顺序决定了匹配结果，可能导致意外行为。

### 3. 前缀规则重叠 (overlapping_prefix)
多个前缀规则的匹配范围存在重叠，可能引起歧义。

### 4. 正则规则不可达 (unreachable_regex)
正则规则的匹配范围被前缀规则完全覆盖，导致永远不会被执行。

### 5. 匹配歧义 (ambiguous_match)
某个路径可以被多条规则匹配，需要确认实际命中的规则是否符合预期。

## 样例说明

- `examples/normal.conf`: 正常配置，无明显冲突
- `examples/conflict.conf`: 包含多种冲突的配置，用于测试检测能力
- `examples/edge_case.conf`: 边界情况测试，如正则顺序、精确匹配vs正则等
- `examples/dirty.conf`: 脏数据，测试解析错误处理
- `examples/empty.conf`: 空配置，测试边界情况

## 输出报告示例

### TXT 报告 (人类可读)
```
======================================================================
Nginx 路由匹配冲突检测报告
生成时间: 2024-01-15 10:30:00
======================================================================

【配置解析摘要】
- 服务器块数量: 1
- 解析错误: 0 个
- 当前检测服务器: conflict-example.com
- 监听端口: 80
- Location 规则数: 8

【冲突检测结果】
发现冲突数: 3
----------------------------------------------------------------------
1. [高] 正则规则不可达
   说明: 第 25 行的 '\.php$' 被 ^~ 前缀规则永远覆盖
   涉及规则:
     * 第 25 行 [~] \.php$
     * 第 13 行 [^~] /api/v1/
   影响路径: /test/path/file.html
   建议: 1) 移除不必要的 ^~ 修饰符; ...
```

### JSON 报告 (机器可读)
包含完整的结构化数据，可用于后续自动化处理。
