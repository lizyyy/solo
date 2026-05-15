# CSV字段血缘命令行工具

## 一、启动方式

### 环境要求
- Python 3.6+
- 无需额外依赖

### 运行命令

```bash
# 查看帮助
python3 csv_lineage_cli.py --help

# 查看版本
python3 csv_lineage_cli.py --version

# 补录外包验收单（主流程）
python3 csv_lineage_cli.py supplement --input samples/normal_acceptance.csv --output output.csv --report report.md

# 验证证据链
python3 csv_lineage_cli.py verify --input samples/broken_acceptance.csv

# 生成清理候选清单
python3 csv_lineage_cli.py cleanup --dir ./data --output cleanup_candidates.json
```

## 二、样例来源

### 正常材料
文件: [samples/normal_acceptance.csv](file:///Users/lzy/pro/solo/workspaces/zy70434/samples/normal_acceptance.csv)

包含5条完整记录，所有证据链字段齐全：
- 项目编号
- 外包人员姓名
- 入场日期
- 离场日期
- 人天单价

### 坏材料
文件: [samples/broken_acceptance.csv](file:///Users/lzy/pro/solo/workspaces/zy70434/samples/broken_acceptance.csv)

包含6条记录，其中4条存在证据链断开问题：
- 第2行：缺少项目编号
- 第3行：缺少外包人员姓名
- 第4行：缺少入场日期
- 第5行：缺少离场日期

## 三、主流程说明

### 补录外包验收单流程

```
原始CSV输入
    ↓
加载数据并验证编码
    ↓
证据链完整性检查
    ├─ 通过 → 计算派生字段（出勤天数、验收金额）
    │       ↓
    │   保存带血缘信息的结果
    │       ↓
    │   生成分析报告
    └─ 失败 → 保存失败记录（含原因和原始数据）
            ↓
        生成失败报告
```

### 字段血缘设计

每个派生字段都保留完整的追溯信息：

| 目标字段 | 计算公式 | 源字段 |
|---------|---------|--------|
| 出勤天数 | 离场日期 - 入场日期 + 1 | 入场日期、离场日期 |
| 验收金额 | 出勤天数 × 人天单价 | 出勤天数、人天单价 |

### 血缘数据存储

每条记录包含以下元数据字段（`_`开头）：
- `_source`: 原始文件路径
- `_row_index`: 原始行号
- `_run_mark`: 重跑标记（8位哈希）
- `_original_fields`: 原始输入字段的JSON快照
- `_processed_fields`: 派生字段的计算过程说明
- `_failure_reason`: 失败原因（如适用）

## 四、失败路径设计

### 证据链断开检测

**触发条件**：当以下任一必填字段缺失或为空时：
- 项目编号
- 外包人员姓名
- 入场日期
- 离场日期

**处理方式**：
1. 记录失败原因
2. 单独保存失败记录到 `failures/` 目录（JSON格式）
3. 在报告中列出所有失败项

### 失败记录格式

失败记录保存在 `failures/failure_{run_id}_{type}.json`，包含：
```json
{
  "run_id": "20240515_120000",
  "timestamp": "2024-05-15T12:00:00",
  "failure_type": "evidence_chain_broken",
  "data": {...},
  "reason": "证据链断开: 缺少字段 项目编号",
  "lineage": {
    "source": "...",
    "original_fields": {...},
    "processed_fields": {...}
  }
}
```

## 五、清理与回滚机制

### 候选清单生成

执行清理前，先生成候选文件清单，避免误伤真实数据：

```bash
python3 csv_lineage_cli.py cleanup --dir ./data --output cleanup_candidates.json
```

清单包含：
- 文件完整路径
- 文件大小
- 修改时间
- 关联的重跑标记

### 人工确认流程

1. 生成候选清单
2. 人工审核清单内容
3. 仅在确认无误后执行实际删除
4. 建议使用重跑标记进行批量操作

## 六、夜间巡检复核样例

报告中自动包含复核表格，使用重跑标记串起完整链路：

| 复核项 | 状态 | 说明 | 重跑标记 |
|--------|------|------|----------|
| 证据链完整性 | ☐待复核 | 验证必填字段是否完整 | a1b2c3d4 |
| 计算逻辑正确性 | ☐待复核 | 验证出勤天数、验收金额计算 | a1b2c3d4 |
| 字段血缘可追溯 | ☐待复核 | 验证派生字段来源可查 | a1b2c3d4 |

### 重跑验证方法

使用相同输入文件和重跑标记重新执行：
```bash
# 第一次执行（获取重跑标记）
python3 csv_lineage_cli.py supplement --input input.csv

# 第二次执行（验证一致性）
python3 csv_lineage_cli.py supplement --input input.csv

# 对比两次输出的重跑标记和结果数据
```

## 七、目录结构

```
.
├── csv_lineage_cli.py      # 主程序
├── README.md               # 本文档
├── samples/                # 样例数据
│   ├── normal_acceptance.csv   # 正常材料
│   └── broken_acceptance.csv   # 坏材料
├── data/                   # 输出数据目录
├── reports/                # 报告目录
└── failures/               # 失败记录目录
```
