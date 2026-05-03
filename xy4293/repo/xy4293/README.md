# 屋顶光伏串线校核器

县域光伏安装队专用本地计算工具，用于屋顶光伏系统的串线方案校核与优化。

## 功能特性

- **多源数据导入**：支持屋面分区CSV、组件参数、逆变器MPPT表、逐小时遮挡系数
- **核心计算**：温度修正计算、遮挡损失评估、线缆压降分析、逆变器匹配验证
- **方案优化**：自动生成2-3个优化方案，支持人工调整参数
- **风险检测**：低温开路电压超限、同一路串电流不一致、线损过高风险预警
- **报告导出**：支持Markdown/CSV/JSON三种格式的详细报告
- **方案保存**：支持方案配置的本地存储与加载

## 项目结构

```
pv-string-checker/
├── src/
│   └── pvchecker/
│       ├── __init__.py      # 包初始化
│       ├── dataparser.py    # 数据解析模块
│       ├── pvcalc.py        # 光伏计算核心模块
│       ├── solver.py        # 方案搜索模块
│       ├── risk.py          # 风险规则模块
│       ├── storage.py       # 状态存储模块
│       ├── exporter.py      # 导出模块
│       └── cli.py           # 命令行入口
├── data/
│   ├── samples/             # 示例数据目录
│   └── saved/               # 已保存方案目录
├── tests/                   # 测试用例
├── requirements.txt         # 依赖列表
├── setup.py                 # 安装配置
└── README.md                # 本文档
```

## 安装

### 依赖安装

```bash
pip install -r requirements.txt
```

### 开发安装

```bash
pip install -e .
```

## 快速开始

### 1. 准备数据

将以下数据文件放入 `data/samples/` 目录（项目已包含示例数据）：

- `roof_zones.csv` - 屋面分区信息
- `module_params.json` - 光伏组件参数
- `inverter_mppt.csv` - 逆变器MPPT参数表
- `shading_coefficients.csv` - 逐小时遮挡系数

### 2. 运行校核

```bash
# 使用示例数据运行
python3 -m pvchecker.cli analyze --data-dir ./data/samples/

# 或者指定各数据文件
python3 -m pvchecker.cli analyze \
  --roof-zones ./data/samples/roof_zones.csv \
  --module-params ./data/samples/module_params.json \
  --inverter-mppt ./data/samples/inverter_mppt.csv \
  --shading-coeff ./data/samples/shading_coefficients.csv
```

### 3. 调整参数

```bash
# 调整环境温度范围，重新计算
python3 -m pvchecker.cli analyze --min-temp -20 --max-temp 45 --data-dir ./data/samples/

# 同时导出报告
python3 -m pvchecker.cli analyze --data-dir ./data/samples/ --output ./report --format all
```

### 4. 导出报告

```bash
# 在分析时直接导出
python3 -m pvchecker.cli analyze --data-dir ./data/samples/ \
  --output ./reports/analysis \
  --format all
```

### 5. 保存和加载方案

```bash
# 保存当前方案（在分析时）
python3 -m pvchecker.cli analyze --data-dir ./data/samples/ --save "方案A-优化版"

# 列出已保存方案
python3 -m pvchecker.cli list
```

### 6. 验证数据

```bash
# 验证数据文件是否正确
python3 -m pvchecker.cli validate --data-dir ./data/samples/
```

### 7. 查看版本

```bash
python3 -m pvchecker.cli version
```

## 验证流程

### 完整验证步骤

以下是从0到1的完整验证流程：

#### 步骤1：安装依赖

```bash
cd /path/to/project
pip install -e .
```

#### 步骤2：验证数据文件

项目已包含示例数据，验证数据格式是否正确：

```bash
python3 -m pvchecker.cli validate --data-dir ./data/samples/
```

**预期输出：**
- 屋面分区：3个分区，共57块组件
- 组件参数：JKM550N-72HL4, 550.0W
- 逆变器参数：SUN-10K-SG04LP1-EU, 200.0-1000.0V
- 遮挡系数：12个月 × 24小时矩阵

