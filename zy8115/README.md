# 舞台灯光时间线复核工具

用于舞台监督在彩排前复核灯光时间线的本地桌面工具。

## 功能特性

### 核心功能
- **数据加载**：支持三种数据格式
  - 灯光 CUE 列表 (CSV)
  - 曲目时间轴 (JSON)
  - 设备通道配置 (YAML)

- **智能风险检测**：自动检测以下问题
  - **通道重叠**：同一通道在不同 CUE 中的时间重叠
  - **时间过早**：CUE 时间早于关联曲目的起点
  - **缺失标记**：CUE 关联的曲目标记不存在
  - **未知通道**：使用了设备配置中未定义的通道
  - **重复编号**：重复的 CUE 编号
  - **配置冲突**：同一通道在不同场景的配置不一致

- **风险确认**：支持将风险标记为已确认，并持久保存
- **报告导出**：支持导出 Markdown 和 CSV 格式的复核报告
- **筛选功能**：按场景、设备、风险类型、风险级别筛选数据

### 界面功能
- **CUE 列表**：显示所有灯光 CUE 的顺序、时间、关联曲目等信息
- **通道占用**：显示每个通道的使用情况和冲突状态
- **风险列表**：按优先级显示检测到的风险
- **风险详情**：查看风险的详细信息和确认状态

## 项目结构

```
zy8115/
├── models.py           # 数据模型定义
├── parsers.py          # 数据解析器
├── risk_detector.py    # 风险检测器
├── utils.py            # 工具类（持久化、导出）
├── gui_app.py          # 图形界面应用
├── main.py             # 主入口（支持GUI和CLI）
├── requirements.txt    # Python依赖
├── examples/           # 示例数据
│   ├── lighting_cues.csv      # 灯光CUE示例
│   ├── track_timeline.json    # 曲目时间轴示例
│   └── device_channels.yaml   # 设备通道配置示例
└── README.md           # 本文档
```

## 安装说明

### 环境要求
- Python 3.8 或更高版本
- pip 包管理器

### 安装依赖

```bash
# 进入项目目录
cd /path/to/zy8115

# 安装依赖
pip install -r requirements.txt
```

### 依赖列表
- **PyYAML**：用于解析 YAML 配置文件
- **python-dateutil**：日期时间处理
- **pandas**：数据处理（可选，用于高级分析）
- **numpy**：数值计算（可选）
- **matplotlib**：数据可视化（可选）
- **pytest**：测试框架（可选）

## 使用方法

### 方式一：图形界面（推荐）

```bash
python main.py
```

或直接运行：

```bash
python gui_app.py
```

#### GUI 操作步骤

1. **启动应用**：运行上述命令打开图形界面
2. **加载数据**：
   - 方式一：`文件` → `从目录自动加载` → 选择包含数据文件的目录
   - 方式二：分别加载 `文件` → `加载灯光CUE`、`加载曲目时间轴`、`加载设备通道`
3. **运行检测**：`操作` → `运行风险检测` 或点击界面上的按钮
4. **查看风险**：在右侧风险列表中查看检测到的问题
5. **确认风险**：选中风险后点击 `确认风险` 按钮（可填写确认人）
6. **保存项目**：`文件` → `保存项目`（保存风险确认状态）
7. **导出报告**：`操作` → `导出Markdown报告` 或 `导出CSV报告`

### 方式二：命令行模式

```bash
# 查看帮助
python main.py --help

# 从目录自动加载并导出报告
python main.py --directory ./examples --export-md report.md --export-csv report.csv

# 指定各个文件并保存项目
python main.py \
  --cues-file ./examples/lighting_cues.csv \
  --timeline-file ./examples/track_timeline.json \
  --channels-file ./examples/device_channels.yaml \
  --save my_project.json \
  --export-md report.md \
  --verbose

# 命令行参数说明
# --directory, -d    从目录自动加载项目文件
# --cues-file        灯光CUE CSV文件路径
# --timeline-file    曲目时间轴JSON文件路径
# --channels-file    设备通道YAML文件路径
# --project-name     项目名称
# --save             保存项目到JSON文件
# --export-md        导出Markdown报告
# --export-csv       导出CSV风险报告
# --export-cues      导出CUE列表CSV
# --verbose, -v      显示详细信息
```

## 数据格式说明

### 1. 灯光 CUE CSV 格式

