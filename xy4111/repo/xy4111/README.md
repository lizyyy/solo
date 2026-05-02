# 离线采样包合并器

给野外水文调查队用的本地命令行工具，用于合并多台记录仪导出的 CSV、照片目录、GPS 轨迹 GPX 和手填样点表。

## 功能特性

- **多源数据导入**：支持 CSV、GPX 轨迹、照片目录、Excel 手填样点表
- **坐标/时间归一化**：自动处理 WGS84/GCJ02/BD09 坐标系转换，跨时区时间统一
- **冲突检测**：自动检测样点编号冲突、坐标漂移、时间倒序、缺附件等问题
- **人工裁决**：支持交互式裁决冲突，记录决策历史
- **多格式导出**：支持 GeoJSON、CSV、Markdown 外业交接包

## 安装

### 环境要求

- Python 3.8+

### 安装步骤

```bash
# 克隆或下载项目
cd xy4111

# 安装基础依赖
pip install -e .

# 安装完整依赖（支持照片EXIF解析和Excel手填表）
pip install -e ".[full]"

# 安装测试依赖
pip install -e ".[test]"
```

## 命令速览

```bash
sampler-merger --help

# 可用命令：
#   init    - 初始化新项目配置
#   ingest  - 导入多源文件并保留原件哈希
#   merge   - 生成统一样点库
#   check   - 标出冲突、缺附件、异常坐标和时间倒序
#   review  - 记录人工裁决
#   export  - 导出 GeoJSON、CSV 和 Markdown 外业交接包
```

## 完整工作流程

### 1. 初始化项目

```bash
# 在工作目录创建新项目
mkdir -p /tmp/hydrology_survey
cd /tmp/hydrology_survey

# 初始化项目，指定时区和坐标系
sampler-merger init --timezone "Asia/Shanghai" --coordinate-system "WGS84"
```

这会创建以下目录结构：
```
hydrology_survey/
├── sampler_config.json    # 项目配置文件
├── raw/                   # 原始数据（导入的文件副本）
│   ├── csv/
│   ├── gpx/
│   ├── photos/
│   └── manual/
├── processed/             # 解析后的数据
├── exports/               # 导出结果
└── reviews/               # 人工裁决记录
```

### 2. 导入数据

```bash
# 导入单个CSV文件
sampler-merger ingest --source /path/to/logger_A.csv

# 导入整个目录（自动检测文件类型）
sampler-merger ingest --source /path/to/survey_data/ --recursive

# 试运行（不实际导入，只显示待导入文件）
sampler-merger ingest --source /path/to/data/ --dry-run

# 指定文件类型导入
sampler-merger ingest --source /path/to/track.gpx --type gpx
```

**支持的文件类型：**
- `csv` - 记录仪导出的CSV文件
- `gpx` - GPS轨迹文件
- `photos` - 照片目录（从EXIF提取GPS和时间）
- `manual` - Excel手填样点表

### 3. 合并数据

```bash
# 基本合并（全部合并，标记冲突）
sampler-merger merge

# 使用不同策略合并
sampler-merger merge --strategy "keep_both"    # 保留全部，自动重命名冲突ID
sampler-merger merge --strategy "first_wins"   # 保留第一个出现的
sampler-merger merge --strategy "last_wins"    # 保留最后一个出现的

# 自定义容差参数
sampler-merger merge --time-tolerance 600 --distance-tolerance 100
```

**合并策略：**
- `merge_all` (默认) - 全部合并，在check阶段标记冲突
- `keep_both` - 保留全部，自动给冲突ID添加后缀重命名
- `first_wins` - 只保留每个ID的第一个出现
- `last_wins` - 只保留每个ID的最后一个出现

### 4. 检查冲突

```bash
# 控制台输出检查报告
sampler-merger check

# 输出JSON格式报告
sampler-merger check --format json

# 输出Markdown格式报告到文件
sampler-merger check --format markdown --output check_report.md
```

**检查内容：**
- **样点ID冲突** - 相同ID出现在多个来源
- **坐标异常** - 坐标超出有效范围、同一ID坐标距离过大
- **时间问题** - 缺少时间戳、时间倒序
- **附件缺失** - 引用的附件文件不存在
- **潜在重复** - 坐标和时间接近但ID不同的样点
- **照片关联** - 照片无法匹配到记录样点

### 5. 人工裁决

```bash
# 交互式裁决
sampler-merger review

# 非交互式裁决（脚本化）
sampler-merger review --conflict-id "id_S001" --decision "keep_first" --note "记录仪A数据更准确"
```

