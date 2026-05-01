# Sensor Gateway Config Manager

本地串口设备配置快照与回滚桌面工具，用于管理实验室多台传感器网关。

## 功能特性

- **Mock 串口适配器**: 无需真实硬件，模拟串口设备寄存器读写
- **YAML 配置导入**: 解析目标配置文件，验证寄存器定义
- **差异高亮**: 可视化对比当前状态与目标配置
- **选择性写入**: 仅写入选中的寄存器
- **失败重试**: 写入失败自动重试，支持指数退避
- **历史持久化**: SQLite 存储快照历史，支持回滚
- **边界处理**: 设备离线、只读寄存器、类型不匹配

## 模块结构

```
sensor_gateway_manager/
├── adapters/             # 串口适配器
│   └── serial_adapter.py
├── config_parser/         # YAML 配置解析
│   └── yaml_parser.py
├── engine/                # Diff/回滚引擎
│   └── diff_engine.py
├── persistence/            # SQLite 持久化
│   └── sqlite_store.py
├── ui/                    # Tkinter 界面
│   └── main_window.py
├── sample_data/           # 示例数据
│   ├── target_config.yaml
│   ├── target_config_modified.yaml
│   ├── registers.json
│   └── devices.json
├── main.py               # GUI 入口
├── demo_dry_run.py       # 终端演示
└── SPEC.md               # 详细规格
```

## 安装依赖

```bash
pip install pyyaml
```

Python 3.8+ 自带 tkinter，无需额外安装。

## 运行方式

### 1. 终端 Dry-run 演示

无需 GUI，在终端演示所有功能模块：

```bash
cd sensor_gateway_manager
python demo_dry_run.py
```

输出示例：
```
============================================================
  Sensor Gateway Config Manager - Dry Run Demo
============================================================

============================================================
  Demo 1: Mock Serial Adapter
============================================================

--- Initial Register Snapshot ---
Device: GW-TEST
Registers:
  0x00 DEVICE_ID             = GW-001          [RO]
  0x01 FW_VERSION           = 1.2.3           [RO]
  0x10 SENSOR_INTERVAL       = 5000            [RW]
  ...
```

### 2. GUI 桌面工具

```bash
cd sensor_gateway_manager
python main.py
```

操作步骤：
1. 点击 **Add Mock Device** 创建模拟设备
2. 点击 **Import YAML** 导入 `sample_data/target_config.yaml`
3. 修改设备寄存器值（模拟配置变更）
4. 点击 **Take Snapshot** 拍摄当前快照
5. 点击 **Compute Diff** 查看差异
6. 勾选要写入的寄存器，点击 **Write Selected**
7. 查看 History 面板，双击历史记录可恢复

### 3. 边界情况演示

Dry-run 中的 `demo_edge_cases()` 函数演示：

- **设备离线**: `DeviceOfflineError`
- **只读寄存器**: `ReadOnlyRegisterError`
- **类型不匹配**: `TypeMismatchError`
- **批量写入失败重试**
- **回滚时保护只读寄存器**

## 示例 YAML 配置

```yaml
device_id: GW-001
name: Lab Sensor Gateway A
registers:
  - address: 0x10
    name: SENSOR_INTERVAL
    type: int
    value: 5000
    readonly: false
  - address: 0x11
    name: SENSOR_ENABLED
    type: bool
    value: true
    readonly: false
```

## 数据库

SQLite 数据库默认存储在 `~/.sensor_gateway_manager/history.db`

包含表 `snapshots`:
- `id`: 主键
- `device_id`: 设备ID
- `timestamp`: 时间戳
- `snapshot_json`: 寄存器快照 JSON
- `target_yaml`: 目标配置 YAML
- `diff_summary`: 差异摘要

## 差异颜色说明

| 颜色 | 状态 |
|------|------|
| 绿色 | 匹配 (match) |
| 黄色 | 差异 (mismatch) |
| 红色 | 只读/类型错误 (readonly/type_error) |
| 灰色 | 缺失 (missing) |

## 项目结构

```
sensor_gateway_manager/
├── adapters/             # 串口适配器
├── config_parser/        # YAML 配置解析
├── engine/               # Diff/回滚引擎
├── persistence/          # SQLite 持久化
├── ui/                   # Tkinter 界面
└── sample_data/          # 示例数据
```

## License

MIT