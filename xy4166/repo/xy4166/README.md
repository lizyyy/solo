# 减压曲线复核员 (Deco Reviewer)

给潜水俱乐部教练用的本地科学计算 CLI 工具，用于复核潜水日志的减压曲线是否安全。

## 功能特性

- **Bühlmann ZH-L16C 简化减压模型**：16个组织隔室，支持梯度因子(GF 30/85)
- **CSV 日志解析**：支持中英文列名，灵活的数据格式
- **风险计算**：
  - 组织惰性气体压力(N2/He)
  - NDL (无减压极限)
  - CNS 氧中毒百分比
  - OTU (氧毒性单位)
  - M值比值和领先隔室
- **违规检测**：
  - 上升速率过快 (>9m/min)
  - 超过无减压极限
  - 安全停留缺失/不足
  - 重复潜水间隔过短
  - CNS/OTU 超标
- **多格式报告**：
  - 终端彩色摘要
  - Markdown 详细报告
  - JSON 审计数据
- **档案管理**：保存多次潜水记录，支持查询和管理

## 项目结构

```
deco-reviewer/
├── deco_reviewer/           # 主包
│   ├── __init__.py         # 版本信息
│   ├── models.py           # 数据模型定义
│   ├── parser.py           # CSV解析器
│   ├── buhlmann.py         # Bühlmann减压模型
│   ├── validator.py        # 规则校验器
│   ├── storage.py          # 档案存储
│   ├── report.py           # 报告生成
│   ├── main.py             # 核心分析函数
│   └── cli.py              # CLI入口
├── examples/               # 样例数据
│   ├── safe_dive_20m_25min.csv      # 安全潜水示例
│   └── unsafe_dive_35m_36min.csv    # 违规潜水示例
├── tests/                  # 测试套件
│   ├── __init__.py
│   ├── test_parser.py
│   ├── test_buhlmann.py
│   └── test_validator.py
├── pyproject.toml          # 项目配置
└── README.md               # 本文档
```

## 安装

### 环境要求

- Python 3.9+

### 安装步骤

```bash
# 克隆或下载项目
cd deco-reviewer

# 安装项目（可编辑模式，方便开发）
pip install -e .

# 或者直接安装依赖
pip install click rich pytest
```

## 快速开始

### 1. 运行演示

```bash
# 查看演示（安全潜水 + 违规潜水对比）
deco-reviewer demo

# 导出演示报告
deco-reviewer demo -o ./demo_reports
```

### 2. 分析自己的潜水日志

```bash
# 分析CSV文件（自动保存到档案库）
deco-reviewer analyze examples/safe_dive_20m_25min.csv

# 分析并导出报告
deco-reviewer analyze examples/safe_dive_20m_25min.csv -o ./my_reports

# 使用自定义梯度因子
deco-reviewer analyze your_dive.csv --gf-low 0.4 --gf-high 0.9

# 分析但不保存到档案库
deco-reviewer analyze your_dive.csv --no-save
```

### 3. 管理档案库

```bash
# 列出所有潜水记录
deco-reviewer list

# 查看特定潜水详情
deco-reviewer show DIVE_20260501_001

# 重新导出报告
deco-reviewer show DIVE_20260501_001 -o ./exported

# 删除潜水记录
deco-reviewer delete DIVE_20260501_001
```

## CSV 文件格式

### 必需字段

| 字段名 | 中文名 | 说明 |
|--------|--------|------|
| time | 时间 | 分钟（从潜水开始） |
| depth | 深度 | 米 |

### 可选字段

| 字段名 | 中文名 | 默认值 |
|--------|--------|--------|
| dive_id | 潜水ID | 自动生成 |
| diver_name | 潜水员 | "未知潜水员" |
| dive_date | 潜水日期 | 今天 |
| gas_type | 气体类型 | "air" |
| o2_percent | 氧气% | 21 |
| n2_percent | 氮气% | 79 |
| he_percent | 氦气% | 0 |
| safety_stop_depth | 安全停留深度 | - |
| safety_stop_duration | 安全停留时间 | - |
| surface_interval_minutes | 水面间隔 | - |
| temperature | 温度 | - |

### 示例 CSV

```csv
dive_id,diver_name,dive_date,gas_type,o2_percent,n2_percent,time,depth
MY_DIVE_001,张教练,2026-05-01,air,21,79,0,0
,,,,,,,,1,5
,,,,,,,,2,10
,,,,,,,,3,15
,,,,,,,,5,20
,,,,,,,,25,20
,,,,,,,,26,18
,,,,,,,,27,15
,,,,,,,,30,5
,,,,,,,,33,5
,,,,,,,,35,0
```

## 校验规则

### 上升速率

- **限制**：≤ 9 米/分钟
- **警告**：> 9 米/分钟
- **严重**：> 13.5 米/分钟 (1.5倍限制)

### 安全停留

- **触发深度**：≥ 9 米
- **5米停留**：至少 3 分钟
- **3米停留**：≥ 20米时额外 1 分钟

### 重复潜水间隔

- **建议最小**：60 分钟
- **警告**：< 60 分钟