| 字段名 | 类型 | 必填 | 说明 |
|--------|------|------|------|
| cue_number | 字符串 | 是 | CUE 编号，如 "Q1", "Q2" |
| scene | 字符串 | 是 | 场景名称 |
| description | 字符串 | 否 | CUE 描述 |
| time | 浮点数 | 是 | 全局触发时间（秒） |
| track_name | 字符串 | 否 | 关联的曲目名称 |
| track_time | 浮点数 | 否 | 相对于曲目的时间（秒） |
| channels | JSON字符串 | 是 | 通道配置，格式为 `{通道号: 值, ...}` |
| fade_in | 浮点数 | 否 | 淡入时间（秒） |
| fade_out | 浮点数 | 否 | 淡出时间（秒） |
| notes | 字符串 | 否 | 备注 |

**示例：**
```csv
cue_number,scene,description,time,track_name,track_time,channels,fade_in,fade_out,notes
Q1,开场,主舞台灯光亮起,0.0,序曲,0.0,"{1: 100, 2: 100}",3.0,0.0,开场效果
Q2,开场,追光聚焦主持人,2.5,序曲,2.5,"{4: 100}",2.0,0.0,主持人登场
```

### 2. 曲目时间轴 JSON 格式

```json
{
  "project_name": "项目名称",
  "tracks": [
    {
      "name": "曲目名称",
      "start_time": 0.0,
      "end_time": 60.0,
      "duration": 60.0,
      "cue_points": [0.0, 10.0, 30.0],
      "description": "曲目描述"
    }
  ]
}
```

**字段说明：**
- `name`: 曲目名称（与 CUE 中的 track_name 对应）
- `start_time`: 曲目开始时间（全局时间，秒）
- `end_time`: 曲目结束时间（全局时间，秒）
- `duration`: 曲目时长（秒）
- `cue_points`: 曲目中的关键时间点列表
- `description`: 曲目描述

### 3. 设备通道 YAML 格式

```yaml
project_info:
  name: "项目名称"
  venue: "演出场地"

scenes:
  - name: "场景名称"
    description: "场景描述"
    devices:
      - channel: 1
        name: "设备名称"
        type: "设备类型"
        description: "设备描述"
        patch: 1
```

**字段说明：**
- `channel`: DMX 通道号
- `name`: 设备名称
- `type`: 设备类型（如 "LED Par", "Moving Head", "Spotlight"）
- `scene`: 所属场景
- `description`: 设备描述
- `patch`: 物理跳线位置（可选）

## 风险检测规则

### 1. 通道重叠 (CHANNEL_OVERLAP)
**检测条件**：
- 同一通道在多个 CUE 中被使用
- CUE 的时间范围存在重叠（考虑淡入淡出时间）

**风险级别**：高 (HIGH)

**说明**：
- 当两个 CUE 在时间上重叠且使用了同一通道时，可能导致灯光效果冲突
- 检测器会计算每个 CUE 的有效时间范围（触发时间 ± 淡入淡出时间）
- 如果相邻 CUE 的时间范围有重叠，则标记为风险

### 2. 时间早于曲目起点 (TIME_BEFORE_TRACK_START)
**检测条件**：
- CUE 关联了曲目
- CUE 的全局触发时间早于曲目的开始时间
- 或 CUE 的曲目相对时间为负值

**风险级别**：严重 (CRITICAL)

**说明**：
- 这表示 CUE 被设置在曲目开始之前触发，可能导致不同步
- 全局时间与曲目时间的对应关系需要仔细检查

### 3. 缺失曲目标记 (MISSING_TRACK_MARKER)
**检测条件**：
- CUE 关联的曲目名称在曲目时间轴中不存在

**风险级别**：高 (HIGH)

**说明**：
- 可能是曲目名称拼写错误
- 或曲目时间轴文件未包含该曲目

### 4. 未知通道 (UNKNOWN_CHANNEL)
**检测条件**：
- CUE 使用的通道号在设备通道配置中未定义

**风险级别**：中 (MEDIUM)

**说明**：
- 可能是通道号配置错误
- 或设备配置文件不完整

### 5. 无效 CUE 编号 (INVALID_CUE_NUMBER)
**检测条件**：
- 多个 CUE 使用了相同的编号

**风险级别**：高 (HIGH)

### 6. 通道配置冲突 (CHANNEL_CONFLICT)
**检测条件**：
- 同一通道号在不同场景配置了不同的设备名称或类型

**风险级别**：中 (MEDIUM)

## 报告导出格式

