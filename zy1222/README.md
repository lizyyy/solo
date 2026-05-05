# mapdebug - Go Map 底层行为复盘工具

一个用于排查 Go map 性能问题和偶发 key 问题的本地 CLI 工具。通过模拟 Go map 的底层行为，帮助新人理解 map 的工作原理和常见陷阱。

## 功能特性

- **init**: 初始化新的复盘会话，生成示例配置文件
- **replay**: 重放操作序列，模拟 map 执行过程
- **analyze**: 分析复盘结果，输出风险报告
- **export**: 导出 Markdown/JSON 格式报告

## 模拟的底层机制

| 机制 | 描述 |
|------|------|
| `hmap` | Map 头部结构，包含 count、B、hash0 等字段 |
| `bucket` | 桶结构，每个桶存储 8 个 key-value 对 |
| `tophash` | 哈希值高 8 位，用于快速筛选 |
| `overflow bucket` | 溢出桶，当桶满时使用 |
| `load factor` | 装载因子 = count / (2^B * 8) |
| `incremental expand` | 增量扩容，每次操作迁移部分 bucket |
| `oldbucket migrate` | 旧桶迁移过程 |
| `tombstone` | 删除标记 (tophash = 1) |
| `random iteration` | 随机遍历顺序 |
| `concurrent write` | 并发写风险检测 |

## 安装

```bash
# 克隆仓库
git clone <repo-url>
cd mapdebug

# 下载依赖
go mod tidy

# 编译
go build -o mapdebug .
```

## 快速开始

### 1. 初始化会话

```bash
# 使用默认设置
./mapdebug init

# 或指定名称和种子
./mapdebug init my_session -s 42
```

这将生成以下文件：
- `map-cases.yaml`: 测试用例配置
- `ops.jsonl`: 操作序列 (JSON Lines 格式)
- `snippets/`: 示例代码片段

### 2. 重放操作

```bash
# 使用默认操作文件
./mapdebug replay

# 指定种子和详细输出
./mapdebug replay -s 42 -v

# 在扩容时停止
./mapdebug replay --stop-at-expand
```

### 3. 分析结果

```bash
# 查看所有会话
./mapdebug analyze --list

# 分析特定会话
./mapdebug analyze <session-id>

# 详细分析
./mapdebug analyze <session-id> -d

# 只看风险
./mapdebug analyze <session-id> --risks-only
```

### 4. 导出报告

```bash
# 导出 Markdown 报告
./mapdebug export <session-id> report.md

# 导出 JSON 报告
./mapdebug export <session-id> report.json -f json

# 包含详细步骤
./mapdebug export <session-id> report.md --include-steps
```

## 操作类型

`ops.jsonl` 文件中的每一行是一个 JSON 对象，支持以下操作类型：

| 类型 | 格式 | 说明 |
|------|------|------|
| `put` | `{"type":"put","key":"k","value":"v"}` | 插入或更新键值对 |
| `get` | `{"type":"get","key":"k"}` | 查找键 |
| `delete` | `{"type":"delete","key":"k"}` | 删除键 |
| `range` | `{"type":"range"}` | 遍历 map |
| `len` | `{"type":"len"}` | 获取元素数量 |

示例操作文件：
```json
{"type":"put","key":"user_001","value":"Alice"}
{"type":"put","key":"user_002","value":"Bob"}
{"type":"get","key":"user_001"}
{"type":"range"}
{"type":"delete","key":"user_002"}
{"type":"len"}
```

## 风险检测

工具会自动检测以下风险：

| 风险类别 | 风险等级 | 说明 |
|----------|----------|------|
| `hash_collision` | WARNING | 哈希冲突导致高查找成本 |
| `long_chain` | WARNING | 过长的溢出桶链 |
| `load_factor` | WARNING | 装载因子过高 |
| `concurrent_write` | ERROR | 并发写风险 (Go map 非线程安全) |
| `delete_tombstone` | INFO | 删除标记可能影响性能 |
| `iteration_order` | INFO | 遍历顺序不确定 |
| `expand_stall` | INFO | 增量扩容进行中 |

## Go Map 底层机制说明

### 数据结构

