# 离线采集包合并器 (Offline Merger)

专为外勤测绘小组设计的本地 CLI 工具，用于合并多个离线采集包（照片、轨迹 GPX、点位 CSV、备注 JSON）。

## 解决的问题

- **同名不同内容**：相同文件名但内容不同的冲突检测
- **坐标系混乱**：自动识别并统一转换坐标系（WGS84/GCJ02/BD09/CGCS2000）
- **重复点位**：基于距离阈值的重复点位检测
- **漏传附件**：点位引用的附件完整性校验

## 功能特性

- **init**：初始化任务配置
- **scan**：扫描多个采集包并生成校验清单
- **merge**：dry-run 合并计划，识别冲突
- **commit**：提交合并，生成 manifest、隔离区和审计日志
- **export**：导出 Markdown 报告、CSV 异常清单、JSON 合并结果
- **status**：显示任务状态

## 安装

```bash
# 安装依赖
pip3 install click pandas gpxpy pillow pyproj python-dateutil pytest

# 运行测试
python3 -m pytest tests/ -v
```

## 快速开始

### 1. 初始化任务

```bash
python3 -m offline_merger.cli init "20240501-八达岭长城测绘" \
    --output-dir ./output \
    --isolate-dir ./isolate \
    --coordinate-system WGS84 \
    --duplicate-threshold 1.0
```

### 2. 扫描采集包

```bash
python3 -m offline_merger.cli scan \
    --task-config ./output/task_config.json \
    ./sources/平板1 ./sources/平板2 ./sources/平板3
```

### 3. 生成合并计划（Dry-Run）

```bash
python3 -m offline_merger.cli merge \
    --task-config ./output/task_config.json \
    --scan-result ./output/scan_result.json
```

### 4. 查看冲突并解决

查看 merge_result.json 中的冲突列表，修改冲突状态：

```json
{
    "conflicts": [
        {
            "conflict_id": "hash_conflict_000001",
            "action": "pending",
            "status": "unresolved"
        }
    ]
}
```

修改 `action` 字段为以下值之一：
- `keep`：保留（需指定保留哪个来源）
- `isolate`：隔离到隔离区
- `rename`：重命名（格式：原名称_来源_时间戳）
- `merge`：合并（适用于重复点位）
- `delete`：删除

### 5. 提交合并

```bash
python3 -m offline_merger.cli commit \
    --task-config ./output/task_config.json \
    --merge-result ./output/merge_result.json
```

### 6. 导出报告

```bash
# 导出 Markdown 交接报告
python3 -m offline_merger.cli export markdown \
    --task-config ./output/task_config.json \
    --scan-result ./output/scan_result.json \
    --merge-result ./output/merge_result.json \
    --output ./output/report.md

# 导出 CSV 异常清单
python3 -m offline_merger.cli export csv \
    --task-config ./output/task_config.json \
    --scan-result ./output/scan_result.json \
    --merge-result ./output/merge_result.json \
    --output ./output/anomalies.csv

# 导出 JSON 合并结果
python3 -m offline_merger.cli export json \
    --task-config ./output/task_config.json \
    --scan-result ./output/scan_result.json \
    --merge-result ./output/merge_result.json \
    --output ./output/final_result.json
```

## 目录结构

