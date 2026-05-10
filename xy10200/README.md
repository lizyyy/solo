# 码头堆场箱位纠错 CLI (yard-position-corrector)

用于处理码头堆场集装箱临时移位后多源数据一致性校验的命令行工具。

## 功能概述

- **箱位导入**：支持闸口系统、堆场清单、理货记录三类数据导入
- **移位链校验**：验证集装箱移位路径的完整性（起点→中间移位→终点）
- **冲突定位**：自动识别四类差异
  - 堆场坐标格式异常
  - 箱位占用冲突
  - 多源数据不一致
  - 移位链断裂
- **幂等性**：相同数据重复扫描不会产生重复冲突
- **异常清单**：实时导出待复核项
- **Markdown报告**：生成可读的纠错报告

## 安装要求

- Node.js 18+

## 快速开始

### 1. 初始化样例数据

```bash
# 顺利样例（无冲突，演示正常流程）
node bin/yardc.js init --sample=normal

# 冲突样例（含拦截/待复核项，演示纠错流程）
node bin/yardc.js init --sample=conflict
```

### 2. 执行一致性检查

```bash
node bin/yardc.js check
```

### 3. 查看冲突（如有）

```bash
# 查看所有待复核冲突
node bin/yardc.js review

# 按类型筛选
node bin/yardc.js review --type=yard_coordinate
node bin/yardc.js review --type=position_occupancy
node bin/yardc.js review --type=multi_source
node bin/yardc.js review --type=shift_chain_broken
```

### 4. 标记冲突为已解决

```bash
node bin/yardc.js resolve --id=<冲突ID> --resolution="<处理方案描述>"
```

### 5. 导出报告

```bash
node bin/yardc.js export --dir=./output
```

导出内容：
- `report-<timestamp>.json` - 结构化报告
- `report-<timestamp>.md` - Markdown可读报告
- `anomalies-<timestamp>.json` - 待复核异常清单

### 6. 查看检查历史

```bash
node bin/yardc.js history

# 查看最近20条
node bin/yardc.js history --limit=20
```

## 详细使用说明

### 完整流程演示 - 顺利样例

```bash
# 1. 初始化顺利样例
node bin/yardc.js init --sample=normal

# 2. 执行检查（预期结果：无冲突）
node bin/yardc.js check

# 3. 导出报告
node bin/yardc.js export --dir=./normal_report

# 4. 再次执行检查（演示幂等性）
node bin/yardc.js check
# 输出将显示："⚡ 检测到重复扫描（幂等性校验通过）"

# 5. 查看历史记录
node bin/yardc.js history
```

### 完整流程演示 - 冲突样例

```bash
# 1. 初始化冲突样例
node bin/yardc.js init --sample=conflict

# 2. 执行检查（预期结果：发现7个冲突）
node bin/yardc.js check

# 3. 查看冲突详情
node bin/yardc.js review

# 4. 标记一个冲突为已解决
node bin/yardc.js resolve --id=conflict-xxxxxxx --resolution="修正闸口系统记录"

# 5. 导出报告（将显示1个已解决，6个待复核）
node bin/yardc.js export --dir=./conflict_report

# 6. 导出独立的异常清单
node bin/yardc.js anomalies
```

### 导入自定义数据

准备三个JSON文件，格式如下：

**闸口系统数据 (gate_system.json)：**
```json
[
  {
    "containerNo": "MSKU1234567",
    "originalPosition": "A01-01-01",
    "currentPosition": "A01-01-01",
    "timestamp": "2024-01-15T08:30:00Z",
    "isShifted": false,
    "metadata": {
      "shipVoyage": "MAERSK E-DISCOVERY / 123E",
      "weight": 23500,
      "size": "40HQ"
    }
  }
]
```

**堆场清单数据 (yard_inventory.json)：**
```json
[
  {
    "containerNo": "MSKU1234567",
    "originalPosition": "A01-01-01",
    "currentPosition": "A01-01-01",
    "timestamp": "2024-01-15T14:00:00Z",
    "isShifted": false,
    "metadata": {
      "lastCheck": "2024-01-15T13:30:00Z",
      "bayOccupancy": 85
    }
  }
]
```

**理货移位记录 (tally_records.json)：**
```json
[
  {
    "containerNo": "HLCU9876543",
    "fromPosition": "B02-03-04",
    "toPosition": "C05-06-07",
    "operator": "ZHANG_SAN",
    "timestamp": "2024-01-15T09:30:00Z",
    "reason": "舱位调整",
    "sequence": 1
  }
]
```

