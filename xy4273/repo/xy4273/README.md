# 固件灰度放行员 (Firmware Gray Release Manager)

离线巡检平板固件灰度升级管理工具，解决以下核心问题：

- ✅ 防止不同硬件批次刷错包
- ✅ 确保签名校验不被遗漏
- ✅ 升级中断后回滚记录与现场遥测对齐

## 功能特性

### 核心命令

| 命令 | 功能 | 说明 |
|------|------|------|
| `init` | 生成示例 | 创建设备清单、固件manifest、升级窗口、遥测日志示例文件 |
| `import` | 导入数据 | 导入设备清单CSV、固件manifest JSON、升级窗口YAML、遥测日志JSONL |
| `check` | 安全校验 | 校验硬件兼容、签名哈希、低电量、窗口冲突、重复升级 |
| `plan` | 分批策略 | 生成金丝雀→阶段1→阶段2→阶段3→全量的分批升级计划 |
| `rollback` | 回滚管理 | 记录回滚状态，追踪遥测同步情况 |
| `report` | 审计导出 | 导出 Markdown/CSV/JSON 格式的审计报告包 |
| `status` | 状态概览 | 查看升级记录和回滚记录统计 |
| `timeline` | 时间线 | 查看单台设备的升级事件时间线 |

### 校验项

1. **硬件兼容性检查** - 确保设备硬件批次在固件兼容列表中
2. **签名哈希校验** - 验证固件文件的SHA256校验值
3. **低电量保护** - 电量低于阈值(默认20%)的设备不允许升级
4. **升级窗口检查** - 确认当前时间在允许的升级窗口内
5. **重复升级检查** - 防止同一设备重复升级或并发升级

### 策略引擎

- **金丝雀批次 (Canary)**: 5%设备，零失败容忍
- **阶段1 (Phase 1)**: 15%设备，5%失败容忍
- **阶段2 (Phase 2)**: 30%设备，5%失败容忍
- **阶段3 (Phase 3)**: 50%设备，5%失败容忍
- **全量 (Full)**: 剩余设备

## 快速开始

### 安装

```bash
# 克隆或下载项目后，安装依赖
pip install -r requirements.txt

# 以开发模式安装
pip install -e .
```

### 验证流程

#### 1. 生成示例数据

```bash
# 在当前目录生成示例配置文件
firmware-ga init --output-dir ./samples

# 查看生成的文件
ls -la ./samples/
```

生成的文件：
- `devices.csv` - 5台设备示例清单
- `firmware_manifest.json` - 固件v2.2.0清单
- `upgrade_windows.yaml` - 3个升级时段配置
- `telemetry.jsonl` - 遥测日志示例
- `firmware_ga_config.json` - 策略配置示例

#### 2. 进行安全校验

```bash
# 导入并校验示例数据
firmware-ga check \
  --devices ./samples/devices.csv \
  --firmware ./samples/firmware_manifest.json \
  --windows ./samples/upgrade_windows.yaml \
  --telemetry ./samples/telemetry.jsonl \
  --verbose \
  --output ./check_results
```

校验结果说明：
- ✅ 通过：所有校验项都满足
- ❌ 失败：存在不满足条件的校验项
  - `PAD-004` 会因电量15%<20%阈值而失败
  - 其他设备应该全部通过

#### 3. 生成分批策略

```bash
# 基于校验通过的设备生成分批计划
firmware-ga plan \
  --devices ./samples/devices.csv \
  --firmware ./samples/firmware_manifest.json \
  --windows ./samples/upgrade_windows.yaml \
  --telemetry ./samples/telemetry.jsonl \
  --output ./batch_plan
```

查看生成的分批计划：
```bash
cat ./batch_plan/batch_plan.json
```

#### 4. 模拟回滚场景

```bash
# 回滚指定设备
firmware-ga rollback \
  --device-id PAD-003 \
  --devices-csv ./samples/devices.csv \
  --firmware ./samples/firmware_manifest.json \
  --reason "模拟回滚测试" \
  --output ./rollback_records

# 或基于遥测自动回滚所有失败设备
firmware-ga rollback \
  --all-failed \
  --telemetry ./samples/telemetry.jsonl \
  --output ./rollback_records
```

