# 轨检车数据复核工具

一个用于铁路工务班组在维修计划前复核轨检车数据的 Python CLI 工具。

## 功能特性

- **数据读取**：支持读取轨道区间定义、几何检测点数据和超限规则配置
- **K里程归一采样**：按指定间隔对原始数据进行归一化采样
- **超限扣分计算**：根据轨距、水平、高低、轨向四个指标计算超限情况和扣分
- **病害段合并**：将连续超限点合并为病害段
- **维修优先级**：根据超限等级和长度自动计算维修优先级
- **多格式输出**：CSV 病害列表、Markdown 分析报告、交互式 HTML 里程图

## 项目结构

```
zy8150/
├── track_inspection/         # 核心包
│   ├── __init__.py          # 包入口
│   ├── models.py            # 数据模型定义
│   ├── reader.py            # 数据读取模块
│   ├── sampler.py           # K里程归一采样模块
│   ├── calculator.py        # 超限计算模块
│   ├── merger.py            # 病害合并模块
│   ├── reporter.py          # 报告导出模块
│   └── plotter.py           # HTML图表生成模块
├── sample_data/              # 示例数据
│   ├── track_sections.csv   # 轨道区间定义
│   ├── geometry_points.jsonl # 几何检测点数据
│   └── rules.yaml           # 超限规则配置
├── output/                   # 输出目录（运行后生成）
│   ├── issues.csv           # 病害段列表
│   ├── track_report.md      # 详细分析报告
│   └── track_chart.html     # 交互式里程图
├── track_inspect.py         # CLI 入口脚本
├── requirements.txt         # 依赖列表
└── README.md               # 本文档
```

## 安装依赖

```bash
pip3 install PyYAML
```

## 快速开始

### 使用示例数据运行

```bash
python3 track_inspect.py \
    --sections sample_data/track_sections.csv \
    --points sample_data/geometry_points.jsonl \
    --rules sample_data/rules.yaml \
    --output ./output
```

### 完整命令行参数

```bash
python3 track_inspect.py [OPTIONS]

选项:
  -s, --sections    轨道区间定义 CSV 文件 (默认: track_sections.csv)
  -p, --points      几何检测点 JSONL 文件 (默认: geometry_points.jsonl)
  -r, --rules       超限规则 YAML 文件 (默认: rules.yaml)
  -o, --output      输出目录 (默认: 当前目录)
  -i, --interval    采样间隔（米）(默认: 2.0米)
  -g, --merge-gap   病害合并间隔（米）(默认: 10.0米)
```

### 更多示例

```bash
# 使用 5 米采样间隔
python3 track_inspect.py -i 5 -o ./output

# 使用 15 米合并间隔
python3 track_inspect.py -g 15 -o ./output

# 使用当前目录默认文件
python3 track_inspect.py -o ./output
```

## 输入数据格式

### 1. track_sections.csv - 轨道区间定义

定义轨道的区间类型（直线/曲线）、里程范围等信息。

```csv
section_id,start_km,end_km,section_type,curve_direction,curve_radius
K100+000_100+200,100.000,100.200,straight,,
K100+200_100+500,100.200,100.500,curve,left,800
```

**字段说明：**
- `section_id`: 区间唯一标识
- `start_km`: 起始里程（公里）
- `end_km`: 结束里程（公里）
- `section_type`: 区间类型 (`straight` 直线, `curve` 曲线)
- `curve_direction`: 曲线方向 (`left` 左, `right` 右)，曲线段必填
- `curve_radius`: 曲线半径（米），曲线段必填

### 2. geometry_points.jsonl - 几何检测点数据

轨检车检测的原始几何数据，每行一个 JSON 对象。

```json
{"mileage": 100.000, "track_gauge": 1435.0, "level": 0.0, "alignment_left": 1.0, "alignment_right": 1.0, "profile_left": 1.0, "profile_right": 1.0}
{"mileage": 100.002, "track_gauge": 1435.2, "level": 0.5, "alignment_left": 1.5, "alignment_right": 1.2, "profile_left": 1.0, "profile_right": 1.0}
```

**字段说明：**
- `mileage`: 里程位置（公里）
- `track_gauge`: 轨距（毫米，标准值 1435mm）
- `level`: 水平（毫米）
- `alignment_left`: 左轨向（毫米）
- `alignment_right`: 右轨向（毫米）
- `profile_left`: 左高低（毫米）
- `profile_right`: 右高低（毫米）

### 3. rules.yaml - 超限规则配置

定义各指标的超限阈值和扣分规则。

```yaml
version: "1.0"

thresholds:
  track_gauge:
    straight:
      nominal: 1435.0
      tolerance_plus: 6.0
      tolerance_minus: 4.0
    curve:
      nominal: 1435.0
      tolerance_plus: 8.0
      tolerance_minus: 5.0

scoring:
  track_gauge:
    straight:
      minor: { threshold: 1.0, score: 5 }
      general: { threshold: 3.0, score: 10 }
      severe: { threshold: 6.0, score: 20 }
```

**注意：曲线段和直线段的阈值不同！**

## 输出文件说明

### 1. issues.csv - 病害段列表

包含所有合并后的病害段信息，可直接用 Excel 打开。

```csv
优先级,等级,起始里程(km),结束里程(km),长度(m),涉及指标,区间类型,总扣分,最大单级扣分
高,一般,100.014,100.024,10.0,"轨向,水平,高低,轨距",straight,90,10
中,轻微,100.402,100.520,118.0,"轨向,水平,高低",mixed,310,5
```

