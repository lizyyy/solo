# 航拍素材归档校验员

面向无人机航拍小组的本地自动化工具，用于解决外拍素材（照片、短视频、飞行日志CSV、航点计划JSON及客户交付清单）的编号一致性、GPS时间同步、航线编号匹配及云台角度对应等关键问题。

## 功能特性

- **项目初始化**：创建标准化目录结构和可配置的项目参数
- **素材扫描**：自动提取照片EXIF和视频元数据
- **日志导入**：解析飞行日志、航点计划和交付清单
- **多维度校验**：
  - 交付清单素材缺失检查
  - 时间轴与飞行日志同步检查
  - 拍摄坐标与规划航线偏离检查
  - 重复归档检测
  - 元数据缺失检查
  - 禁飞区识别
- **素材打包**：仅复制通过校验的素材并生成Manifest
- **报告导出**：支持Markdown、CSV、JSON三种格式

## 目录结构

```
aerial_archive_validator/
├── __init__.py          # 包初始化
├── __main__.py          # 入口文件
├── cli.py               # CLI命令行模块
├── config.py            # 配置模型模块
├── exceptions.py        # 异常类定义
├── metadata.py          # 元数据解析模块
├── log_alignment.py     # 日志对齐模块
├── rules.py             # 规则校验模块
├── packer.py            # 打包模块
├── reporter.py          # 报告模块
└── sample_data.py       # 示例数据模块

tests/
├── __init__.py
├── test_config.py       # 配置模块测试
└── test_rules.py        # 规则模块测试

pyproject.toml           # 项目配置
README.md                # 本文档
```

## 安装

### 系统要求

- Python 3.9+
- FFmpeg (用于视频元数据解析)

### 安装步骤

```bash
# 克隆项目
cd xy4058

# 安装依赖
pip install -e .
```

### 安装FFmpeg (视频解析必需)

**macOS:**
```bash
brew install ffmpeg
```

**Ubuntu/Debian:**
```bash
sudo apt-get install ffmpeg
```

