# Calibration Checker - 工业相机标定包离线复核工具

用于产线视觉工程师离线复核工业相机标定包的 Python CLI 工具。

## 功能特性

- **重投影误差复核**: 重新计算棋盘格角点的重投影误差，验证标定精度
- **内参范围校验**: 检查焦距(fx, fy)和畸变系数(k1, k2)是否在设备档案规定范围内
- **分辨率匹配**: 验证实际图像分辨率与设备档案是否一致
- **异常检测**:
  - **缺角点检测**: 检测哪些帧存在角点缺失问题
  - **跨相机误归属**: 检测同一标定序列是否被错误分配给多个相机
- **报告生成**: 生成可下发的标定包 JSON、失败记录 CSV 和详细报告 Markdown

## 项目结构

```
calibration-checker/
├── pyproject.toml              # 项目配置
├── README.md                   # 本文档
└── src/
    └── calibration_checker/
        ├── __init__.py
        ├── models.py           # 数据模型定义
        ├── config.py           # 配置读取 (calibration_rules.yaml)
        ├── io.py               # 文件读写 (CSV, JSONL)
        ├── calibrator.py       # 标定计算与检查逻辑
        ├── anomaly_detector.py # 异常检测
        ├── report_generator.py # 报告生成
        └── cli.py              # CLI 入口
```

## 安装

### 方式一: 可编辑模式安装

```bash
pip install -e .
```

### 方式二: 直接运行

```bash
python -m src.calibration_checker.cli
```

### 依赖

- Python >= 3.9
- numpy
- opencv-python (用于实际标定计算，如未安装将使用模拟模式)
- pyyaml
- pandas
- click
- rich

## 快速开始

### 1. 生成示例数据

```bash
calib-check init-example
```

这将在 `./example_data` 目录生成示例数据，包含:

```
example_data/
├── cameras.csv              # 3台相机的设备档案
├── calibration_rules.yaml   # 标定规则配置
└── detections/              # 检测数据
    ├── CAM001.jsonl         # 含1帧缺角点异常
    ├── CAM002.jsonl         # 含跨相机误归属异常
    └── CAM003.jsonl         # 正常数据
```

### 2. 运行复核

```bash
calib-check check -i ./example_data -o ./output
```

### 3. 查看输出

```
output/
├── calibration_bundle.json  # 可下发的标定包
├── failures.csv             # 失败记录
└── report.md                # 详细复核报告
```

## 命令详解

### `check` 命令 - 执行标定复核

```bash
calib-check check \
    --input-dir ./my_calib_data \
    --output-dir ./output \
    --verbose
```

**选项:**

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--input-dir` | `-i` | 输入目录 (必需) | - |
| `--output-dir` | `-o` | 输出目录 | `./output` |
| `--verbose` | `-v` | 显示详细日志 | `False` |
| `--force` | `-f` | 覆盖已存在文件 | `False` |

### `init-example` 命令 - 生成示例数据

```bash
calib-check init-example --output-dir ./test_data
```

**选项:**

| 参数 | 简写 | 说明 | 默认值 |
|------|------|------|--------|
| `--output-dir` | `-o` | 示例数据输出目录 | `./example_data` |

## 输入文件格式

### 1. cameras.csv - 设备档案

```csv
camera_id,serial_number,model,expected_width,expected_height,expected_fx_min,expected_fx_max,expected_fy_min,expected_fy_max,expected_k1_min,expected_k1_max,expected_k2_min,expected_k2_max
CAM001,SN20240001,USB3Vision-12MP,4096,3000,900,1100,900,1100,-0.2,0.2,-0.1,0.1
```

| 字段 | 说明 |
|------|------|
| camera_id | 相机唯一标识 |
| serial_number | 序列号 |
| model | 相机型号 |
| expected_width/height | 期望分辨率 |
| expected_fx_min/max | 焦距 fx 允许范围 |
| expected_fy_min/max | 焦距 fy 允许范围 |
| expected_k1_min/max | 畸变 k1 允许范围 |
| expected_k2_min/max | 畸变 k2 允许范围 |

### 2. calibration_rules.yaml - 标定规则

```yaml
max_reprojection_error: 1.0      # 最大允许重投影误差 (像素)
min_valid_frames: 5               # 最少有效帧数

cameras:
  - camera_id: CAM001
    serial_number: SN20240001
    model: USB3Vision-12MP
    resolution:
      width: 4096
      height: 3000
    focal_length:
      fx_min: 900.0
      fx_max: 1100.0
      fy_min: 900.0
      fy_max: 1100.0
    distortion:
      k1_min: -0.2
      k1_max: 0.2
      k2_min: -0.1
      k2_max: 0.1

patterns:
  - pattern_id: PAT_001
    sequence_id: SEQ_2024_CALIB_01
    camera_id: CAM001
    board_width: 9        # 棋盘格内角点列数
    board_height: 6       # 棋盘格内角点行数
    square_size: 25.0     # 棋盘格尺寸 (mm)
