# 配网馈线保护配合复核工具

用于在配网定值单下发前复核馈线保护配合关系的 Python CLI 工具。

## 功能特性

- **拓扑解析**: 读取馈线拓扑结构，建立保护装置上下级关系
- **配合计算**: 计算各故障点上下级保护的动作时间、级差和灵敏度
- **风险检测**: 自动检测 CT 变比不一致、时间级差不足、末端故障拒动等风险
- **报告生成**: 导出问题清单、详细配合报告和 HTML 曲线预览

## 模块结构

```
protection_coord/
├── __init__.py      # 包初始化
├── parser.py        # 输入文件解析器
├── topology.py      # 拓扑构建器
├── calculator.py    # 配合计算器
├── rules.py         # 规则引擎
├── reporter.py      # 报告生成器
└── sample_data.py   # 示例数据生成器
```

## 安装

```bash
# 安装依赖
pip install -r requirements.txt

# 或使用开发模式安装
pip install -e .
```

## 快速开始

### 1. 生成示例数据

```bash
# 使用 CLI 命令
python3 main.py generate-samples --output-dir ./samples

# 或直接运行
python3 -c "from protection_coord.sample_data import SampleDataGenerator; from pathlib import Path; g=SampleDataGenerator(); g.generate_all(Path('./samples'))"
```

### 2. 执行配合复核

```bash
# 使用 CLI 命令
python3 main.py check \
  --feeder ./samples/feeder.json \
  --settings ./samples/settings.csv \
  --fault-cases ./samples/fault_cases.yaml \
  --devices ./samples/devices.csv \
  --output-dir ./output \
  --verbose
```

### 3. 查看输出结果

```bash
# 问题清单
cat ./output/issues.csv

# 详细配合报告
cat ./output/coordination_report.md

# 曲线预览 (用浏览器打开)
open ./output/curve_preview.html
```

## 输入文件格式

### 1. feeder.json (馈线拓扑)

```json
{
  "feeder_name": "示例馈线F01",
  "voltage_level": 10.0,
  "root_node": "BUS_SUB",
  "nodes": [
    {
      "id": "BUS_SUB",
      "name": "变电站10kV母线",
      "type": "bus",
      "has_protection": true,
      "protection_devices": ["REL_SUB"]
    },
    {
      "id": "NODE_A",
      "name": "分段开关A",
      "type": "switch",
      "has_protection": true,
      "protection_devices": ["REL_A"]
    }
  ],
  "edges": [
    {
      "from": "BUS_SUB",
      "to": "NODE_A",
      "length": 2.5,
      "line_type": "overhead"
    }
  ]
}
```

### 2. settings.csv (保护定值)

| 字段 | 说明 | 示例 |
|------|------|------|
| device_id | 装置ID | REL_SUB |
| device_name | 装置名称 | 变电站出线保护 |
| node_id | 所在节点 | BUS_SUB |
| phase_oc1_current | 相间过流I段电流(A,二次) | 8.0 |
| phase_oc1_time | 相间过流I段时间(s/时间常数) | 0.8 |
| phase_oc2_current | 相间过流II段电流 | 4.0 |
| phase_oc2_time | 相间过流II段时间 | 0.7 |
| ground_oc1_current | 接地过流I段电流 | 4.0 |
| ground_oc1_time | 接地过流I段时间 | 0.6 |
| ct_ratio | CT变比 | 40.0 |
| inverse_time_curve | 反时限曲线类型 | SI |

### 3. fault_cases.yaml (故障案例)

```yaml
cases:
  - fault_id: F001
    fault_location: LOAD_D
    fault_type: phase
    description: 负荷D处三相短路故障
    phase_fault_current: 150.0
    ground_fault_current: 0.0
    fault_resistance: 0.0
```

### 4. devices.csv (设备信息)

| 字段 | 说明 | 示例 |
|------|------|------|
| device_id | 装置ID | REL_SUB |
| device_name | 装置名称 | 变电站出线保护 |
| ct_ratio_primary | CT一次电流(A) | 400.0 |
| ct_ratio_secondary | CT二次电流(A) | 5.0 |
| manufacturer | 厂家 | 南瑞继保 |
| model | 型号 | PCS-9611 |

## 检测规则