**Windows:**
从 [FFmpeg官网](https://ffmpeg.org/download.html) 下载并添加到PATH。

## 快速开始

### 方法1: 使用示例项目快速测试

```bash
# 创建示例项目到临时目录
aerial-validator sample-project --temp --name "测试项目"

# 或者创建到指定目录
aerial-validator sample-project --name "我的航拍项目" --output ./my_project
```

### 方法2: 从零开始创建项目

```bash
# 初始化新项目
aerial-validator init --name "北京CBD航拍" --project-id "PROJ_2024_BJ001"

# 或者带示例数据
aerial-validator init --name "测试项目" --with-sample
```

## 完整工作流程

### 1. 项目初始化 (init)

创建标准化的项目目录结构。

```bash
# 基本用法
aerial-validator init --name "项目名称"

# 指定项目ID和输出目录
aerial-validator init --name "项目名称" \
    --project-id "PROJ_001" \
    --output ./my_project

# 创建带示例数据的项目
aerial-validator init --name "测试项目" --with-sample
```

**创建的目录结构：**
```
my_project/
├── project_config.json   # 项目配置文件
├── photos/              # 照片素材目录
├── videos/              # 视频素材目录
├── logs/                # 飞行日志目录
├── plans/               # 航点计划目录
├── delivery_lists/      # 交付清单目录
├── output/              # 打包输出目录
├── quarantine/          # 隔离区目录
├── reports/             # 报告输出目录
└── metadata/            # 元数据缓存目录
```

### 2. 素材扫描 (scan)

扫描素材文件并提取元数据。

```bash
# 在项目目录中扫描默认目录
cd my_project
aerial-validator scan

# 指定扫描目录
aerial-validator scan --directory ./source_photos

# 不递归扫描子目录
aerial-validator scan --no-recursive

# 禁用元数据缓存
aerial-validator scan --no-cache
```

**扫描功能：**
- 自动识别照片和视频文件类型
- 提取照片EXIF元数据（GPS坐标、拍摄时间、设备型号、镜头参数等）
- 解析视频元数据（拍摄时间、设备信息、分辨率、帧率等）
- 从文件名解析航线编号(L001)和航点编号(W01)
- 计算文件SHA256哈希用于重复检测

### 3. 日志导入 (import-log)

导入飞行日志、航点计划和交付清单。

```bash
# 自动检测日志类型
aerial-validator import-log ./flight_log_20240501.csv

# 指定日志类型
aerial-validator import-log --type flight ./flight_log.csv
aerial-validator import-log --type plan ./waypoint_plan.json
aerial-validator import-log --type delivery ./delivery_list.csv
```

**支持的文件类型：**
- **飞行日志(flight)**: CSV格式，包含时间戳、GPS坐标、高度、云台角度等
- **航点计划(plan)**: JSON格式，包含规划航点坐标、云台角度、飞行参数等
- **交付清单(delivery)**: CSV或TXT格式，包含应交付的素材列表

**飞行日志CSV字段映射（支持中英文）：**
| 英文字段名 | 中文字段名 | 说明 |
|-----------|-----------|------|
| timestamp | 时间戳 | 记录时间 |
| latitude/lat | 纬度 | GPS纬度 |
| longitude/lon/lng | 经度 | GPS经度 |
| altitude/alt | 高度 | 飞行高度 |
| gimbal_pitch/pitch | 云台俯仰 | 云台俯仰角 |
| gimbal_yaw/yaw | 云台偏航 | 云台偏航角 |

### 4. 校验检查 (check)

执行所有启用的校验规则。

```bash
# 执行完整校验（自动隔离异常素材）
aerial-validator check

# 不隔离异常素材
aerial-validator check --no-quarantine

# 使用指定的元数据缓存
aerial-validator check --cache ./metadata/scan_20240501_120000.json

# 只运行指定规则
aerial-validator check --rules time_misalignment,duplicate_archive
```

**校验规则说明：**

| 规则名 | 说明 | 严重程度 |
|--------|------|----------|
| delivery_missing | 检查素材是否在交付清单中 | warning |
| time_misalignment | 检查拍摄时间与飞行日志是否同步 | error |
| coordinate_deviation | 检查实际坐标与规划航线偏离程度 | error |
| duplicate_archive | 检查重复归档（相同哈希或相同文件名） | error/warning |
| missing_metadata | 检查关键元数据字段是否缺失 | error |
| no_fly_zone | 检查是否进入禁飞区 | error |

**可配置的校验参数（在project_config.json中）：**
```json
{
  "time_sync_threshold_seconds": 300.0,
  "coordinate_deviation_threshold_meters": 50.0,
  "no_fly_zones": [
    {
      "name": "机场禁飞区",
      "center_lat": 40.0,
      "center_lon": 116.0,
      "radius_meters": 5000.0
    }
  ]
}
```

**隔离区功能：**
- 校验失败（error级别）的素材会被自动移到 `quarantine/` 目录
- 每个隔离文件会生成对应的 `.meta` 文件，记录隔离原因和校验错误详情

### 5. 素材打包 (pack)

仅复制通过校验的素材到交付目录。

```bash
# 使用最新的校验报告打包
aerial-validator pack

# 指定输出目录
aerial-validator pack --output ./delivery_package

# 覆盖已存在的文件
aerial-validator pack --overwrite

# 使用指定的校验报告
aerial-validator pack --check-report ./reports/check_report_xxx.json
```

**打包规则：**
- 仅复制通过所有error级别校验的素材
- 自动创建分类目录结构：
  - `output/photos/` - 照片文件
  - `output/videos/` - 视频文件
  - 按航线编号进一步分类（如 `photos/flight_line_001/`）

**Manifest文件：**
打包完成后生成 `manifest.json`，包含：
- 项目信息
- 校验统计结果
- 交付文件清单（含源路径、目标路径、文件大小）
- Manifest ID和生成时间

### 6. 报告导出 (report)

导出校验报告。

```bash
# 导出所有格式（Markdown、CSV、JSON）
aerial-validator report

# 指定导出格式
aerial-validator report --format md
aerial-validator report --format csv
aerial-validator report --format json

# 指定输出路径
aerial-validator report --output ./my_report

# 指定报告标题
aerial-validator report --title "2024年5月航拍项目校验报告"

# 使用指定的校验报告
aerial-validator report --check-report ./reports/check_report_xxx.json
```

**报告内容：**

**Markdown报告包含：**
- 报告概览（生成时间、项目ID等）
- 校验统计表格（总素材数、通过/失败数、隔离数）
- 按规则统计结果
- 异常详情（分error和warning级别展示）
- 配置信息汇总
- 禁飞区配置列表

**CSV报告包含：**
- 每个校验结果的完整记录
- 文件信息、规则名称、校验结果、详细信息
- GPS坐标、拍摄时间、设备型号等元数据

**JSON报告包含：**
- 完整的校验报告数据结构
- 可用于后续分析或二次开发

## 使用临时目录进行全流程验证

### 完整测试流程

```bash
# 1. 创建临时示例项目
aerial-validator sample-project --temp --name "全流程测试"

# 记录输出的项目路径，例如：/var/folders/.../aerial_xxxxxx
# 进入该目录
cd /var/folders/.../aerial_xxxxxx

# 2. 扫描素材
aerial-validator scan

# 3. 查看生成的元数据缓存
ls -la metadata/

# 4. 执行校验（会发现一些预设的异常）
aerial-validator check

# 5. 查看生成的报告
ls -la reports/

# 6. 查看隔离区（应该有隔离的文件）
ls -la quarantine/

# 7. 打包通过校验的素材
aerial-validator pack

# 8. 查看打包结果
ls -la output/
cat output/manifest.json

# 9. 重新导出报告
aerial-validator report --format md

# 10. 查看Markdown报告
cat reports/report_*.md
```

### 预期的测试结果

示例项目中包含：
- 5个正常照片素材
- 1个无效命名的素材（INVALID_0001.JPG）
- 1个重复文件（DJI_0001_duplicate.JPG）

校验时应该检测到：
- 重复文件被标记为error并隔离
- 交付清单检查：部分文件可能不在清单中
- 时间同步检查取决于飞行日志时间范围

## 配置说明

### project_config.json 结构

```json
{
  "project_name": "项目名称",
  "project_id": "PROJ_001",
  "version": "1.0.0",
  "created_at": "2024-05-01T09:00:00",

  "directories": {
    "photos": "photos",
    "videos": "videos",
    "logs": "logs",
    "plans": "plans",
    "delivery_lists": "delivery_lists",
    "output": "output",
    "quarantine": "quarantine",
    "reports": "reports",
    "metadata": "metadata"
  },

  "material_extensions": {
    "photo": [".jpg", ".jpeg", ".png", ".raw", ".dng", ".tiff"],
    "video": [".mp4", ".mov", ".avi", ".mkv", ".m4v"],
    "log_csv": [".csv"],
    "plan_json": [".json"],
    "delivery_list": [".csv", ".txt", ".xlsx"]
  },

  "enabled_rules": [
    "delivery_missing",
    "time_misalignment",
    "coordinate_deviation",
    "duplicate_archive",
    "missing_metadata",
    "no_fly_zone"
  ],

  "time_sync_threshold_seconds": 300.0,
  "coordinate_deviation_threshold_meters": 50.0,

  "no_fly_zones": [],

  "metadata_required_fields": [
    "latitude",
    "longitude",
    "capture_time",
    "device_model"
  ],

  "delivery_list_columns": {
    "filename": "文件名",
    "shooting_time": "拍摄时间",
    "location": "地点",
    "notes": "备注"
  },

  "drone_models": [
    "DJI Mini 3",
    "DJI Mini 3 Pro",
    "DJI Mavic 3",
    "DJI Air 3",
    "DJI Inspire 3",
    "DJI Phantom 4",
    "DJI Matrice 300",
    "DJI Matrice 350"
  ]
}
```

### 自定义配置

1. **禁用特定校验规则：**
```json
"enabled_rules": [
  "delivery_missing",
  "time_misalignment",
  "missing_metadata"
]
```

2. **调整校验阈值：**
```json
"time_sync_threshold_seconds": 600.0,
"coordinate_deviation_threshold_meters": 100.0
```

3. **添加禁飞区：**
```json
"no_fly_zones": [
  {
    "name": "北京首都机场",
    "center_lat": 40.0799,
    "center_lon": 116.6031,
    "radius_meters": 5000.0
  },
  {
    "name": "政府敏感区",
    "center_lat": 39.9042,
    "center_lon": 116.4074,
    "radius_meters": 1000.0
  }
]
```

4. **自定义元数据必需字段：**
```json
"metadata_required_fields": [
  "latitude",
  "longitude",
  "capture_time",
  "device_model",
  "camera_focal_length"
]
```

## 扩展规则

### 如何添加新的校验规则

1. 在 `rules.py` 中继承 `BaseValidationRule` 类：

```python
from .config import ValidationRule

class MyCustomRule(BaseValidationRule):
    def __init__(self, config: ProjectConfig) -> None:
        # 为你的规则创建一个新的ValidationRule枚举值，
        # 或者使用现有规则
        super().__init__(ValidationRule.MISSING_METADATA, config)

    def is_enabled(self) -> bool:
        # 检查规则是否在配置中启用
        return self.config.is_rule_enabled(ValidationRule.MISSING_METADATA)

    def validate(
        self,
        material: MaterialMetadata,
        log_aligner: LogAligner,
        context: Optional[Dict[str, Any]] = None,
    ) -> ValidationResult:
        # 实现你的校验逻辑
        # 返回ValidationResult对象
        pass
```

2. 在 `ValidationEngine._create_rules()` 中注册新规则：

```python
def _create_rules(self) -> List[BaseValidationRule]:
    return [
        # ... 现有规则
        MyCustomRule(self.config),  # 添加你的规则
    ]
```

3. 在 `config.py` 的 `ValidationRule` 枚举中添加新规则（如果需要）：

```python
class ValidationRule(str, Enum):
    # ... 现有规则
    MY_CUSTOM_RULE = "my_custom_rule"
```

## 常见问题

### Q1: 视频元数据无法解析

**问题：** 运行 scan 命令时，视频文件的元数据为空或报错。

**原因：** FFmpeg 未安装或不在PATH中。

**解决方法：**
1. 安装 FFmpeg（参见安装章节）
2. 验证安装：运行 `ffmpeg -version`
3. 如果已安装但仍无法识别，检查系统PATH设置

### Q2: 照片EXIF中的GPS坐标无法读取

**问题：** 已知带有GPS信息的照片，扫描后 latitude/longitude 为空。

**原因：** 不同相机厂商的EXIF GPS存储格式可能不同。

**解决方法：**
1. 使用专门的EXIF工具验证照片是否确实包含GPS数据：
   ```bash
   # 使用exiftool（如果安装）
   exiftool -GPSLatitude -GPSLongitude photo.jpg
   ```
2. 检查照片是否在拍摄时启用了GPS记录
3. 大疆部分机型需要在DJI Fly App中开启"写入GPS信息到照片"

### Q3: 飞行日志导入失败

**问题：** import-log 命令报错或数据为空。

**原因：** CSV格式不符合预期，字段名不匹配。

**解决方法：**
1. 检查CSV是否有正确的表头行
2. 确认以下关键字段存在（支持中英文）：
   - timestamp / 时间戳
   - latitude / lat / 纬度
   - longitude / lon / lng / 经度
3. 确保时间格式可被解析（支持 ISO8601、YYYY-MM-DD HH:MM:SS 等常见格式）

### Q4: 所有素材都报告时间错位

**问题：** check 命令报告所有素材都存在 time_misalignment 错误。

**原因：**
1. 飞行日志和素材的时区不同
2. 素材拍摄时间不在飞行日志时间范围内
3. 时间同步阈值设置过小

**解决方法：**
1. 检查飞行日志的时间范围
2. 确认素材拍摄时间确实在飞行期间
3. 适当增大 `time_sync_threshold_seconds` 参数（默认300秒=5分钟）

### Q5: 坐标偏离检查频繁报错

**问题：** 素材与规划航线的偏离检查频繁失败。

**原因：**
1. 实际飞行与规划航线确实有偏差
2. 偏离阈值设置过小
3. 航点计划的坐标系与实际不同

**解决方法：**
1. 检查 `coordinate_deviation_threshold_meters` 设置（默认50米）
2. 确认航点计划使用的是相同的坐标系（WGS84）
3. 大疆飞行记录的坐标通常是WGS84，与EXIF一致

### Q6: 如何恢复隔离区的文件

**问题：** 错误的校验将正常文件移到了隔离区。

**解决方法：**
1. 检查隔离区的 `.meta` 文件，了解隔离原因
2. 手动将文件移回原位置
3. 或调整校验规则后重新运行 check（使用 --no-quarantine）

**示例：**
```bash
# 查看隔离原因
cat quarantine/INVALID_0001.JPG.meta

# 手动恢复
mv quarantine/INVALID_0001.JPG photos/
rm quarantine/INVALID_0001.JPG.meta
```

### Q7: 项目配置修改后不生效

**问题：** 修改了 project_config.json，但校验规则未变化。

**原因：** 配置只在命令开始时读取一次。

**解决方法：**
1. 确保修改的是正确的配置文件
2. 重新运行命令
3. 配置文件中存在语法错误时，会使用默认值（检查是否有JSON格式错误）

### Q8: 如何查看详细的调试信息

**问题：** 需要了解命令执行的详细过程。

**解决方法：**
本工具通过rich控制台提供美观的输出。如需更多调试信息：

1. 检查生成的报告文件（reports目录）
2. 查看元数据缓存（metadata目录）
3. 检查隔离区的.meta文件
4. 未来版本可能会添加 --verbose 参数

## 运行测试

```bash
# 安装测试依赖
pip install -e ".[dev]"

# 运行所有测试
pytest

# 运行指定测试
pytest tests/test_config.py

# 生成覆盖率报告
pytest --cov=aerial_archive_validator
```

## 依赖说明

| 库名 | 用途 |
|------|------|
| click | 命令行参数解析 |
| pillow | 图像处理和EXIF读取 |
| piexif | 高级EXIF解析 |
| ffmpeg-python | 视频元数据解析 |
| pydantic | 数据模型验证 |
| python-dateutil | 日期时间解析 |
| geopy | 地理坐标计算（可选） |
| rich | 命令行美化输出 |

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 Pull Request。

## 版本历史

- 1.0.0 (2024-05-01): 初始版本
  - 完整的CLI命令（init, scan, import-log, check, pack, report）
  - 6个核心校验规则
  - 多格式报告导出
  - 示例数据和测试用例
