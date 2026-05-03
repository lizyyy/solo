# 执法记录仪取证包工具 (Evidence Tool)

一个本地端侧工具，用于给施工现场执法记录仪生成事故片段取证包。

## 功能特性

- **数据导入**: 读取 `video_manifest.csv`、GPS/NMEA 日志和设备时钟校准 JSON
- **时间线归并**: 把多段视频按事件时间线归并，自动处理跨午夜片段
- **哈希计算**: 计算 SHA256 清单，检测同名文件哈希冲突
- **异常检测**: 标出缺段、时钟漂移超过阈值、GPS 跳点和重复片段
- **导出取证包**: 导出 `evidence_package/manifest.json`、`timeline.md` 和 `anomalies.csv`
- **完整性验证**: 验证取证包的完整性

## 安装

### 环境要求
- Python 3.8+

### 安装依赖

```bash
pip install -r requirements.txt
```

## 快速开始

### 使用示例数据

项目包含一套示例数据，位于 `sample_data/` 目录下，包含以下文件：

- `video_manifest.csv` - 视频清单（包含缺段、重叠、跨午夜、同名冲突等异常）
- `gps_log.nmea` - GPS 轨迹日志（包含 GPS 跳点）
- `clock_calibration.json` - 时钟校准数据（包含时钟漂移）
- `video_001.mp4` ~ `video_006.mp4` - 模拟视频文件

### 演示命令

#### 1. 导入数据 (ingest)

```bash
# 使用默认参数导入
python cli.py ingest sample_data

# 导入并立即导出取证包
python cli.py ingest sample_data -o evidence_package

# 使用自定义阈值
python cli.py ingest sample_data \
    --gap-threshold 30 \
    --drift-threshold 3 \
    --jump-threshold 50

# 跳过哈希计算（快速预览）
python cli.py ingest sample_data --no-hash

# 以 JSON 格式输出结果
python cli.py ingest sample_data --json
```

#### 2. 验证取证包 (verify)

```bash
# 验证已导出的取证包
python cli.py verify evidence_package

# 使用指定的哈希文件验证
python cli.py verify evidence_package -e expected_hashes.json

# 以 JSON 格式输出验证结果
python cli.py verify evidence_package --json
```

#### 3. 导出取证包 (export)

```bash
# 从源数据重新导入并导出
python cli.py export -o evidence_package -s sample_data

# 从已导入的会话导出（需要先运行 ingest）
python cli.py ingest sample_data
python cli.py export -o evidence_package
```

#### 4. 列出异常 (list-anomalies)

```bash
# 从源数据列出所有异常
python cli.py list-anomalies -s sample_data

# 从取证包列出异常
python cli.py list-anomalies -p evidence_package

# 按类型筛选异常
python cli.py list-anomalies -s sample_data -t missing_segment

# 按严重程度筛选
python cli.py list-anomalies -s sample_data -l critical

# 以 JSON 格式输出
python cli.py list-anomalies -s sample_data --json
```

## 输入文件格式

### 1. video_manifest.csv

视频清单文件格式：

```csv
filename,start_time,end_time,duration,device_id,file_size,metadata
video_001.mp4,2024-05-01 09:00:00,2024-05-01 09:05:00,300,DEV-001,10240000,scene=entrance
```

字段说明：
- `filename`: 视频文件名
- `start_time`: 开始时间 (格式: `YYYY-MM-DD HH:MM:SS`)
- `end_time`: 结束时间
- `duration`: 时长（秒）
- `device_id`: 设备ID
- `file_size`: 文件大小（字节）
- `metadata`: 额外元数据（可选）

### 2. GPS/NMEA 日志

标准 NMEA 0183 格式，支持以下语句：
- `$GPGGA` - GPS 定位信息
- `$GPRMC` - 推荐最小定位信息

示例：
```
$GPGGA,010000.00,3123.4567,N,12130.1234,E,1,08,1.0,100.0,M,0.0,M,,*4F
$GPRMC,010000.00,A,3123.4567,N,12130.1234,E,10.5,180.0,010524,,,A*6E
```

### 3. 时钟校准 JSON

```json
{
  "device_id": "DEV-001",
  "calibrations": [
    {
      "calibration_time": "2024-05-01T08:00:00",
      "device_time": "2024-05-01T08:00:02",
      "reference_time": "2024-05-01T08:00:00",
      "drift_seconds": 2.0,
      "calibration_type": "gps"
    }
  ]
}
```