| 规则名称 | 严重程度 | 检测内容 |
|----------|----------|----------|
| 越级跳闸风险 | critical | 上级保护动作时间 ≤ 下级保护 |
| 时间级差不足 | high | 时间级差 < 0.3s |
| 灵敏度不足 | high | 灵敏度 < 1.5 |
| 保护拒动风险 | high/medium | 故障电流小于动作电流 |
| CT变比不一致 | medium | 上下级保护CT变比不同 |
| 定值缺失 | high/medium | 缺少必要的定值 |
| 时间级差偏小 | low | 时间级差接近阈值 |

## 输出文件说明

### 1. issues.csv (问题清单)

包含所有检测到的问题，按严重程度排序：

| 列名 | 说明 |
|------|------|
| 序号 | 问题编号 |
| issue_id | 问题唯一标识 |
| rule_name | 触发的规则名称 |
| severity | 严重程度 (critical/high/medium/low) |
| category | 问题类别 |
| description | 问题描述 |
| affected_devices | 相关设备 |
| fault_location | 故障位置 |
| fault_type | 故障类型 |
| recommendation | 处理建议 |

### 2. coordination_report.md (配合报告)

详细的 Markdown 格式报告，包含：

1. **总体概览**: 配合率、时间级差统计
2. **问题清单**: 按严重程度分组的详细问题
3. **详细配合分析**: 每个故障案例的保护动作情况和配合检查
4. **设备定值清单**: 所有保护装置的定值汇总

### 3. curve_preview.html (曲线预览)

交互式 HTML 页面，使用 Chart.js 绘制：

- 反时限特性曲线 (I段保护)
- 保护定值汇总表格
- 鼠标悬停显示详细数值

## 命令行参考

### check 命令

```bash
python3 main.py check [OPTIONS]

Options:
  --feeder PATH         馈线拓扑文件 (feeder.json) [required]
  --settings PATH       保护定值文件 (settings.csv) [required]
  --fault-cases PATH    故障案例文件 (fault_cases.yaml) [required]
  --devices PATH        设备信息文件 (devices.csv) [required]
  --output-dir PATH     输出目录 (默认: ./output)
  --verbose             显示详细信息
  --help                显示帮助信息
```

### generate-samples 命令

```bash
python3 main.py generate-samples [OPTIONS]

Options:
  --output-dir PATH     示例数据输出目录 (默认: ./samples)
  --help                显示帮助信息
```

## 计算原理

### 反时限动作时间计算

使用标准 IEC 反时限公式：

```
t = α / ((I/Ip)^p - 1) * TD
```

其中：
- `t`: 动作时间 (s)
- `α, p`: 曲线参数
- `I`: 故障电流
- `Ip`: 动作电流整定值
- `TD`: 时间常数

### 曲线类型参数

| 曲线类型 | α | p |
|----------|---|---|
| SI (标准反时限) | 0.14 | 0.02 |
| VI (非常反时限) | 13.5 | 1.0 |
| EI (极端反时限) | 80.0 | 2.0 |

### 灵敏度计算

```
灵敏度 = 故障电流 / 动作电流整定值
```

要求：灵敏度 ≥ 1.5

### 时间级差要求

```
级差 = 上级动作时间 - 下级动作时间
```

要求：级差 ≥ 0.3s

## 开发说明

### 项目结构

```
├── main.py              # CLI 入口
├── setup.py             # 安装配置
├── requirements.txt     # 依赖清单
├── README.md            # 本文档
└── protection_coord/    # 核心模块
    ├── __init__.py
    ├── parser.py        # 解析模块
    ├── topology.py      # 拓扑模块
    ├── calculator.py    # 计算模块
    ├── rules.py         # 规则模块
    ├── reporter.py      # 报告模块
    └── sample_data.py   # 示例数据
```

### 添加自定义规则

1. 继承 `BaseRule` 类
2. 实现 `evaluate` 方法
3. 注册到 `RuleEngine`

```python
from protection_coord.rules import BaseRule, Issue, RuleEngine

class MyCustomRule(BaseRule):
    rule_name = "自定义规则"
    category = "自定义类别"
    
    def evaluate(self, coordination_results, input_data):
        issues = []
        # 实现检测逻辑
        return issues

# 使用自定义规则
engine = RuleEngine(rules=[MyCustomRule()])
issues = engine.evaluate_all(results, input_data)
```

## 许可证

本项目仅供学习和内部使用。

## 版本历史

- v1.0.0: 初始版本
  - 支持馈线拓扑解析
  - 支持保护配合计算
  - 支持规则引擎检测
  - 支持多种报告输出
