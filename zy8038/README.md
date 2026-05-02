# CRDT 操作日志回放工具

一个基于 TypeScript/Node.js 的命令行工具，用于回放多人编辑器的离线操作日志。该工具实现了 RGA (Replicated Growable Array) 算法，能够处理插入、删除和撤销操作的合并，并生成可视化报告。

## 功能特性

- ✅ 解析 `clients.json` 和 `ops.jsonl` 日志文件
- ✅ 实现 RGA/CRDT 算法处理操作合并
- ✅ 检测并发插入冲突
- ✅ 检测无效删除操作
- ✅ 生成最终合并文档
- ✅ 生成 Markdown 冲突报告
- ✅ 生成 HTML 时间线可视化页面

## 安装

```bash
npm install
```

## 构建

```bash
npm run build
```

## 测试

```bash
npm test
```

## 使用方法

### 命令格式

```bash
crdt-playback replay -c <clients.json> -o <ops.jsonl> -i <initial.txt> [选项]
```

### 参数说明

| 参数 | 说明 | 必填 |
|------|------|------|
| `-c, --clients <path>` | clients.json 配置文件路径 | 是 |
| `-o, --operations <path>` | ops.jsonl 操作日志文件路径 | 是 |
| `-i, --initial <path>` | 初始文档文件路径 | 是 |
| `-d, --document <path>` | 最终文档输出路径 | 否 (默认: output/document.txt) |
| `-r, --report <path>` | Markdown 报告输出路径 | 否 (默认: output/report.md) |
| `-t, --timeline <path>` | HTML 时间线输出路径 | 否 (默认: output/timeline.html) |

### 示例命令

```bash
# 使用示例数据进行回放
crdt-playback replay \
  -c examples/clients.json \
  -o examples/ops.jsonl \
  -i examples/initial.txt
```

### 输出结果

执行命令后，工具会在 `output/` 目录下生成三个文件：

1. **document.txt** - 最终合并后的文档内容
2. **report.md** - 包含冲突解释的 Markdown 报告
3. **timeline.html** - 可在浏览器中打开的 HTML 时间线可视化页面

## 数据格式

### clients.json

```json
[
  { "id": "user1", "name": "张三", "color": "#e74c3c" },
  { "id": "user2", "name": "李四", "color": "#3498db" }
]
```

### ops.jsonl

每行一个 JSON 对象，支持三种操作类型：

```jsonl
{"id": "op1", "clientId": "user1", "timestamp": 1000, "type": "insert", "position": 0, "char": "H"}
{"id": "op2", "clientId": "user1", "timestamp": 2000, "type": "delete", "position": 0}
{"id": "op3", "clientId": "user1", "timestamp": 3000, "type": "undo", "position": 0, "targetOpId": "op1"}
```

### 操作类型

| 类型 | 说明 | 必需字段 |
|------|------|----------|
| `insert` | 插入字符 | `position`, `char` |
| `delete` | 删除字符 | `position` |
| `undo` | 撤销操作 | `targetOpId` |

## 项目结构

```
src/
├── types.ts          # 类型定义
├── log-parser.ts     # 日志解析模块
├── crdt-state.ts     # CRDT状态模块
├── conflict-diagnostic.ts  # 冲突诊断模块
├── report-generator.ts     # 报告生成模块
└── cli.ts            # CLI模块
```

## 技术实现

### RGA (Replicated Growable Array)

RGA 是一种基于链表的 CRDT 算法，通过维护每个字符的前驱和后继引用，实现分布式环境下的无冲突合并。

### 冲突检测

工具会检测以下冲突类型：

1. **并发插入冲突** - 多个客户端在相近时间戳向同一位置插入字符
2. **无效删除冲突** - 尝试删除已被删除的字符或超出文档范围的位置
3. **撤销目标不存在** - 尝试撤销一个不存在的操作

## 许可证

MIT