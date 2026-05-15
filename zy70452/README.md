# 大文件切片校验工具

面向灰度物流拦截场景的大文件切片校验与回滚管理命令行工具。

## 快速开始

### 环境要求

- Python 3.9+
- poetry (推荐) 或 pip

### 安装依赖

```bash
poetry install
# 或使用 pip
pip install click pydantic rich pandas pyarrow xxhash python-dotenv
```

### 查看帮助

```bash
python main.py --help
```

## 样例来源

本工具的业务场景贴近真实的**灰度物流拦截系统**，主要处理以下类型的数据：

- **即时配送订单**：华东区高频拦截记录
- **快递揽收数据**：华北区包裹流转信息
- **生鲜冷链监控**：华南区温度敏感型物流
- **大件运输追踪**：西南区重货运输数据

所有样例文件位于 `samples/` 目录下：

- `logistics_batch_001.json` - 正常批次提交样例
- `logistics_batch_partial.json` - 部分成功失败路径样例
- `partitions.json` - 湖仓分区清单样例

## 主流程

### 1. 提交校验

```bash
python main.py validate samples/logistics_batch_001.json
```

校验流程：

```
批次提交 → 切片完整性检查 → 文件大小校验 → 校验和验证 → 结果持久化
```

### 2. 查看校验结果

支持三种输出格式：

```bash
# 控制台输出（默认）
python main.py validate samples/logistics_batch_001.json -f console

# JSON 格式
python main.py validate samples/logistics_batch_001.json -f json -o result.json

# Markdown 格式
python main.py validate samples/logistics_batch_001.json -f markdown -o report.md
```

### 3. 结果复用与冲突检测

相同批次 ID 重复提交时，工具会自动复用历史校验结果：

```bash
# 第一次校验会执行完整流程
python main.py validate samples/logistics_batch_001.json

# 第二次会直接返回缓存结果
python main.py validate samples/logistics_batch_001.json

# 如需强制重新校验
python main.py validate samples/logistics_batch_001.json -F
```

### 4. 湖仓分区人工确认

对关键分区的数据质量进行人工审核确认：

```bash
python main.py confirm-partition LOGISTICS-INTERCEPT-20240515-001 samples/partitions.json

# 拒绝分区
python main.py confirm-partition LOGISTICS-INTERCEPT-20240515-001 samples/partitions.json --reject
```

## 失败路径演示

### 场景：部分成功（只成功一半）

使用 `logistics_batch_partial.json` 演示典型的失败路径：

```bash
python main.py validate samples/logistics_batch_partial.json
```

预期失败类型：

1. **checksum_mismatch** - 校验和不匹配（数据损坏）
2. **missing_slice** - 切片文件缺失（传输中断）
3. **size_mismatch** - 文件大小不匹配（不完整写入）
4. **partial_success** - 部分切片成功，部分失败

### 按失败类型过滤查询

```bash
# 查看所有缺失的切片
python main.py filter LOGISTICS-INTERCEPT-20240515-PARTIAL-002 missing_slice

# 查看校验和错误的文件
python main.py filter LOGISTICS-INTERCEPT-20240515-PARTIAL-002 checksum_mismatch
```

## 回滚与候选清单

> ⚠️ **安全机制**：所有清理/回滚动作必须先生成候选清单，经人工确认后才能执行，避免误伤真实数据。

### 1. 生成回滚候选清单

```bash
python main.py plan-rollback LOGISTICS-INTERCEPT-20240515-PARTIAL-002 -o rollback_plan.md
```

### 2. 查看待确认的回滚计划

```bash
python main.py list-plans
```

### 3. 确认并执行回滚

```bash
# 先试运行（不实际删除文件）
python main.py confirm <PLAN_ID> --dry-run

# 实际执行
python main.py confirm <PLAN_ID> -y
```

## 命令参考

| 命令 | 功能 |
|------|------|
| `validate` | 校验批次切片文件 |
| `filter` | 按失败类型过滤查询 |
| `plan-rollback` | 生成回滚候选清单 |
| `list-plans` | 列出待确认的回滚计划 |
| `confirm` | 确认并执行回滚计划 |
| `confirm-partition` | 人工确认湖仓分区清单 |

## 目录结构

```
.
├── slice_validator/
│   ├── core/
│   │   ├── validator.py       # 核心校验逻辑
│   │   ├── candidate_manager.py  # 候选清单管理
│   │   └── output_formatter.py   # 输出格式处理
│   ├── models/
│   │   └── schemas.py         # 数据模型定义
│   └── cli/
│       └── main.py            # 命令行入口
├── samples/                   # 样例数据
├── data/
│   ├── results/               # 校验结果存储
│   └── candidates/            # 回滚计划存储
└── main.py                    # 主入口脚本
```
