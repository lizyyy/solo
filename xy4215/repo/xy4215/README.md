# 巡检包断点补账员

地下管廊机器人巡检数据处理命令行工具

## 功能概述

针对地下管廊机器人巡检中常见的数据问题，提供完整的数据处理解决方案：

- **数据解析**：支持解析分段视频索引（JSON）、传感器数据（CSV）、人工缺陷标注（YAML）
- **数据校验**：检测时间戳跳变（断电导致）、里程桩号倒退、数据完整性问题
- **缺陷归并**：按管段合并多机器人重复标注的同一缺陷
- **风险评分**：基于缺陷类型、严重程度、证据数量计算风险等级
- **报告导出**：生成 Markdown/CSV/JSON 格式的分析报告

## 安装

### 环境要求

- Python 3.8+
- pip

### 安装步骤

```bash
# 克隆或下载项目到本地
cd xy4215

# 安装依赖
pip install -e .

# 验证安装
inspection-fixer --help
```

## 快速开始

### 1. 生成示例数据（可选）

```bash
# 生成所有类型的示例数据
inspection-fixer generate-samples

# 或只生成特定类型
inspection-fixer generate-samples -t overlapping -t normal
```

### 2. 执行完整处理流程

```bash
# 处理单个巡检包
inspection-fixer process ./test_samples/robot_001_normal

# 处理多个巡检包
inspection-fixer process ./test_samples/robot_*_overlapping

# 指定输出路径和格式
inspection-fixer process ./test_samples/robot_*_overlapping \
    -o ./reports/my_analysis \
    -f markdown -f csv -f json
```

### 3. 仅校验数据

```bash
# 校验数据质量，不执行归并和评分
inspection-fixer validate ./test_samples/*

# 导出校验报告
inspection-fixer validate ./test_samples/* -o ./reports/validation
```

## 主流程说明

完整的数据处理流程包含以下 5 个步骤：

```
解析 → 校验 → 归并 → 评分 → 导出
```

### 步骤 1：数据解析

自动识别巡检包目录中的所有数据文件：

- **JSON 文件**：解析为视频索引数据，包含分段视频信息、时间戳、里程桩号
- **CSV 文件**：解析为传感器数据，支持多种表头格式自动识别
- **YAML/YML 文件**：解析为缺陷标注数据，支持多种字段名

示例数据结构：
```
巡检包目录/
├── video_index.json      # 视频索引
├── sensor_data.csv       # 传感器数据
└── defect_annotations.yaml  # 缺陷标注
```

### 步骤 2：数据校验

检查以下问题：

| 问题类型 | 检测内容 | 严重程度 |
|---------|---------|---------|
| 时间戳跳变 | 相邻记录时间间隔超过阈值（默认300秒） | ⚠️ 警告 |
| 时间戳倒退 | 时间戳递减 | ⚠️ 警告 |
| 里程倒退 | 里程桩号递减（超过允许的微小误差） | ⛔ 严重错误 |
| 里程跳变 | 相邻记录里程间隔超过阈值（默认100米） | ⚠️ 警告 |
| 数据缺失 | 缺少关键字段或文件 | ⛔ 严重错误 |
| 数据损坏 | 解析失败的文件 | ⛔ 严重错误 |

**注意**：默认情况下，只有完全没有问题的包才会进入后续处理。使用 `-w` 参数可以包含只有警告的包。

### 步骤 3：缺陷归并

合并多机器人重复标注的缺陷：

1. **按管段分组**：首先将缺陷按管段（pipe_segment）分组
2. **按类型归一化**：将"裂缝"、"裂纹"等同类型缺陷统一标识
3. **里程聚类**：在 2 米容差范围内的同类型缺陷视为同一缺陷
4. **信息合并**：
   - 取最严重的严重程度
   - 合并所有描述信息
   - 保留所有证据来源
   - 计算里程范围和时间范围

### 步骤 4：风险评分

基于以下维度计算风险等级（0-100 分）：

| 维度 | 权重 | 说明 |
|-----|------|-----|
| 严重程度 | 40% | 标注的严重程度 |
| 缺陷类型 | 30% | 不同类型固有风险不同（漏水>变形>裂缝>...） |
| 证据数量 | 20% | 多来源、多机器人发现的缺陷可信度更高 |
| 时间新鲜度 | 10% | 最近发现的缺陷优先级更高 |

风险等级划分：

| 等级 | 分数范围 | 图标 | 处理建议 |
|-----|---------|------|---------|
| 紧急 | >= 85 | 🔴 | 需要立即处理 |
| 高风险 | 70-84 | 🟠 | 近期需要处理 |
| 中等 | 40-69 | 🟡 | 计划内处理 |
| 低风险 | 20-39 | 🟢 | 监控观察 |
| 信息 | < 20 | 🔵 | 无需处理 |

### 步骤 5：报告导出

支持导出为以下格式：

- **Markdown** (`-f markdown`)：美观易读，包含图表和详细列表
- **CSV** (`-f csv`)：便于导入 Excel 或其他工具进一步分析
- **JSON** (`-f json`)：完整结构化数据，便于程序处理

## 命令参考

### process（完整处理）

```bash
inspection-fixer process [OPTIONS] PACKAGE_DIRS...
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|-----|------|--------|
| `PACKAGE_DIRS` | 一个或多个巡检包目录路径 | 必填 |
| `-o, --output` | 输出报告路径（不含扩展名） | 自动生成 |
| `-f, --format` | 输出格式（可多选）：markdown/csv/json | markdown, csv |
| `-s, --skip-invalid` | 跳过无效的巡检包 | 否（终止处理） |
| `-w, --include-warnings` | 包含有警告的巡检包 | 否（只包含完全有效的） |
| `-v, --verbose` | 显示详细输出 | 否 |

**示例：**

```bash
# 基本使用
inspection-fixer process ./robot_001 ./robot_002

