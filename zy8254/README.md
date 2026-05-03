# 演唱会场馆安检分析系统

一个用于演唱会场馆运营的本地数据分析与可视化工具，帮助在散场前复盘入场安检拥堵情况。

## 功能特性

- **数据读取与整合**：支持读取 CSV、JSONL、YAML 格式的多源数据
- **流量分析**：按闸口、票区和时间窗还原入场流量
- **异常检测**：自动识别以下异常情况：
  - 闸机离线
  - 同票重复入场
  - 包检通道超载
  - 跨午夜场次归属错误
- **可视化界面**：交互式 Web 界面，支持筛选场次/票区
- **拥堵峰值图**：实时展示入场流量时间分布
- **异常明细**：详细展示各类异常记录
- **报告导出**：支持导出 `gate_review.md` 和 `issues.csv`

## 项目结构

```
zy8254/
├── app.py                 # 主应用入口
├── requirements.txt       # Python 依赖
├── README.md             # 本文档
├── sample/               # 示例数据目录
│   ├── tickets.csv        # 门票信息
│   ├── gate_scans.jsonl   # 闸机扫描记录
│   ├── bag_check_lanes.csv # 包检通道配置
│   └── zone_rules.yaml    # 票区规则配置
├── src/                  # 源代码目录
│   └── data_processor.py  # 数据处理核心逻辑
└── exports/              # 导出文件目录（运行时生成）
```

## 快速开始

### 1. 环境要求

- Python 3.8+
- pip 包管理器

### 2. 安装依赖

```bash
cd /path/to/zy8254
pip install -r requirements.txt
```

### 3. 启动应用

```bash
streamlit run app.py
```

应用启动后，浏览器会自动打开 `http://localhost:8501`

### 4. 使用示例数据

项目已包含一组可直接演示的数据，位于 `sample/` 目录下：

#### 数据文件说明

| 文件名 | 格式 | 说明 |
|--------|------|------|
| `tickets.csv` | CSV | 门票信息，包含票号、场次、票区、有效期等 |
| `gate_scans.jsonl` | JSON Lines | 闸机扫描记录，包含扫描时间、闸机状态、是否包检等 |
| `bag_check_lanes.csv` | CSV | 包检通道配置，包含通道容量、状态等 |
| `zone_rules.yaml` | YAML | 票区与闸口映射、时间窗定义、拥堵阈值等 |

#### 示例数据包含的异常场景

示例数据中故意设计了以下异常情况，用于演示系统的检测能力：

1. **同票重复入场**：
   - 票号 `T00001` 在闸机 G1 于 18:15 和 18:25 两次入场（间隔 10 分钟，在阈值内）

2. **闸机离线**：
   - 闸机 G3 在扫描票号 `T00006` 和 `T00007` 时处于离线状态

3. **包检通道超载**：
   - 闸机 G4 在 18:22-18:24 期间 3 分钟内有 3 人入场，可能触发超载检测

4. **跨午夜场次归属错误**：
   - 票号 `T00011` 和 `T00012` 属于 5月5日的场次，但在 5月5日 00:30 之后入场，超过了 5月4日场次的有效期

## 数据格式规范

### tickets.csv

| 列名 | 类型 | 说明 |
|------|------|------|
| ticket_id | string | 票号（唯一标识） |
| event_id | string | 场次ID |
| event_name | string | 场次名称 |
| zone | string | 票区 |
| seat_number | string | 座位号 |
| purchase_time | datetime | 购票时间 |
| valid_from | datetime | 票有效期开始 |
| valid_to | datetime | 票有效期结束 |

### gate_scans.jsonl

每行一个 JSON 对象，包含以下字段：

| 字段 | 类型 | 说明 |
|------|------|------|
| scan_id | string | 扫描记录ID |
| gate_id | string | 闸机ID |
| ticket_id | string | 票号 |
| scan_time | datetime | 扫描时间 |
| scan_result | string | 扫描结果（success/failed） |
| gate_status | string | 闸机状态（online/offline） |
| bag_checked | boolean | 是否经过包检 |

### bag_check_lanes.csv

| 列名 | 类型 | 说明 |
|------|------|------|
| lane_id | string | 通道ID |
| gate_id | string | 所属闸机ID |
| max_capacity_per_minute | integer | 每分钟最大容量 |
| status | string | 通道状态 |
| last_maintenance | date | 上次维护日期 |

