# 陶瓷窑炉烧成曲线复盘系统

一个用于复盘陶瓷窑炉烧成曲线的桌面GUI应用，支持导入多源数据、自动检测风险、记录人工确认、导出复查报告。

## 功能特性

- **多格式数据导入**：支持CSV、JSONL、YAML格式的数据文件
- **曲线可视化**：使用matplotlib绘制升温、保温、降温完整时间线
- **风险自动检测**：
  - 升温速率超限
  - 保温时间不足
  - 探头数据断采
  - 跨午夜批次归属错位
- **人工确认管理**：记录确认人、备注、误报标记
- **报告导出**：
  - 导出问题列表 (issues.csv)
  - 导出复查报告 (firing_review.md)
- **数据持久化**：保存确认状态和操作历史

## 项目结构

```
kiln_review/
├── main.py                 # 主程序入口（GUI界面）
├── requirements.txt        # 项目依赖
├── README.md              # 本文档
├── modules/               # 核心模块
│   ├── __init__.py
│   ├── data_parser.py     # 数据解析模块
│   ├── rule_engine.py     # 规则引擎模块
│   ├── persistence.py     # 状态持久化模块
│   └── exporter.py        # 报告导出模块
└── sample_data/           # 示例数据
    ├── kiln_batches.csv       # 批次数据
    ├── temperature_log.jsonl  # 温度日志
    ├── recipe_rules.yaml      # 配方规则
    └── operator_notes.csv     # 操作员记录
```

## 快速开始

### 1. 环境准备

确保已安装 Python 3.8 或更高版本。

```bash
python --version
```

### 2. 安装依赖

```bash
pip install -r requirements.txt
```

### 3. 运行程序

```bash
python main.py
```

### 4. 导入测试数据

启动程序后，点击菜单：

**文件 → 导入Sample数据**

系统将自动加载 sample_data 目录下的所有示例数据并进行分析。

## 使用指南

### 导入数据

支持导入以下4类数据文件：

1. **批次数据 (CSV)**
   - 文件格式：kiln_batches.csv
   - 包含字段：batch_id, kiln_id, recipe_name, start_time, end_time, status, target_temp, operator

2. **温度日志 (JSONL)**
   - 文件格式：temperature_log.jsonl
   - 每行一个JSON对象，包含：timestamp, temperature, kiln_id, probe_id, is_valid

3. **配方规则 (YAML)**
   - 文件格式：recipe_rules.yaml
   - 定义升温速率限制、保温时间要求、烧成阶段配置

4. **操作员记录 (CSV)**
   - 文件格式：operator_notes.csv
   - 包含字段：note_id, batch_id, timestamp, content, author

### 查看批次

1. 左侧"批次列表"标签页显示所有批次
2. 使用窑炉下拉框筛选特定窑炉的批次
3. 点击"有问题"按钮只显示检测到风险的批次
4. 红色底色表示高风险批次，黄色底色表示中风险批次

### 分析温度曲线

选择任意批次后，右侧将显示：

1. **烧成曲线图**：
   - 蓝色曲线：温度数据
   - 绿色虚线：目标温度
   - 灰色X标记：无效数据点
   - 红色/橙色竖线：风险发生位置

2. **批次信息栏**：显示批次基本信息

3. **问题列表**：显示该批次检测到的所有风险

### 风险类型说明

| 风险类型 | 说明 | 严重程度 |
|---------|------|---------|
| 升温速率超限 | 实际升温速率超过配方规定上限 | 高/中 |
| 保温不足 | 保温时间不足或未达到目标温度 | 高/中 |
| 探头断采 | 数据采集中断或无效数据过多 | 高 |
| 跨午夜批次归属错位 | 批次可能被错误归属到前一天 | 中 |

### 人工确认

1. 在"问题列表"选择一个问题
2. 切换到"问题详情"标签页
3. 填写确认人姓名和备注
4. 点击：
   - **确认问题**：确认该问题真实存在
   - **标记误报**：标记为系统误报
   - **清除确认**：清除之前的确认状态

### 定位问题到曲线

1. 双击问题列表中的任意问题
2. 或选择问题后点击"定位到曲线"按钮
3. 图表将自动缩放并聚焦到问题发生的时间点

### 导出报告

#### 导出问题列表 (CSV)

菜单：**文件 → 导出问题列表 (CSV)**

输出格式示例：
```csv
问题ID,批次ID,风险类型,发生时间,严重程度,描述,详情,确认人,确认时间,是否误报,备注
ISS_20260403_0001,K01_20260402_002,升温速率超限,2026-04-02 10:10:00,高,升温速率超限: 240.0°C/h,actual_rate: 240.00; max_allowed: 150.00,李四,2026-04-03 15:30:00,否,阀门故障导致升温过快
```

#### 导出复查报告 (Markdown)

菜单：**文件 → 导出复查报告 (MD)**

报告包含：
- 风险统计概览
- 风险类型分布统计
- 每个批次的详细信息
- 问题详情和确认状态
- 操作员记录
- 风险类型说明附录

## Sample数据说明

示例数据包含4个批次，演示正常和异常场景：

### 批次 K01_20260401_001 (正常批次)
- 窑炉：K01
- 配方：standard_gas_kiln
- 状态：completed
- 升温速率正常（约120°C/h）
- 保温时间充足（约90分钟）
- 无风险检测

### 批次 K01_20260402_002 (异常批次)
- 窑炉：K01
- 配方：standard_gas_kiln
- 检测到的风险：
  1. **升温速率超限**：实际速率240°C/h > 上限150°C/h（高风险）
  2. **保温不足**：仅保温30分钟 < 要求60分钟（高风险）
  3. **探头断采**：12:00-13:30数据中断，4个无效数据点（高风险）

