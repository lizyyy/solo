# 配镜加工单守门员

> 眼镜店处方复核工具 - 守护每一张加工单的准确性

## 项目简介

配镜加工单守门员是专为眼镜店验光师设计的**本地处方复核工具**。每天门店会收到手写验光单、镜架参数 CSV 和镜片库存表，最怕的是：

- 球镜/柱镜正负号录错
- 左右眼轴位互换
- 瞳距和镜框尺寸不匹配
- 最终导致加工厂返工

本工具通过**规则引擎**自动检测这些常见错误，帮助验光师在提交加工前复核处方。

## 功能特性

### 核心命令

| 命令 | 功能 |
|------|------|
| `init` | 初始化门店配置，设置校验规则 |
| `import prescriptions` | 导入处方 CSV 文件 |
| `import frames` | 导入镜架参数 CSV 文件 |
| `import inventory` | 导入镜片库存 CSV 文件 |
| `check` | 校验处方，检测各种错误 |
| `plan` | 生成加工建议和镜片匹配方案 |
| `report` | 导出 Markdown/CSV/JSON 格式报告 |
| `status` | 查看当前数据统计 |

### 校验规则

- **度数范围校验**：球镜/柱镜是否在合理范围内
- **度数步长校验**：度数是否符合标准步长（0.25D）
- **柱镜格式校验**：检测正柱镜格式（门店通常使用负柱镜）
- **轴位有效性校验**：轴位是否在 0-180° 范围内
- **轴位互换检测**：检测左右眼轴位是否可能互换（相差 90° 等）
- **瞳距校验**：瞳距是否在合理范围，单眼瞳距与总瞳距是否一致
- **瞳高校验**：瞳高是否合理
- **瞳距镜架匹配**：瞳距与镜框几何中心距是否匹配
- **库存可用性**：处方度数是否有库存镜片支持
- **重复订单检测**：检测是否存在重复录入的订单

## 安装

### 依赖要求

- Python 3.9+
- click >= 8.0
- pydantic >= 2.0
- rich >= 13.0

### 安装步骤

```bash
# 安装依赖
pip install click pydantic rich

# 进入项目目录
cd /path/to/xy4100

# 设置 PYTHONPATH
export PYTHONPATH=$PYTHONPATH:/path/to/xy4100
```

## 快速开始

### 1. 初始化门店

首先需要初始化门店配置：

```bash
cd /path/to/work_directory

python3 -m opto_guardian.cli init \
    --store-id "STORE-001" \
    --store-name "视光中心总店" \
    --min-sphere -20.0 \
    --max-sphere 6.0 \
    --min-cylinder -6.0 \
    --max-cylinder 4.0 \
    --min-pd 50.0 \
    --max-pd 75.0
```

初始化后会创建以下目录结构：

```
工作目录/
├── config/
│   └── store_config.json    # 门店配置
├── data/
│   ├── prescriptions.json   # 处方数据
│   ├── frames.json          # 镜架数据
│   ├── inventory.json       # 库存数据
│   └── orders.json          # 历史订单
├── exports/                  # 导出报告目录
└── temp/                     # 临时目录
```

### 2. 导入数据

使用示例数据导入：

```bash
# 到处方
python3 -m opto_guardian.cli import prescriptions /path/to/xy4100/examples/prescriptions.csv

# 导入镜架
python3 -m opto_guardian.cli import frames /path/to/xy4100/examples/frames.csv

# 导入库存
python3 -m opto_guardian.cli import inventory /path/to/xy4100/examples/inventory.csv
```

### 3. 查看状态

```bash
python3 -m opto_guardian.cli status
```

### 4. 校验处方

```bash
# 校验所有处方
python3 -m opto_guardian.cli check

# 校验指定订单
python3 -m opto_guardian.cli check --order-id RX007

# 结合镜架进行校验
python3 -m opto_guardian.cli check --order-id RX002 --frame-id FRAME-001
```

### 5. 生成加工计划

```bash
python3 -m opto_guardian.cli plan --order-id RX002 --frame-id FRAME-001
```

### 6. 导出报告

```bash
# 导出 Markdown 格式
python3 -m opto_guardian.cli report -f markdown -o report.md

# 导出 CSV 格式
python3 -m opto_guardian.cli report -f csv -o report.csv

# 导出 JSON 格式
python3 -m opto_guardian.cli report -f json -o report.json

# 导出指定订单的加工计划
python3 -m opto_guardian.cli report --order-id RX002 --plan -f markdown -o plan.md
```