```

### 3. detections/*.jsonl - 检测数据

每行为一个 JSON 对象:

```json
{
  "frame_id": "CAM001_FRAME_001",
  "camera_id": "CAM001",
  "sequence_id": "SEQ_2024_CALIB_01",
  "pattern_id": "PAT_001",
  "timestamp": "2024-01-15T10:00:00Z",
  "image_width": 4096,
  "image_height": 3000,
  "object_points": [[0.0, 0.0, 0.0], [25.0, 0.0, 0.0], ...],
  "image_points": [[100.5, 200.3], [130.2, 205.1], ...]
}
```

| 字段 | 说明 |
|------|------|
| frame_id | 帧唯一标识 |
| camera_id | 相机 ID |
| sequence_id | 标定序列 ID (用于检测跨相机误归属) |
| pattern_id | 标定板配置 ID |
| image_width/height | 图像实际分辨率 |
| object_points | 棋盘格世界坐标点 (N × 3) |
| image_points | 棋盘格图像坐标点 (N × 2) |

## 输出文件说明

### 1. calibration_bundle.json - 可下发标定包

包含所有相机的标定结果，可直接下发给产线系统:

```json
{
  "version": "1.0.0",
  "generated_at": "2024-01-15T10:30:00",
  "summary": {
    "total_cameras": 3,
    "passed_cameras": 2,
    "failed_cameras": 1,
    "passed_camera_ids": ["CAM001", "CAM003"],
    "failed_camera_ids": ["CAM002"]
  },
  "cameras": {
    "CAM001": {
      "camera_id": "CAM001",
      "serial_number": "SN20240001",
      "status": "PASS",
      "camera_matrix": [
        [1020.5, 0.0, 2048.0],
        [0.0, 1018.3, 1500.0],
        [0.0, 0.0, 1.0]
      ],
      "dist_coefficients": [0.05, -0.03, 0.0, 0.0, 0.001],
      "intrinsics": {
        "fx": 1020.5,
        "fy": 1018.3,
        "cx": 2048.0,
        "cy": 1500.0
      },
      "distortion": {
        "k1": 0.05,
        "k2": -0.03,
        "p1": 0.0,
        "p2": 0.0,
        "k3": 0.001
      },
      "reprojection_error": 0.35,
      "rms": 0.32,
      "num_valid_frames": 11,
      "check_results": [...]
    }
  }
}
```

### 2. failures.csv - 失败记录

```csv
camera_id,failure_type,status,message,details
CAM001,missing_corners,WARNING,"发现 1/12 帧存在缺角点问题。缺角点比例: 8.3%",{...}
CAM002,cross_camera_mismatch,ERROR,"序列 SEQ_2024_CALIB_02 被分配到了 2 个不同相机",{...}
CAM002,resolution,FAIL,"分辨率不匹配: 期望 2592x1944, 实际 4096x3000",{...}
```

### 3. report.md - 详细复核报告

包含:
- 执行摘要
- 异常检测详情 (缺角点、跨相机误归属)
- 各相机详细报告 (标定结果、检查项、失败记录)

## 异常检测说明

### 缺角点异常 (missing_corners)

当一帧中检测到的角点数量少于棋盘格实际角点数时触发。

**严重级别:**
- `INFO`: 缺角点比例 ≤ 20%
- `WARNING`: 缺角点比例 20% - 50%
- `ERROR`: 缺角点比例 > 50%

**报告示例:**
```
相机 CAM001 - [WARNING]
> 发现 1/12 帧存在缺角点问题。缺角点比例: 8.3%
影响帧数: 1
```

### 跨相机误归属异常 (cross_camera_mismatch)

当同一 `sequence_id` 被分配到多个不同 `camera_id` 时触发。

这是严重的数据错误，意味着标定序列的帧被错误地分配给了错误的相机。

**报告示例:**
```
序列 SEQ_2024_CALIB_02 - [ERROR]
> 序列 SEQ_2024_CALIB_02 被分配到了 2 个不同相机: CAM002, CAM003
| 根据配置，该序列应属于相机 CAM002
| 误归属的相机: CAM003
涉及相机: CAM002, CAM003
期望归属: CAM002
```

## 检查项说明

| 检查项 | 说明 | 通过条件 |
|--------|------|----------|
| `resolution` | 分辨率匹配 | 实际宽高 == 期望宽高 |
| `reprojection_error` | 重投影误差 | 误差 ≤ max_reprojection_error |
| `focal_length` | 焦距范围 | fx/fy 在期望范围内 |
| `distortion` | 畸变范围 | k1/k2 在期望范围内 |

## 使用示例流程

```bash
# 1. 安装
pip install -e .

# 2. 生成示例数据 (用于测试)
calib-check init-example -o ./test_data

# 3. 查看数据结构
ls -la ./test_data/
ls -la ./test_data/detections/

# 4. 运行复核
calib-check check -i ./test_data -o ./test_output -v

# 5. 查看结果
cat ./test_output/report.md
cat ./test_output/failures.csv
```

## 常见问题

### Q: 为什么需要离线复核?

产线上相机标定数据可能存在以下问题:
1. 标定板角点检测不完整 (缺角点)
2. 数据采集时帧归属错误 (跨相机误归属)
3. 相机参数漂移超出预期范围
4. 标定算法在边缘情况下计算不稳定

离线复核可以在下发前发现这些问题。

### Q: 如何处理缺角点的帧?

缺角点的帧会被排除在标定计算之外。如果有效帧数足够 (≥ min_valid_frames)，标定仍可进行，但会在报告中标记 WARNING。

### Q: 跨相机误归属如何排查?

检查 `sequence_id` 和 `camera_id` 的对应关系。每个 `sequence_id` 应只属于一个 `camera_id`。在 `calibration_rules.yaml` 的 `patterns` 段定义了这种映射关系。

## License

MIT
