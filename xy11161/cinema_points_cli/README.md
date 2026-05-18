# 影院会员部影院票根补积分 CLI

## 功能说明

本工具用于处理影院会员部的票根补积分业务，支持：

1. **多文件批量读取
2. **自动识别并分类：
   - 正常积分记录
   - 退票记录
   - 团体票记录
   - 重复上传记录
   - 错误记录
3. **规则化配置
4. **可复跑对比（支持规则变更前后对比）
5. **多格式输出（CSV、JSON、Markdown）

## 目录结构

```
cinema_points_cli/
├── src/
│   ├── __init__.py
│   └── cli.py              # 主程序
├── rules/
│   ├── default.json        # 默认规则 v1.0
│   └── v1_1.json        # 更新规则 v1.1
├── samples/
│   ├── normal_input/       # 正常输入样例
│   ├── dirty_input/        # 含脏数据的输入样例
│   └── rerun_input/       # 重跑对照样例
└── output/                 # 输出目录
```

## 使用方法

### 1. 基础运行

```bash
python src/cli.py --input samples/normal_input --rules rules/default.json --output output/run1
```

### 2. 指定输出格式

```bash
# CSV 格式（默认）
python src/cli.py -i samples/normal_input -r rules/default.json -o output/run1 -f csv

# JSON 格式
python src/cli.py -i samples/normal_input -r rules/default.json -o output/run1 -f json

# Markdown 报告格式
python src/cli.py -i samples/normal_input -r rules/default.json -o output/run1 -f md
```

### 3. 重跑对比

```bash
# 第一次运行
python src/cli.py -i samples/normal_input -r rules/default.json -o output/run1 --run-id 202405_v1

# 第二次运行（使用新规则，对比第一次运行）
python src/cli.py -i samples/rerun_input -r rules/v1_1.json -o output/run2 --run-id 202405_v1_1 --compare output/run1
```

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| `{run_id}_valid.csv | 正常积分记录 |
| `{run_id}_refunds.csv | 退票记录 |
| `{run_id}_group_tickets.csv | 团体票记录 |
| `{run_id}_duplicates.csv | 重复上传记录 |
| `{run_id}_errors.csv | 错误记录 |
| `{run_id}_summary.json | 运行摘要 |
| `{run_id}_comparison.json | 对比结果（使用 --compare 时） |

## 规则文件说明

规则文件（JSON 格式）包含以下配置项：

```json
{
  "name": "规则名称",
  "key_fields": ["去重关键字段"],
  "refund_keywords": ["退票识别关键词"],
  "group_keywords": ["团体票识别关键词"],
  "group_min_count": 团体票最小数量,
  "points_per_yuan": 每元积分,
  "min_points": 最小积分,
  "max_points": 最大积分,
  "valid_cinemas": ["有效影院列表"]
}
```