### 2. track_report.md - 详细分析报告

Markdown 格式的详细报告，包含：
- 基本信息（检测里程、采样点数等）
- 统计摘要（超限统计、病害段统计、扣分汇总）
- 病害段详细列表
- 维修建议

可通过任何 Markdown 阅读器查看，或转换为 PDF。

### 3. track_chart.html - 交互式里程图

可直接在浏览器中打开的交互式图表，包含：

**功能特性：**
- 轨距、水平、轨向、高低四个指标的趋势图
- 用不同颜色标记直线段和曲线段
- 高亮显示病害段位置（按优先级用不同颜色）
- 鼠标悬停显示详细数值
- 病害段详情表格

**查看方式：**
```bash
# macOS
open output/track_chart.html

# 或直接在浏览器中打开
# Chrome: 文件 -> 打开文件 -> 选择 track_chart.html
```

## 核心算法说明

### 1. K 里程归一采样

**处理要点：**
- **重复采样**：同一里程有多个检测点时取平均值
- **跨区间里程跳变**：根据里程值精确归属到对应区间
- **线性插值**：在采样点之间进行线性插值

**采样间隔**：默认 2 米，可通过 `-i` 参数调整。

### 2. 超限扣分计算

**四个检测指标：**

| 指标 | 说明 | 计算方式 |
|------|------|----------|
| 轨距 | 轨道宽度 | 与标准值 1435mm 的偏差 |
| 水平 | 左右轨高差 | 偏差绝对值 |
| 轨向 | 轨道方向 | 左右轨向最大值 |
| 高低 | 轨道高低 | 左右高低最大值 |

**曲线段与直线段的区别：**
- 曲线段阈值更宽松（轨距允许更大偏差）
- 扣分规则相同，但阈值起点不同

**超限等级：**
- **轻微**：偏差超过阈值 1-3mm（视指标而定），扣 5 分
- **一般**：偏差超过阈值 3-6mm，扣 10 分
- **严重**：偏差超过阈值 6mm+，扣 20 分

### 3. 病害段合并

**合并规则：**
- 按里程顺序处理超限点
- 同一里程范围内的不同指标超限合并
- 相邻超限点距离小于合并间隔（默认 10 米）则合并
- 合并后按总扣分和长度计算优先级

### 4. 维修优先级

**判定规则：**

| 优先级 | 条件 | 建议 |
|--------|------|------|
| 紧急 | 严重超限 + 长度>50m 或 扣分>50分 | 立即处理 |
| 高 | 一般/严重超限 + 长度>20m 或 扣分>30分 | 本周内处理 |
| 中 | 轻微/一般超限 + 长度>10m 或 扣分>15分 | 计划处理 |
| 低 | 其他情况 | 观察处理 |

## 注意事项

### 关于里程格式

- 里程单位为**公里**，如 `100.000` 表示 K100+000
- `100.500` 表示 K100+500
- 里程必须按从小到大顺序排列

### 关于曲线段

曲线段的阈值不同于直线段：
- 轨距：曲线段允许更大的正偏差（+8mm vs +6mm）
- 水平/轨向/高低：曲线段阈值也略有放宽

确保在 `track_sections.csv` 中正确标注曲线段。

### 常见问题

**Q: 为什么有些超限没有被检测到？**
A: 请检查：
1. 区间定义是否正确覆盖该里程
2. 该里程属于直线段还是曲线段
3. 规则文件中的阈值设置

**Q: 如何调整采样间隔？**
A: 使用 `-i` 参数：
```bash
python3 track_inspect.py -i 5 ...  # 5米采样
```

**Q: 如何调整病害合并间距？**
A: 使用 `-g` 参数：
```bash
python3 track_inspect.py -g 20 ...  # 20米内的超限合并
```

## 示例运行输出

```
============================================================
轨检车数据复核工具
============================================================
分析时间: 2026-05-03 13:55:13
采样间隔: 2.0 米
合并间隔: 10.0 米

[1/5] 读取轨道区间定义...
      共读取 4 个区间定义
        区间 1: 100.000km - 100.200km, straight
        区间 2: 100.200km - 100.500km, curve (R=800.0m)
        区间 3: 100.500km - 100.800km, straight
        区间 4: 100.800km - 101.000km, curve (R=1200.0m)

[2/5] 读取几何检测点数据...
      共读取 77 个检测点
      里程范围: 100.000km - 101.000km

[3/5] 读取超限规则配置...
      已加载规则版本: 1.0

[4/5] 按 K 里程归一化采样...
      归一化采样点: 501 个

[5/5] 计算超限和病害段...
      超限点数量: 342 个
      病害段数量: 4 个
      优先级分布: {'高': 1, '中': 3}

============================================================
导出结果...
  ✓ 病害段列表: output/issues.csv
  ✓ 详细报告: output/track_report.md
  ✓ 里程图: output/track_chart.html

============================================================
分析完成!

病害段摘要:
  #1 [高] 100.014km - 100.024km
      长度: 10.0m, 扣分: 90, 等级: 一般
  #2 [中] 100.402km - 100.520km
      长度: 118.0m, 扣分: 310, 等级: 轻微
  #3 [中] 100.922km - 101.000km
      长度: 78.0m, 扣分: 200, 等级: 轻微
  #4 [中] 100.132km - 100.182km
      长度: 50.0m, 扣分: 85, 等级: 轻微
```

## 许可证

仅供内部学习和使用。

---

*轨检车数据复核工具 - 为铁路工务班组提供精准的轨道状态分析*
