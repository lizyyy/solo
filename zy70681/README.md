# 门店巡检整改复查扣分排查CLI工具

本地命令行工具，用于处理门店巡检、整改、复查、扣分全流程的数据管理。

## 功能特性

- **数据解析**：支持Excel/CSV格式，自动识别工作表类型
- **规则判断**：自动计算巡检评分、整改状态流转、复查驳回逻辑
- **来源追踪**：记录每条数据的文件位置，坏行保留原始位置
- **照片管理**：照片证据验证、重复检测、使用追踪
- **报告生成**：导出完整巡检报告、门店详情报告、单项追踪报告
- **结果稳定**：相同输入产生相同输出，排序不影响结果

## 安装

```bash
pip3 install -e .
```

## 使用命令

### 1. 汇总信息
```bash
# 显示完整汇总
python3 -m inspection_cli summary 数据文件.xlsx

# 仅显示警告
python3 -m inspection_cli warnings 数据文件.xlsx

# 仅显示门店评分
python3 -m inspection_cli scores 数据文件.xlsx

# 检查照片状态
python3 -m inspection_cli photos 数据文件.xlsx
```

### 2. 生成报告
```bash
# 生成完整Excel报告（默认使用稳定文件名，同一材料多次运行结果一致）
python3 -m inspection_cli report 数据文件.xlsx

# 生成JSON格式报告
python3 -m inspection_cli report 数据文件.xlsx --format json

# 生成带时间戳的报告（每次运行文件名不同）
python3 -m inspection_cli report 数据文件.xlsx --with-timestamp

# 生成指定门店详细报告
python3 -m inspection_cli store-report 数据文件.xlsx --store-id S001

# 生成指定巡检项追踪报告
python3 -m inspection_cli item-report 数据文件.xlsx --item-id I001
```

### 3. 可复跑性保证
报告生成默认使用**稳定文件名**，文件名基于数据内容的哈希值（`inspection_report_内容哈希.xlsx`）。相同输入材料多次运行时：
- 报告文件名保持一致（不会因时间戳产生差异）
- 所有数据按业务 ID 稳定排序
- 报告内容字节级一致

如需每次生成不同的报告文件，可添加 `--with-timestamp` 参数。

## 数据格式说明

Excel文件支持以下工作表（自动识别关键词）：

| 工作表类型 | 识别关键词 | 说明 |
|-----------|-----------|------|
| 门店信息 | 门店、店铺、store | 门店基础信息 |
| 巡检记录 | 巡检、检查、inspection | 巡检项评分记录 |
| 整改任务 | 整改、任务、task | 整改任务清单 |
| 复查记录 | 复查、recheck | 复查结果记录 |
| 扣分记录 | 扣分、deduction | 扣分详情 |
| 照片清单 | 照片、图片、photo | 照片证据列表 |

## 示例数据

```bash
cd examples
python3 generate_sample_data.py
```

生成 `巡检示例数据.xlsx` 包含完整测试数据。

## 项目结构

```
inspection_cli/
├── models/          # 数据模型
│   └── base.py     # 门店、巡检、整改、复查等数据类
├── parsers/         # 数据解析
│   └── parser.py   # Excel/CSV解析器
├── rules/           # 规则引擎
│   └── engine.py   # 评分、状态、警告规则
├── photo/           # 照片管理
│   └── manager.py  # 照片验证、重复检测
├── report/          # 报告生成
│   └── generator.py # Excel/JSON报告生成
├── utils/           # 工具函数
│   └── helpers.py  # 稳定哈希、字符串处理
└── cli.py           # 命令行入口
```
