# 数据修复预演命令行工具

用于跨天物业报修单数据修复的预演工具，支持权限误放大等问题的检测和修复。

## 功能特性

- ✅ **真实样例数据**：包含5条跨天物业报修单，其中1条权限被误放大（REP-2024-003）
- ✅ **批量操作预览**：执行前显示影响范围、风险类型统计、受影响工单、修复项详情
- ✅ **完整报告**：处理前后对比、执行时间、下一步建议
- ✅ **失败项独立保存**：方便接手时直接查看原因
- ✅ **异常样本导出**：可导出给同事复核
- ✅ **历史查询**：支持按批次、操作者、风险类型过滤
- ✅ **原始行号追溯**：每条修复建议对应原始数据行号
- ✅ **灰度发布备忘**：包含人工修正记录，按字段路径标注来源和处理依据

## 安装依赖

```bash
pip install -r requirements.txt
```

## 使用命令

### 1. 列出样例数据

```bash
python3 -m data_fix.cli list-samples
```

显示所有物业报修单样例数据，自动标记：
- ⚠️ 跨天工单
- 🔴 权限异常工单

### 2. 预览修复（不执行）

```bash
python3 -m data_fix.cli preview
```

显示批量操作影响范围预览，包括：
- 总工单数、待修复项数
- 风险类型统计
- 受影响工单列表
- 修复项详情（原值、建议值、原始行号）

### 3. 执行数据修复

```bash
python3 -m data_fix.cli run --operator your_name
```

可选参数：
- `--confirm`：跳过预览确认直接执行
- `--dry-run`：仅预览不执行实际修复

执行后自动导出：
- `output/{batch_id}_report.json` - 完整执行报告
- `output/{batch_id}_exception_samples.json` - 异常样本（供复核）
- `output/{batch_id}_full_history.json` - 完整历史记录
- `output/{batch_id}_failed_records.json` - 失败记录（如有）

### 4. 查询历史记录

```bash
# 查询所有历史
python3 -m data_fix.cli query

# 按批次ID查询
python3 -m data_fix.cli query --batch-id BATCH-xxx

# 按操作者查询
python3 -m data_fix.cli query --operator admin_user

# 按风险类型查询
python3 -m data_fix.cli query --risk-type permission_over_granted
```

## 报告内容说明

### 执行摘要
- 批次ID、操作者
- 开始/结束时间、执行耗时
- 总处理数、成功数、失败数、跳过数

### 处理前后对比
| 字段 | 说明 |
|------|------|
| 工单ID | 报修单编号 |
| 风险类型 | permission_over_granted / grayscale_record |
| 字段路径 | 数据来源字段路径（如 property.repair.order.items.2.permission_level） |
| 原值 | 修复前的值 |
| 新值 | 修复后的值 |
| 原始行号 | 对应原始数据行号 |
| 处理依据 | 修复依据的规范条款 |

### 灰度发布备忘
- 记录ID、字段路径、来源
- 修正内容、处理依据

### 下一步建议
自动生成的后续处理建议清单

## 项目结构

```
data-fix-preview/
├── data_fix/
│   ├── __init__.py          # 包初始化
│   ├── models.py            # 数据模型定义
│   ├── sample_data.py       # 样例数据生成
│   ├── engine.py            # 修复引擎核心逻辑
│   ├── report.py            # 报告生成器
│   └── cli.py               # 命令行接口
├── output/                  # 输出目录（自动创建）
├── requirements.txt         # 依赖清单
├── pyproject.toml          # 项目配置
└── README.md               # 本文档
```

## 数据模型说明

### PropertyRepairOrder（物业报修单）
- `order_id`: 工单ID
- `community_id`: 小区ID
- `community_name`: 小区名称
- `report_time`: 报修时间
- `repair_type`: 维修类型
- `description`: 描述
- `reporter_id`: 报修人ID
- `reporter_name`: 报修人姓名
- `handler_id`: 处理人ID
- `handler_name`: 处理人姓名
- `status`: 状态（pending/processing/completed/cancelled）
- `permission_level`: 权限级别（normal/supervisor/admin）
- `is_cross_day`: 是否跨天工单
- `source_field_path`: 字段来源路径

### RiskType（风险类型）
- `permission_over_granted`: 权限被误放大
- `data_inconsistency`: 数据不一致
- `status_abnormal`: 状态异常
- `grayscale_record`: 灰度发布记录
- `other`: 其他