### 氧中毒

| 指标 | 警告阈值 | 临界阈值 |
|------|---------|---------|
| CNS | 80% | 100% |
| OTU | 250 | 300 |

## 技术说明

### Bühlmann ZH-L16C 模型

使用 16 个组织隔室，每个隔室有独立的：
- 氮气半衰期 (5.0 ~ 635.0 分钟)
- 氦气半衰期 (1.88 ~ 240.03 分钟)
- M值系数 (a, b)

### 梯度因子

默认使用 GF 30/85：
- 低梯度因子 (GF Low)：0.30 (最大深度处)
- 高梯度因子 (GF High)：0.85 (水面处)

可通过命令行参数 `--gf-low` 和 `--gf-high` 自定义。

### Schreiner 方程

用于变深度情况下的组织压力计算：

```
P(t) = Pi + R*(t - 1/k) - (Pi - P0 - R/k) * e^(-kt)
```

其中：
- P(t)：时间t的组织压力
- Pi：初始惰性气体分压
- R：深度变化率
- k：ln(2)/半衰期
- t：时间

## 测试

### 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_parser.py

# 详细输出
pytest -v

# 覆盖率报告
pytest --cov=deco_reviewer
```

### 测试覆盖

| 模块 | 测试文件 | 用例数 |
|------|---------|--------|
| CSV解析器 | test_parser.py | 8 |
| Bühlmann模型 | test_buhlmann.py | 11 |
| 规则校验器 | test_validator.py | 15 |

## 验证流程

### 首次使用验证

1. **安装验证**
   ```bash
   pip install -e .
   deco-reviewer --version
   ```

2. **演示验证**
   ```bash
   deco-reviewer demo
   ```
   应该看到：
   - 安全潜水：无违规记录
   - 违规潜水：多项违规检测

3. **档案库验证**
   ```bash
   deco-reviewer list
   ```
   应该为空（演示数据不保存）

4. **完整流程验证**
   ```bash
   deco-reviewer analyze examples/safe_dive_20m_25min.csv
   deco-reviewer list
   deco-reviewer show DIVE_20260501_001
   deco-reviewer delete DIVE_20260501_001
   ```

### 测试数据说明

| 文件 | 描述 | 预期违规 |
|------|------|---------|
| safe_dive_20m_25min.csv | 20米25分钟，正确安全停留 | 0 |
| unsafe_dive_35m_36min.csv | 35米36分钟，无停留，快速上升 | 多项 |

## 输出示例

### 终端摘要

```
╭──────────────────────────────────────────────────────────╮
│           减压曲线复核员 - 潜水分析报告                   │
│ 状态: [green]✓ 安全潜水[/green]                          │
╰──────────────────────────────────────────────────────────╯

┌──────────────── 潜水基本信息 ────────────────┐
│ 项目         │ 数值                           │
├──────────────┼────────────────────────────────┤
│ 潜水ID       │ DIVE_20260501_001             │
│ 潜水员       │ 张教练                         │
│ 潜水日期     │ 2026-05-01                     │
│ 最大深度     │ 20.0 m                         │
│ 总时间       │ 35 分钟                        │
│ 气体类型     │ air (O2: 21.0%)               │
└──────────────┴────────────────────────────────┘

┌──────────────── 计算结果 ────────────────┐
│ 指标         │ 数值                         │
├──────────────┼──────────────────────────────┤
│ 当前NDL      │ [green]45 分钟[/green]      │
│ 最大深度NDL  │ 25 分钟                     │
│ CNS氧中毒    │ [green]5.2%[/green]         │
│ OTU氧毒性    │ [green]12.5[/green]         │
│ 领先隔室     │ # 3                          │
│ M值比值      │ [green]0.654[/green]        │
└──────────────┴──────────────────────────────┘

┌──────────────── 合规检查 ────────────────┐
│ [green]✓ 无违规记录[/green]              │
└───────────────────────────────────────────┘

✅ 分析完成！
```

## 注意事项

⚠️ **重要安全声明**

> 此工具仅供教育和复核用途，不能替代专业潜水电脑表或经过认证的减压计划软件。使用前请验证计算结果。潜水有风险，安全第一！

### 已知限制

1. **简化模型**：使用 BHLmann ZH-L16C 简化版，不包含所有专业减压软件的复杂功能
2. **单次潜水**：重复潜水的水面间隔处理为基础版
3. **温度影响**：当前版本不考虑水温对组织灌注的影响
4. **保守性**：默认梯度因子 GF 30/85 相对保守

## 扩展开发

### 添加新的校验规则

编辑 `deco_reviewer/validator.py`，添加新的 `_check_*` 方法。

### 自定义报告格式

编辑 `deco_reviewer/report.py` 中的 `generate_markdown` 或 `print_terminal_summary` 方法。

### 添加新的气体类型

编辑 `deco_reviewer/models.py` 中的 `GasType` 枚举。

## 许可证

仅供内部使用。

## 贡献

欢迎提交 Issue 和 Pull Request 来改进这个工具。

---

**减压曲线复核员** - 让每一次潜水更安全 🤿