**裁决方式：**
- `keep_first` - 保留第一个
- `keep_last` - 保留最后一个
- `keep_both` - 全部保留（重命名）
- `custom` - 自定义处理

### 6. 导出结果

```bash
# 导出所有格式
sampler-merger export --output ./export_output

# 只导出特定格式
sampler-merger export --output ./export_output --formats geojson
sampler-merger export --output ./export_output --formats csv
sampler-merger export --output ./export_output --formats markdown

# 不应用已记录的裁决
sampler-merger export --output ./export_output --no-apply-reviews
```

**导出内容：**
- `samples.geojson` - GeoJSON格式，可直接导入GIS软件
- `samples.csv` - CSV格式，可直接用Excel打开
- `report.md` - Markdown格式的完整报告
- `attachments/` - 照片等附件（如存在）

## 临时目录验证全流程

以下是一个完整的验证流程，使用项目自带的样例数据：

```bash
# 1. 创建临时目录
mkdir -p /tmp/test_sampler
cd /tmp/test_sampler

# 2. 初始化项目
sampler-merger init --timezone "Asia/Shanghai" --coordinate-system "WGS84"

# 3. 导入样例数据（假设项目在 ~/projects/xy4111）
SAMPLER_DIR=~/projects/xy4111

sampler-merger ingest --source $SAMPLER_DIR/sample_data/logger_A.csv
sampler-merger ingest --source $SAMPLER_DIR/sample_data/logger_B.csv
sampler-merger ingest --source $SAMPLER_DIR/sample_data/track.gpx

# 4. 查看已导入的文件
# （检查配置文件确认）
cat sampler_config.json | python3 -c "import sys,json; d=json.load(sys.stdin); print(f'已导入 {len(d[\"ingested_files\"])} 个文件')"

# 5. 合并数据（注意：logger_A和logger_B都有S001、S002，会产生冲突）
sampler-merger merge --strategy "merge_all"

# 6. 检查冲突
sampler-merger check

# 预期看到：
# - ID冲突：S001、S002 在两个CSV中都存在
# - 潜在重复：坐标和时间接近的样点

# 7. 交互式裁决（可选）
# sampler-merger review

# 8. 导出结果
sampler-merger export --output ./final_export

# 9. 查看导出结果
ls -la ./final_export/
cat ./final_export/report.md
```

## 项目结构

```
sampler_merger/
├── __init__.py              # 版本信息
├── cli/
│   ├── __init__.py
│   └── main.py              # CLI主入口
├── config.py                # 配置管理和Sample数据模型
├── parsers.py               # 解析器（CSV、GPX、照片、手填表）
├── normalizers.py           # 坐标/时间归一化
├── conflict_rules.py        # 冲突检测和解决规则
├── ingest.py                # 导入管理器
├── merge.py                 # 合并管理器
├── check.py                 # 检查管理器
├── review.py                # 裁决管理器
└── export.py                # 导出管理器

sample_data/                 # 样例数据
├── logger_A.csv             # 记录仪A数据
├── logger_B.csv             # 记录仪B数据（有ID冲突）
└── track.gpx                # GPS轨迹

tests/                       # 测试用例
├── test_normalizers.py      # 归一化测试
├── test_sample.py           # Sample模型测试
└── test_integration.py      # 集成测试
```

## 坐标系统支持

| 坐标系 | 说明 |
|--------|------|
| WGS84 | GPS原始坐标，国际标准 |
| GCJ02 | 火星坐标，中国国内地图使用 |
| BD09 | 百度坐标，百度地图使用 |

工具会自动将所有坐标统一到项目配置的目标坐标系。

## 时区处理

- 支持通过 `zoneinfo` 或 `pytz` 处理时区
- 自动检测时间字符串中的时区偏移（如 `+08:00`、`Z`）
- 所有时间统一到项目配置的目标时区

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_integration.py -v
```

## 常见问题

**Q: 照片无法解析GPS信息？**
A: 确保安装了 `pillow` 库（`pip install pillow`），并且照片确实包含GPS EXIF数据。

**Q: Excel手填表无法解析？**
A: 确保安装了 `openpyxl` 库（`pip install openpyxl`），并且表格第一行是表头。

**Q: 坐标转换不准确？**
A: GCJ02/WGS84/BD09 之间的转换是近似算法，误差在米级范围内，对于一般调查工作足够精确。

## 许可证

MIT License
