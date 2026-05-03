# 离线样本包合并器

为外业地质队设计的本地端侧数据合并工具

## 项目背景

在山区野外地质勘查时，多名地质队员各自使用平板设备记录岩芯样本数据。由于山里没有网络，队员们各自独立工作，回驻地后会带回大量的样本数据。传统的合并工作面临以下问题：

1. **样本编号撞车**：多人使用相同的编号前缀或重复编号
2. **经纬度漂移**：GPS 信号不佳导致同一地点记录坐标偏差
3. **采样时间倒序**：记录顺序混乱，难以确定真实时间
4. **照片漏关联**：照片与样本记录对应关系不完整
5. **后改记录被覆盖**：修改后的记录可能被原始记录覆盖

离线样本包合并器正是为了解决这些问题而设计。

## 功能特性

- **多格式支持**：支持 CSV、JSON、JSONL 格式的样本数据
- **哈希校验**：使用 SHA-256 哈希算法确保数据完整性
- **冲突检测**：自动检测 6 种类型的冲突
- **人工复核**：冲突进入人工复核队列，保存决策记录
- **报告导出**：导出 Markdown 合并报告、CSV 冲突清单、JSON 审计包
- **本地存储**：使用 SQLite 数据库持久化存储，支持后续查询

## 冲突类型

| 冲突类型 | 说明 |
|---------|------|
| 样本编号撞车 | 相同样本编号的记录 |
| 经纬度漂移 | 同一编号但坐标差异较大（默认阈值） |
| 采样时间倒序 | 采样时间与修改时间顺序不一致 |
| 照片漏关联 | 记录的照片路径不存在 |
| 后改记录被覆盖 | 相同编号但内容哈希不同 |
| 字段不一致 | 相同编号但字段值不一致 |

## 安装

### 环境要求

- Python 3.8+
- pip 包管理器

### 安装依赖

```bash
pip install -r requirements.txt
```

## 项目结构

```
xy4239/
├── offline_sample_merger/      # 主包目录
│   ├── __init__.py            # 包初始化
│   ├── models.py                # 数据模型定义
│   ├── scanner.py               # 包扫描模块
│   ├── validator.py             # 解析校验模块
│   ├── merger.py                 # 冲突合并模块
│   ├── reviewer.py              # 复核存储模块
│   └── exporter.py              # 导出模块
├── sample_data/                  # 示例数据
│   ├── team_a/
│   │   ├── manifest.json       # 元数据清单
│   │   └── samples.json        # JSON 格式样本
│   ├── team_b/
│   │   ├── manifest.json
│   │   └── samples.json
│   └── team_c/
│       └── samples.csv           # CSV 格式样本
├── main.py                       # 主程序入口
├── requirements.txt             # 依赖列表
└── README.md                     # 本文档
```

## 使用方法

### 基本合并

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output
```

### 自动解决冲突

使用 `--auto-resolve` 参数自动解决冲突（保留最新修改记录）：

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output --auto-resolve
```

### 交互模式人工复核

使用 `--interactive` 参数进入交互模式，逐个处理冲突：

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output --interactive
```

交互模式下的决策选项：

- `[1]` 保留先到记录
- `[2]` 保留后改记录
- `[3]` 保留指定记录
- `[4]` 合并创建新记录
- `[5]` 标记为重复
- `[s]` 跳过此冲突
- `[q]` 退出复核模式

### 严格模式校验

使用 `--strict` 参数启用严格模式：

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output --strict
```

### 指定操作人

使用 `--user` 参数指定操作人名称：

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output --user "地质队长"
```

### 查看已合并样本

```bash
python main.py list-samples --db ./output/sample_database.db
```

### 查看冲突记录

```bash
# 查看所有冲突
python main.py list-conflicts --db ./output/sample_database.db

