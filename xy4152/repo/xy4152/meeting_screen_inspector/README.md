# 会议屏串口巡检盒 (Meeting Screen Inspector - MSI)

给共享工位运维同事用的本地端侧工具，用于每周升级前巡检会议屏和投屏盒。

## 功能特性

- **scan** - 导入多设备数据包（从各个U盘收集的日志/配置）
- **parse** - 解析串口日志、蓝牙广播快照、设备配置JSON
- **check** - 标出版本漂移、重启循环、地址重复、配置缺项和回滚风险
- **confirm** - 支持人工确认风险状态
- **export** - 导出Markdown巡检报告、CSV风险清单和JSON回滚包

## 项目结构

```
meeting_screen_inspector/
├── cli/                    # 命令行接口
│   └── main.py             # Click CLI主入口
├── models/                 # 数据模型
│   └── models.py           # Pydantic模型定义
├── parsers/                # 协议解析模块
│   ├── serial_parser.py    # 串口日志解析器
│   ├── bluetooth_parser.py # 蓝牙广播解析器
│   └── config_parser.py    # JSON配置解析器
├── rules/                  # 规则引擎
│   └── engine.py           # 检测规则实现
├── storage/                # 状态存储
│   └── store.py            # 会话存储管理
├── exporters/              # 导出模块
│   └── exporter.py         # Markdown/CSV/JSON导出
├── samples/                # 示例数据
│   ├── normal_device/      # 正常设备示例
│   ├── old_version_device/ # 版本漂移示例
│   ├── reboot_loop_device/ # 重启循环示例
│   ├── incomplete_config/  # 配置缺项示例
│   └── duplicate_bt_device/# 蓝牙地址重复示例
├── tests/                  # 测试用例
│   ├── test_parsers.py     # 解析器测试
│   └── test_rules.py       # 规则引擎测试
├── data/                   # 数据目录（运行时使用）
├── pyproject.toml          # 项目配置
└── README.md               # 本文档
```

## 安装

### 环境要求

- Python 3.9+
- pip

### 安装步骤

```bash
# 进入项目目录
cd meeting_screen_inspector

# 安装依赖
pip install -e .

# 或使用开发模式安装（含测试依赖）
pip install -e ".[dev]"
```

## 快速开始

### 临时目录验证流程

项目自带示例数据，可以直接用来验证工具功能：

```bash
# 1. 进入项目目录
cd /path/to/meeting_screen_inspector

# 2. 查看示例数据
ls samples/
# 输出:
# duplicate_bt_device/  incomplete_config/  old_version_device/
# normal_device/        reboot_loop_device/

# 3. 扫描导入示例数据
msi scan samples/ --name "测试巡检"

# 4. 查看解析结果
msi parse

# 5. 执行规则检查
msi check

# 6. 导出报告
msi export --output-dir ./output
```

### 预期检查结果

使用示例数据运行 `msi check` 后，你应该看到以下风险被检测到：

| 设备ID | 风险类型 | 风险等级 | 说明 |
|--------|----------|----------|------|
| MS-102 | version_drift | HIGH/MEDIUM | 版本2.2.1，主流版本2.3.5 |
| MS-103 | reboot_loop | CRITICAL | 检测到3次以上重启 |
| MS-104 | config_missing | CRITICAL | 缺少version、network、bluetooth等配置 |
| MS-105 | address_duplicate | CRITICAL | 蓝牙地址与MS-101重复 (串台) |

## 详细使用说明

### 1. scan - 导入数据

```bash
# 导入单个设备目录
msi scan /path/to/device_data/

# 导入包含多个设备的目录（每个子目录为一个设备）
msi scan /path/to/all_devices/ --name "2024年5月巡检"

# 指定设备类型
msi scan /path/to/data/ --device-type meeting_screen

# 指定预期波特率
msi scan /path/to/data/ --baud-rate 9600

# 追加到现有会话
msi scan /path/to/more_data/ --session-id abc12345
```

**数据目录结构要求**：

工具支持以下目录结构：

```
# 方式1：每个设备一个子目录（推荐）
data/
├── MS-101/
│   ├── serial.log        # 串口日志
│   ├── bluetooth.json    # 蓝牙快照
│   └── config.json       # 设备配置
├── MS-102/
│   ├── log.txt
│   └── config.json
└── ...

# 方式2：单个文件（会作为单个设备处理）
msi scan /path/to/serial.log
```

### 2. parse - 查看解析结果

```bash
# 查看最近会话的解析结果
msi parse

# 指定会话
msi parse --session-id abc12345

# 查看特定设备
msi parse --device-id MS-101
```

### 3. check - 执行规则检查

```bash
# 使用默认配置检查
msi check

# 自定义参数
msi check --reboot-threshold 2 --expected-baudrate 9600

# 指定会话
msi check --session-id abc12345
```

**检测的规则**：

