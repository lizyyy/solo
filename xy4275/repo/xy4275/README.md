# 换景灯光防撞器 - DMX 演出线索核对工具

一个给剧场舞台监督使用的本地 DMX 演出线索核对工具，用于检测潜在的灯光冲突和安全隐患。

## 功能特性

- **init**: 初始化剧场配置
- **import**: 导入 cue 表 CSV、灯具 patch JSON 和手动修改记录
- **check**: 检测以下问题：
  - 通道冲突（同一通道被多台灯抢占）
  - 时间重叠（CUE 执行时间重叠）
  - 危险跳变（换景前后亮度变化过大）
  - 安全确认缺失（烟机/升降台联动缺少安全确认）
- **review**: 保存人工判定结果
- **report**: 导出 Markdown/CSV/JSON 复核报告包

## 安装

```bash
# 克隆项目后，在项目根目录运行
pip install -e .
```

或者使用 Python 直接运行：

```bash
python -m dmx_protect.cli [command]
```

## 命令说明

### init - 初始化剧场配置

```bash
dmx-protect init --name "剧场名称" --total-channels 512
```

参数：
- `--name`: 剧场名称
- `--total-channels`: 总通道数（默认 512）
- `--config-dir`: 配置目录（默认 `~/.dmx-protect`）

### import - 导入数据

```bash
# 导入 cue 表
dmx-protect import --cue cues.csv

# 导入灯具 patch
dmx-protect import --patch patch.json

# 导入修改记录
dmx-protect import --modifications mods.json

# 同时导入多个文件
dmx-protect import --cue cues.csv --patch patch.json
```

### check - 运行检测

```bash
# 运行所有检测
dmx-protect check

# 指定特定检测类型
dmx-protect check --type channel_conflict
dmx-protect check --type time_overlap
dmx-protect check --type dangerous_jump
dmx-protect check --type missing_confirmation
```

### review - 人工判定

```bash
# 查看所有问题
dmx-protect review --list

# 对问题进行判定
dmx-protect review --issue-id ISSUE_001 --decision accept --comment "这是故意的双控设置"
dmx-protect review --issue-id ISSUE_002 --decision reject --comment "需要修复"
```

### report - 导出报告

```bash
# 导出所有格式的报告
dmx-protect report --output ./report

# 指定特定格式
dmx-protect report --output ./report --format markdown
dmx-protect report --output ./report --format csv
dmx-protect report --output ./report --format json
```

## 数据格式

### CUE 表 CSV 格式

```csv
cue_number,description,trigger_type,trigger_value,duration,channels
CUE_001,开场定点,time,0.0,5.0,"{1: 100, 2: 50}"
CUE_002,换景1,time,5.0,3.0,"{1: 0, 2: 100, 3: 80}"
CUE_003,烟机启动,auto,0.0,2.0,"{10: 255}"
```

字段说明：
- `cue_number`: CUE 编号
- `description`: CUE 描述
- `trigger_type`: 触发类型（time/auto/manual）
- `trigger_value`: 触发值（时间点或关联 CUE）
- `duration`: 执行时长（秒）
- `channels`: 通道值（JSON 对象，键为通道号，值为 0-255 亮度值）

### 灯具 Patch JSON 格式

```json
{
  "fixtures": [
    {
      "id": "SPOT_001",
      "name": "聚光灯1",
      "type": "spot",
      "start_channel": 1,
      "channel_count": 3,
      "channels": {
        "dimmer": 1,
        "pan": 2,
        "tilt": 3
      }
    },
    {
      "id": "FOG_001",
      "name": "烟机1",
      "type": "hazer",
      "start_channel": 10,
      "channel_count": 2,
      "requires_confirmation": true
    },
    {
      "id": "LIFT_001",
      "name": "升降台1",
      "type": "lift",
      "start_channel": 20,
      "channel_count": 1,
      "requires_confirmation": true
    }
  ]
}
```

### 修改记录 JSON 格式

