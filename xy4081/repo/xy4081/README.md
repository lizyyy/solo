# DMX 地址补丁校验员

小剧场灯光师必备工具，用于巡演换场时校验 DMX Patch 表，避免通道重叠、灯具模式选错、宇宙容量超限或调光地址和实际吊杆对不上的问题。

## 功能特性

- ✅ **init** - 初始化项目配置
- 📥 **import-fixtures/import-patch** - 导入灯具清单和控台 Patch 表
- 🔍 **check** - 检测地址冲突、容量超限、模式错误等问题
- 📋 **plan** - 生成可执行的地址重排建议
- 📝 **apply** - 写入本地变更历史
- 📤 **export** - 导出 Markdown 检查单和 CSV Patch 表

## 项目结构

```
dmx_patch_validator/
├── __init__.py          # 版本信息
├── cli.py               # 主 CLI 入口
├── models.py            # 数据模型（Fixtures, Patch, Validation等）
├── config.py            # 配置管理（init, 加载保存）
├── parser.py            # CSV 解析器
├── validator.py         # 校验逻辑（冲突检测、容量检查）
├── planner.py           # 地址规划器（重排建议）
├── history.py           # 历史存储管理
└── exporter.py          # 导出器（Markdown, CSV）

sample_data/             # 示例数据
├── fixtures_with_conflicts.csv   # 带冲突的灯具清单（用于测试）
├── fixtures_clean.csv             # 正常的灯具清单
└── patch_table.csv                # 控台 Patch 表

tests/                   # 单元测试
├── test_models.py
├── test_validator.py
└── test_planner.py
```

## 安装

### 开发模式安装

```bash
pip install -e .
```

或者使用 pip:

```bash
pip install click rich pydantic
```

安装后即可使用 `dmx-validator` 命令。

## 快速开始：临时目录验证全流程

以下步骤演示如何使用示例数据验证完整工作流。

### 步骤 1: 创建临时目录并初始化项目

```bash
# 创建临时目录
mkdir -p /tmp/dmx_test
cd /tmp/dmx_test

# 初始化项目（创建 .dmx-patch 目录）
dmx-validator init --name "巡演测试项目" --universes 2
```

预期输出：
```
✓ 项目初始化成功: 巡演测试项目
  项目目录: /tmp/dmx_test/.dmx-patch
  配置宇宙数: 2
```

### 步骤 2: 查看项目状态

```bash
dmx-validator status
```

预期输出：
```
┌─────────────────────────────────────────────────────┐
│ 项目状态: 巡演测试项目                               │
├──────────────────┬──────────────────────────────────┤
│ 项目             │ 值                               │
├──────────────────┼──────────────────────────────────┤
│ 项目名称         │ 巡演测试项目                     │
│ 创建时间         │ 2026-05-02 XX:XX               │
│ 最后修改         │ 2026-05-02 XX:XX               │
│ 配置宇宙数       │ 2                                │
│ 灯具数量         │ 0                                │
│ Patch条目        │ 0                                │
└──────────────────┴──────────────────────────────────┘
```

### 步骤 3: 导入带冲突的灯具清单测试校验功能

```bash
# 使用示例数据（假设示例数据在 repo 目录）
# 先复制示例数据到临时目录
cp /Users/mac/pro/solocoder/pro/xy4081/repo/xy4081/sample_data/*.csv .

# 导入带冲突的灯具清单
dmx-validator import-fixtures fixtures_with_conflicts.csv
```

预期输出：
```
✓ 成功导入 11 个灯具
  当前灯具总数: 11
```

### 步骤 4: 执行校验（应该检测到冲突）

```bash
dmx-validator check --verbose
```

