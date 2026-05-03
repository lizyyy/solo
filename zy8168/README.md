# USB HID 宏键盘映射冲突预检工具

一个给硬件工程师在刷固件前使用的预检工具，用于检查 `keymap.json`（按键映射）、`device_caps.yaml`（设备能力）和 `app_shortcuts.csv`（常用软件快捷键）之间的冲突。

## 功能特性

- ✅ **多层按键解析**: 支持 QMK/VIA 风格的多层按键映射
- ✅ **长按/连按宏检测**: 支持复杂的宏序列定义
- ✅ **循环依赖检测**: 自动检测宏循环和层切换循环
- ✅ **设备内存检查**: 检查宏大小是否超出设备限制
- ✅ **软件快捷键冲突**: 与常用软件快捷键对比检测冲突
- ✅ **跨系统一致性**: 检测 Windows/macOS 修饰键映射不一致
- ✅ **精简映射输出**: 生成可直接下发的精简映射包
- ✅ **Markdown 报告**: 生成完整的复核报告

## 依赖安装

```bash
pip install pyyaml
```

## 文件格式说明

### 1. `device_caps.yaml` - 设备能力配置

```yaml
device_capabilities:
  device_name: "MacroPad V2"
  firmware_version: "2.1.0"
  max_layers: 4                    # 最大层数
  max_keys_per_layer: 12           # 每层最大按键数
  max_macro_size_bytes: 256        # 单宏最大字节
  max_total_macros_size_bytes: 2048 # 总宏最大字节
  supported_modifiers:              # 支持的修饰键
    - "KC_LCTL"
    - "KC_LSFT"
    - "KC_LALT"
    - "KC_LGUI"
```

### 2. `keymap.json` - 按键映射

```json
{
  "macros": {
    "select_all": [
      {"action": "press", "key": "KC_LCTL"},
      {"action": "tap", "key": "KC_A"},
      {"action": "release", "key": "KC_LCTL"}
    ]
  },
  "layers": [
    {
      "layer_id": 0,
      "layer_name": "Base Layer",
      "keys": {
        "0": {
          "key_code": "KC_F13",
          "tap_action": "KC_F13",
          "hold_action": "MO(1)",
          "layer_toggle": 1,
          "is_tap": true,
          "is_hold": true
        },
        "6": {
          "key_code": "KC_A",
          "modifiers": ["KC_LCTL"],
          "macro_ref": "select_all"
        }
      }
    }
  ]
}
```

### 3. `app_shortcuts.csv` - 软件快捷键

```csv
app_name,action,windows_key,macos_key,context
VS Code,保存,Ctrl+S,Cmd+S,全局
VS Code,格式化代码,Ctrl+Shift+I,Option+Shift+F,编辑器
Chrome,新建标签页,Ctrl+T,Cmd+T,浏览器
```

## 使用方法

### 基本命令格式

```bash
python hid_keymap_validator.py \
  -k <keymap.json> \
  -c <device_caps.yaml> \
  [-s <app_shortcuts.csv>] \
  [-o <compact_output.json>] \
  [-r <report.md>] \
  [-v]
```

### 参数说明

| 参数 | 简写 | 必须 | 说明 |
|------|------|------|------|
| `--keymap` | `-k` | ✅ | 按键映射文件路径 |
| `--caps` | `-c` | ✅ | 设备能力文件路径 |
| `--shortcuts` | `-s` | ❌ | 软件快捷键文件路径 |
| `--output` | `-o` | ❌ | 输出精简映射包路径 |
| `--report` | `-r` | ❌ | 输出 Markdown 报告路径 |
| `--verbose` | `-v` | ❌ | 显示详细冲突信息 |

## 演示命令

### 1. 基础检查（仅设备能力和按键映射）

```bash
python hid_keymap_validator.py \
  -k keymap.json \
  -c device_caps.yaml
```

### 2. 完整检查（含软件快捷键冲突）

```bash
python hid_keymap_validator.py \
  -k keymap.json \
  -c device_caps.yaml \
  -s app_shortcuts.csv
```

### 3. 输出精简映射包

```bash
python hid_keymap_validator.py \
  -k keymap.json \
  -c device_caps.yaml \
  -o compact_keymap.json
```

### 4. 生成 Markdown 复核报告

```bash
python hid_keymap_validator.py \
  -k keymap.json \
  -c device_caps.yaml \
  -s app_shortcuts.csv \
  -r validation_report.md
```

### 5. 完整流程（所有输出 + 详细模式）

```bash
python hid_keymap_validator.py \
  -k keymap.json \
  -c device_caps.yaml \
  -s app_shortcuts.csv \
  -o compact.json \
  -r report.md \
  -v
```

## 异常样例测试

工具包含 4 个预先设计的异常样例，位于 `samples/` 目录：

| 样例文件 | 预期检测到的问题 |
|----------|-----------------|
| `invalid_circular_macros.json` | 宏循环调用（A→B→C→A，自引用） |
| `invalid_memory_overflow.json` | 宏大小超出设备内存限制 |
| `invalid_cross_os_inconsistent.json` | Windows/macOS 修饰键不一致 |
| `invalid_layer_cycle.json` | 层切换循环（0→1→2→0） |

### 测试循环宏

```bash
python hid_keymap_validator.py \
  -k samples/invalid_circular_macros.json \
  -c device_caps.yaml \
  -v
```

**预期输出**: 检测到 `macro_a ↔ macro_b ↔ macro_c` 形成的循环，以及 `self_ref_macro` 的自引用。