#### 5. 生成审计报告

```bash
# 生成完整审计包（Markdown+CSV+JSON）
firmware-ga report \
  --devices ./samples/devices.csv \
  --firmware ./samples/firmware_manifest.json \
  --telemetry ./samples/telemetry.jsonl \
  --format all \
  --output ./audit_report
```

查看报告：
```bash
# Markdown格式报告
cat ./audit_report/audit_report.md

# JSON格式报告
cat ./audit_report/audit_report.json
```

#### 6. 查看系统状态

```bash
# 查看升级记录和回滚记录统计
firmware-ga status

# 查看详细状态
firmware-ga status --verbose
```

#### 7. 查看设备时间线

```bash
# 查看特定设备的升级事件时间线
firmware-ga timeline PAD-001 --telemetry ./samples/telemetry.jsonl
```

## 数据文件格式

### 设备清单 (devices.csv)

| 列名 | 类型 | 必填 | 说明 |
|------|------|------|------|
| device_id | string | 是 | 设备唯一标识 |
| hardware_batch | string | 是 | 硬件批次号 |
| current_firmware | string | 是 | 当前固件版本 |
| battery_level | float | 是 | 剩余电量(0-100) |
| last_checkin | datetime | 是 | 最后签到时间 |
| status | string | 否 | 设备状态 |
| hardware_model | string | 否 | 硬件型号 |
| serial_number | string | 否 | 序列号 |

### 固件清单 (firmware_manifest.json)

```json
{
  "version": "v2.2.0",
  "hardware_compatible": ["BATCH-2024-A", "BATCH-2024-B"],
  "signature_hash": "SHA256:abc123...",
  "file_path": "/firmware/padpro_v2.2.0_update.img",
  "checksum_sha256": "a1b2c3d4e5f6...",
  "release_notes": "修复蓝牙连接问题...",
  "rollback_version": "v2.1.0"
}
```

### 升级窗口 (upgrade_windows.yaml)

```yaml
windows:
  - window_id: "WINDOW-MORNING"
    start_time: "2024-01-15T08:00:00"
    end_time: "2024-01-15T12:00:00"
    allowed_hardware_batches: ["BATCH-2024-A"]
    max_devices: 50
    priority: 1
```

### 遥测日志 (telemetry.jsonl)

每行一个JSON对象：

```json
{"device_id": "PAD-001", "timestamp": "2024-01-15T10:30:00", "event_type": "upgrade_start", "firmware_version": "v2.1.0", "details": {"target_version": "v2.2.0"}}
{"device_id": "PAD-001", "timestamp": "2024-01-15T10:35:00", "event_type": "upgrade_success", "firmware_version": "v2.2.0", "details": {"duration_seconds": 300}}
```

事件类型：
- `upgrade_start` - 升级开始
- `upgrade_success` - 升级成功
- `upgrade_failed` - 升级失败
- `upgrade_rollback` - 回滚执行
- `telemetry_report` - 遥测上报

## 策略配置

在 `firmware_ga_config.json` 中配置策略：

```json
{
  "strategy": {
    "canary_percentage": 5.0,
    "phase_1_percentage": 15.0,
    "phase_2_percentage": 30.0,
    "phase_3_percentage": 50.0,
    "canary_max_failures": 0,
    "phase_max_failures_ratio": 0.05,
    "delay_between_batches_hours": 24.0,
    "group_by_hardware_batch": true,
    "prioritize_low_battery": false,
    "prioritize_recent_checkin": true,
    "minimum_batch_size": 1,
    "maximum_batch_size": 100
  },
  "validation": {
    "min_battery_threshold": 20.0
  }
}
```

## 运行测试

```bash
# 运行所有测试
pytest -v

# 运行测试并生成覆盖率报告
pytest --cov=firmware_ga --cov-report=html

# 运行特定模块测试
pytest tests/test_parser_validator.py -v
```

## 项目结构

