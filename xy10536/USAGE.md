# 模型训练数据剔除 CLI 工具使用指南

## 概述

这是一个用于在发现训练样本包含敏感信息后，按来源、标签、版本和下游集合进行剔除并留痕的 CLI 工具。

## 功能特性

- **初始化 (init)**: 初始化工作空间
- **数据导入 (import)**: 导入数据集、标签和敏感样本清单
- **检查 (check)**: 检查敏感样本在数据集中的分布
- **详情 (detail)**: 查看操作历史、数据集详情、敏感样本详情
- **执行剔除 (execute)**: 执行实际的剔除操作
- **报告 (report)**: 生成汇总报告和详细报告

## 核心规则

1. **增强样本处理**: 同一原始样本的所有增强版本会被一起识别和剔除
2. **标签文件缺行**: 支持标签文件不完整的情况
3. **已发布版本**: 已发布版本只能通过补丁版本修改
4. **幂等性**: 重复执行或重复回调保持幂等，不会产生重复副作用
5. **人工修正留痕**: 所有操作都记录操作者、时间和前后差异

## 本地启动

### 环境要求

- Python 3.7+
- pip

### 安装依赖

```bash
pip install click json5 tabulate
```

或使用项目自带的 requirements.txt:

```bash
pip install -r requirements.txt
```

### 项目结构

```
.
├── purge.py                  # CLI 入口
├── requirements.txt          # 依赖文件
├── data_purge_cli/           # 核心模块
│   ├── __init__.py
│   ├── storage.py           # 数据存储管理
│   ├── engine.py            # 核心业务引擎
│   └── formatter.py         # 输出格式化
├── examples/                 # 示例数据
│   ├── text_samples.json    # 文本样本索引
│   ├── text_labels.json     # 文本标签
│   ├── image_samples.json   # 图片样本索引（含增强样本）
│   ├── image_labels.json    # 图片标签
│   ├── sensitive_samples.json  # 敏感样本清单
│   ├── demo_script.sh       # 完整演示脚本
│   └── fail_demo.sh         # 失败路径演示
└── .purge_data/             # 数据存储目录（运行时创建）
```

## 造数说明

### 内置示例数据

工具提供了完整的示例数据，覆盖以下场景：

1. **文本样本** (`examples/text_samples.json`):
   - 5个文本样本
   - 2个包含敏感信息的样本

2. **图片样本** (`examples/image_samples.json`):
   - 1个原始图片样本 + 2个增强样本
   - 增强样本通过 `original_id` 关联到原始样本
   - 包含 EXIF 元数据（GPS 坐标等）

3. **敏感样本清单** (`examples/sensitive_samples.json`):
   - 3个敏感样本
   - 包含原因说明和严重程度
   - `include_augment` 字段控制是否包含增强样本

### 数据格式

#### 样本索引文件 (JSON/JSONL)

```json
[
  {
    "id": "sample_001",
    "type": "text|image",
    "source": "数据来源",
    "original_id": "原始样本ID（用于增强样本）",
    "is_augmented": false
  }
]
```

#### 标签文件 (JSON/JSONL)

```json
{
  "sample_001": {
    "id": "sample_001",
    "label": "标签",
    "category": "类别"
  }
}
```

#### 敏感样本清单 (JSON/JSONL)

```json
{
  "samples": [
    {
      "id": "样本ID",
      "original_id": "原始样本ID",
      "reason": "敏感原因",
      "severity": "high|medium|low",
      "include_augment": true
    }
  ]
}
```

## 主要演示路径

### 快速开始（一键演示）

```bash
bash examples/demo_script.sh
```

### 分步演示

#### 1. 初始化工作空间

```bash
# 首次初始化
python3 purge.py init

# 强制重新初始化（清除所有数据）
python3 purge.py init --force
```

#### 2. 导入数据集

导入文本数据集（未发布版本）：

```bash
python3 purge.py import-cmd dataset text_dataset \
    --description "文本训练数据集" \
    --sample-index examples/text_samples.json \
    --labels examples/text_labels.json \
    --version v1.0.0 \
    --source crawled_news \
    --operator demo_user
```

导入图片数据集（已发布版本）：

```bash
python3 purge.py import-cmd dataset image_dataset \
    --description "图片训练数据集（已发布）" \
    --sample-index examples/image_samples.json \
    --labels examples/image_labels.json \
    --version v1.0.0 \
    --source crawled_flickr \
    --published \
    --operator demo_user
```

#### 3. 导入敏感样本清单

```bash
python3 purge.py --json import-cmd sensitive examples/sensitive_samples.json \
    --reason "合规审查发现" \
    --operator compliance_20240601
```

记录输出中的 `operation_id`，下一步需要使用。

#### 4. 检查敏感样本分布

```bash
python3 purge.py check <敏感样本操作ID> --operator demo_user
```