# 只查看待复核的冲突
python main.py list-conflicts --db ./output/sample_database.db --pending
```

## 输出文件说明

合并完成后，输出目录会包含以下文件：

### 1. Markdown 合并报告 (`YYYYMMDD_HHMMSS_merge_report.md`)

包含：
- 合并统计摘要
- 包扫描详情（设备、采集者、校验和）
- 冲突统计
- 冲突详情（待复核/已解决）
- 样本列表

### 2. CSV 冲突清单 (`YYYYMMDD_HHMMSS_conflicts.csv`)

字段：
- 冲突ID
- 冲突类型
- 状态（待复核/已解决）
- 描述
- 涉及样本
- 决策
- 解决时间
- 解决人
- 备注

### 3. JSON 审计包 (`YYYYMMDD_HHMMSS_audit_package.json`)

包含完整的审计数据：
- 元数据（导出时间、版本）
- 所有包信息
- 所有样本数据
- 所有冲突记录
- 合并统计

### 4. CSV 样本列表 (`YYYYMMDD_HHMMSS_merged_samples.csv`)

合并后的样本数据，可直接导入其他系统。

### 5. SQLite 数据库 (`sample_database.db`)

包含三个表：
- `samples`：样本数据
- `conflicts`：冲突记录
- `audit_log`：审计日志

## 数据格式说明

### 样本数据字段

| 字段名 | 类型 | 必填 | 说明 |
|-------|------|------|------|
| sample_id | string | 是 | 样本编号 |
| latitude | float | 是 | 纬度（-90 到 90） |
| longitude | float | 是 | 经度（-180 到 180） |
| sample_time | datetime | 是 | 采样时间 |
| collector | string | 是 | 采集者 |
| rock_type | string | 否 | 岩性 |
| description | string | 否 | 描述 |
| depth | float | 否 | 深度（米） |
| photo_paths | array | 否 | 照片路径列表 |
| create_time | datetime | 否 | 创建时间 |
| modify_time | datetime | 否 | 修改时间 |

### Manifest 格式 (`manifest.json`)

```json
{
    "name": "team_a",
    "device": "iPad_Pro_12_9_2024",
    "collector": "地质队A组-张三",
    "created_at": "2026-05-02T08:30:00",
    "description": "A组野外采样数据"
}
```

### JSON 格式示例

```json
[
    {
        "sample_id": "QZ-2026-001",
        "latitude": 35.678912,
        "longitude": 94.567890,
        "sample_time": "2026-05-02T09:15:00",
        "collector": "地质队A组-张三",
        "rock_type": "花岗岩",
        "description": "中粗粒黑云母花岗岩",
        "depth": 12.5,
        "photo_paths": ["photos/QZ-2026-001_1.jpg", "photos/QZ-2026-001_2.jpg"],
        "create_time": "2026-05-02T09:15:00",
        "modify_time": "2026-05-02T09:15:00"
    }
]
```

### CSV 格式示例

```csv
sample_id,latitude,longitude,sample_time,collector,rock_type,description,depth,photo_paths,create_time,modify_time
QZ-2026-006,35.683456,94.572345,2026-05-02T15:30:00,地质队C组-王五,玄武岩,暗绿色玄武岩,10.0,"photos/1.jpg,photos/2.jpg",2026-05-02T15:30:00,2026-05-02T15:30:00
```

## 配置参数

### 冲突检测阈值

可在 `offline_sample_merger/merger.py` 中调整：

```python
class ConflictDetector:
    # 经纬度漂移阈值（度，约 11 米）
    COORDINATE_DRIFT_THRESHOLD = 0.0001
    
    # 时间倒序阈值（分钟）
    TIME_OUT_OF_ORDER_THRESHOLD_MINUTES = 5
```

### 坐标距离计算

使用 Haversine 公式计算两点间距离（考虑地球曲率）：

```
距离 = 2 * R * asin( sqrt( sin²(Δlat/2) + cos(lat1) * cos(lat2) * sin²(Δlon/2) )
```

其中 R = 6371 km（地球平均半径）

## 示例数据

项目包含 3 个模拟地质队的样本数据，用于演示各种冲突场景：

- **team_a**：原始记录（3 个样本）
- **team_b**：包含后改记录、坐标漂移、照片缺失（4 个样本）
- **team_c**：CSV 格式数据（3 个样本）

运行示例：

```bash
python main.py merge --scan-dir ./sample_data --output-dir ./output --auto-resolve
```

## 工作流程

1. **扫描**：遍历目录发现所有离线样本包
2. **解析**：读取 CSV/JSON/JSONL 文件
3. **校验**：检查字段完整性、坐标范围、时间格式
4. **哈希**：计算样本哈希用于检测修改
5. **冲突检测**：识别 6 种冲突类型
6. **合并**：自动或人工解决冲突
7. **存储**：保存到 SQLite 数据库
8. **导出**：生成报告和清单

## 版本历史

- v1.0.0 (2026-05-03)
  - 初始版本发布
  - 支持 6 种冲突检测
  - 支持 4 种报告导出
  - 支持 SQLite 持久化存储

## 许可证

本项目仅供内部使用。

## 联系方式

如有问题，请联系地质数据处理团队。
