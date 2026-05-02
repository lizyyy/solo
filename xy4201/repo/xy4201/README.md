# 窑烧曲线复盘台

专为陶艺工作室主理人设计的桌面GUI应用，用于窑烧后的数据分析、风险检测和复盘报告生成。

## 功能特性

- **数据导入**：支持导入窑炉温度CSV、烧成计划JSON、釉料批次表、作品列表和观察备注
- **风险检测**：自动检测以下问题：
  - 升温速率超限
  - 保温时间不足
  - 层间温差过大
  - 釉料批次不匹配（批次不存在、已过期、已用完）
  - 作品编号重复
- **人工复核**：支持对检测到的风险进行人工复核（确认、忽略、解决）
- **数据持久化**：本地JSON存储，无需数据库
- **报告导出**：
  - 导出 Markdown 格式的完整复盘报告
  - 导出 CSV 格式的问题清单

## 项目结构

```
窑烧曲线复盘台/
├── main.py                     # 主程序入口
├── requirements.txt            # 项目依赖
├── README.md                   # 本文档
├── gui/                        # GUI模块
│   ├── __init__.py
│   └── main_window.py         # 主窗口
├── models/                     # 数据模型
│   ├── __init__.py
│   └── data_models.py         # 所有数据类定义
├── parsers/                    # 文件解析器
│   ├── __init__.py
│   ├── base_parser.py         # 解析器基类
│   ├── temperature_parser.py  # 温度CSV解析
│   ├── firing_plan_parser.py  # 烧成计划JSON解析
│   ├── glaze_batch_parser.py  # 釉料批次CSV解析
│   └── observation_parser.py  # 观察备注解析
├── rules/                      # 规则引擎
│   ├── __init__.py
│   ├── base_rule.py           # 规则基类
│   ├── rate_rule.py           # 升温速率检查
│   ├── insulation_rule.py     # 保温时间检查
│   ├── temperature_diff_rule.py # 层间温差检查
│   ├── batch_match_rule.py    # 釉料批次匹配检查
│   └── rule_engine.py         # 规则引擎
├── persistence/                # 数据持久化
│   ├── __init__.py
│   └── data_store.py          # 本地存储管理
├── import_export/              # 导入导出
│   ├── __init__.py
│   ├── markdown_exporter.py   # Markdown报告导出
│   └── csv_exporter.py        # CSV问题清单导出
├── samples/                    # 示例数据
│   ├── sample_temperature.csv     # 示例温度数据
│   ├── sample_firing_plan.json    # 示例烧成计划
│   ├── sample_glaze_batches.csv   # 示例釉料批次
│   ├── sample_work_pieces.csv     # 示例作品列表
│   └── sample_observations.txt    # 示例观察备注
└── tests/                      # 测试文件
    ├── __init__.py
    ├── test_data_models.py    # 数据模型测试
    ├── test_parsers.py        # 解析器测试
    ├── test_rules.py          # 规则引擎测试
    └── test_persistence.py    # 持久化测试
```

## 环境要求

- Python 3.8+
- Tkinter（通常随Python一起安装）

## 安装与运行

### 1. 安装依赖

```bash
cd 窑烧曲线复盘台
pip install -r requirements.txt
```

**注意**：本项目主要使用Python标准库，`requirements.txt` 中的依赖较少。Tkinter 通常已随Python安装。

### 2. 运行应用

```bash
python main.py
```

## 使用指南

### 快速开始（使用示例数据）

1. **启动应用**：运行 `python main.py`

2. **新建记录**：
   - 点击左侧面板的「新建记录」按钮
   - 输入记录名称，如「2024年第一窑复盘」
   - 点击「确定」

3. **导入数据**：
   - 点击菜单栏「导入」→「窑炉温度CSV」，选择 `samples/sample_temperature.csv`
   - 点击菜单栏「导入」→「烧成计划JSON」，选择 `samples/sample_firing_plan.json`
   - 点击菜单栏「导入」→「釉料批次表」，选择 `samples/sample_glaze_batches.csv`
   - 点击菜单栏「导入」→「作品列表」，选择 `samples/sample_work_pieces.csv`
   - 点击菜单栏「导入」→「观察备注」，选择 `samples/sample_observations.txt`

4. **执行分析**：
   - 点击菜单栏「分析」→「执行风险检测」
   - 或点击概览标签页的「执行风险检测」按钮

5. **查看风险**：
   - 切换到「风险问题」标签页
   - 查看检测到的所有风险问题
   - 可以按风险级别或类型筛选
   - 可以对单个风险进行复核，或批量复核

6. **查看时间线**：
   - 切换到「时间线」标签页
   - 查看烧成过程的时间线事件