# 处理所有子目录
inspection-fixer process ./inspection_packages/*/

# 跳过无效包，包含警告包
inspection-fixer process ./packages/* -s -w

# 三种格式全部导出
inspection-fixer process ./packages/* -f markdown -f csv -f json -o ./reports/analysis
```

### validate（仅校验）

```bash
inspection-fixer validate [OPTIONS] PACKAGE_DIRS...
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|-----|------|--------|
| `PACKAGE_DIRS` | 一个或多个巡检包目录路径 | 必填 |
| `-o, --output` | 输出校验报告路径 | 不导出 |
| `-v, --verbose` | 显示详细输出 | 否 |

**示例：**

```bash
# 校验并显示结果表
inspection-fixer validate ./packages/*

# 导出校验报告
inspection-fixer validate ./packages/* -o ./reports/validation
```

### generate-samples（生成示例数据）

```bash
inspection-fixer generate-samples [OPTIONS]
```

**参数说明：**

| 参数 | 说明 | 默认值 |
|-----|------|--------|
| `-o, --output-dir` | 示例数据输出目录 | `./test_samples` |
| `-t, --types` | 要生成的类型（可多选） | `all` |

**可用类型：**

| 类型 | 说明 |
|-----|------|
| `normal` | 正常的巡检包 |
| `timestamp_jump` | 包含时间戳跳变（模拟断电） |
| `mileage_backtrack` | 包含里程桩号倒退 |
| `overlapping` | 多机器人重复标注相同缺陷（3个包） |
| `empty` | 空巡检包 |
| `corrupt` | 损坏的数据文件 |
| `all` | 生成所有类型 |

**示例：**

```bash
# 生成所有示例数据
inspection-fixer generate-samples

# 只生成重叠包和正常包
inspection-fixer generate-samples -t overlapping -t normal -o ./my_samples
```

### version（版本信息）

```bash
inspection-fixer version
```

## 数据格式说明

### 视频索引 JSON

```json
{
  "segments": [
    {
      "segment_id": 1,
      "timestamp": 1714500000.0,
      "mileage": 0.0,
      "file_name": "video_001.mp4",
      "duration": 30
    }
  ]
}
```

**支持的字段名变体：**
- 时间戳：`timestamp`, `time`, `start_time`, `datetime`
- 里程：`mileage`, `mileage_stake`, `stake_number`, `position`
- 文件名：`file_name`, `filename`, `video_file`, `path`

### 传感器数据 CSV

```csv
timestamp,mileage,temperature,humidity,vibration,gas_level,robot_id
1714500000.0,0.0,22.5,65.2,0.12,45.0,robot_001
1714500006.0,5.0,22.6,64.8,0.15,46.2,robot_001
```

**支持的字段名变体：**
- 时间戳：`timestamp`, `time`, `datetime`, `采集时间`, `时间戳`
- 里程：`mileage`, `mileage_stake`, `桩号`, `里程`

### 缺陷标注 YAML

```yaml
defects:
  - defect_id: D001
    defect_type: crack
    mileage: 120.5
    pipe_segment: segment_001
    severity: high
    description: "管壁纵向裂缝"
    timestamp: 1714500100.0
    source: robot_001
    annotator: auto
```

**支持的字段名变体：**
- 缺陷类型：`defect_type`, `type`, `问题类型`, `缺陷类型`
- 里程：`mileage`, `mileage_stake`, `桩号`, `位置`
- 管段：`pipe_segment`, `segment`, `section`, `管段`
- 严重程度：`severity`, `level`, `严重程度`, `等级`
- 描述：`description`, `desc`, `描述`, `备注`

**缺陷类型归一化：**

| 原始值 | 归一化后 |
|-------|---------|
| 裂缝, 裂纹, crack | crack |
| 漏水, 渗漏, leak | leak |
| 腐蚀, 锈蚀, corrosion | corrosion |
| 变形, 形变, deformation | deformation |
| 堵塞, 阻塞, blockage | blockage |

## 项目结构

```
xy4215/
├── pyproject.toml           # 项目配置
├── README.md               # 本文档
└── inspection_cli/         # 主包
    ├── __init__.py
    ├── cli.py              # CLI 入口
    ├── sample_data.py      # 示例数据生成器
    └── modules/            # 功能模块
        ├── __init__.py
        ├── parser.py       # 数据解析
        ├── validator.py    # 数据校验
        ├── merger.py       # 缺陷归并
        ├── scorer.py       # 风险评分
        └── exporter.py     # 报告导出
```

## 常见问题

### Q: 如何处理有警告的巡检包？

A: 使用 `-w` 或 `--include-warnings` 参数：

```bash
inspection-fixer process ./packages/* -w
```

### Q: 如何跳过无效包继续处理？

A: 使用 `-s` 或 `--skip-invalid` 参数：

```bash
inspection-fixer process ./packages/* -s
```

### Q: 如何调整校验阈值？

A: 目前阈值在代码中硬编码，可以通过修改 `inspection_cli/modules/validator.py` 中的默认值：

```python
self.max_timestamp_gap = 300.0  # 最大时间间隔（秒）
self.max_mileage_gap = 100.0     # 最大里程间隔（米）
self.allowable_mileage_backtrack = 0.5  # 允许的里程倒退（米）
```

### Q: 如何调整归并的里程容差？

A: 修改 `inspection_cli/modules/merger.py` 中的默认值：

```python
self.mileage_tolerance = 2.0  # 里程匹配容差（米）
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。