### 测试内存溢出

```bash
python hid_keymap_validator.py \
  -k samples/invalid_memory_overflow.json \
  -c device_caps.yaml \
  -v
```

**预期输出**: 检测到单个宏大小超出限制，以及总宏内存超出设备上限。

### 测试跨系统不一致

```bash
python hid_keymap_validator.py \
  -k samples/invalid_cross_os_inconsistent.json \
  -c device_caps.yaml \
  -v
```

**预期输出**: 检测到使用 `KC_LGUI` 或 `KC_LALT` 修饰键的映射在两个系统上行为不同。

### 测试层循环

```bash
python hid_keymap_validator.py \
  -k samples/invalid_layer_cycle.json \
  -c device_caps.yaml \
  -v
```

**预期输出**: 检测到 `Layer_0 → Layer_1 → Layer_2 → Layer_0` 形成的层切换循环。

## 检测的冲突类型

### 严重冲突 (CRITICAL)

| 类型 | 说明 | 示例 |
|------|------|------|
| 循环宏 | 宏之间形成循环调用 | Macro A 调用 B，B 调用 C，C 调用 A |
| 自引用宏 | 宏直接调用自己 | Macro X 内部调用 macro_ref: "X" |
| 层循环 | 层切换形成循环 | Layer 0 → 1 → 2 → 0 |
| 层数超限 | 定义层数超过设备能力 | 设备支持 4 层，但定义了 5 层 |
| 按键数超限 | 单层按键数超过限制 | 每层最多 12 键，但定义了 15 个 |
| 总宏内存超限 | 所有宏总大小超出设备内存 | 设备最多 2KB，实际使用 3KB |

### 高危冲突 (HIGH)

| 类型 | 说明 | 示例 |
|------|------|------|
| 单宏大小超限 | 单个宏超出大小限制 | 单宏最多 256 字节，实际 300 字节 |
| 跨系统不一致 | Win/macOS 修饰键行为不同 | 使用 `KC_LGUI` (Win键)，在 macOS 上会映射为 Option |

### 中危冲突 (MEDIUM)

| 类型 | 说明 | 示例 |
|------|------|------|
| 软件快捷键冲突 | 与常用软件快捷键冲突 | 映射 `Ctrl+C` 与 VS Code 复制功能冲突 |
| 不支持的修饰键 | 使用了设备不支持的修饰键 | 使用 `KC_HYPER` 但设备不支持 |

### 低危提示 (LOW)

| 类型 | 说明 | 示例 |
|------|------|------|
| 重复按键映射 | 同一层中多个按键映射到同一行为 | 按键 0 和按键 5 都定义为 `KC_MUTE` |

## 输出说明

### 精简映射包 (`-o` 参数)

生成的 JSON 文件经过优化，使用短字段名，仅包含使用到的宏，适合直接下发给设备：

```json
{
  "device_version": "1.0.0",
  "layers": [
    {
      "layer_id": 0,
      "layer_name": "Base Layer",
      "keys": {
        "0": {"k": "KC_F13", "lt": 1, "h": 1, "t": 1},
        "6": {"k": "KC_A", "m": ["KC_LCTL"], "macro": "M_abc12345"}
      }
    }
  ],
  "macros": {
    "M_abc12345": [...]
  }
}
```

### Markdown 报告 (`-r` 参数)

生成的报告包含：

1. **设备能力** - 设备硬件限制参数
2. **按键映射概览** - 各层按键列表
3. **监测的软件快捷键** - 加载的快捷键清单
4. **冲突分析** - 按严重程度分类的详细冲突
5. **统计摘要** - 各等级冲突数量统计

## 退出码

| 退出码 | 含义 |
|--------|------|
| 0 | 成功，无严重冲突 |
| 1 | 发现严重冲突，不建议刷入 |
| 其他 | 程序错误 |

## 使用示例

### 正常情况（无冲突）

```
$ python hid_keymap_validator.py -k keymap.json -c device_caps.yaml
============================================================
  USB HID 宏键盘映射冲突预检工具
============================================================

[1/5] 加载设备能力配置...
    ✓ 已加载: 最大层数=4, 每层按键=12
[2/5] 加载按键映射...
    ✓ 已加载: 3 层, 8 个宏定义
[3/5] 跳过软件快捷键检查（未提供文件）
[4/5] 执行冲突检查...
    ✓ 检查完成

------------------------------------------------------------
冲突统计:
  🔴 严重: 0
  🟠 高危: 0
  🟡 中危: 0
  🟢 低危: 0
------------------------------------------------------------

============================================================
✅ 所有检查通过，可以安全刷入固件。
============================================================
```

### 发现冲突情况

```
$ python hid_keymap_validator.py -k samples/invalid_circular_macros.json -c device_caps.yaml
============================================================
  USB HID 宏键盘映射冲突预检工具
============================================================

[1/5] 加载设备能力配置...
    ✓ 已加载: 最大层数=4, 每层按键=12
[2/5] 加载按键映射...
    ✓ 已加载: 1 层, 5 个宏定义
[3/5] 跳过软件快捷键检查（未提供文件）
[4/5] 执行冲突检查...
    ✓ 检查完成

------------------------------------------------------------
冲突统计:
  🔴 严重: 2
  🟠 高危: 0
  🟡 中危: 0
  🟢 低危: 0
------------------------------------------------------------

============================================================
❌ 存在严重冲突，不建议刷入固件！
============================================================
```

## 许可证

MIT License

## 贡献

欢迎提交 Issue 和 PR！
