# 巡检缺项安全分级整改报告排查CLI

一个用于工厂巡检表分析的命令行工具，支持解析Excel表格、校验数据、按班组汇总、安全分级、以及导出多格式报告。

## 功能特性

- ✅ Excel表格解析
- ✅ 必填项数据校验
- ✅ 按班组统计汇总
- ✅ 缺项类型分类（安全项、保养项、环境项、操作项）
- ✅ 风险等级分级（高/中/低）
- ✅ 整改期限自动计算
- ✅ 多格式导出（文本、JSON、CSV）
- ✅ 丰富的命令行可视化输出

## 安装依赖

```bash
pip install pandas openpyxl click rich python-dateutil
```

## 使用方法

### 1. 分析巡检表并生成报告

```bash
# 基本使用
python3 main.py analyze samples/acceptance_normal.xlsx

# 指定输出目录
python3 main.py analyze samples/acceptance_normal.xlsx --output-dir output/

# 只显示概要
python3 main.py analyze samples/acceptance_normal.xlsx --no-show-detail

# 选择导出格式
python3 main.py analyze samples/acceptance_normal.xlsx --format json
```

### 2. 列出所有班组

```bash
python3 main.py list-teams samples/acceptance_normal.xlsx
```

### 3. 验证数据格式

```bash
python3 main.py validate samples/acceptance_abnormal.xlsx
```

### 4. 查看帮助

```bash
python3 main.py --help
python3 main.py analyze --help
```

## 输入Excel格式要求

必填列：
- 日期
- 设备编号
- 检查项
- 班组
- 缺项类型
- 是否完成

可选列：
- 巡检人
- 整改负责人
- 备注

## 风险分级规则

- **高风险**（1天内整改）：安全项 + 包含关键词（高压、消防、高空、动火、有毒、爆炸等）
- **中风险**（3天内整改）：安全项 + 包含关键词（机械、防护、防护罩、警示标识等）
- **低风险**（7天内整改）：保养项、环境项、操作项

## 样例数据

`samples/` 目录包含6种测试样例：

| 文件名 | 类型 | 说明 |
|--------|------|------|
| normal_sample.xlsx | 正常输入 | 20条完整记录 |
| dirty_data_sample.xlsx | 脏数据 | 格式错误、空值、未知类型 |
| boundary_conflict_sample.xlsx | 边界冲突 | 全部缺项、高风险集中 |
| empty_sample.xlsx | 空结果 | 空表格 |
| acceptance_normal.xlsx | 验收样例（正常） | 用于验收的8条标准数据 |
| acceptance_abnormal.xlsx | 验收样例（异常） | 包含错误数据的验收样例 |

## 验收测试

### 正常样例测试

```bash
python3 main.py analyze samples/acceptance_normal.xlsx --output-dir output/acceptance_normal
```

预期结果：
- 8条记录全部解析成功
- 总完成率 37.5%
- 安全项缺项4个，保养项缺项1个
- 高风险2个，中风险2个，低风险1个
- 3个班组数据完整
- 输出文件：txt报告、json数据、csv缺项表

### 异常样例测试

```bash
python3 main.py analyze samples/acceptance_abnormal.xlsx --output-dir output/acceptance_abnormal
```

预期结果：
- 成功解析6条有效记录
- 显示1个数据错误
- 错误提示与原始数据问题对应
- 报告与JSON、CSV数据一致

## 输出文件说明

| 文件类型 | 后缀 | 用途 |
|---------|------|------|
| 文本报告 | _report.txt | 人读，包含完整分析 |
| JSON数据 | _report.json | 机器读，结构化完整数据 |
| CSV缺项表 | _defects.csv | 可导入Excel，缺项明细 |

## 项目结构

```
.
├── main.py                 # CLI入口
├── requirements.txt        # 依赖列表
├── generate_samples.py     # 样例数据生成脚本
├── samples/               # 样例数据目录
├── output/                # 输出目录
└── src/
    └── inspection_cli/
        ├── __init__.py
        ├── models.py      # 数据模型
        ├── parser.py      # Excel解析器
        ├── analyzer.py    # 分析逻辑
        ├── exporter.py    # 报告导出
        └── cli.py         # CLI命令定义
```

## 验证要点（验收）

1. **数据一致性**：文本报告、JSON数据、CSV表格的统计数字必须完全一致
2. **错误捕获**：脏数据场景下，错误提示与实际数据问题对应
3. **边界处理**：空表格、全缺项、全高风险等场景能正常输出
4. **历史追踪**：输出文件带时间戳，可追踪历史版本