```json
{
  "modifications": [
    {
      "id": "MOD_001",
      "cue_number": "CUE_001",
      "modified_at": "2026-01-15T10:30:00",
      "modified_by": "李舞台",
      "changes": [
        {
          "channel": 1,
          "old_value": 80,
          "new_value": 100,
          "reason": "导演要求更亮"
        }
      ],
      "confirmed": true
    }
  ]
}
```

## 临时目录验证流程

### 1. 准备测试目录

```bash
mkdir -p /tmp/dmx_test
cd /tmp/dmx_test
```

### 2. 初始化配置

```bash
python -m dmx_protect.cli init --name "测试剧场" --total-channels 512 --config-dir ./config
```

### 3. 准备示例数据

从项目的 `examples/` 目录复制示例数据：

```bash
cp /path/to/dmx-protect/examples/*.csv .
cp /path/to/dmx-protect/examples/*.json .
```

或者使用项目内置的示例生成功能：

```bash
python -m dmx_protect.cli example --output ./
```

### 4. 导入数据

```bash
python -m dmx_protect.cli import --cue cues.csv --patch patch.json --modifications mods.json --config-dir ./config
```

### 5. 运行检测

```bash
python -m dmx_protect.cli check --config-dir ./config
```

### 6. 查看和处理问题

```bash
# 列出所有问题
python -m dmx_protect.cli review --list --config-dir ./config

# 人工判定某个问题
python -m dmx_protect.cli review --issue-id ISSUE_001 --decision accept --comment "故意设置" --config-dir ./config
```

### 7. 导出报告

```bash
python -m dmx_protect.cli report --output ./output --config-dir ./config
```

### 8. 检查输出

```bash
ls -la ./output/
cat ./output/report.md
```

## 检测规则说明

### 通道冲突检测

检测同一时间点同一通道是否被多个 CUE 同时设置不同值。

- **严重级别**: Critical
- **触发条件**: 两个 CUE 的执行时间重叠，且对同一通道设置了不同的值

### 时间重叠检测

检测 CUE 之间的时间线是否有重叠。

- **严重级别**: Warning
- **触发条件**: 前一个 CUE 的结束时间大于后一个 CUE 的开始时间

### 危险跳变检测

检测换景前后同一通道的亮度变化是否过大。

- **严重级别**: Warning
- **触发条件**: 连续 CUE 之间同一通道的亮度差值超过阈值（默认 150）

### 安全确认缺失检测

检测需要安全确认的设备（如烟机、升降台）的 CUE 是否有确认记录。

- **严重级别**: Critical
- **触发条件**: 
  - 操作的设备类型为 `hazer` 或 `lift`
  - 该设备配置了 `requires_confirmation: true`
  - 没有对应的修改记录确认或 review 判定

## 项目结构

```
dmx-protect/
├── dmx_protect/
│   ├── __init__.py
│   ├── cli.py              # 命令行入口
│   ├── models.py           # 数据模型定义
│   ├── parser.py           # 数据解析器
│   ├── rules.py            # 规则引擎
│   ├── storage.py          # 状态存储
│   └── reporter.py         # 报告导出
├── examples/
│   ├── cues.csv            # 示例 CUE 表
│   ├── patch.json          # 示例灯具 patch
│   └── mods.json           # 示例修改记录
├── tests/
│   ├── test_parser.py      # 解析器测试
│   ├── test_rules.py       # 规则引擎测试
│   ├── test_storage.py     # 存储测试
│   └── test_cli.py         # CLI 测试
├── README.md
└── setup.py
```

## 运行测试

```bash
# 安装测试依赖
pip install pytest

# 运行所有测试
pytest tests/ -v

# 运行特定测试
pytest tests/test_rules.py -v
```

## 注意事项

1. **本地运行**: 所有数据都存储在本地，不会上传到任何服务器
2. **数据格式**: 确保导入的 CSV/JSON 文件格式正确
3. **时间戳**: 所有时间都以秒为单位，从 0 开始计算
4. **通道号**: DMX 通道从 1 开始，最大 512

## 许可证

MIT License