检查结果会显示：
- 受影响的数据集
- 每个数据集的匹配样本数
- 哪些版本是已发布的
- 匹配的样本 ID 列表

#### 5. 查看详情

查看所有操作历史：

```bash
python3 purge.py detail --all
```

按状态筛选操作：

```bash
python3 purge.py detail --all --status completed
python3 purge.py detail --all --status failed
```

查看数据集详情：

```bash
python3 purge.py detail --dataset text_dataset
```

查看敏感样本详情：

```bash
python3 purge.py detail --sensitive-id <敏感样本操作ID>
```

#### 6. 执行剔除

对未发布版本直接执行：

```bash
python3 purge.py execute <检查操作ID> text_dataset v1.0.0 \
    --operator purger_001 \
    --reason "剔除包含隐私信息的样本"
```

对已发布版本必须使用补丁版本：

```bash
python3 purge.py execute <检查操作ID> image_dataset v1.0.0 \
    --patch-version v1.0.1 \
    --operator purger_001 \
    --reason "剔除包含敏感GPS信息的样本"
```

#### 7. 验证幂等性

再次执行相同的剔除操作：

```bash
python3 purge.py execute <检查操作ID> text_dataset v1.0.0 \
    --operator purger_001 \
    --reason "重复测试"
```

会提示 "该版本已执行过剔除操作（幂等）"。

#### 8. 生成报告

生成汇总报告：

```bash
python3 purge.py report
```

报告内容包括：
- 数据集汇总（各版本样本数和剔除状态）
- 最近操作列表

## 失败路径演示

### 运行失败路径演示脚本

```bash
bash examples/fail_demo.sh
```

### 常见失败场景

#### 场景1：未初始化就执行操作

```bash
# 先清理数据
rm -rf .purge_data

# 尝试导入（会失败）
python3 purge.py import-cmd dataset test_dataset --sample-index examples/text_samples.json
```

**错误信息**: 工作空间未初始化，请先运行 'purge init'

#### 场景2：导入不存在的文件

```bash
python3 purge.py import-cmd dataset test_dataset --sample-index nonexistent.json
```

**错误信息**: 样本索引文件不存在: nonexistent.json

#### 场景3：检查不存在的敏感操作ID

```bash
python3 purge.py check nonexistent-id-12345
```

**错误信息**: 敏感样本清单不存在: nonexistent-id-12345

#### 场景4：对已发布版本执行剔除但未指定补丁版本

```bash
# 先导入一个已发布版本的数据集
python3 purge.py import-cmd dataset test_dataset \
    --sample-index examples/text_samples.json \
    --version v1.0.0 \
    --published

# 导入敏感样本并获取操作ID
SENSITIVE_ID=$(python3 purge.py --json import-cmd sensitive examples/sensitive_samples.json | python3 -c "import sys,json; print(json.load(sys.stdin).get('operation_id',''))")

# 检查并获取检查ID
CHECK_ID=$(python3 purge.py --json check $SENSITIVE_ID | python3 -c "import sys,json; print(json.load(sys.stdin).get('operation_id',''))")

# 尝试直接剔除已发布版本（会失败）
python3 purge.py execute $CHECK_ID test_dataset v1.0.0
```

**错误信息**: 已发布版本只能通过补丁版本修改，请指定 --patch-version

#### 场景5：使用不存在的检查操作ID

```bash
python3 purge.py execute fake-check-id test_dataset v1.0.0 --patch-version v1.0.1
```

**错误信息**: 检查操作不存在: fake-check-id

#### 场景6：使用不存在的数据集

```bash
python3 purge.py execute $CHECK_ID nonexistent_dataset v1.0.0
```

**错误信息**: 数据集版本不存在: nonexistent_dataset v1.0.0

#### 场景7：使用不存在的版本

```bash
python3 purge.py execute $CHECK_ID text_dataset v999.0.0
```

**错误信息**: 数据集版本不存在: text_dataset v999.0.0

## 业务闭环验证

执行完整流程后，可以通过以下方式验证业务是否真的闭环：

### 1. 查看数据存储

```bash
ls -la .purge_data/
```

数据目录结构：
- `.purge_data/datasets/` - 数据集元数据
- `.purge_data/labels/<dataset>/` - 各版本的标签和样本索引
- `.purge_data/sensitive/` - 敏感样本清单
- `.purge_data/history/` - 操作历史
- `.purge_data/snapshots/<dataset>/<version>/` - 版本快照
- `.purge_data/reports/` - 报告

### 2. 查看剔除后的数据集

```bash
python3 purge.py detail --dataset text_dataset
```

应该显示：
- 版本 v1.0.0 的样本数已减少（从 5 变为 3）
- 剔除状态：✓ 已剔除

### 3. 查看补丁版本

```bash
python3 purge.py detail --dataset image_dataset
```