### zone_rules.yaml

```yaml
zone_gate_mapping:        # 票区与闸口映射
  A区:
    - G1
    - G2
  B区:
    - G3
    - G4

time_windows:             # 时间窗定义
  - name: "入场早高峰"
    start: "2026-05-04 18:00:00"
    end: "2026-05-04 18:30:00"
    expected_traffic: "high"

thresholds:               # 检测阈值
  congestion_threshold_per_minute: 10    # 每分钟拥堵阈值
  bag_check_overload_multiplier: 1.5     # 包检超载倍率
  duplicate_entry_interval_minutes: 5     # 重复入场间隔（分钟）
```

## 使用说明

### 界面功能

1. **左侧边栏**：
   - 数据目录：选择数据文件所在目录（默认 `sample`）
   - 选择场次：筛选特定场次
   - 选择票区：筛选特定票区

2. **实时概览**：
   - 四个指标卡片显示各类异常数量
   - 绿色表示正常，红色/橙色表示需关注

3. **入场流量分析**（三个标签页）：
   - **时间分布**：折线图展示入场流量随时间变化，可选择时间间隔（1分钟/5分钟/15分钟/30分钟/1小时），自动标注拥堵峰值
   - **闸口分布**：柱状图展示各闸口入场流量
   - **票区分布**：饼图展示各票区入场流量占比

4. **异常明细**：
   - 可筛选异常类型
   - 每种类型以折叠面板展示详细记录
   - 包含关键信息如票号、场次、时间等

5. **导出报告**：
   - 导出 `issues.csv`：所有异常记录的 CSV 格式
   - 导出 `gate_review.md`：完整的复盘报告，包含统计、详情和建议

### 异常类型说明

| 异常类型 | 说明 | 检测逻辑 |
|----------|------|----------|
| 同票重复入场 | 同一张票在短时间内多次入场 | 同一票号在设定间隔内多次扫描 |
| 闸机离线 | 闸机在离线状态下进行扫描 | 扫描记录中 gate_status 为 offline |
| 包检通道超载 | 单位时间内入场人数超过通道容量 | 每分钟流量超过容量 × 超载倍率 或 超过拥堵阈值 |
| 跨午夜场次归属错误 | 入场时间超出票的有效期 | 扫描时间晚于票的 valid_to 时间 |

## 自定义数据

1. 参考 `sample/` 目录下的文件格式准备自己的数据
2. 将数据文件放在一个目录中（如 `my_data/`）
3. 启动应用后，在左侧边栏修改"数据目录"为你的数据目录路径

## 技术栈

- **Python 3.8+**：核心开发语言
- **Streamlit**：快速构建数据可视化 Web 应用
- **Pandas**：数据处理和分析
- **Plotly**：交互式图表
- **PyYAML**：YAML 文件解析

## 输出文件说明

### issues.csv

包含所有检测到的异常记录，字段因异常类型而异，通用字段包括：
- issue_type：异常类型
- severity：严重程度（high/medium）
- ticket_id：票号
- event_id/event_name：场次信息
- zone：票区
- gate_id：闸机ID
- 其他类型特定字段

### gate_review.md

Markdown 格式的复盘报告，包含：
- 生成时间
- 场次概览
- 异常统计
- 详细异常记录（按类型分类表格）
- 改进建议

## 常见问题

**Q: 为什么没有检测到异常？**
A: 请检查：
1. 数据格式是否符合规范
2. 阈值设置是否合理（可修改 `zone_rules.yaml` 中的 thresholds）
3. 数据中是否确实存在异常

**Q: 如何调整检测阈值？**
A: 修改 `zone_rules.yaml` 文件中的 `thresholds` 部分：
- `congestion_threshold_per_minute`：每分钟拥堵阈值
- `bag_check_overload_multiplier`：超载倍率
- `duplicate_entry_interval_minutes`：重复入场判定间隔

**Q: 支持哪些时间格式？**
A: 支持标准的日期时间格式，如：
- `YYYY-MM-DD HH:MM:SS`
- `YYYY-MM-DDTHH:MM:SS`（ISO 格式）

## 许可证

MIT License