### 批次 K02_20260402_003 (跨午夜批次)
- 窑炉：K02
- 配方：fast_firing
- 时间：2026-04-02 22:00 至 2026-04-03 08:00
- 检测到的风险：
  - **跨午夜批次归属错位**：次日占比约67%，建议归属到次日

### 批次 K01_20260403_004 (正常批次)
- 窑炉：K01
- 配方：standard_gas_kiln
- 状态：completed
- 无风险检测

## 模块说明

### data_parser.py - 数据解析模块

核心类：
- `DataParser`：数据解析器
- `TemperaturePoint`：温度数据点
- `KilnBatch`：窑炉批次
- `RecipeRule`：配方规则
- `OperatorNote`：操作员记录

主要功能：
- `parse_kiln_batches()`：解析批次CSV
- `parse_temperature_log()`：解析温度日志JSONL
- `parse_recipe_rules()`：解析配方YAML
- `parse_operator_notes()`：解析操作员记录CSV
- `get_batch_temperature_data()`：获取批次关联的温度数据

### rule_engine.py - 规则引擎模块

核心类：
- `RuleEngine`：规则引擎
- `Issue`：问题实体
- `RiskType`：风险类型枚举

风险检测规则：

1. **升温速率超限检测** (`check_heating_rate`)
   - 计算相邻有效数据点的升温速率
   - 超过配方 max_heating_rate * 1.1 触发警告
   - 超过配方 max_heating_rate * 1.5 触发高风险

2. **保温不足检测** (`check_holding_time`)
   - 识别保温阶段（温度波动 < 10°C）
   - 保温时长 < min_holding_time 触发警告
   - 从未达到目标温度触发高风险

3. **探头断采检测** (`check_probe_connection`)
   - 数据间隔 > 预期间隔 * 3 触发断采警告
   - 无效数据占比 > 10% 触发警告

4. **跨午夜批次检测** (`check_midnight_alignment`)
   - 检查批次是否跨午夜
   - 次日占比 > 前一天2倍触发归属错位警告

### persistence.py - 状态持久化模块

核心类：
- `StatePersistence`：状态管理器

存储位置：`review_state/` 目录

存储内容：
- `confirmations.json`：问题确认状态
- `review_history.json`：操作历史记录
- `batch_{batch_id}_notes.json`：批次备注

主要功能：
- `save_confirmations()`：保存确认状态
- `load_confirmations()`：加载确认状态
- `apply_saved_confirmations()`：应用已保存的确认到问题列表
- `log_review_action()`：记录操作历史
- `get_review_history()`：获取操作历史
- `save_batch_notes()` / `load_batch_notes()`：批次备注管理

### exporter.py - 报告导出模块

核心类：
- `Exporter`：报告导出器

导出功能：
1. `export_issues_csv()`：导出问题列表CSV
   - 包含：问题ID、批次ID、风险类型、发生时间、严重程度、描述、详情、确认信息

2. `export_firing_review_md()`：导出复查报告Markdown
   - 概览统计
   - 风险类型统计表格
   - 每个批次的详细章节
   - 问题详情和确认状态
   - 操作员记录
   - 风险类型说明附录

3. `export_batch_summary_csv()`：导出批次摘要CSV
   - 批次基本信息
   - 问题数量统计
   - 整体状态评估

## 技术栈

- **GUI框架**：ttkbootstrap (基于tkinter的现代化主题)
- **图表库**：matplotlib (温度曲线可视化)
- **数据解析**：
  - csv模块 (CSV文件解析)
  - json模块 (JSONL文件解析)
  - PyYAML (YAML文件解析)
- **数据处理**：
  - datetime (日期时间处理)
  - pathlib (路径管理)
- **数据结构**：dataclasses (数据类定义)

## 开发说明

### 扩展新的风险类型

1. 在 `rule_engine.py` 的 `RiskType` 枚举添加新类型
2. 实现新的检测方法（类似 `check_heating_rate`）
3. 在 `analyze_batch()` 方法中调用新检测方法
4. 在 `exporter.py` 中添加风险类型的中文映射

### 添加新的数据格式

1. 在 `data_parser.py` 中实现新的解析方法
2. 在 `main.py` 的菜单中添加导入选项
3. 更新使用说明

## 常见问题

### Q: 程序无法启动？

检查以下几点：
1. Python版本是否 >= 3.8
2. 是否安装了所有依赖（运行 `pip install -r requirements.txt`）
3. 检查是否有冲突的Python包

### Q: 无法导入数据？

检查数据文件格式：
1. CSV文件必须有正确的表头
2. JSONL文件每行必须是有效的JSON对象
3. YAML文件格式必须正确（使用在线YAML验证器检查）
4. 日期时间格式必须是ISO格式（如 `2026-04-01T08:00:00`）

### Q: 曲线显示异常？

可能的原因：
1. 温度数据点太少
2. 时间戳顺序混乱
3. 无效数据点过多

建议检查温度日志文件格式是否正确。

### Q: 确认状态没有保存？

检查：
1. 程序是否有写入 `review_state/` 目录的权限
2. 目录是否存在（程序会自动创建）

## 版本历史

- v1.0.0 (2026-04-03)
  - 初始版本发布
  - 支持4类风险检测
  - 支持CSV/JSONL/YAML数据导入
  - 支持问题确认和状态持久化
  - 支持CSV和Markdown报告导出

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交Issue。