```
firmware-ga/
├── firmware_ga/
│   ├── __init__.py          # 包初始化
│   ├── cli.py               # CLI入口和命令处理
│   ├── parser_validator.py  # 解析器和校验器
│   ├── strategy_engine.py   # 策略引擎
│   ├── state_storage.py     # 状态存储(SQLite)
│   ├── telemetry_replay.py  # 遥测回放和分析
│   └── exporter.py          # 报告导出(MD/CSV/JSON)
├── tests/
│   ├── __init__.py
│   └── test_parser_validator.py  # 单元测试
├── samples/                  # 示例数据(init生成)
├── output/                   # 输出目录
├── .firmware_ga/             # 数据存储(SQLite)
├── requirements.txt
├── setup.py
└── README.md
```

## 模块说明

### 1. CLI模块 (`cli.py`)

使用Click框架实现命令行界面，包含所有用户交互命令。

### 2. 解析校验模块 (`parser_validator.py`)

- **Parser类**: 解析CSV/JSON/YAML/JSONL格式的数据文件
- **Validator类**: 实现5项核心校验逻辑
- **数据类**: DeviceInfo, FirmwareManifest, UpgradeWindow, TelemetryEntry

### 3. 策略引擎模块 (`strategy_engine.py`)

- **StrategyConfig**: 策略配置参数
- **StrategyEngine**: 分批计划生成、批次检查、回滚候选识别
- **BatchPriority**: 批次优先级枚举
- **BatchPlan**: 批次计划数据类

### 4. 状态存储模块 (`state_storage.py`)

- 使用SQLite持久化存储
- 记录导入历史、升级记录、回滚状态
- 支持CSV导出历史记录
- 校验回滚记录与遥测同步

### 5. 遥测回放模块 (`telemetry_replay.py`)

- 构建设备事件时间线
- 分析设备当前状态
- 检测失败升级和回滚差异
- 模拟升级流程

### 6. 导出模块 (`exporter.py`)

- JSON格式导出
- CSV格式导出(支持嵌套字典扁平化)
- Markdown报告生成(带表格)
- 完整审计包导出

## 最佳实践

### 1. 灰度升级流程

```
1. init → 准备示例数据，了解格式
2. import → 导入真实生产数据
3. check → 全面校验，排除问题设备
4. plan → 生成分批策略，确认窗口分配
5. (执行升级) → 按批次推送固件
6. check → 再次校验，确认成功/失败
7. rollback → 对失败设备记录回滚
8. report → 导出完整审计报告
```

### 2. 数据校验清单

每次升级前必须确认：

- [ ] 所有设备硬件批次在固件兼容列表中
- [ ] 固件文件SHA256校验与manifest一致
- [ ] 待升级设备电量均≥20%
- [ ] 当前时间在配置的升级窗口内
- [ ] 无设备正在进行同版本升级
- [ ] 升级窗口无时间冲突

### 3. 回滚触发条件

建议在以下情况触发回滚：

1. **升级失败**: `upgrade_failed` 事件
2. **升级后崩溃**: 升级后遥测显示 `crash_count > 0`
3. **人工确认**: 管理员手动触发

### 4. 遥测同步验证

每次回滚后必须验证：

- 设备是否上报了回滚后的版本
- 回滚记录中的 `to_version` 与遥测一致
- 更新 `telemetry_sync_status` 字段

## 常见问题

### Q1: 如何修改电量阈值？

修改 `parser_validator.py` 中的 `Validator.MIN_BATTERY_THRESHOLD` 常量，或在未来版本通过配置文件设置。

### Q2: 如何添加新的校验项？

1. 在 `Validator` 类中添加新的 `validate_xxx` 方法
2. 在 `validate_all` 方法中注册新校验项
3. 更新测试用例

### Q3: 数据存储在哪里？

默认在当前目录的 `.firmware_ga/` 文件夹：
- `firmware_ga.db` - SQLite数据库
- `rollback/` - 回滚记录JSON备份
- `json/` - JSON格式导出

### Q4: 如何清理历史数据？

```bash
# 手动删除 .firmware_ga 文件夹
rm -rf .firmware_ga/

# 或使用SQL命令清理特定表
sqlite3 .firmware_ga/firmware_ga.db "DELETE FROM upgrade_records WHERE upgrade_time < '2024-01-01';"
```

## License

MIT License

## 贡献

欢迎提交Issue和Pull Request！