#### 步骤3：验证温度修正计算

```bash
python3 -m pvchecker.cli test --test temperature
```

**验证点：**
- 标准测试条件(STC): 25°C, 1000W/m² 下参数应与组件规格书一致
- 开路电压温度系数: β = -0.32%/°C（负值表示温度升高电压降低）
- 低温工况(-10°C): 预期Voc应高于STC值（约增加 35 × 0.32% = 11.2%）
- 高温工况(60°C): 预期Voc应低于STC值（约减少 35 × 0.32% = 11.2%）

#### 步骤4：验证串并联方案计算

```bash
python3 -m pvchecker.cli test --test configuration
```

**验证逻辑：**
- 逆变器MPPT电压范围: 200V-1000V
- 组件Voc_STC: 59.2V
- 低温下(考虑1.15倍安全系数): 59.2V × 1.15 = 68.08V/块
- 最大串联块数计算: floor(1000 / 68.08) = 14块
- 最小串联块数计算: ceil(200 / (59.2 × 0.85)) = ceil(200 / 50.32) = 4块

#### 步骤5：验证遮挡损失计算

```bash
python3 -m pvchecker.cli test --test shading
```

**验证点：**
- 同一组串内，若某块组件遮挡系数为0.5
- 当该组件为瓶颈时，整串电流受限于该组件的短路电流
- 计算遮挡后的输出功率损失百分比

#### 步骤6：验证线缆压降计算

```bash
python3 -m pvchecker.cli test --test cable
```

**验证点：**
- 铜芯线单位电阻约 3.08 Ω/km（6mm²）
- 线缆长度: 50米 = 0.05 km
- 直流电流: 15A
- 预期压降: I × R × L = 15 × 3.08 × 0.05 ≈ 2.31V
- 线损占比不应超过2%（行业标准）

#### 步骤7：验证风险检测

```bash
python3 -m pvchecker.cli test --test risk
```

**风险规则验证：**

1. **电压超限风险**
   - 低温(-10°C)下计算的Voc × 串联块数
   - 如果超过逆变器最大直流输入电压 → 高风险
   - 安全裕度建议 >= 10%

2. **电流不匹配风险**
   - 同一MPPT下两路串的Isc差异
   - 差异超过10% → 中风险
   - 差异超过20% → 高风险

3. **线损过高风险**
   - 线缆压降/功率损耗超过2% → 中风险
   - 线缆压降/功率损耗超过5% → 高风险

#### 步骤8：运行完整分析

```bash
python3 -m pvchecker.cli analyze --data-dir ./data/samples/
```

**预期输出内容：**
- 基本参数摘要（组件、逆变器、总功率等）
- 3个方案对比（最小串联、最优串联、最大串联）
- 风险评估（红色=高风险，黄色=中风险，绿色=低风险）
- 关键建议

#### 步骤9：导出报告验证

```bash
# 导出所有格式报告
python3 -m pvchecker.cli analyze --data-dir ./data/samples/ \
  --output ./test_report \
  --format all

# 验证文件生成
ls -la ./test_report/
```

**预期生成文件：**
- `test_report.md` - Markdown格式报告
- `test_report.json` - JSON格式完整数据
- `test_report/` 目录下包含CSV文件

#### 步骤10：运行单元测试

```bash
# 运行所有测试
python3 -m pytest tests/ -v

# 或者运行特定模块测试
python3 -m pytest tests/test_pvcalc.py -v
python3 -m pytest tests/test_risk.py -v
```

**预期结果：** 所有95个测试应全部通过

### 快速验证清单