### Markdown 报告包含内容
1. **统计摘要**：风险总数、已确认/未确认数量
2. **风险级别分布**：按严重程度统计
3. **风险类型分布**：按问题类型统计
4. **项目数据概览**：CUE、曲目、通道数量
5. **场景列表**：各场景的 CUE 数量
6. **风险详情**：
   - 未确认风险（按优先级排序）
   - 已确认风险（可选）
7. **CUE 列表**：完整的 CUE 信息
8. **曲目时间轴**：所有曲目的时间范围
9. **设备通道配置**：通道与设备的对应关系

### CSV 报告字段
- 风险ID、风险类型、风险级别、标题、详细描述
- 影响CUE、影响通道、影响曲目、参考时间
- 是否已确认、确认人、确认时间、确认备注

## 示例数据说明

项目包含的示例数据文件位于 `examples/` 目录：

### lighting_cues.csv
包含 10 个示例 CUE，设计了多种测试场景：
- **正常 CUE**：Q1-Q5、Q10
- **通道重叠测试**：Q6 和 Q7（通道 1、2 重叠）
- **时间过早测试**：Q8（时间 -5.0s，早于曲目起点）
- **未知通道测试**：Q9（使用通道 99、100，未在配置中定义）

### track_timeline.json
包含 5 首示例曲目：
- 序曲 (0s-8s)
- 第一幕主题曲 (10s-28s)
- 第二幕曲 (30s-38s)
- 第三幕曲 (35s-55s)
- 片尾曲 (55s-65s)

### device_channels.yaml
按场景组织的设备配置：
- **开场**：通道 1-3（主舞台基础照明）
- **第一幕**：通道 4-9（追光、背景、道具照明）
- **第二幕**：通道 1-2、4（复用部分设备）
- **第三幕**：通道 1-2、5-6（基础照明和背景）

## 风险确认持久化

风险确认状态通过以下方式保存：

### 1. 保存项目文件
- 格式：JSON
- 内容：包含所有项目数据和风险确认状态
- 使用：`文件` → `保存项目` 或 `--save` 参数

### 2. 项目文件结构
```json
{
  "name": "项目名称",
  "lighting_cues": [...],
  "track_markers": [...],
  "device_channels": [...],
  "risks": [
    {
      "id": "RISK_XXXXXXX",
      "risk_type": "通道重叠",
      "level": "高",
      "title": "...",
      "description": "...",
      "is_confirmed": true,
      "confirmed_by": "舞台监督",
      "confirmed_at": "2024-01-15T10:30:00",
      "notes": "确认备注"
    }
  ],
  "created_at": "2024-01-15T09:00:00",
  "updated_at": "2024-01-15T10:30:00"
}
```

## 常见问题

### Q1: 如何准备我的数据文件？
1. 从灯光控台导出 CUE 列表为 CSV 格式
2. 从音响系统导出曲目时间轴为 JSON 格式
3. 根据设备配置表创建设备通道 YAML 文件
4. 确保 CUE 中的 `track_name` 与曲目时间轴中的 `name` 一致

### Q2: 通道重叠一定是问题吗？
不一定。以下情况通道重叠可能是预期的：
- CUE 之间是递进关系（如亮度逐渐增加）
- 使用了不同的通道值（如从 50 变为 100）

建议：
1. 查看风险详情中的时间重叠范围
2. 确认 CUE 的实际效果是否符合预期
3. 如果是预期行为，将风险标记为已确认

### Q3: 如何批量确认风险？
- GUI 模式：点击 `确认所有风险` 按钮
- CLI 模式：加载项目后手动修改 `is_confirmed` 字段

### Q4: 支持哪些 DMX 控台的导出格式？
当前版本支持标准 CSV 格式。如果您的控台导出格式不同，可以：
1. 手动调整为支持的 CSV 格式
2. 或修改 `parsers.py` 中的解析逻辑

## 扩展开发

### 添加新的风险检测规则
1. 在 `models.py` 的 `RiskType` 枚举中添加新类型
2. 在 `risk_detector.py` 中实现新的检测方法
3. 在 `detect_all()` 方法中调用新方法

### 自定义报告格式
修改 `utils.py` 中的 `ReportExporter` 类：
- `export_markdown()`: 自定义 Markdown 报告内容
- `export_csv()`: 自定义 CSV 报告字段

## 许可证

本项目仅供内部使用。

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本发布
- 支持三种数据格式加载
- 实现 7 种风险检测规则
- 提供图形界面和命令行两种模式
- 支持 Markdown 和 CSV 报告导出
- 包含完整的示例数据