应该显示：
- 原版本 v1.0.0: 5 样本, 未剔除（保持不变）
- 补丁版本 v1.0.1: 2 样本, ✓ 已剔除

### 4. 查看操作历史

```bash
python3 purge.py detail --all
```

可以追踪完整的操作链：
- 导入数据集 (import_dataset)
- 导入敏感样本 (import_sensitive)
- 检查分布 (check)
- 执行剔除 (purge)
- 生成报告 (report)

### 5. 查看报告

```bash
python3 purge.py report
```

报告展示：
- **受影响数据集**: 哪些数据集被修改
- **标签变化**: 标签数量是否变化
- **版本快照**: before/after 快照路径
- **需要重训的模型**: 明确指出需要重新训练

## 版本快照说明

每次剔除操作都会创建两个快照：

- **before_YYYYMMDD_HHMMSS.json**: 剔除前的状态
- **after_YYYYMMDD_HHMMSS.json**: 剔除后的状态

快照内容包括：
- 版本号
- 样本数量
- 标签数量
- 移除的样本数
- 移除的标签数

快照路径保存在 `purge_info` 中，可通过以下命令查看：

```bash
python3 purge.py detail --dataset <数据集名称>
```

## JSON 格式输出

所有命令都支持 `--json` 选项，输出 JSON 格式便于程序处理：

```bash
python3 purge.py --json init
python3 purge.py --json import-cmd dataset ...
python3 purge.py --json check ...
python3 purge.py --json detail --all
python3 purge.py --json report
```

## 操作人追踪

所有操作都要求指定操作者：

```bash
--operator <操作者名称>
```

操作历史中会记录：
- 操作者 (operator)
- 操作时间 (created_at/updated_at)
- 操作原因 (reason)
- 操作结果 (status)

## 安全特性

1. **已发布版本保护**: 已发布版本不能直接修改，必须通过补丁版本
2. **幂等性保证**: 重复执行相同操作不会产生副作用
3. **完整审计日志**: 所有操作都有记录，可追溯
4. **版本快照**: 保留剔除前后的完整状态
5. **差异记录**: 记录移除的样本 ID 和标签

## 命令参考

### 全局选项

| 选项 | 说明 |
|------|------|
| `--version` | 显示版本号 |
| `--json` | 输出 JSON 格式 |
| `--help` | 显示帮助信息 |

### init

```bash
python3 purge.py init [--force]
```

| 选项 | 说明 |
|------|------|
| `--force` | 强制重新初始化，清除所有数据 |

### import-cmd dataset

```bash
python3 purge.py import-cmd dataset <名称> \
    [--description <描述>] \
    [--sample-index <路径>] \
    [--labels <路径>] \
    [--version <版本>] \
    [--source <来源>] \
    [--published] \
    [--operator <操作者>]
```

### import-cmd sensitive

```bash
python3 purge.py import-cmd sensitive <文件路径> \
    [--reason <原因>] \
    [--operator <操作者>]
```

### check

```bash
python3 purge.py check <敏感样本操作ID> \
    [--dataset <数据集名称>] \
    [--version <版本>] \
    [--operator <操作者>]
```

### detail

```bash
python3 purge.py detail \
    [--check-id <检查操作ID>] \
    [--sensitive-id <敏感样本操作ID>] \
    [--dataset <数据集名称>] \
    [--all] \
    [--status <状态>]
```

### execute

```bash
python3 purge.py execute <检查操作ID> <数据集名称> <版本> \
    [--patch-version <补丁版本>] \
    [--operator <操作者>] \
    [--reason <原因>]
```

### report

```bash
python3 purge.py report \
    [--check-id <检查操作ID>] \
    [--purge-id <剔除操作ID>] \
    [--operator <操作者>]
```

## 常见问题

### Q: 如何处理标签文件缺行的情况？

A: 工具支持标签文件不完整的情况。标签文件中缺失的样本不会被当作标签问题处理，只会移除存在匹配的标签。

### Q: 增强样本是如何处理的？

A: 通过 `original_id` 字段关联。如果敏感样本的 `include_augment` 为 true，所有具有相同 `original_id` 的增强样本都会被识别和剔除。

### Q: 已发布版本为什么不能直接修改？

A: 这是为了保护已发布数据的完整性。已发布版本可能已被用于训练模型，直接修改会导致版本不一致。必须通过补丁版本进行修改。

### Q: 如何确认剔除操作已完成？

A: 可以通过以下方式确认：
1. 查看操作状态：`detail --all`
2. 查看数据集详情：`detail --dataset <名称>`
3. 查看版本快照：`.purge_data/snapshots/`

### Q: 数据存储在哪里？

A: 所有数据存储在当前目录下的 `.purge_data/` 目录中。可以备份或迁移这个目录来保存完整的操作历史。
