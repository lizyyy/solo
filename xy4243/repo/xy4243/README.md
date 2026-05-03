# 道具交接节拍器

专为剧场舞台监督设计的离线桌面工具，解决排练时道具管理的常见问题。

## 功能特性

- **CSV导入**：支持导入道具表、演员上下场表、场景切换表
- **状态机管理**：完整的道具交接状态流转（借出→使用→归还→复核）
- **自动规则检查**：
  - 时间冲突检测：同一件道具是否被多场次同时借用
  - 缺签检查：借出/归还签名是否缺失
  - 危险品复核：危险道具是否经过复核流程
  - 遗失超时：超期未归还或已标记遗失
- **持久化存储**：本地SQLite数据库，数据安全
- **导出功能**：Markdown场务提示单、CSV问题清单
- **离线优先**：无需网络，全本地运行

## 项目结构

```
├── main.py                 # 主程序入口
├── requirements.txt        # 项目依赖
├── app/
│   ├── __init__.py
│   ├── models/             # 数据模型
│   │   ├── __init__.py
│   │   ├── enums.py        # 枚举类型
│   │   ├── base.py         # 基类
│   │   ├── actor.py        # 演员模型
│   │   ├── prop.py         # 道具模型
│   │   ├── scene.py        # 场次模型
│   │   ├── handover.py     # 交接记录模型
│   │   └── violation.py    # 违规记录模型
│   ├── parsers/            # CSV解析器
│   │   ├── __init__.py
│   │   ├── base_parser.py
│   │   ├── prop_parser.py
│   │   ├── scene_parser.py
│   │   └── actor_schedule_parser.py
│   ├── rules/              # 规则引擎
│   │   ├── __init__.py
│   │   ├── base_check.py
│   │   ├── time_conflict_check.py
│   │   ├── missing_signature_check.py
│   │   ├── dangerous_prop_check.py
│   │   ├── lost_overdue_check.py
│   │   └── rules_engine.py
│   ├── storage/            # 存储层
│   │   ├── __init__.py
│   │   ├── database.py
│   │   ├── actor_store.py
│   │   ├── prop_store.py
│   │   ├── scene_store.py
│   │   ├── handover_store.py
│   │   ├── violation_store.py
│   │   └── store_manager.py
│   ├── io/                 # 导入导出
│   │   ├── __init__.py
│   │   ├── import_manager.py
│   │   ├── markdown_exporter.py
│   │   └── csv_violation_exporter.py
│   └── gui/                # 图形界面
│       ├── __init__.py
│       ├── styles.py
│       └── main_window.py
├── examples/               # 示例数据
│   ├── props.csv
│   ├── scenes.csv
│   └── actor_schedule.csv
└── tests/                  # 单元测试
    ├── __init__.py
    ├── test_models.py
    ├── test_parsers.py
    ├── test_rules.py
    └── test_storage.py
```

## 安装与运行

### 环境要求

- Python 3.8+
- tkinter（Python自带，通常无需额外安装）

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行程序

**GUI模式（推荐）：**

```bash
python main.py
```

**命令行模式：**

```bash
# 导入数据
python main.py --import-props examples/props.csv
python main.py --import-scenes examples/scenes.csv
python main.py --import-handovers examples/actor_schedule.csv

# 运行规则检查
python main.py --check

# 查看统计
python main.py --stats
```

## 数据格式说明

### 道具表 (props.csv)

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| name | 是 | 道具名称 | 罗密欧之剑 |
| category | 否 | 分类 | 武器 |
| is_dangerous | 否 | 是否危险 | True/False |
| danger_level | 否 | 危险等级 | SAFE/LOW/MEDIUM/HIGH/CRITICAL |
| danger_description | 否 | 危险描述 | 仿真刀剑 |
| requires_verification | 否 | 需要复核 | yes/no |
| total_quantity | 否 | 总数 | 2 |
| available_quantity | 否 | 可用数 | 2 |
| location | 否 | 存放位置 | 道具柜A区 |
| notes | 否 | 备注 | 注意安全使用 |

### 场次表 (scenes.csv)

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| act_number | 是 | 幕数 | 1 |
| scene_number | 是 | 场数 | 1 |
| title | 否 | 场次标题 | 维洛那广场 |
| duration_minutes | 否 | 时长(分钟) | 15 |
| start_time | 否 | 开始时间 | 2026-05-10T19:30:00 |
| end_time | 否 | 结束时间 | 2026-05-10T19:45:00 |
| location | 否 | 地点 | 广场 |
| notes | 否 | 备注 | 群戏开场 |

### 演员上下场表 (actor_schedule.csv)

