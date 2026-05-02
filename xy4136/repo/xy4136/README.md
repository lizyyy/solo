# 门禁刷卡冲突仲裁器

一个给园区门禁管理员使用的本地离线同步工具，用于合并多台手持读卡器的离线刷卡数据，检测时钟漂移、撤权人员放行、重复刷卡、反潜回逻辑混乱等问题。

## 功能特性

- **init** - 初始化项目配置和目录结构
- **import** - 导入设备日志JSON、人员权限CSV、门区规则CSV
- **reconcile** - 按设备时钟偏差合并事件时间线
- **check** - 检测违规事件（撤权刷卡、门区不匹配、重复刷卡、进出方向断链、设备缺口）
- **review** - 保存人工仲裁结果
- **report** - 导出 Markdown/CSV/JSON 格式的审计报告
- **status** - 显示项目当前状态

## 安装

```bash
pip install -e .
```

或者

```bash
pip install click pydantic python-dateutil rich pytest
```

## 快速开始

### 1. 初始化项目

```bash
mkdir my_project && cd my_project
access-arbiter init "园区门禁项目"
```

这将创建以下目录结构：

```
my_project/
├── .arbiter_config.json      # 项目配置文件
├── data/
│   ├── devices/              # 设备日志JSON
│   ├── permissions/          # 人员权限CSV
│   └── zones/                # 门区规则CSV
└── output/                   # 输出目录
```

### 2. 导入数据

使用提供的示例数据：

```bash
access-arbiter import \
  -d /path/to/examples/devices/device_a_main_gate.json \
  -d /path/to/examples/devices/device_b_server_room.json \
  -p /path/to/examples/permissions/staff_permissions.csv \
  -z /path/to/examples/zones/zone_rules.csv
```

或者手动将文件复制到对应目录。

### 3. 合并时间线

如果已知设备B的时钟慢120秒：

```bash
access-arbiter reconcile -o device_b=120
```

查看时间缺口：

```bash
access-arbiter reconcile -g 30  # 30分钟以上间隔视为缺口
```

### 4. 检查违规

```bash
access-arbiter check
```

使用自定义重复刷卡窗口：

```bash
access-arbiter check -w 60  # 60秒内算重复
```

禁用反潜回检查：

```bash
access-arbiter check --no-anti-passback
```

### 5. 人工仲裁

创建新的仲裁会话：

```bash
access-arbiter review --new
```

列出所有会话：

```bash
access-arbiter review -l
```

确认违规：

```bash
access-arbiter review -c 0 -c 2  # 确认索引0和2的违规
```

驳回违规（误报）：

```bash
access-arbiter review -d 1 -n "设备误读，重复刷卡"  # 驳回并添加备注
```

### 6. 导出报告

```bash
access-arbiter report
```

指定格式：

```bash
access-arbiter report -f json -f markdown
```

使用特定仲裁会话：

```bash
access-arbiter report -s session_20260502_143000
```

添加文件名前缀：

```bash
access-arbiter report -p "20260501_"
```

### 7. 查看状态

```bash
access-arbiter status
```

## 数据格式说明

### 设备日志 JSON 格式

```json
{
  "device_id": "device_a",
  "device_name": "正门读卡器A",
  "export_time": "2026-05-01 18:00:00",
  "events": [
    {
      "card_id": "C001",
      "timestamp": "2026-05-01 08:00:15",
      "zone_id": "main_gate",
      "direction": "in",
      "event_type": "swipe"
    }
  ]
}
```

**字段说明：**
- `card_id`: 卡号
- `timestamp`: 时间戳（支持格式：`%Y-%m-%d %H:%M:%S`、`%Y%m%d%H%M%S`、`%Y-%m-%dT%H:%M:%S`）
- `zone_id`: 门区ID
- `direction`: 方向（`in`/`out`/`enter`/`exit`/`进`/`出`）
- `event_type`: 事件类型（`swipe`/`deny`/`alarm`）

### 人员权限 CSV 格式

```csv
card_id,person_name,person_id,department,group,allowed_zones,valid_from,valid_until,is_active
C001,张三,E001,技术部,管理员,"main_gate,server_room,storage",2026-01-01,2026-12-31,true
C004,赵六,E004,财务部,普通员工,"main_gate,finance_room",2026-01-01,2026-04-30,false
```