```
project/
├── offline_merger/          # 主程序包
│   ├── cli.py               # CLI 命令入口
│   ├── config/              # 配置模块
│   │   ├── task_config.py   # 任务配置
│   │   ├── coordinate_config.py  # 坐标系配置
│   │   └── merge_rules.py   # 合并规则
│   ├── parsers/             # 文件解析器
│   │   ├── base_parser.py   # 解析器基类
│   │   ├── photo_parser.py  # 照片解析器（EXIF）
│   │   ├── gpx_parser.py    # GPX 轨迹解析器
│   │   ├── csv_parser.py    # CSV 点位解析器
│   │   └── json_parser.py   # JSON 备注解析器
│   ├── validators/          # 校验规则
│   │   ├── hash_validator.py      # 哈希冲突校验
│   │   ├── attachment_validator.py # 附件完整性校验
│   │   ├── time_validator.py       # 时间序列校验
│   │   ├── coordinate_validator.py # 坐标校验
│   │   └── duplicate_validator.py  # 重复点位校验
│   ├── conflict/            # 冲突状态管理
│   │   └── conflict_manager.py
│   ├── archiver/            # 文件归档
│   │   ├── manifest.py      # 清单文件
│   │   ├── audit_log.py     # 审计日志
│   │   └── file_archiver.py # 文件操作
│   └── exporters/           # 导出模块
│       ├── markdown_exporter.py
│       ├── csv_exporter.py
│       └── json_exporter.py
├── tests/                   # 测试用例
├── docs/                    # 文档
├── pyproject.toml           # 项目配置
└── README.md
```

## 支持的文件类型

| 类型 | 扩展名 | 解析内容 |
|------|--------|----------|
| 照片 | .jpg, .jpeg, .png, .heic | EXIF GPS 坐标、拍摄时间 |
| 轨迹 | .gpx | 轨迹点、航点、时间戳 |
| 点位 | .csv | 经纬度、高度、ID、时间、附件引用 |
| 备注 | .json | 自定义属性、GeoJSON |

## 坐标系支持

支持以下坐标系的自动识别和转换：

- **WGS84**：国际标准 GPS 坐标系
- **GCJ02**：国测局加密坐标系（高德地图）
- **BD09**：百度坐标系
- **CGCS2000**：国家大地坐标系 2000
- **UTM**：通用横轴墨卡托投影

## 冲突类型

| 冲突类型 | 严重性 | 描述 |
|----------|--------|------|
| hash_conflict | high | 同名不同内容（哈希不匹配）|
| duplicate_point | medium | 重复点位（距离小于阈值）|
| missing_attachment | high | 缺失附件 |
| coordinate_issue | medium | 坐标越界或无效值 |
| time_order_issue | medium | 时间倒序 |
| coordinate_system_conflict | high | 坐标系混乱 |

## 解决策略

| 策略 | 描述 |
|------|------|
| keep | 保留指定来源的文件/点位 |
| isolate | 隔离到隔离区待人工审核 |
| rename | 重命名（追加来源标识）|
| merge | 合并属性（适用于重复点位）|
| delete | 删除 |

## 临时目录验证流程

### 1. 创建测试数据目录

```bash
# 创建测试目录结构
mkdir -p /tmp/offline_merger_test/{sources/平板{1,2,3},output,isolate}

# 平板1 - 创建测试数据
cat > /tmp/offline_merger_test/sources/平板1/points.csv << 'EOF'
点位编号,纬度,经度,海拔,时间,备注
P001,39.9042,116.4074,43.5,2024-05-01 08:00:00,起点
P002,39.9052,116.4084,45.2,2024-05-01 08:15:00,中途点
EOF

# 平板2 - 创建测试数据（包含重复点位）
cat > /tmp/offline_merger_test/sources/平板2/points.csv << 'EOF'
点位编号,纬度,经度,海拔,时间,备注
P001,39.90421,116.40741,43.3,2024-05-01 08:05:00,起点（平板2）
P003,39.9062,116.4094,46.1,2024-05-01 08:30:00,终点
EOF

# 平板3 - 创建测试数据（包含同名不同内容文件）
cat > /tmp/offline_merger_test/sources/平板3/points.csv << 'EOF'
点位编号,纬度,经度,海拔,时间,备注
P004,40.0,117.0,50.0,2024-05-01 09:00:00,异常点（坐标越界）
EOF

# 创建测试照片文件（空文件，用于测试扫描）
touch /tmp/offline_merger_test/sources/平板1/photo_001.jpg
touch /tmp/offline_merger_test/sources/平板2/photo_001.jpg  # 同名文件
touch /tmp/offline_merger_test/sources/平板3/photo_002.jpg

# 创建 GPX 轨迹文件
cat > /tmp/offline_merger_test/sources/平板1/track.gpx << 'EOF'
<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1">
  <trk>
    <name>测试轨迹</name>
    <trkseg>
      <trkpt lat="39.9042" lon="116.4074">
        <ele>43.5</ele>
        <time>2024-05-01T08:00:00Z</time>
      </trkpt>
      <trkpt lat="39.9052" lon="116.4084">
        <ele>45.2</ele>
        <time>2024-05-01T08:15:00Z</time>
      </trkpt>
    </trkseg>
  </trk>
</gpx>
EOF
```

