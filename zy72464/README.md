# 公园夜跑路线安全 - 城更项目管理系统

> 项目经理：阿宁
>
> 核心诉求：点位在两个街道边界上别被汇总数字盖过去，能回到证据

---

## 一、边界规则（写在代码里，不是口头约定）

### 1.1 边界判定规则

文件位置：[boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72464/park_night_run/boundary_rules.py#L14-L14)

```python
BOUNDARY_THRESHOLD_METERS = 50.0  # 边界阈值：50米内算边界点位
```

**判定逻辑：**

| 条件 | 结果 | 处理方式 |
|------|------|----------|
| 点位距离最近两个街道的距离差 ≤ 100米 | `is_boundary = 1` | 标记`boundary_review_status = 'pending'`，留项目经理复核 |
| 只落在一个街道范围内 | `is_boundary = 0` | 自动确认 `boundary_review_status = 'confirmed'` |
| 不在任何街道范围 | `street_name = '未知街道'` | 标记 `pending` 待人工处理 |

### 1.2 边界点位复核规则

| 操作 | 代码入口 | 说明 |
|------|----------|------|
| 确认归属 | `confirm_boundary_point(point_id, final_street)` | 清除`second_street_name`，状态设为`confirmed`，记录历史 |
| 驳回 | `reject_boundary_point(point_id, reason)` | 状态设为`rejected`，记录驳回原因 |
| 待复核列表 | `get_pending_boundary_points()` | 查出所有 `is_boundary=1 AND boundary_review_status='pending'` |

### 1.3 回滚规则

文件位置：[boundary_rules.py](file:///Users/lzy/pro/solo/workspaces/zy72464/park_night_run/boundary_rules.py#L148-L176)

```python
rollback_point(point_id, history_id, reason)
```

- 按字段级别回滚，支持任意历史版本
- 回滚操作本身也会写入历史记录（谁回滚的、为什么回滚）
- 回滚日志单独记录在 `rollback_log` 表

---

## 二、数据去重规则

### 2.1 批次去重（防数量翻倍）

文件位置：[importer.py](file:///Users/lzy/pro/solo/workspaces/zy72464/park_night_run/importer.py#L17-L19)

```python
def compute_batch_hash(rows):
    content = json.dumps(rows, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()
```

- 同一批CSV的内容哈希后存入 `import_batches.batch_hash`
- 重复导入同一文件 → 直接跳过，不会新增记录

### 2.2 单点去重

- 每个采样点有唯一标识 `point_code`
- 同一点位再次导入 → 更新现有记录，不新增

---

## 三、三步核心流程

```
第一步：导入夜间采样点
        ↓
   自动识别边界点位 → 标记 pending（留复核）
        ↓
第二步：阿宁补录居民投诉编号
        ↓
   process_status: initial → complaint_added
        ↓
第三步：导出地图更新（GeoJSON/CSV）
        ↓
   process_status: complaint_added → map_exported
   边界待复核点位在GeoJSON中标记 needs_review=true
```

### 第一步：导入夜间采样点

```python
from park_night_run.importer import import_sampling_points

result = import_sampling_points("data/sampling_points.csv", operator="阿宁")
# 返回: {batch_id, inserted, updated, skipped, message}
```

**导入时保留的证据：**
- `original_row_number`：原始CSV/Excel的行号
- `batch_id`：关联导入批次
- `created_at`：导入时间

### 第二步：补录居民投诉编号

```python
from park_night_run.importer import update_complaint_codes

result = update_complaint_codes(point_id=5, complaint_codes="TS-2026-002,TS-2026-009", operator="阿宁")
# 返回: {old, new, message}
```

**自动记录历史：**
- 修改人、修改时间
- 改前值、改后值
- 修改原因

### 第三步：导出地图更新

```python
from park_night_run.exporter import export_to_geojson

result = export_to_geojson("data/output.geojson", include_pending_boundary=True, operator="阿宁")
# 返回: {total_exported, boundary_points, pending_review}
```

**导出的GeoJSON包含：**
- `properties.original_row`：原始行号
- `properties.is_boundary`：是否边界点
- `properties.needs_review`：是否待复核（项目经理一眼就能看到）
- `properties.boundary_status`：复核状态

---

## 四、历史追溯（项目经理追问时能回到证据）

### 4.1 查看单点位完整历史

```python
from park_night_run.database import get_point_history

history = get_point_history(point_id=5)
```

每条历史记录包含：
| 字段 | 说明 |
|------|------|
| `field_name` | 修改了哪个字段 |
| `old_value` | 改前值 |
| `new_value` | 改后值 |
| `changed_by` | 谁改的（默认：阿宁） |
| `change_reason` | 为什么改 |
| `changed_at` | 什么时候改的 |

### 4.2 可追溯的字段

- 街道归属 `street_name`
- 第二街道 `second_street_name`
- 边界复核状态 `boundary_review_status`
- 投诉编号 `complaint_codes`
- 备注 `remark`
- 安全等级 `safety_level`
- 照明情况 `lighting_condition`
- 处理状态 `process_status`

---

## 五、快速开始

### 5.1 运行完整演示

```bash
python3 run_demo.py
```

演示内容：
1. 初始化数据库
2. 导入8个夜间采样点（含边界点位自动识别）
3. 查看待复核的边界点位列表
4. 验证重复导入不翻倍
5. 阿宁补录8个点位的居民投诉编号
6. 阿宁修改单条备注，查看历史记录差别
7. 处理边界点位复核（确认/驳回）
8. 导出GeoJSON和CSV地图数据
9. 演示回滚操作
10. 最终汇总报告

### 5.2 数据文件位置

| 文件 | 说明 |
|------|------|
| [data/sampling_points_demo.csv](file:///Users/lzy/pro/solo/workspaces/zy72464/data/sampling_points_demo.csv) | 示例采样点数据 |
| `data/park_night_run.db` | SQLite数据库（自动生成） |
| `data/night_running_points.geojson` | 导出的GeoJSON（演示后生成） |
| `data/night_running_points_export.csv` | 导出的CSV（演示后生成） |

---

## 六、数据库表结构

### sampling_points（夜间采样点主表）

| 字段 | 说明 |
|------|------|
| `original_row_number` | 原始Excel行号（关键证据） |
| `point_code` | 点位唯一编码 |
| `is_boundary` | 是否边界点位（0/1） |
| `boundary_review_status` | pending/confirmed/rejected |
| `street_name` | 归属街道 |
| `second_street_name` | 争议第二街道（边界点位用） |
| `complaint_codes` | 居民投诉编号 |
| `remark` | 备注 |
| `process_status` | initial/complaint_added/map_exported/boundary_review |

### point_history（修改历史表）
- 每条字段修改都有记录，支持追溯到每一次改动

### import_batches（导入批次表）
- `batch_hash` 去重，防止同一批数据重复导入导致数量翻倍

### rollback_log（回滚日志表）
- 每次回滚都留痕

---

## 七、常见现场问题处理

### 错口径修正

场景：街道归属统计口径错了，需要批量修正

```python
# 1. 找出所有待复核的边界点位
pending = get_pending_boundary_points()

# 2. 逐个确认归属
for p in pending:
    confirm_boundary_point(p["id"], final_street="望京街道", operator="阿宁")
```

### 补录返工

场景：漏录了投诉编号，需要补上

```python
# 补录同时记录历史，知道是谁补的、什么时候补的
update_complaint_codes(point_id=5, complaint_codes="TS-2026-002", operator="阿宁")
```

### 改错了回滚

场景：阿宁备注写错了，要改回来

```python
# 1. 先看历史，找到要回滚到哪条
history = get_point_history(5)

# 2. 指定历史ID回滚
rollback_point(point_id=5, history_id=17, reason="备注写错了", operator="阿宁")
```

---

## 八、注意事项

1. **边界点位不急着归正常**：`is_boundary=1` 的点位默认 `pending`，必须项目经理人工复核
2. **导出时边界点有标记**：GeoJSON 中 `needs_review=true`，不会被汇总数字盖过去
3. **所有改动留痕**：没有能偷偷改的字段，每条修改都能找到人、找到原因
4. **原始行号一直保留**：从导入到导出，`original_row_number` 始终在，随时能回到原始表格