7. **保存记录**：
   - 点击菜单栏「文件」→「保存当前记录」
   - 记录会保存在本地 `data/` 目录下

8. **导出报告**：
   - 点击菜单栏「导出」→「Markdown复盘报告」
   - 选择保存位置，导出完整的复盘报告
   - 或点击「CSV问题清单」导出风险汇总

### 详细功能说明

#### 数据文件格式

##### 1. 窑炉温度CSV

格式要求：
```csv
时间,上层,中层,下层
2024-01-15 08:00:00,25.0,24.5,24.8
2024-01-15 08:10:00,80.0,78.5,75.0
```

- 第一列必须是时间戳，格式支持 `YYYY-MM-DD HH:MM:SS`
- 后续列是各层温度数据，列名为层位名称

##### 2. 烧成计划JSON

格式要求：
```json
{
    "plan_id": "FP-2024-001",
    "name": "标准氧化烧成计划",
    "segments": [
        {
            "segment_id": "S1",
            "name": "预热阶段",
            "start_temperature": 25,
            "end_temperature": 300,
            "rate": 150,
            "hold_time_minutes": 0
        },
        {
            "segment_id": "S2",
            "name": "保温阶段",
            "start_temperature": 1220,
            "end_temperature": 1220,
            "rate": 0,
            "hold_time_minutes": 30
        }
    ]
}
```

- `rate`: 升温速率（℃/小时），保温阶段为0
- `hold_time_minutes`: 保温时间（分钟）

##### 3. 釉料批次表CSV

格式要求：
```csv
batch_id,glaze_name,formula,quantity,unit,created_date,expiration_date,notes,status
GB-2024-001,青瓷釉,长石40%,5000,g,2024-01-01,2025-01-01,新批次,可用
```

- `status` 字段值：`可用`、`已过期`、`已用完`

##### 4. 作品列表CSV

格式要求：
```csv
work_id,title,artist,glaze_batch_id,shelf_layer,notes,status
W-001,青瓷花瓶,张三,GB-2024-001,上层,手工拉坯,待烧成
```

- `glaze_batch_id` 关联釉料批次表中的 `batch_id`

##### 5. 观察备注

支持两种格式：

**带时间戳格式（推荐）：**
```txt
[2024-01-15 09:30:00] 上层温度上升略快 - 张三
[2024-01-15 10:00:00] 进入氧化阶段 - 李四
```

**纯文本格式：**
```txt
上层温度上升略快，可能需要关注
进入氧化阶段，注意氧化是否充分
```

#### 风险类型说明

| 风险类型 | 说明 | 检测条件 |
|---------|------|---------|
| 升温速率超限 | 实际升温速率超过计划限值 | 计算相邻温度点的实际速率，与计划阶段速率比较 |
| 保温时间不足 | 保温阶段持续时间不够 | 检测温度保持在±20℃范围内的时间，与计划保温时间比较 |
| 层间温差过大 | 各层之间温度差异过大 | 检测同一时间点各层温度的最大温差（默认阈值50℃） |
| 釉料批次不匹配 | 作品关联的釉料批次不存在、已过期或已用完 | 检查work_pieces中的glaze_batch_id是否存在且可用 |
| 作品编号重复 | 存在相同的作品编号 | 检测work_id是否唯一 |

#### 复核状态

- **待复核**：新检测到的风险，等待人工确认
- **已确认**：确认该风险确实存在，需要后续处理
- **已忽略**：认为该风险不重要，可以忽略
- **已解决**：该风险问题已经处理完毕

## 运行测试

### 运行所有测试

```bash
python -m pytest tests/ -v
```

### 运行特定测试模块

```bash
# 测试数据模型
python -m pytest tests/test_data_models.py -v

# 测试解析器
python -m pytest tests/test_parsers.py -v

# 测试规则引擎
python -m pytest tests/test_rules.py -v

# 测试持久化
python -m pytest tests/test_persistence.py -v
```

### 使用unittest运行测试

```bash
python -m unittest discover -s tests -v
```

## 示例数据验证流程

为了快速验证应用功能，可以使用 `samples/` 目录下的示例数据。这些数据包含以下预设问题：

### 预设问题场景

1. **升温速率超限**：
   - 示例温度数据中，上层升温速率在部分时段超过计划的200℃/小时

2. **保温时间不足**：
   - 计划保温30分钟，实际温度数据中保温时间较短

3. **层间温差过大**：
   - 上层、中层、下层之间存在明显温差，最高可达60℃