## 输出文件说明

### 1. manifest.json

取证包元数据文件，包含：
- 包ID、生成时间、工具版本
- 时间线完整信息
- 哈希清单
- 异常摘要
- 文件索引

### 2. timeline.md

时间线报告，包含：
- 时间线概览
- 视频片段时间线表格
- GPS轨迹概览
- 时钟校准记录
- 异常概览和详细列表
- 哈希清单

### 3. anomalies.csv

异常列表 CSV 文件，字段：
- `id`: 异常序号
- `type`: 异常类型
- `severity`: 严重程度
- `timestamp`: 时间戳
- `description`: 描述
- `affected_files`: 受影响文件
- `time_range_start`: 时间范围开始
- `time_range_end`: 时间范围结束
- `details_json`: 详细信息（JSON格式）

## 异常类型说明

| 异常类型 | 说明 | 严重程度 |
|---------|------|---------|
| `missing_segment` | 视频缺段 | 间隙>300秒=CRITICAL, >120秒=HIGH, >60秒=MEDIUM |
| `clock_drift` | 时钟漂移 | 漂移>60秒=CRITICAL, >30秒=HIGH, >10秒=MEDIUM |
| `gps_jump` | GPS跳点 | 距离>1000米=CRITICAL, >500米=HIGH, >200米=MEDIUM |
| `duplicate_segment` | 重复/重叠片段 | 重叠>60秒=HIGH, >10秒=MEDIUM |
| `hash_conflict` | 哈希冲突 | 同名不同哈希=HIGH |

## 配置参数

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `--gap-threshold` | 60秒 | 缺段检测阈值 |
| `--drift-threshold` | 5秒 | 时钟漂移阈值 |
| `--jump-threshold` | 100米 | GPS跳点阈值 |
| `--no-hash` | False | 跳过哈希计算 |
| `--strict` | False | 严格模式，缺失文件时报错 |

## 特殊场景处理

### 跨午夜片段

工具能够自动检测和处理跨午夜的视频片段。当检测到以下情况时会自动调整：
- `start_time > end_time`（只记录时间不记录日期）
- 与前后片段时间差超过12小时

### 同名文件哈希冲突

当两个不同的视频文件具有相同的文件名但不同的内容时，工具会：
1. 分别计算各自的哈希值
2. 标记为 `hash_conflict` 异常
3. 在哈希清单中保留完整路径区分

## API 使用（作为库）

除了 CLI 命令，也可以作为 Python 库使用：

```python
from evidence_tool.processor import EvidenceProcessor

# 创建处理器
processor = EvidenceProcessor(
    gap_threshold_seconds=60,
    clock_drift_threshold_seconds=5,
    gps_jump_threshold_meters=100
)

# 导入数据
package = processor.ingest(
    source_dir='sample_data',
    calculate_hashes=True
)

# 获取摘要
summary = processor.get_summary(package)
print(f"发现 {summary['anomalies']['total_count']} 个异常")

# 导出取证包
exported = processor.export('evidence_package', package)

# 验证
result = processor.verify(package)
print(f"验证结果: {'通过' if result['valid'] else '失败'}")
```

## 测试

使用示例数据运行完整测试流程：

```bash
# 1. 安装依赖
pip install -r requirements.txt

# 2. 导入示例数据
python cli.py ingest sample_data -o evidence_package

# 3. 查看生成的文件
ls evidence_package/
# manifest.json  timeline.md  anomalies.csv

# 4. 查看时间线报告
cat evidence_package/timeline.md

# 5. 验证取证包
python cli.py verify evidence_package

# 6. 列出所有异常
python cli.py list-anomalies -p evidence_package
```

## 项目结构

```
zy8162/
├── cli.py                    # CLI 入口
├── requirements.txt          # 依赖文件
├── README.md                 # 本文档
├── evidence_tool/            # 核心模块
│   ├── __init__.py
│   ├── models.py             # 数据模型
│   ├── readers.py            # 文件读取器
│   ├── timeline.py           # 时间线处理
│   ├── hash_utils.py         # 哈希计算
│   ├── anomaly_detector.py   # 异常检测
│   ├── exporter.py           # 导出器
│   └── processor.py          # 核心处理器
└── sample_data/              # 示例数据
    ├── video_manifest.csv
    ├── gps_log.nmea
    ├── clock_calibration.json
    └── *.mp4 (模拟视频文件)
```

## 许可证

MIT License
