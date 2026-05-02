# 串口固件升级回放器

一个用于工厂设备运维工程师的本地端侧工具，用于重放和复核串口固件升级过程。

## 功能特性

- **日志解析**：智能解析串口日志，提取时间戳、日志级别、事件类型和关键数据
- **状态机重放**：基于有限状态机重放完整升级过程，识别状态流转
- **规则校验**：自动检测多种风险场景：
  - 握手超时
  - 版本跳级
  - CRC校验失败
  - 重复刷写
  - 回滚缺口
  - 升级中断
  - 重试次数过多
- **复核存储**：保存复核记录，支持历史查询和统计
- **多格式导出**：
  - Markdown 报告（人工可读）
  - CSV 风险清单（批量分析）
  - JSON 审计包（完整数据）

## 项目结构

```
xy4167/
├── main.py                 # 主入口程序
├── requirements.txt        # 依赖包
├── README.md              # 本文档
├── src/
│   ├── __init__.py
│   ├── log_parser.py      # 日志解析模块
│   ├── models.py          # 设备/固件数据模型
│   ├── state_machine.py   # 升级状态机
│   ├── rules.py           # 规则校验引擎
│   ├── storage.py         # 复核存储管理
│   └── io_handler.py      # 导入导出处理
└── tests/
    ├── __init__.py
    ├── test_log_parser.py
    ├── test_state_machine.py
    └── test_rules.py
```

## 安装

```bash
# 克隆项目后进入目录
cd xy4167

# 安装依赖
pip install -r requirements.txt
```

## 快速开始

### 1. 创建示例数据

使用示例数据体验完整流程：

```bash
python main.py sample --output ./sample_data
```

这会在 `./sample_data` 目录下创建：
- `sample_upgrade.log` - 示例串口日志
- `firmware_manifest.json` - 固件元数据
- `batch_20240115.csv` - 设备批次信息
- `review_notes.txt` - 人工备注示例

### 2. 运行完整复核流程

使用示例数据运行复核：

```bash
python main.py run \
    --log ./sample_data/sample_upgrade.log \
    --manifest ./sample_data/firmware_manifest.json \
    --batch ./sample_data/batch_20240115.csv \
    --notes ./sample_data/review_notes.txt \
    --output ./output \
    --device-id DEV001 \
    --reviewer "运维工程师"
```

### 3. 查看输出

在 `./output` 目录下会生成三个文件：

1. **Markdown 报告** (`review_<id>_<timestamp>.md`)
   - 复核结论和风险统计
   - 违规详情
   - 状态流转记录
   - 版本信息

2. **CSV 风险清单** (`review_<id>_<timestamp>_risks.csv`)
   - 所有违规记录的表格形式
   - 便于批量分析和导入其他系统

3. **JSON 审计包** (`review_<id>_<timestamp>_audit.json`)
   - 完整的复核数据
   - 包含状态机摘要、规则结果、日志摘要

## 命令参考

### `sample` - 创建示例数据

```bash
python main.py sample --output <目录>
```

| 参数 | 说明 |
|------|------|
| `--output, -o` | 输出目录（必填） |

### `run` - 运行复核流程

```bash
python main.py run --log <日志文件> [选项]
```

| 参数 | 说明 |
|------|------|
| `--log, -l` | 串口日志文件路径（必填） |
| `--manifest, -m` | 固件 manifest JSON 路径 |
| `--batch, -b` | 设备批次 CSV 路径 |
| `--notes, -n` | 人工备注文件路径 |
| `--output, -o` | 报告输出目录 |
| `--device-id, -d` | 设备 ID |
| `--reviewer, -r` | 复核人名称 |

### `list` - 列出历史复核记录

```bash
python main.py list [选项]
```

| 参数 | 说明 |
|------|------|
| `--batch-id, -b` | 按批次 ID 筛选 |
| `--conclusion, -c` | 按结论筛选 (PASS/WARNING/FAIL) |
| `--limit, -n` | 显示数量限制（默认 50） |
| `--json` | 以 JSON 格式输出 |

### `get` - 查看详细复核记录

```bash
python main.py get <复核ID> [选项]
```

| 参数 | 说明 |
|------|------|
| `--json` | 以 JSON 格式输出 |

### `stats` - 查看统计信息

```bash
python main.py stats [选项]
```

| 参数 | 说明 |
|------|------|
| `--json` | 以 JSON 格式输出 |

## 临时目录验证流程

### 使用临时目录快速验证

```bash
# 1. 创建临时工作目录
mkdir -p /tmp/firmware_review

# 2. 生成示例数据到临时目录
python main.py sample --output /tmp/firmware_review/sample

# 3. 运行复核流程
python main.py run \
    --log /tmp/firmware_review/sample/sample_upgrade.log \
    --manifest /tmp/firmware_review/sample/firmware_manifest.json \
    --output /tmp/firmware_review/output \
    --device-id TEST-001

# 4. 查看生成的报告
ls -la /tmp/firmware_review/output/

# 5. 查看复核统计
python main.py stats

# 6. 清理临时目录（可选）
rm -rf /tmp/firmware_review
```