导入命令：
```bash
node bin/yardc.js import --gate=./custom/gate.json --yard=./custom/yard.json --tally=./custom/tally.json
```

## 冲突类型说明

### 1. 堆场坐标异常 (yard_coordinate)

**触发条件**：箱位坐标格式不符合标准格式 `A01-01-01`

**格式规则**：
- 首字符：大写字母（区域）
- 第2-3位：数字（贝位）
- 第5-6位：数字（列）
- 第8-9位：数字（层）
- 分隔符：`-`

**示例**：`INVALID-FORMAT` → ✗ 错误，`A01-01-01` → ✓ 正确

### 2. 箱位占用冲突 (position_occupancy)

**触发条件**：同一箱位被多个不同集装箱占用

**示例**：
- 闸口系统：`OOCU1122334` 在 `D10-05-03`
- 闸口系统：`MAEU8877665` 在 `D10-05-03`
- → 冲突，需要确认哪个箱子实际在该位置

### 3. 多源数据不一致 (multi_source)

**触发条件**：同一集装箱在闸口系统和堆场清单中的位置不一致

**示例**：
- 闸口系统：`YMLU5566778` 在 `F07-02-05`
- 堆场清单：`YMLU5566778` 在 `G12-05-01`
- → 冲突，需要核对实际位置

### 4. 移位链断裂 (shift_chain_broken)

**触发条件**：移位记录无法连接闸口起点和堆场终点

**两种情况**：
1. **起点不匹配**：移位记录的起点与闸口位置不符
2. **终点不匹配**：移位链终点与堆场位置不符

**正常移位链示例**：
- 闸口位置：`E03-12-08`
- 移位1：`E03-12-08` → `E05-09-03`
- 移位2：`E05-09-03` → `F07-02-05`
- 堆场位置：`F07-02-05`
- ✓ 链路完整

## 样例数据说明

### 顺利样例 (samples/normal/)

- 5个集装箱
- 所有位置坐标格式正确
- 闸口和堆场数据完全一致
- 移位记录链路完整
- 执行检查后无冲突

### 冲突样例 (samples/conflict/)

- 6个集装箱
- 包含以下7个冲突：
  1. **堆场坐标异常**：`HLCU9876543` 的原始位置为 `INVALID-FORMAT`
  2. **箱位占用冲突**：`D10-05-03` 被 `OOCU1122334` 和 `MAEU8877665` 同时占用
  3. **多源不一致**：`YMLU5566778` 在闸口显示 `F07-02-05`，堆场显示 `G12-05-01`
  4. **多源不一致**：`KMTU9900112` 在闸口显示 `G06-09-04`，堆场显示 `H08-12-06`
  5. **移位链断裂（起点）**：`YMLU5566778` 闸口位置与移位记录起点不符
  6. **移位链断裂（终点）**：`YMLU5566778` 移位链终点与堆场位置不符
  7. **移位链断裂（终点）**：`KMTU9900112` 移位链终点与堆场位置不符

## 数据存储

所有数据存储在工作目录的 `.yardc/` 文件夹中：

- `history.json` - 检查历史记录
- `conflicts.json` - 冲突记录（含处理状态）
- `checksums.json` - 用于幂等性校验的检查码

## 命令速查

| 命令 | 说明 |
|------|------|
| `yardc help` | 显示帮助 |
| `yardc init --sample=normal` | 初始化顺利样例 |
| `yardc init --sample=conflict` | 初始化冲突样例 |
| `yardc import --gate=x --yard=y --tally=z` | 导入自定义数据 |
| `yardc check` | 执行一致性检查 |
| `yardc review` | 查看待复核冲突 |
| `yardc review --type=<type>` | 按类型筛选冲突 |
| `yardc resolve --id=<id> --resolution=<desc>` | 标记冲突已解决 |
| `yardc export --dir=<path>` | 导出报告 |
| `yardc anomalies` | 导出异常清单 |
| `yardc history` | 查看检查历史 |

## 项目结构

```
yard-position-corrector/
├── bin/
│   └── yardc.js              # CLI入口
├── lib/
│   ├── cli.js                # 命令处理
│   ├── models.js             # 数据模型
│   ├── importer.js           # 数据导入
│   ├── validator.js          # 校验逻辑
│   ├── storage.js            # 数据存储
│   └── exporter.js           # 报告导出
├── samples/
│   ├── normal/               # 顺利样例
│   │   ├── gate_system.json
│   │   ├── yard_inventory.json
│   │   └── tally_records.json
│   └── conflict/             # 冲突样例
│       ├── gate_system.json
│       ├── yard_inventory.json
│       └── tally_records.json
├── package.json
└── README.md
```