预期输出（会检测到多个冲突）：
```
┌───────────────────────────────┐
│ 校验结果摘要                  │
├────────────────┬──────────────┤
│ 类别           │         数量 │
├────────────────┼──────────────┤
│ 严重错误       │           X  │
│ 警告           │           X  │
│ 信息           │           X  │
│ 总计           │           X  │
└────────────────┴──────────────┘

详细问题列表:
╭──────────────────────────────────────────────────────────╮
│ [严重]                                                    │
├──────────────────────────────────────────────────────────┤
│ [地址重叠] 灯具 'PAR001' 和 'PAR002' 在宇宙 1 地址 ... │
│ 受影响: PAR001, PAR002                                   │
│ 建议: 检查并调整其中一个灯具的起始地址                    │
╰──────────────────────────────────────────────────────────╯
...
✗ 发现 X 个严重问题，请修复
```

### 步骤 5: 生成重排规划

```bash
dmx-validator plan --mode rearrange
```

预期输出：
```
┌────────────────────────────────────────────────────────────┐
│ 规划摘要                                                    │
├────────────────────────────────────────────────────────────┤
│ 检测到 X 个冲突灯具，规划了 X 个重排动作                    │
└────────────────────────────────────────────────────────────┘

执行动作 (按优先级):
  [1] 将灯具 'PAR002' 从 U1@5 移至 U1@XX
  [2] ...
```

### 步骤 6: 导入正常数据继续测试

```bash
# 替换为正常的灯具清单
dmx-validator import-fixtures --replace fixtures_clean.csv

# 导入 Patch 表
dmx-validator import-patch patch_table.csv
```

### 步骤 7: 再次校验（应该通过）

```bash
dmx-validator check
```

预期输出：
```
┌───────────────────────────────┐
│ 校验结果摘要                  │
├────────────────┬──────────────┤
│ 类别           │         数量 │
├────────────────┼──────────────┤
│ 严重错误       │           0  │
│ 警告           │           X  │
│ 信息           │           X  │
│ 总计           │           X  │
└────────────────┴──────────────┘

⚠  发现 X 个警告，建议检查
# 或者
✓ 校验通过，未发现问题
```

### 步骤 8: 应用变更记录

```bash
dmx-validator apply --note "验证测试流程"
```

### 步骤 9: 导出检查单和 Patch 表

```bash
# 导出所有格式
dmx-validator export --format all --type all --output ./exports

# 查看导出的文件
ls -la exports/
```

预期输出：
```
✓ 导出项目概览: exports/巡演测试项目_summary.md
✓ 导出检查单 (Markdown): exports/巡演测试项目_checklist.md
✓ 导出灯具清单 (CSV): exports/巡演测试项目_fixtures.csv
✓ 导出Patch表 (CSV): exports/巡演测试项目_patch.csv

✓ 共导出 4 个文件
```

### 步骤 10: 查看操作历史

```bash
dmx-validator history --limit 20
```

预期输出：
```
┌─────────────────────────────────────────────────────────────────┐
│ 操作历史                                                        │
├──────────────┬────────┬────────────────────────────┬─────────────┤
│ ID           │ 动作   │ 描述                       │ 时间        │
├──────────────┼────────┼────────────────────────────┼─────────────┤
│ XXXXXXXX     │ EXPORT │ 导出项目数据: .            │ 2026-05-02  │
│ XXXXXXXX     │ APPLY  │ 应用 0 个变更              │ 2026-05-02  │
│ XXXXXXXX     │ CHECK  │ 执行校验: 发现 X 个问题    │ 2026-05-02  │
│ ...          │ ...    │ ...                        │ ...         │
└──────────────┴────────┴────────────────────────────┴─────────────┘
```

## 命令详解

### init - 初始化项目

```bash
dmx-validator init [OPTIONS]

选项:
  --name, -n      项目名称 (默认: "DMX Patch Project")
  --universes, -u 宇宙数量 (默认: 1)
```

### import-fixtures - 导入灯具清单

```bash
dmx-validator import-fixtures [OPTIONS] FILE_PATH

选项:
  --replace, -r   替换现有灯具清单（默认追加）
```