### 使用真实数据

准备好以下文件后运行：

```bash
python main.py run \
    --log /path/to/your/serial.log \
    --manifest /path/to/your/firmware.json \
    --batch /path/to/your/devices.csv \
    --output ./reports
```

## 支持的日志格式

### 时间戳格式

支持多种时间戳格式：
- `2024-01-15 09:30:00.123`
- `[2024-01-15 09:30:00.123]`
- `09:30:00.123`

### 日志级别

- `DEBUG`, `INFO`, `WARNING`/`WARN`, `ERROR`, `CRITICAL`/`FATAL`

### 识别的事件类型

| 事件关键词 | 事件类型 |
|-----------|---------|
| handshake, 握手 | HANDSHAKE |
| version, 版本, VER: | VERSION_CHECK |
| firmware, 固件 | FIRMWARE_INFO |
| transfer start, 开始传输 | TRANSFER_START |
| transfer complete, 传输完成 | TRANSFER_COMPLETE |
| crc, 校验 | CRC_CHECK |
| crc pass, crc ok, 校验通过 | CRC_PASS |
| crc fail, crc error, 校验失败 | CRC_FAIL |
| flash start, 开始烧录 | FLASH_START |
| flash complete, 烧录完成 | FLASH_COMPLETE |
| reboot, 重启 | REBOOT |
| rollback, 回滚 | ROLLBACK_START |
| rollback complete, 回滚完成 | ROLLBACK_COMPLETE |
| timeout, 超时 | TIMEOUT |
| retry, 重试 | RETRY |
| success, 成功 | SUCCESS |
| failure, fail, 失败 | FAILURE |

### 数据提取

自动从日志中提取：
- `version` - 版本号 (如 `VER: 1.2.0`)
- `crc` - CRC 值 (如 `CRC: A1B2C3D4`)
- `progress` - 进度百分比 (如 `50%`)
- `size` - 文件大小
- `packet` - 包序号
- `retry_count` - 重试次数

## 规则说明

### 风险级别

| 级别 | 颜色 | 说明 |
|------|------|------|
| CRITICAL | 🔴 红色 | 严重问题，必须处理 |
| HIGH | 🟠 橙色 | 高风险，建议复查 |
| MEDIUM | 🟡 黄色 | 中等风险，建议关注 |
| LOW | 🟢 绿色 | 低风险，可选处理 |

### 检测规则

1. **握手超时** (CRITICAL)
   - 检测到超时事件或状态停留在超时状态

2. **版本跳级** (MEDIUM)
   - 检测到跨大版本升级（如 1.0.0 -> 3.0.0）

3. **CRC 校验失败** (CRITICAL)
   - 检测到 CRC 错误日志
   - 或 CRC 未验证就继续后续步骤

4. **重复刷写** (MEDIUM)
   - 同一版本被多次成功刷写

5. **回滚缺口** (HIGH/CRITICAL)
   - 回滚目标版本高于源版本
   - 跨大版本回滚
   - 回滚操作失败

6. **升级中断** (CRITICAL)
   - 状态机在非终止状态结束
   - 检测到断电相关日志

7. **重试次数过多** (MEDIUM)
   - 重试次数超过阈值（默认 3 次）

## 固件 Manifest 格式

```json
{
    "version": "2.0.0",
    "type": "application",
    "file_size": 1048576,
    "crc32": "A1B2C3D4",
    "md5": "e10adc3949ba59abbe56e057f20f883",
    "release_date": "2024-01-10T00:00:00",
    "compatible_hardware": ["HW1.0", "HW1.1", "HW2.0"],
    "rollback_allowed": true,
    "minimum_rollback_version": "1.0.0",
    "notes": "此版本修复了通信稳定性问题"
}
```

## 设备批次 CSV 格式

```csv
device_id,serial_number,model,hardware_version,firmware_version,status
DEV001,SN20240101,Controller-X,HW1.0,1.2.0,NORMAL
DEV002,SN20240102,Controller-X,HW1.0,1.1.0,NORMAL
```

## 运行测试

```bash
# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_log_parser.py -v
pytest tests/test_state_machine.py -v
pytest tests/test_rules.py -v

# 生成覆盖率报告
pytest tests/ --cov=src -v
```

## 存储位置

复核记录默认存储在：
- macOS/Linux: `~/.serial_firmware_replayer/reviews/`

可以通过 `ReviewStorage` 类自定义存储路径。

## 版本历史

- **v1.0.0** (2024-01-15)
  - 初始版本发布
  - 支持日志解析、状态机重放、规则校验
  - 支持 Markdown/CSV/JSON 导出
  - 支持复核记录存储和查询

## 许可证

MIT License

## 联系方式

如有问题或建议，请提交 Issue。