**字段说明：**
- `card_id`: 卡号
- `person_name`: 人员姓名
- `person_id`: 人员ID/工号
- `department`: 部门
- `group`: 组别/级别
- `allowed_zones`: 允许访问的门区（逗号分隔，`*`表示全部）
- `valid_from`: 权限生效日期
- `valid_until`: 权限到期日期
- `is_active`: 是否有效（`false`表示已撤权）

### 门区规则 CSV 格式

```csv
zone_id,name,description,anti_passback,re_entry_grace_minutes
main_gate,正门入口,园区主入口,true,5
server_room,机房,核心服务器机房,true,3
meeting_room,会议室,会议接待区,false,10
```

**字段说明：**
- `zone_id`: 门区ID
- `name`: 门区名称
- `description`: 描述
- `anti_passback`: 是否启用反潜回（true/false）
- `re_entry_grace_minutes`: 重入宽限时间（分钟）

## 违规类型说明

| 类型 | 级别 | 说明 |
|------|------|------|
| `unauthorized_person` | CRITICAL | 未授权人员（卡号无权限记录） |
| `revoked_card` | CRITICAL | 撤权人员刷卡（is_active=false） |
| `zone_mismatch` | HIGH | 门区不匹配（无对应门区权限） |
| `expired_permission` | HIGH | 权限已过期 |
| `anti_passback_violation` | HIGH | 反潜回违规（进出方向断链） |
| `duplicate_swipe` | MEDIUM | 重复刷卡（短时间内多次刷卡） |
| `time_outside_valid` | MEDIUM | 权限尚未生效 |

## 临时目录验证流程

使用示例数据快速验证工具功能：

```bash
# 1. 创建临时目录
mkdir -p /tmp/arbiter_test && cd /tmp/arbiter_test

# 2. 初始化项目
access-arbiter init "测试项目"

# 3. 复制示例数据
cp -r /path/to/examples/* data/

# 4. 合并时间线（device_b时钟慢120秒）
access-arbiter reconcile -o device_b=120

# 5. 检查违规
access-arbiter check

# 6. 创建仲裁会话
access-arbiter review --new

# 7. 确认/驳回一些违规
access-arbiter review -c 0 -c 1  # 确认
access-arbiter review -d 2 -n "设备误读"  # 驳回

# 8. 导出报告
access-arbiter report

# 9. 查看生成的文件
ls output/
```

**预期输出：**

示例数据设计了以下违规场景：
1. **C999** - 未授权人员（CRITICAL）
2. **C004** - 已撤权人员（CRITICAL，is_active=false）
3. **C005** - 方向异常（OUT但没有对应的IN）
4. **C003** - 10秒内重复刷卡（MEDIUM）
5. **device_b** - 时间线校正（慢120秒）

## 运行测试

```bash
pytest tests/ -v
```

## 项目结构

```
access_arbiter/
├── __init__.py          # 版本信息
├── cli.py               # CLI入口（所有命令定义）
├── config.py            # 配置管理
├── models.py            # 数据模型和解析器
├── timeline.py          # 时间线归并（时钟偏差、缺口检测）
├── rules.py             # 规则引擎（权限检查、反潜回）
├── arbitration.py       # 仲裁状态管理
└── exporter.py          # 报告导出（JSON/CSV/Markdown）

examples/
├── devices/             # 示例设备日志
├── permissions/         # 示例权限表
└── zones/               # 示例门区规则

tests/
├── test_models.py       # 数据模型测试
├── test_timeline.py     # 时间线测试
└── test_rules.py        # 规则引擎测试
```

## 常见问题

**Q: 如何处理设备时钟漂移？**

A: 使用 `reconcile -o device_id=seconds` 手动指定偏移。正值表示设备时钟慢（需要加），负值表示设备时钟快（需要减）。

**Q: 什么是反潜回（Anti-Passback）？**

A: 反潜回是门禁系统的一种安全机制，要求人员必须遵循"进-出-进-出"的顺序。如果连续两次"进"或连续两次"出"，就会触发违规。

**Q: 如何判断一个违规是误报？**

A: 考虑以下情况：
- 设备方向识别错误
- 人员代刷但实际是合法的
- 同一人短时间内多次刷卡（如刷卡太快）
- 时钟偏差导致的时间顺序问题

**Q: 导出的报告包含哪些内容？**

A: 报告包含：
- 时间线合并结果（含时钟偏移）
- 所有违规事件详情
- 仲裁状态和备注
- 按级别和类型的统计
- 完整事件时间线

## License

MIT License