4. **釉料批次不匹配**：
   - W-003（均红盘子）使用了已过期的批次 GB-2024-003
   - W-004（透明茶杯）使用了已用完的批次 GB-2024-004
   - W-008（均红茶杯）使用了不存在的批次 GB-2024-INVALID

### 验证步骤

1. 启动应用：`python main.py`
2. 新建记录：点击「新建记录」，输入「测试记录」
3. 依次导入所有示例数据文件：
   - 温度CSV：`samples/sample_temperature.csv`
   - 烧成计划JSON：`samples/sample_firing_plan.json`
   - 釉料批次CSV：`samples/sample_glaze_batches.csv`
   - 作品列表CSV：`samples/sample_work_pieces.csv`
   - 观察备注：`samples/sample_observations.txt`
4. 执行分析：点击「分析」→「执行风险检测」
5. 验证结果：
   - 切换到「风险问题」标签页
   - 应该能看到：
     - 若干个「升温速率超限」的风险
     - 若干个「层间温差过大」的风险
     - 若干个「釉料批次不匹配」的风险
6. 测试复核功能：
   - 选中一个风险，点击「复核选中」
   - 选择「已确认」，输入备注
   - 确认风险状态已更新
7. 测试导出功能：
   - 点击「导出」→「Markdown复盘报告」
   - 选择保存位置，查看生成的报告
8. 测试保存功能：
   - 点击「文件」→「保存当前记录」
   - 关闭应用后重新打开
   - 点击「文件」→「打开记录」，确认记录已保存

## 技术架构

### 设计模式

1. **策略模式（Strategy Pattern）**：规则引擎中的规则设计
   - `BaseRule` 作为抽象基类
   - `RateRule`、`InsulationRule` 等作为具体策略实现
   - `RuleEngine` 作为上下文，统一执行所有规则

2. **工厂模式（Factory Pattern）**：文件解析器设计
   - 不同类型的文件使用不同的解析器
   - 统一的 `parse()` 接口

3. **MVC架构**：GUI设计
   - 数据模型：`FiringRecord` 等数据类
   - 视图：`MainWindow` 中的GUI组件
   - 控制器：事件处理方法

### 数据持久化

- 使用JSON格式本地存储
- 数据目录：`data/`（运行时自动创建）
- 记录索引：`data/index.json`
- 记录数据：`data/records/{record_id}.json`
- 自动备份：每次保存前会创建 `.bak` 备份文件

## 扩展开发

### 添加新的规则

1. 在 `rules/` 目录下创建新的规则文件
2. 继承 `BaseRule` 类
3. 实现 `check()` 方法
4. 在 `rule_engine.py` 的 `RuleEngine.__init__` 中注册新规则

示例：
```python
# rules/my_new_rule.py
from .base_rule import BaseRule
from models.data_models import Risk, RiskType, RiskLevel

class MyNewRule(BaseRule):
    def __init__(self):
        super().__init__("MyNewRule", "自定义规则描述")
    
    def check(self, record):
        risks = []
        # 实现检查逻辑
        return risks
```

### 支持新的文件格式

1. 在 `parsers/` 目录下创建新的解析器
2. 继承 `BaseParser` 类
3. 实现 `parse()` 方法
4. 在GUI中添加对应的导入菜单项

## 常见问题

### Q1: Tkinter 未安装？

在某些Linux发行版上，Tkinter可能没有默认安装：

```bash
# Ubuntu/Debian
sudo apt-get install python3-tk

# CentOS/RHEL
sudo yum install python3-tkinter
```

### Q2: 如何修改检测阈值？

可以直接修改对应规则文件中的参数：

- 升温速率容忍度：`rules/rate_rule.py` 中的 `tolerance` 参数
- 层间温差阈值：`rules/temperature_diff_rule.py` 中的 `max_diff_threshold`
- 保温温度偏差：`rules/insulation_rule.py` 中的 `temperature_tolerance`

### Q3: 数据存储在哪里？

默认存储在 `data/` 目录下，可以通过修改 `DataStore` 的 `data_dir` 参数来更改位置。

### Q4: 如何备份数据？

直接复制整个 `data/` 目录即可。每次保存时也会自动创建 `.bak` 备份文件。

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 实现完整的GUI界面
- 实现温度数据、烧成计划、釉料批次、作品列表、观察备注的导入解析
- 实现四大规则引擎：速率、保温、温差、批次匹配
- 实现本地JSON持久化
- 实现Markdown报告和CSV问题清单导出
- 提供示例数据和测试用例

## 许可证

本项目仅供学习和内部使用。

---

**陶艺工作室主理人小贴士**：
- 建议每次开窑后及时导入数据进行复盘
- 定期检查釉料批次的有效期
- 保存好每次的复盘报告，用于优化后续的烧成工艺