```go
type hmap struct {
    count      int        // 元素数量
    flags      uint8      // 状态标志
    B          uint8      // 桶数 = 2^B
    noverflow  uint16     // 溢出桶近似数量
    hash0      uint32     // 哈希种子
    buckets    unsafe.Pointer // 桶数组 (大小 2^B)
    oldbuckets unsafe.Pointer // 扩容时的旧桶数组
    nevacuate  uintptr    // 已迁移的桶数
    extra      *mapextra  // 可选字段 (溢出桶等)
}

type bmap struct {
    tophash  [8]uint8      // 每个槽位的 tophash
    keys     [8]keytype    // 键数组
    values   [8]valuetype  // 值数组
    overflow *bmap         // 溢出桶指针
}
```

### Tophash 含义

| 值 | 含义 |
|----|------|
| 0 | 空槽位，后面也是空 |
| 1 | 空槽位 (已删除，tombstone) |
| 2-254 | 有效 tophash 值 |
| 255 | 已迁移标记 (扩容期间) |

### 扩容触发条件

当以下任一条件满足时触发扩容：

1. **装载因子 > 6.5** (count / (2^B) > 6.5)
2. **溢出桶过多** (overflow count >= 2^B 且 count > 4*2^B)

### 增量扩容过程

1. 创建新桶数组 (大小翻倍)
2. `oldbuckets` 指向旧桶数组
3. 每次 `put/get/delete` 操作最多迁移 2 个 bucket
4. 查找时同时检查新旧 bucket
5. 所有 bucket 迁移完成后释放旧桶

## 示例场景

### 场景 1: 哈希冲突

```bash
# 创建冲突键的操作序列
cat > conflict_ops.jsonl << 'EOF'
{"type":"put","key":"user_12345","value":"A"}
{"type":"put","key":"user_12346","value":"B"}
{"type":"put","key":"user_12347","value":"C"}
{"type":"put","key":"user_12348","value":"D"}
{"type":"put","key":"user_12349","value":"E"}
{"type":"get","key":"user_12345"}
EOF

# 使用固定种子重放
./mapdebug replay --ops conflict_ops.jsonl -s 12345
```

### 场景 2: 扩容过程观察

```bash
# 创建大量插入操作
./mapdebug init expand_test -s 42

# 编辑 ops.jsonl，添加 50+ 个 put 操作
# 然后重放并观察扩容
./mapdebug replay --stop-at-expand -v
```

### 场景 3: 并发写问题

查看 `examples/snippets/bad_concurrent.go` 了解并发写的错误示例和正确做法。

## 目录结构

```
mapdebug/
├── main.go                 # 入口文件
├── cmd/
│   ├── root.go            # 命令根
│   ├── init.go            # init 命令
│   ├── replay.go          # replay 命令
│   ├── analyze.go         # analyze 命令
│   └── export.go          # export 命令
├── pkg/
│   ├── types/
│   │   └── types.go       # 类型定义
│   ├── mapmodel/
│   │   ├── map.go         # map 模拟实现
│   │   └── map_test.go    # 测试
│   ├── replay/
│   │   ├── replay.go      # 操作重放
│   │   └── replay_test.go # 测试
│   └── storage/
│       └── sqlite.go      # SQLite 存储
├── examples/
│   ├── map-cases.yaml     # 示例用例配置
│   ├── ops.jsonl          # 示例操作序列
│   └── snippets/
│       ├── bad_concurrent.go  # 并发示例
│       └── bad_iteration.go   # 遍历示例
├── go.mod
└── README.md
```

## 测试

```bash
# 运行所有测试
go test ./...

# 运行特定包测试
go test ./pkg/mapmodel -v
go test ./pkg/replay -v
```

## 常见问题

### Q: 为什么要使用这个工具？

Go map 的行为在很多方面是"不透明"的：
- 遍历顺序不可预测
- 扩容是增量进行的
- 删除会留下 tombstone
- 并发写会 panic 但不是每次都发生

这个工具可以：
1. 可视化这些底层行为
2. 帮助理解性能问题的根源
3. 复现偶发的 key 问题
4. 作为教学工具帮助新人理解 map

### Q: 如何复现偶发问题？

使用 `--seed` 参数固定随机种子：
```bash
# 第一次运行，记录种子
./mapdebug replay -v

# 使用相同种子复现
./mapdebug replay -s <记录的种子> -v
```

### Q: SQLite 数据库存储了什么？

数据库包含以下表：
- `sessions`: 会话元数据
- `steps`: 每一步的详细状态
- `risks`: 检测到的风险
- `expand_events`: 扩容事件

可以使用 SQLite 客户端直接查询：
```bash
sqlite3 mapdebug.db "SELECT * FROM sessions;"
```

## License

MIT

## 贡献

欢迎提交 Issue 和 PR！