### 2. 运行验证命令

```bash
# 进入项目目录
cd /Users/mac/pro/solocoder/pro/xy4146/repo/xy4146

# 1. 初始化任务
python3 -m offline_merger.cli init "临时测试任务" \
    --output-dir /tmp/offline_merger_test/output \
    --isolate-dir /tmp/offline_merger_test/isolate \
    --coordinate-system WGS84 \
    --duplicate-threshold 5.0

# 2. 扫描采集包
python3 -m offline_merger.cli scan \
    --task-config /tmp/offline_merger_test/output/task_config.json \
    /tmp/offline_merger_test/sources/平板1 \
    /tmp/offline_merger_test/sources/平板2 \
    /tmp/offline_merger_test/sources/平板3

# 查看扫描结果
cat /tmp/offline_merger_test/output/scan_result.json | python3 -m json.tool

# 3. 生成合并计划
python3 -m offline_merger.cli merge \
    --task-config /tmp/offline_merger_test/output/task_config.json \
    --scan-result /tmp/offline_merger_test/output/scan_result.json

# 查看合并计划
cat /tmp/offline_merger_test/output/merge_result.json | python3 -m json.tool

# 4. 导出 Markdown 报告
python3 -m offline_merger.cli export markdown \
    --task-config /tmp/offline_merger_test/output/task_config.json \
    --scan-result /tmp/offline_merger_test/output/scan_result.json \
    --merge-result /tmp/offline_merger_test/output/merge_result.json \
    --output /tmp/offline_merger_test/output/report.md

# 查看报告
cat /tmp/offline_merger_test/output/report.md
```

### 3. 查看验证结果

```bash
# 查看输出目录结构
ls -la /tmp/offline_merger_test/output/

# 查看任务配置
cat /tmp/offline_merger_test/output/task_config.json | python3 -m json.tool
```

### 4. 清理测试数据

```bash
rm -rf /tmp/offline_merger_test
```

## 输出文件说明

| 文件名 | 说明 |
|--------|------|
| task_config.json | 任务配置（包含采集包列表、坐标系、阈值等）|
| scan_result.json | 扫描结果（所有文件元数据、哈希值、解析结果）|
| merge_result.json | 合并计划（冲突列表、操作计划、dry-run 标志）|
| manifest.json | 提交后生成的清单文件（记录所有操作）|
| audit_log.jsonl | 审计日志（JSON Lines 格式，可追加）|
| report.md | Markdown 交接报告 |
| anomalies.csv | CSV 异常清单 |
| final_result.json | JSON 合并结果 |

## 审计日志格式

每条记录为一行 JSON：

```json
{
    "action": "copy",
    "timestamp": "2024-05-01T10:00:00",
    "source": "/usb/平板1/photo.jpg",
    "destination": "/output/平板1_photo.jpg",
    "file_hash": "abc123...",
    "operator": "user",
    "reason": "正常复制"
}
```

## 注意事项

1. **本地运行**：所有操作均在本地执行，不会上传数据
2. **哈希校验**：使用 SHA256 + MD5 双重哈希确保文件完整性
3. **只读访问**：扫描过程对源文件只读，不会修改源数据
4. **隔离区**：冲突文件会被隔离，不会污染输出目录
5. **可追溯**：所有操作均记录在审计日志中

## 开发

```bash
# 运行单元测试
python3 -m pytest tests/ -v

# 运行特定测试
python3 -m pytest tests/test_parsers.py -v
```

## License

MIT License