| 序号 | 验证项 | 命令 | 预期结果 |
|------|--------|------|----------|
| 1 | 版本信息 | `python3 -m pvchecker.cli version` | 显示版本1.0.0 |
| 2 | 数据验证 | `python3 -m pvchecker.cli validate -d ./data/samples/` | 4项数据全部有效 |
| 3 | 温度测试 | `python3 -m pvchecker.cli test -t temperature` | 低温Voc > 高温Voc |
| 4 | 方案测试 | `python3 -m pvchecker.cli test -t configuration` | 生成3个方案 |
| 5 | 遮挡测试 | `python3 -m pvchecker.cli test -t shading` | 检测到瓶颈效应 |
| 6 | 线缆测试 | `python3 -m pvchecker.cli test -t cable` | 计算线损正确 |
| 7 | 风险测试 | `python3 -m pvchecker.cli test -t risk` | 正确识别风险 |
| 8 | 完整分析 | `python3 -m pvchecker.cli analyze -d ./data/samples/` | 显示完整报告 |
| 9 | 单元测试 | `python3 -m pytest tests/` | 95测试全部通过 |

## 模块说明

### 1. dataparser.py - 数据解析

负责解析各种输入数据格式：
- `RoofZoneParser`: 解析屋面分区CSV
- `ModuleParser`: 解析组件参数JSON
- `InverterParser`: 解析逆变器MPPT表CSV
- `ShadingParser`: 解析逐小时遮挡系数CSV

### 2. pvcalc.py - 光伏计算核心

核心计算模块：
- `TemperatureCorrector`: 温度修正计算
  - 开路电压温度修正
  - 短路电流温度修正
  - 最大功率温度修正
  
- `IVCalculator`: I-V特性计算
  - 单块组件I-V曲线
  - 串联组串I-V曲线
  - 并联组串I-V曲线
  
- `ShadingCalculator`: 遮挡损失计算
  - 基于遮挡系数的电流限制
  - 组串级遮挡损失评估
  
- `CableLossCalculator`: 线缆压降计算
  - 直流线缆压降
  - 交流线缆压降
  - 线损功率和百分比计算

### 3. solver.py - 方案搜索

自动生成优化方案：
- `ConfigurationSolver`: 串并联方案求解器
  - 基于逆变器MPPT范围的串联块数计算
  - 基于组件数量的并联路数计算
  - 生成2-3个候选方案（最小串联、最优、最大串联）
  
- `Optimizer`: 方案优化器
  - 综合考虑效率、成本、风险
  - 多目标优化评分

### 4. risk.py - 风险规则

风险检测与评估：
- `RiskRule`: 风险规则基类
- `VoltageLimitRule`: 电压超限检测
- `CurrentMismatchRule`: 电流不匹配检测
- `CableLossRule`: 线损过高检测
- `RiskAssessor`: 风险综合评估器

### 5. storage.py - 状态存储

方案的保存与加载：
- `SchemeStorage`: 方案存储管理器
  - 保存方案配置到JSON
  - 从JSON加载方案
  - 方案列表管理

### 6. exporter.py - 导出模块

报告导出功能：
- `MarkdownExporter`: Markdown格式报告
- `CSVExporter`: CSV格式报告
- `JSONExporter`: JSON格式报告
- `ReportExporter`: 统一导出接口

## 测试运行

```bash
# 运行所有测试
pytest

# 运行特定测试
pytest tests/test_pvcalc.py -v

# 运行测试并生成覆盖率报告
pytest --cov=pvchecker --cov-report=html
```

## 常见问题

### Q1: 如何确定线缆规格？

参考以下经验值：
- 电流 < 10A: 2.5mm²
- 电流 10-20A: 4mm²
- 电流 20-30A: 6mm²
- 电流 > 30A: 10mm²或更大

### Q2: 温度系数如何获取？

从组件规格书(Datasheet)中查找：
- β (Voc温度系数): 通常为 -0.30% ~ -0.35%/°C
- α (Isc温度系数): 通常为 +0.04% ~ +0.06%/°C
- γ (Pmax温度系数): 通常为 -0.38% ~ -0.42%/°C

### Q3: 遮挡系数如何测量？

可以通过以下方式：
1. 现场勘察记录各时段遮挡情况
2. 使用专业软件模拟（如PVsyst、Helioscope）
3. 参考同区域已安装项目数据

## 许可证

MIT License

## 贡献

欢迎提交Issue和Pull Request。