| 规则名称 | 风险类型 | 说明 |
|----------|----------|------|
| 版本漂移检测 | version_drift | 同一类型设备固件版本不一致 |
| 重启循环检测 | reboot_loop | 重启次数超过阈值（默认3次） |
| 地址重复检测 | address_duplicate | 蓝牙地址在多个设备中出现（串台） |
| 配置缺项检测 | config_missing | 缺少必需的配置项 |
| 回滚风险检测 | rollback_risk | 缺少配置或回滚配置不完整 |
| 波特率错误检测 | baudrate_error | 检测到的波特率与预期不符 |

### 4. confirm - 人工确认

```bash
# 确认单个设备
msi confirm MS-101 --by "张三" --notes "已排查，确认为误报"

# 确认所有设备
msi confirm --all --by "张三"

# 指定会话
msi confirm MS-101 --session-id abc12345
```

### 5. export - 导出报告

```bash
# 导出所有格式（默认）
msi export --output-dir ./reports

# 仅导出Markdown报告
msi export --format markdown --output-dir ./reports

# 仅导出CSV风险清单
msi export --format csv --output-dir ./reports

# 仅导出回滚包
msi export --format rollback --output-dir ./backups

# 导出单个设备的回滚包
msi export --format rollback --device-id MS-101 --output-dir ./backups

# 自定义文件名前缀
msi export --output-dir ./reports --prefix "20240501_巡检报告"
```

**导出文件格式**：

- **Markdown报告** (`*.md`): 完整的巡检报告，包含概览、设备详情、风险列表
- **CSV风险清单** (`*_risks.csv`): 可导入Excel的风险清单
- **JSON回滚包** (`*_rollback.json`): 包含所有设备配置，可用于升级后回滚

### 6. list - 查看历史会话

```bash
# 查看最近10个会话
msi list

# 查看更多会话
msi list --limit 20
```

### 7. delete - 删除会话

```bash
# 删除指定会话
msi delete abc12345
```

## 配置文件说明

### 串口日志格式

工具支持多种串口日志格式：

```
# 格式1：完整时间戳
2024-05-01 08:00:00 INFO System: Starting up...
2024-05-01 08:00:01 INFO System: Firmware version: 2.3.5

# 格式2：仅时间
08:00:00 INFO System: Test message

# 格式3：括号格式
[2024-05-01 08:00:00] System: Test message

# 格式4：纯文本
Just a simple log line
```

**自动识别的关键字**：
- 版本号: `version:`, `fw:`, `V2.3.5`, `版本:`
- 重启: `reboot`, `restart`, `reset`, `booting`, `重启`, `开机`
- 波特率: `baud rate:`, `波特率:`

### 蓝牙快照格式

支持JSON格式和纯文本格式：

```json
// JSON格式
{
  "timestamp": "2024-05-01T08:00:00Z",
  "devices": [
    {
      "address": "AA:BB:CC:DD:EE:01",
      "name": "MeetingScreen-101",
      "rssi": -45
    }
  ]
}
```

```
# 纯文本格式
AA:BB:CC:DD:EE:01 MeetingScreen-101 -45 dBm
11:22:33:44:55:66 AnotherDevice -60
```

### 设备配置格式

标准JSON格式：

```json
{
  "version": "2.3.5",
  "device_id": "MS-101",
  "location": "3楼会议室A",
  "network": {
    "wifi": {"ssid": "Office_WiFi"},
    "static_ip": {
      "ip": "192.168.1.101",
      "netmask": "255.255.255.0",
      "gateway": "192.168.1.1"
    }
  },
  "bluetooth": {
    "mac_address": "AA:BB:CC:DD:EE:01"
  },
  "rollback_config": {
    "backup_version": "2.3.4"
  }
}
```

## 运行测试

```bash
# 运行所有测试
pytest

# 运行特定测试文件
pytest tests/test_parsers.py

# 运行带覆盖率的测试
pytest --cov=meeting_screen_inspector
```

## 数据存储位置

默认情况下，会话数据存储在：

- macOS/Linux: `~/.msi_inspector/sessions/`
- Windows: `%USERPROFILE%\.msi_inspector\sessions\`

每个会话存储为一个子目录，包含：
- `metadata.json`: 会话元数据
- `session.json`: 完整会话数据

## 常见问题

### Q1: 如何确定设备类型？

工具会根据目录名自动识别：
- 包含 `casting`, `box`, `投屏` → 投屏盒
- 其他 → 会议屏

也可以使用 `--device-type` 参数强制指定。

### Q2: 波特率检测不准确怎么办？

可以使用 `--baud-rate` 参数指定预期波特率：

```bash
msi scan /path/to/data --baud-rate 9600
```

### Q3: 如何添加自定义检查规则？

可以在 `rules/engine.py` 中继承 `BaseRule` 类实现自定义规则，然后添加到 `RuleEngine` 中。

### Q4: 导出的回滚包如何使用？

回滚包包含了所有设备的配置信息，升级前导出保存，升级后如果出现问题可以参考回滚包中的配置进行恢复。

## 版本历史

- v1.0.0: 初始版本
  - 支持串口日志、蓝牙快照、配置文件解析
  - 6种检测规则
  - Markdown/CSV/JSON三种导出格式
  - 会话管理和人工确认功能

## 许可证

本项目仅供内部使用。