支持的 CSV 列名（中英文均可）：
- `id`, `编号`, `灯具ID`
- `name`, `名称`
- `manufacturer`, `制造商`, `品牌`
- `model`, `型号`
- `mode`, `模式`
- `position`, `位置`, `吊杆`
- `universe`, `宇宙`, `宇宙号`
- `start_address`, `起始地址`, `地址`
- `channel_count`, `通道数`
- `note`, `备注`

### import-patch - 导入控台 Patch 表

```bash
dmx-validator import-patch [OPTIONS] FILE_PATH

选项:
  --replace, -r   替换现有 Patch 表
```

支持的 CSV 列名：
- `universe`, `宇宙`, `宇宙号` (必需)
- `start_address`, `起始地址`, `地址` (必需)
- `id`, `编号`
- `fixture_id`, `灯具ID`
- `fixture_name`, `灯具名称`
- `mode`, `模式`
- `channel_count`, `通道数`
- `position`, `位置`
- `note`, `备注`

### check - 校验 Patch 表

```bash
dmx-validator check [OPTIONS]

选项:
  --verbose, -v   显示详细信息
```

检查项：
- 🔴 **地址重叠** - 灯具/Patch 条目地址冲突
- 🔴 **地址越界** - 地址超出 1-512 范围
- 🔴 **容量超限** - 宇宙通道使用超过 512
- 🟡 **容量预警** - 宇宙通道使用超过 90%
- 🟡 **模式错误** - 灯具模式不在灯具库中
- 🟡 **地址不一致** - 灯具与 Patch 表地址不匹配
- 🔵 **位置不一致** - 位置标记不同
- 🔵 **灯具未知** - 未在灯具库定义
- 🔵 **未引用** - 灯具未在 Patch 表引用

退出码：
- `0` - 无严重错误
- `1` - 程序错误
- `2` - 发现严重问题

### plan - 生成重排规划

```bash
dmx-validator plan [OPTIONS]

选项:
  --mode, -m      规划模式: rearrange(冲突重排) 或 optimize(布局优化)
  --by-position/--no-by-position  按位置分组（默认启用）
```

### apply - 应用变更

```bash
dmx-validator apply [OPTIONS]

选项:
  --dry-run, -d   模拟运行，不实际修改
  --note, -n      变更备注
```

### export - 导出数据

```bash
dmx-validator export [OPTIONS]

选项:
  --format, -f    导出格式: markdown, csv, all (默认: markdown)
  --output, -o    输出目录 (默认: .)
  --type, -t      导出类型: checklist, patch, summary, all (默认: all)
```

### status - 查看项目状态

```bash
dmx-validator status
```

### history - 查看操作历史

```bash
dmx-validator history [OPTIONS]

选项:
  --limit, -l     显示最近 N 条记录 (默认: 10)
  --id, -i        查看指定记录详情
```

## 运行测试

```bash
# 安装 pytest
pip install pytest

# 运行测试
pytest tests/ -v
```

## 注意事项

1. **灯具通道数计算**：如果 `custom_channel_count` 未设置，灯具默认按 1 通道计算。建议在 CSV 中明确指定 `channel_count` 列。

2. **灯具库支持**：当前版本不强制要求灯具库，但添加灯具库后可以获得更完善的模式校验。

3. **宇宙编号**：宇宙号从 1 开始，每个宇宙最大 512 通道。

4. **跨平台兼容**：项目使用 UTF-8 编码，支持中英文列名。

## 故障排除

### 问题：`dmx-validator: command not found`

解决方案：确保已使用 `pip install -e .` 安装，或者使用 `python -m dmx_patch_validator.cli` 运行。

### 问题：CSV 解析失败

解决方案：检查 CSV 文件编码（建议 UTF-8），确保表头正确。支持的列名别名见 `parser.py` 中的 `FIXTURE_MAPPING` 和 `PATCH_MAPPING`。

### 问题：校验未检测到预期冲突

解决方案：确保灯具的 `custom_channel_count` 或 `channel_count` 已正确设置。如果通道数为 1，可能不会检测到某些重叠。

## 许可证

MIT License
