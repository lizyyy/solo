# 园区热力井空间归档系统

## 项目概述

本系统用于园区热力井空间坐标的归档管理，重点解决**经纬度和米制坐标混在一起**的边界情况处理。系统提供完整的证据链追踪，确保巡检组复查时可追溯到原始行号、人工改动记录和处理状态。

---

## 边界规则（代码+文档双重约定）

### 规则1: 坐标类型判断逻辑

**判断标准**（见 [coordinate_validator.py](file:///Users/lzy/pro/solo/workspaces/zy72275/coordinate_validator.py#L15-L72)）：

| 坐标类型 | 判定条件 | 处理状态 |
|---------|---------|---------|
| `lat_lng` (经纬度) | 匹配 `纬度, 经度` 格式，数值在有效范围（纬度±90，经度±180）内 | PENDING → NORMAL（需人工确认） |
| `metric` (米制) | 匹配 `X=数值, Y=数值` 格式，且有 `X=`/`Y=`/`米制` 明确标记 | PENDING → NORMAL（需人工确认） |
| `mixed` (混合) | **同时**出现经纬度和米制坐标特征 | **NEEDS_REVIEW（必须巡检组复核）** |
| `unknown` (未知) | 无法识别任何坐标格式 **或** 内容含「无坐标/无定位/缺坐标」且无数值 | **ABNORMAL** |

> **边界规则（CRITICAL）**：内容含「无坐标」「无定位」「缺坐标」字样时，即使出现「坐标」二字，也判为 `unknown` → `ABNORMAL`，不得误判为米制坐标。

### 规则2: 混合坐标的处理流程（CRITICAL）

**代码实现位置**：[coordinate_validator.py](file:///Users/lzy/pro/solo/workspaces/zy72275/coordinate_validator.py#L59-L68)

```
检测到 mixed 类型
    ↓
自动标记为 NEEDS_REVIEW
    ↓
✋ 禁止自动归为 NORMAL
    ↓
等待巡检组人工复核
    ↓
确认无问题后 → 人工标记为 NORMAL
发现问题 → 执行 rollback 回滚
```

**关键点**：混合坐标绝对不能跳过复核流程，这是巡检组重点检查项。

### 规则3: 重复导入处理

**代码实现位置**：[archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py#L72-L82)

- 基于 `源文件:行号:内容` 生成唯一MD5作为记录ID
- 重复导入同一批数据时，相同记录自动跳过
- 记录数不会翻倍，确保统计准确性
- 如需强制更新可加 `--force-update` 参数

### 规则4: 改动历史追踪

**代码实现位置**：[archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py#L114-L145)

- 每次修改记录操作人、时间、字段、改前值、改后值
- 可通过 `history` 命令查看完整变更历史
- 支持 `rollback` 回滚操作

### 规则5: 回滚必须恢复所有人工改动字段（CRITICAL）

**代码实现位置**：[archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py#L147-L202)

回滚不是只改一个状态标记，而是按 `change_history` 逆向恢复每个被改动的字段：

| 回滚行为 | 旧逻辑（已修复） | 新逻辑 |
|---------|----------------|--------|
| `processing_status` | 仅标成 `rollbacked` | 按 `coordinate_type` 重算（mixed→needs_review, lat_lng→pending） |
| `inspection_photo_id` | 不恢复 | 恢复到许工改之前的值（如 None） |
| `site_instruction` | 不恢复 | 恢复到改之前的值 |
| `remark` | 不恢复 | 恢复到改之前的值 |
| `coordinate_type` | 不变 | 不变（回滚不改坐标类型） |
| 回滚记录 | 无细节 | 记录每个字段的回滚前后值和原改动人 |

**关键点**：回滚后 `processing_status` 不是 `'rollbacked'`，而是根据 `coordinate_type` 重新计算的状态，保证与同一份最新坐标类型结果一致。

> **证据链规则（CRITICAL）**：系统追加的 `_rollback` 记录（field_name 以 `_` 开头）在下一次默认全量回滚时会被自动跳过，不会被当成业务字段恢复，避免重复回滚时污染业务数据。重复回滚仅恢复真实业务变更，步数为0表示无剩余业务变更可回滚。

---

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 运行完整演示（三步流程）

```bash
python cli.py demo
```

此命令将完整演示：
1. **步骤1**：坐标原点说明第一次导入
2. **步骤2**：设备工程师许工补看巡检照片编号
3. **步骤3**：给现场班组看的说明更新

同时验证：
- 混合坐标标记为 NEEDS_REVIEW（不自动归为normal）
- 重复导入不翻倍
- 单条记录改前改后差别可见

---

## 完整命令列表

### 1. 导入坐标原点说明

```bash
# 基本导入（重复记录自动跳过）
python cli.py import coords.txt --operator 张三

# 强制更新重复记录
python cli.py import coords.txt --operator 张三 --force-update
```

**输出示例**：
```
导入批次: BATCH20240115103000
总计: 10 条
新增: 8 条
更新: 0 条
跳过: 2 条
```

### 2. 查看所有记录

```bash
# 查看全部
python cli.py list

# 按状态过滤
python cli.py list --status needs_review
python cli.py list --status normal

# 按坐标类型过滤
python cli.py list --type mixed
```

### 3. 更新记录字段

```bash
# 许工补充巡检照片编号
python cli.py update <point_id> inspection_photo_id PHOTO-2024-001 --operator 许工 --reason 补录巡检照片编号

# 更新现场施工说明
python cli.py update <point_id> site_instruction "按坐标定位施工" --operator 李四 --reason 更新现场说明
```

### 4. 查看记录历史（改前改后对比）

```bash
python cli.py history <point_id>
```

**输出示例**：
```json
{
  "point_id": "a1b2c3d4e5f6",
  "current_version": 3,
  "original_line": 3,
  "raw_content": "39.9042, 116.4074 X=50, Y=80 混合坐标井",
  "current_values": {
    "remark": null,
    "inspection_photo_id": "PHOTO-2024-001",
    "site_instruction": null
  },
  "change_history": [
    {
      "timestamp": "2024-01-15 10:30:05",
      "operator": "许工",
      "field": "inspection_photo_id",
      "from": null,
      "to": "PHOTO-2024-001",
      "reason": "补录巡检照片编号"
    }
  ]
}
```

### 5. 回滚记录（恢复所有人工改动字段）

```bash
# 回滚全部变更
python cli.py rollback <point_id> --operator 管理员

# 回滚最近1步变更
python cli.py rollback <point_id> --operator 管理员 --steps 1
```

**输出示例**：
```
回滚成功: 1e7232ecc06b4a5f
回滚步数: 1
当前状态: needs_review (坐标类型: mixed)

恢复字段详情:
  inspection_photo_id:
    回滚前: PHOTO-2024-001
    回滚后: None
    原改动人: 许工
```

### 6. 查看汇总统计

```bash
python cli.py summary
```

**输出示例**：
```json
{
  "total_records": 4,
  "by_coordinate_type": {
    "lat_lng": 2,
    "metric": 1,
    "mixed": 1
  },
  "by_status": {
    "pending": 3,
    "needs_review": 1
  },
  "last_updated": "2024-01-15T10:30:05"
}
```

### 7. 导出巡检组复核数据

```bash
python cli.py inspection
```

此命令导出所有需要巡检组复核的记录（mixed类型和needs_review状态）。

### 8. 查看导入批次

```bash
python cli.py batches
```

---

## 三步流程标准操作指南

### 标准流程

#### 第一步：坐标原点说明第一次导入

```bash
python cli.py import origin_points.txt --operator 导入员
```

**检查要点**：
- 确认导入批次号
- 检查 mixed 类型记录是否标记为 needs_review
- 记录总数是否正确

#### 第二步：设备工程师许工补看巡检照片编号

```bash
# 先找到需要补充的记录ID
python cli.py list --type mixed

# 补充照片编号
python cli.py update <point_id> inspection_photo_id PHOTO-XXXX --operator 许工 --reason 补看巡检照片
```

**检查要点**：
- 即使补充了照片，mixed 类型记录仍应保持 needs_review 状态
- 不得手动改为 normal

#### 第三步：给现场班组看的说明更新

```bash
# 更新正常坐标记录的现场说明
python cli.py update <point_id> site_instruction "现场按坐标定位" --operator 施工员 --reason 更新现场说明
```

**检查要点**：
- mixed 类型记录在巡检组复核前不更新现场说明
- 或在说明中标注"坐标待复核"

---

## 数据存储结构

所有数据保存在 `./data/` 目录下：

| 文件 | 内容 |
|------|------|
| `origin_points.json` | 坐标原点记录及变更历史 |
| `batches.json` | 导入批次记录 |

---

## 巡检组复查指引

1. **运行 `python cli.py inspection`** 获取待复核清单
2. **重点检查 `coordinate_type: "mixed"` 的记录**
3. **使用 `python cli.py history <point_id>` 查看改动历史**
4. **确认原始行号和原始内容是否匹配**
5. **确认人工改动是否有合理理由**
6. **mixed 类型记录必须人工确认后才能标记为 normal**

---

## 代码中的边界规则位置

| 规则 | 文件 | 行号 |
|------|------|------|
| 坐标类型检测（含无坐标否定判断） | [coordinate_validator.py](file:///Users/lzy/pro/solo/workspaces/zy72275/coordinate_validator.py) | L15-L72 |
| 处理状态判定 | [coordinate_validator.py](file:///Users/lzy/pro/solo/workspaces/zy72275/coordinate_validator.py) | L74-L83 |
| 边界规则文档 | [coordinate_validator.py](file:///Users/lzy/pro/solo/workspaces/zy72275/coordinate_validator.py) | L85-L103 |
| 重复导入去重 | [archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py) | L72-L82 |
| 变更历史记录 | [archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py) | L114-L145 |
| 回滚字段恢复（跳过_rollback系统记录） | [archive_manager.py](file:///Users/lzy/pro/solo/workspaces/zy72275/archive_manager.py) | L147-L220 |