## 数据格式说明

### 处方 CSV 格式

| 字段 | 必填 | 说明 |
|------|------|------|
| order_no | 是 | 订单号，唯一标识 |
| patient_name | 否 | 患者姓名 |
| re_sphere | 是 | 右眼球镜（近视负，远视正） |
| re_cylinder | 否 | 右眼柱镜（散光，负柱镜格式） |
| re_axis | 否 | 右眼轴位（有散光时必填） |
| re_add | 否 | 右眼下加光（老花/渐进） |
| le_sphere | 是 | 左眼球镜 |
| le_cylinder | 否 | 左眼柱镜 |
| le_axis | 否 | 左眼轴位 |
| le_add | 否 | 左眼下加光 |
| pd_total | 否 | 总瞳距 (mm) |
| pd_right | 否 | 右眼瞳距 (mm) |
| pd_left | 否 | 左眼瞳距 (mm) |
| ph_right | 否 | 右眼瞳高 (mm) |
| ph_left | 否 | 左眼瞳高 (mm) |
| frame_model | 否 | 镜架型号 |
| lens_type | 否 | 镜片类型 |
| optometrist | 否 | 验光师 |
| exam_date | 否 | 验光日期 |
| notes | 否 | 备注 |

### 镜架 CSV 格式

| 字段 | 必填 | 说明 |
|------|------|------|
| frame_id | 是 | 镜架唯一标识 |
| model | 是 | 型号 |
| brand | 否 | 品牌 |
| style | 否 | 类型：全框/半框/无框/半无框 |
| material | 否 | 材质 |
| eye_size | 是 | 镜框宽度 (mm) |
| bridge_size | 是 | 鼻梁宽度 (mm) |
| temple_length | 否 | 镜腿长度 (mm) |
| lens_height | 否 | 镜片高度 (mm) |
| box_center_distance | 否 | 几何中心距（默认=eye_size+bridge_size） |
| color | 否 | 颜色 |
| quantity | 否 | 库存数量（默认1） |
| price | 否 | 价格 |
| notes | 否 | 备注 |

### 镜片库存 CSV 格式

| 字段 | 必填 | 说明 |
|------|------|------|
| stock_id | 是 | 库存唯一标识 |
| lens_type | 是 | 类型：单光/双光/渐进/防蓝光/变色/偏光 |
| material | 是 | 材质：CR39/PC/1.56/1.61/1.67/1.74/玻璃 |
| min_sphere | 是 | 最小球镜度数 |
| max_sphere | 是 | 最大球镜度数 |
| sphere_step | 否 | 球镜步长（默认0.25） |
| min_cylinder | 否 | 最小柱镜度数（默认0） |
| max_cylinder | 否 | 最大柱镜度数（默认0） |
| cylinder_step | 否 | 柱镜步长（默认0.25） |
| min_add | 否 | 最小下加光 |
| max_add | 否 | 最大下加光 |
| add_step | 否 | 下加光步长 |
| diameter | 否 | 镜片直径 (mm) |
| minimum_lens_height | 否 | 最小瞳高要求 (mm) |
| coating | 否 | 膜层 |
| brand | 否 | 品牌 |
| quantity | 否 | 库存数量（默认1） |
| unit_price | 否 | 单价 |
| supplier | 否 | 供应商 |
| notes | 否 | 备注 |

## 项目结构

```
opto_guardian/
├── __init__.py           # 包初始化
├── __version__.py        # 版本信息
├── cli.py                # CLI 入口
├── models/               # 数据模型
│   ├── __init__.py
│   ├── config.py         # 门店配置和校验规则
│   ├── prescription.py   # 处方模型
│   ├── frame.py          # 镜架模型
│   ├── lens.py           # 镜片库存模型
│   ├── order.py          # 订单和加工计划模型
│   └── validation.py     # 校验结果模型
├── parsers/              # 解析校验模块
│   ├── __init__.py
│   ├── csv_parser.py     # CSV 文件解析
│   └── validators.py     # 数据验证器
├── rules/                # 规则引擎
│   ├── __init__.py
│   ├── base.py           # 规则基类和引擎
│   ├── power_rules.py    # 度数相关规则
│   ├── axis_rules.py     # 轴位相关规则
│   ├── pd_rules.py       # 瞳距/瞳高相关规则
│   ├── inventory_rules.py # 库存相关规则
│   └── duplicate_rules.py # 重复订单规则
├── services/             # 核心服务
│   ├── __init__.py
│   ├── data_store.py     # 数据存储服务
│   ├── validation_service.py # 校验服务
│   └── planning_service.py   # 加工计划服务
└── reports/              # 报告导出
    ├── __init__.py
    └── exporter.py       # 报告导出器

examples/                 # 示例数据
├── prescriptions.csv
├── frames.csv
└── inventory.csv

tests/                    # 测试用例
├── __init__.py
├── test_models.py
└── test_rules.py
```

