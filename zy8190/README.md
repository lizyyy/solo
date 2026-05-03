# 车间边缘相机隐私遮罩配置离线预检工具

本地端侧工具，用于车间边缘相机的隐私遮罩配置进行离线预检和审计。

## 功能特性

- ✅ **数据解析**: 解析 `cameras.csv`、`mask_rules.yaml`、`frames/` 图片和旧版配置 JSON
- 🔍 **规则校验**: 检查遮罩越界、关键工位未遮、分辨率不匹配等问题
- 🖼️ **图片叠加**: 生成遮罩叠加预览图和变更对比 diff 图
- 📊 **报告导出**: 生成详细的 `audit_report.md` 审计报告
- 🔄 **配置对比**: 对比新旧配置，检测回滚、新增、修改操作

## 模块拆分

```
src/
├── data_parser.py      # 数据解析模块：解析各类输入文件
├── rule_validator.py   # 规则校验模块：各类校验逻辑
├── image_overlay.py    # 图片叠加模块：遮罩预览和 diff 图生成
├── report_generator.py # 报告导出模块：生成 audit_report.md
├── cli.py              # CLI 入口：命令行接口
└── __init__.py
```

## 安装

```bash
pip install -r requirements.txt
```

## 使用方法

### 快速 Demo

使用 `sample/` 目录下的示例数据直接运行：

```bash
python3 -m src.cli \
  --cameras sample/cameras.csv \
  --rules sample/mask_rules.yaml \
  --frames sample/frames \
  --old-config sample/old_config.json \
  --output output \
  --verbose
```

### 命令行参数

| 参数 | 简写 | 必填 | 说明 |
|------|------|------|------|
| `--cameras` | `-c` | 是 | 相机配置 CSV 文件路径 |
| `--rules` | `-r` | 是 | 遮罩规则 YAML 文件路径 |
| `--frames` | `-f` | 是 | 样例图片目录路径 |
| `--old-config` | `-o` | 否 | 旧版配置 JSON 文件路径 |
| `--output` | `-O` | 否 | 输出目录（默认: `./output`） |
| `--verbose` | `-v` | 否 | 显示详细输出 |

## 输入文件格式

### 1. cameras.csv

相机配置文件，包含每台相机的基本信息：

```csv
camera_id,name,location,width,height,stations
cam_001,组装线入口,车间A线,1920,1080,station_entrance,station_worker_1
cam_002,检测工位,车间A线,1920,1080,station_inspection,station_worker_2
```

| 字段 | 说明 |
|------|------|
| `camera_id` | 相机唯一标识 |
| `name` | 相机名称 |
| `location` | 安装位置 |
| `width/height` | 配置分辨率 |
| `stations` | 覆盖的工位（逗号分隔） |

### 2. mask_rules.yaml

遮罩规则配置，使用 **归一化坐标** (0.0 ~ 1.0)：

```yaml
mask_rules:
  - station: station_entrance
    mask_type: privacy
    x_min: 0.1
    x_max: 0.4
    y_min: 0.2
    y_max: 0.6
```

| 字段 | 说明 |
|------|------|
| `station` | 对应工位名称 |
| `mask_type` | 遮罩类型 (privacy/key_station) |
| `x_min/x_max` | X 坐标范围 (0.0 ~ 1.0) |
| `y_min/y_max` | Y 坐标范围 (0.0 ~ 1.0) |

### 3. frames/ 目录

存放相机样例图片，文件名格式：
- `{camera_id}_{timestamp}.jpg`
- 或 `{camera_id}.jpg`

例如：
```
frames/
├── cam_001_20240101_080000.jpg
├── cam_002_20240101_080000.jpg
└── cam_003_20240101_080000.jpg
```

### 4. old_config.json (可选)

旧版遮罩配置，用于对比检测：

```json
{
  "version": "v1",
  "cameras": [
    {
      "camera_id": "cam_001",
      "masks": [
        {
          "station": "station_entrance",
          "mask_type": "privacy",
          "x_min": 0.15,
          "x_max": 0.35,
          "y_min": 0.25,
          "y_max": 0.55
        }
      ]
    }
  ]
}
```

## 输出说明

运行后生成以下内容：

```
output/
├── audit_report.md    # 审计报告（主报告）
├── previews/          # 遮罩预览图
│   ├── cam_001_preview.jpg
│   ├── cam_002_preview.jpg
│   └── ...
└── diffs/             # 变更对比图（如果提供了旧配置）
    ├── cam_001_diff.jpg
    ├── cam_002_diff.jpg
    └── ...
```

### 检测的问题类型

| 问题类型 | 严重程度 | 说明 |
|----------|----------|------|
| `mask_out_of_bounds` | 🔴 严重 | 遮罩坐标越界（超出 [0, 1] 范围） |
| `resolution_mismatch` | 🟡 警告 | 配置分辨率与实际图片不匹配 |
| `key_station_unmasked` | 🟡 警告 | 关键工位未配置遮罩规则 |
| `mask_removed` | 🟡 警告 | 遮罩被移除（可能是回滚） |
| `mask_added` | ℹ️ 信息 | 新增遮罩 |
| `mask_modified` | ℹ️ 信息 | 遮罩被修改 |

### 图片颜色图例

| 颜色 | 含义 |
|------|------|
| 🔴 红色 | 隐私遮罩 / 移除的遮罩 |
| 🟢 绿色 | 新增的遮罩 |
| 🟠 橙色 | 修改的遮罩（新位置） |
| 虚线 | 修改的遮罩（旧位置） |

## 示例数据说明

`sample/` 目录包含演示数据，其中故意设置了以下"问题"用于展示预检功能：

| 相机 | 问题 |
|------|------|
| `cam_002` | `station_inspection` 坐标越界 (x_min=-0.1, x_max=1.05) |
| `cam_002` | `station_worker_2` 坐标错误 (y_min > y_max) |
| `cam_004` | `storage_entrance` 工位未配置遮罩规则 |
| `cam_004` | 配置分辨率 1920x1080，图片是 1280x720（分辨率不匹配） |
| 全部 | 新旧配置对比：新增、移除、修改遮罩 |

## 开发说明

### 模块 API

```python
from src.data_parser import DataParser
from src.rule_validator import RuleValidator
from src.image_overlay import ImageOverlay
from src.report_generator import ReportGenerator

# 1. 解析数据
parser = DataParser()
cameras = parser.parse_cameras_csv('cameras.csv')
rules = parser.parse_mask_rules_yaml('mask_rules.yaml')
frames = parser.parse_frames_directory('frames/')
old_configs = parser.parse_old_config_json('old_config.json')

# 2. 规则校验
validator = RuleValidator(cameras, rules, frames, old_configs)
result = validator.validate_all()

# 3. 生成预览图
overlay = ImageOverlay(alpha=0.5)
# ...

# 4. 生成报告
reporter = ReportGenerator('output')
reporter.generate_audit_report(result, cameras, generated_images)
```

## License

MIT License
