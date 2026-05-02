# 96孔板稀释排版管家

一个给生物实验室助理用的本地命令行工具，用于 qPCR 或酶标实验前的样品稀释计算和 96 孔板排布。

## 功能特性

- **init**: 初始化项目配置
- **import-samples**: 导入样品 CSV
- **plan**: 计算稀释步骤和孔位排布
- **apply**: 确认方案并扣减样品体积
- **undo**: 撤销最近一次 apply
- **export-plate**: 导出 96 孔板 CSV 和 Markdown 操作单
- **history**: 按批次或日期查询历史方案
- **list-samples**: 列出已导入的样品

## 安装

### 方式一：开发模式安装

```bash
# 进入项目目录
cd /path/to/xy4032

# 以开发模式安装
pip install -e .
```

### 方式二：使用 hatch 安装

```bash
pip install hatch
hatch shell
```

## 快速开始

### 1. 初始化项目

在工作目录下初始化项目配置：

```bash
# 创建并进入临时工作目录
mkdir -p /tmp/plate_test && cd /tmp/plate_test

# 初始化项目
plate-planner init
```

这会创建 `.plate_planner` 目录，包含：
- `config.json`: 项目配置
- `samples.json`: 样品数据
- `ledger.json`: 账本记录
- `plans.json`: 方案历史

### 2. 准备样品 CSV

创建 `samples.csv` 文件：

```csv
sample_id,batch,initial_concentration,concentration_unit,available_volume,target_concentration,target_concentration_unit,replicate_count,remark
S001,BATCH001,100,ng/ul,100,10,ng/ul,3,标准样品1
S002,BATCH001,200,ng/ul,50,5,ng/ul,2,标准样品2
S003,BATCH002,10,uM,200,1,uM,2,引物A
```

### 3. 导入样品

```bash
plate-planner import-samples samples.csv
```

### 4. 生成方案

```bash
plate-planner plan
```

这会显示：
- 板布局预览
- 每个样品的稀释步骤
- 方案 ID（用于后续操作）

### 5. 确认并应用方案

使用 plan 命令输出的方案 ID：

```bash
plate-planner apply <方案ID>
```

确认后会：
- 扣减样品体积
- 记录操作到 ledger.json
- 生成板号

### 6. 撤销操作

如果需要撤销最近的 apply：

```bash
plate-planner undo
```

### 7. 导出板图

导出 CSV 和 Markdown 操作单：

```bash
plate-planner export-plate <方案ID> -o ./output
```

会生成两个文件：
- `plate_001.csv`: 96 孔板布局矩阵
- `plate_001.md`: 完整操作单，包含稀释步骤

### 8. 查看历史

```bash
# 查看所有历史
plate-planner history

# 按日期筛选
plate-planner history -s 2026-01-01 -e 2026-12-31

# 详细模式
plate-planner history -v
```

## CSV 字段说明

| 字段 | 必填 | 说明 | 示例 |
|------|------|------|------|
| sample_id | 是 | 样品编号 | S001 |
| batch | 是 | 批次 | BATCH001 |
| initial_concentration | 是 | 初始浓度（数值） | 100 |
| concentration_unit | 是 | 浓度单位 | ng/ul, pg/ul, uM, nM |
| available_volume | 是 | 可用体积（ul，数值） | 100 |
| target_concentration | 是 | 目标浓度（数值） | 10 |
| target_concentration_unit | 否 | 目标浓度单位 | 默认与 initial 相同 |
| replicate_count | 否 | 重复孔数 | 默认 1 |
| remark | 否 | 备注 | |
| molecular_weight | 否 | 分子量（g/mol） | 用于摩尔浓度转换 |

### 支持的浓度单位

**质量/体积单位：**
- `ng/ul` (纳克/微升)
- `pg/ul` (皮克/微升)
- `ug/ul` (微克/微升)
- `mg/ml` (毫克/毫升)
- `ng/ml` (纳克/毫升)

**摩尔浓度单位：**
- `uM` (微摩尔，也支持 μM)
- `nM` (纳摩尔)
- `mM` (毫摩尔)

## 配置文件

初始化后可以编辑 `.plate_planner/config.json` 来自定义：

```json
{
  "version": "0.1.0",
  "default_concentration_unit": "ng/ul",
  "default_volume_unit": "ul",
  "pipette": {
    "min_volume_ul": 0.5,
    "max_volume_ul": 1000.0,
    "dead_volume_ul": 10.0
  },
  "plate": {
    "rows": 8,
    "cols": 12,
    "row_labels": ["A", "B", "C", "D", "E", "F", "G", "H"]
  },
  "reserved_wells": [
    {"well": "A1", "purpose": "阴性对照"},
    {"well": "A2", "purpose": "阳性对照"},
    {"well": "A3", "purpose": "空白对照"}
  ]
}
```

### 配置项说明

| 配置项 | 说明 | 默认值 |
|--------|------|--------|
| min_volume_ul | 最小移液体积 | 0.5 ul |
| max_volume_ul | 最大移液体积 | 1000 ul |
| dead_volume_ul | 死体积（枪头残留） | 10 ul |
| reserved_wells | 保留孔位（如对照孔） | A1-A3 |

## 错误提示

工具会在以下情况给出明确错误：

1. **目标浓度高于原液**: "目标浓度高于原液浓度，无法稀释"
2. **可用体积不足**: "可用体积不足，需要 X ul (含死体积)"
3. **移液体积越界**: "移液体积 X ul 小于最小移液体积 X ul"
4. **孔位不够**: "需要 X 个孔，但只有 X 个可用孔"
5. **样品编号重复**: 导入时会跳过重复项

## 完整示例流程

```bash
# 1. 创建工作目录
mkdir -p ~/lab_experiment && cd ~/lab_experiment

# 2. 初始化
plate-planner init

# 3. 准备样品文件
cat > my_samples.csv << 'EOF'
sample_id,batch,initial_concentration,concentration_unit,available_volume,target_concentration,target_concentration_unit,replicate_count,remark
P001,qPCR_0501,100,ng/ul,50,10,ng/ul,3,样本A
P002,qPCR_0501,50,ng/ul,40,5,ng/ul,2,样本B
P003,qPCR_0501,200,nM,100,20,nM,3,cDNA
EOF

# 4. 导入样品
plate-planner import-samples my_samples.csv

# 5. 查看样品
plate-planner list-samples

# 6. 生成方案
plate-planner plan

# 7. 应用方案（使用上面输出的方案ID）
plate-planner apply abc12345

# 8. 导出板图
plate-planner export-plate abc12345 -o ./results

# 9. 查看历史
plate-planner history -v

# 10. （如需）撤销
plate-planner undo
```

## 目录结构

```
xy4032/
├── pyproject.toml          # 项目配置
├── README.md              # 本文档
├── plate_planner/         # 源代码
│   ├── __init__.py
│   ├── cli.py             # CLI 入口
│   ├── config.py          # 配置管理
│   ├── units.py           # 单位换算
│   ├── models.py          # 数据模型
│   ├── dilution.py        # 稀释计算
│   ├── plate_layout.py    # 孔位排布
│   ├── storage.py         # 账本存储
│   └── exporter.py        # 导出报告
├── examples/              # 示例数据
│   └── samples.csv
└── tests/                 # 测试文件
    ├── test_units.py
    └── test_dilution.py
```

## 运行测试

```bash
pip install pytest
pytest tests/ -v
```

## 依赖

- Python >= 3.9
- click >= 8.0.0
- pydantic >= 2.0.0

## License

内部使用