| 列名 | 必填 | 说明 | 示例 |
|------|------|------|------|
| actor_name | 是 | 演员/角色名 | 罗密欧 |
| scene_id | 是 | 场次ID | scene_1_1 |
| prop_name | 是 | 道具名称 | 罗密欧之剑 |
| quantity | 否 | 数量 | 1 |
| actor_role | 否 | 角色 | 男主角 |
| scheduled_start_time | 否 | 借出时间 | 2026-05-10T19:20:00 |
| scheduled_end_time | 否 | 归还时间 | 2026-05-10T19:45:00 |
| notes | 否 | 备注 | 开场使用 |

## 验证流程

### 1. 环境准备

```bash
# 进入项目目录
cd xy4243

# 安装依赖
pip install -r requirements.txt
```

### 2. 运行单元测试

```bash
python -m pytest tests/ -v
```

预期结果：所有测试通过。

### 3. 快速验证（GUI方式）

1. **启动程序**
   ```bash
   python main.py
   ```

2. **导入示例数据**
   - 点击「导入道具表」，选择 `examples/props.csv`
   - 点击「导入场次表」，选择 `examples/scenes.csv`
   - 点击「导入演员表」，选择 `examples/actor_schedule.csv`

3. **查看概览**
   - 切换到「概览」标签页
   - 确认显示：10个道具、8个场次、17条交接记录、4个危险品

4. **运行规则检查**
   - 点击「运行规则检查」按钮
   - 观察是否发现问题（示例数据故意设计了时间冲突）

5. **导出数据**
   - 点击「文件」→「导出场务提示单」保存Markdown文件
   - 点击「文件」→「导出问题清单」保存CSV文件

### 4. 手动测试状态流转

1. 在「交接记录」标签页选择一条状态为「待借出」的记录
2. 点击「借出登记」，填写交接人姓名，确认
3. 观察状态变为「使用中」
4. 选择同一条记录，点击「归还登记」
5. 观察状态变为「已归还」
6. 如果是危险道具，点击「复核确认」
7. 观察状态变为「已完成」

### 5. 命令行验证

```bash
# 清空现有数据（可选）
# 数据库文件位于 ~/.prop_handover/data.db

# 导入数据
python main.py --import-props examples/props.csv
python main.py --import-scenes examples/scenes.csv
python main.py --import-handovers examples/actor_schedule.csv

# 查看统计
python main.py --stats

# 运行规则检查
python main.py --check
```

## 核心概念

### 交接状态机

```
PENDING (待借出)
    │
    ▼ sign_out()
IN_USE (使用中)
    │
    ├──▶ sign_in() ──┐
    │                 ▼
    │          RETURNED (已归还)
    │                 │
    │                 └──▶ verify() ──┐
    │                                  ▼
    │                            VERIFIED (已完成)
    │
    └──▶ mark_lost()
         │
         ▼
    LOST / MISSING (异常状态)
```

### 规则检查类型

| 规则类型 | 检查内容 | 严重程度 |
|----------|----------|----------|
| 时间冲突 | 同一道具在重叠场次被多次借用 | high |
| 缺签 | 已完成交接但缺少借出/归还签名 | medium |
| 危险品未复核 | 危险道具归还后未经过复核 | high |
| 遗失/超时 | 标记为遗失或超期未归还 | high |

### 危险等级

- **SAFE (安全)**：普通道具，无需特殊处理
- **LOW (低危)**：轻微风险，如易碎品
- **MEDIUM (中危)**：需要注意，如仿真武器
- **HIGH (高危)**：必须复核，如实刀、明火道具
- **CRITICAL (极危)**：高度危险，如真实武器、爆炸效果

## 数据存储

数据库文件默认存储位置：
- Windows: `%USERPROFILE%\.prop_handover\data.db`
- macOS/Linux: `~/.prop_handover/data.db`

如需指定自定义路径，可以修改 `StoreManager` 初始化参数。

## 测试说明

运行所有测试：
```bash
python -m pytest tests/ -v
```

运行特定测试模块：
```bash
python -m pytest tests/test_rules.py -v
python -m pytest tests/test_storage.py -v
```

## 技术栈

- **GUI框架**: tkinter (Python标准库)
- **数据库**: SQLite (Python标准库)
- **测试框架**: pytest

## 注意事项

1. **离线使用**：本工具完全离线运行，数据仅存储在本地
2. **数据备份**：定期备份 `~/.prop_handover/data.db` 文件
3. **CSV格式**：导入时请确保CSV文件编码为UTF-8
4. **时间格式**：时间字段建议使用ISO格式 `YYYY-MM-DDTHH:MM:SS`

## 常见问题

**Q: 导入CSV时出现乱码？**
A: 请确保CSV文件使用UTF-8编码保存。

**Q: 数据库文件在哪里？**
A: 默认位置是 `~/.prop_handover/data.db`，可以复制此文件进行备份。

**Q: 如何清空所有数据？**
A: 在GUI中点击「文件」→「清空所有数据」，或直接删除数据库文件。

**Q: 危险等级如何设置？**
A: 在道具表的 `danger_level` 列中填写：SAFE、LOW、MEDIUM、HIGH、CRITICAL。