## 规则引擎设计

本项目采用**可插拔的规则引擎**设计，每个校验规则独立实现：

```python
# 规则基类
class BaseRule(ABC):
    rule_id: str
    rule_name: str
    
    @abstractmethod
    def execute(self, context: RuleContext) -> RuleResult:
        pass
```

### 内置规则列表

| 规则ID | 规则名称 | 说明 |
|--------|----------|------|
| power_range | 度数范围校验 | 校验球镜/柱镜是否在配置范围内 |
| power_step | 度数步长校验 | 校验度数是否符合 0.25D 步长 |
| cylinder_format | 柱镜格式校验 | 检测正柱镜格式 |
| axis_validation | 轴位有效性校验 | 校验轴位是否在 0-180° |
| axis_swap | 轴位互换检测 | 检测轴位是否可能互换 |
| pd_validation | 瞳距校验 | 校验瞳距范围和一致性 |
| pd_frame_match | 瞳距镜架匹配 | 校验瞳距与镜框是否匹配 |
| ph_validation | 瞳高校验 | 校验瞳高是否合理 |
| inventory_availability | 库存可用性校验 | 校验度数是否有库存支持 |
| duplicate_order | 重复订单检测 | 检测重复录入的订单 |

## 常见错误检测

### 1. 正负号录错

- **检测方式**：度数范围校验、步长校验
- **示例**：-3.00D 录成 +3.00D，或 -1.50D 录成 +1.50D

### 2. 轴位互换

- **检测方式**：轴位相差 90° 检测、常见轴位混淆检测
- **示例**：右眼 0° 左眼 90°，可能是左右眼写反或正负柱镜转换错误

### 3. 瞳距与镜框不匹配

- **检测方式**：瞳距与几何中心距(BC)比较
- **计算**：BC = 镜框宽度 + 鼻梁宽度
- **示例**：瞳距 60mm，镜框 BC 70mm，需要移心加工 10mm

## 运行测试

```bash
# 安装测试依赖
pip install pytest pytest-cov

# 运行测试
pytest tests/ -v

# 运行测试并生成覆盖率报告
pytest tests/ -v --cov=opto_guardian
```

## 临时目录验证流程

使用临时目录快速验证全流程：

```bash
# 1. 创建临时工作目录
mkdir -p /tmp/opto_test
cd /tmp/opto_test

# 2. 初始化门店
python3 -m opto_guardian.cli init \
    --store-id "TEST-001" \
    --store-name "测试门店"

# 3. 导入示例数据
python3 -m opto_guardian.cli import prescriptions /path/to/xy4100/examples/prescriptions.csv
python3 -m opto_guardian.cli import frames /path/to/xy4100/examples/frames.csv
python3 -m opto_guardian.cli import inventory /path/to/xy4100/examples/inventory.csv

# 4. 查看状态
python3 -m opto_guardian.cli status

# 5. 校验所有处方（会检测到 RX007 轴位疑似互换、RX008 度数超范围等）
python3 -m opto_guardian.cli check

# 6. 校验特定订单
python3 -m opto_guardian.cli check --order-id RX007

# 7. 生成加工计划
python3 -m opto_guardian.cli plan --order-id RX002 --frame-id FRAME-001

# 8. 导出报告
python3 -m opto_guardian.cli report -f markdown -o validation_report.md

# 9. 清理临时目录
rm -rf /tmp/opto_test
```

## 许可证

内部使用

## 贡献指南

1. Fork 项目
2. 创建功能分支
3. 提交更改
4. 推送到分支
5. 创建 Pull Request
