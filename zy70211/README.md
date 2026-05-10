# 粮仓熏蒸安全检查 CLI

一套用于粮仓熏蒸前安全核对的命令行工具，覆盖从粮仓档案到熏蒸计划再到安全核对的完整工作流。

## 快速开始

### 安装依赖

```bash
pip install -r requirements.txt
```

### 完整工作流程（从空数据到看板）

#### 第一步：导入粮仓档案

准备粮仓档案 CSV 或直接使用样例：

```bash
python main.py archive import examples/grain_barns.csv
```

查看已导入的仓房：
```bash
python main.py archive list
```

#### 第二步：导入熏蒸计划

熏蒸计划必须引用已存在的仓房 ID。准备计划 CSV 或使用样例：

```bash
python main.py plan import examples/fumigation_plans.csv
```

查看计划列表：
```bash
python main.py plan list
```

查看某条计划详情（含药剂和撤离记录）：
```bash
python main.py plan show FP001
```

#### 第三步：执行安全核对

传入环境参数（温度、湿度、封仓时间、密封评分），系统自动核对：

```bash
python main.py check run examples/check_requests.csv
```

输出内容会显示：
- 处理了多少行
- 跳过哪些坏行
- 哪些记录需要人工确认

#### 第四步：查看结果看板

```bash
python main.py check dashboard
```

查看某条核对记录的详细报告：
```bash
python main.py check show <check_id>
```

## 三个核心模块

### 1. archive - 粮仓档案管理

**功能：** 管理所有仓房的基础信息

**CSV 字段：**
- `barn_id` - 仓房唯一ID（必填）
- `barn_name` - 仓房名称（必填）
- `location` - 位置（必填）
- `capacity` - 仓容（吨，必填）
- `current_grain_type` - 当前粮食品种（必填）
- `current_grain_quantity` - 当前储粮数量（吨，必填）
- `last_fumigation_date` - 上次熏蒸日期
- `status` - 仓房状态（必填，有效值：空闲、准备中、熏蒸中、封仓中、已完成）

**命令：**
```bash
python main.py archive import <csv_or_json>   # 导入档案
python main.py archive list                    # 查看列表
python main.py archive import --force          # 强制覆盖重复记录
```

---

### 2. plan - 熏蒸计划管理

**功能：** 为特定仓房创建熏蒸计划，包含药剂清单和人员撤离记录

**CSV 字段：**
- `plan_id` - 计划唯一ID（必填）
- `barn_id` - 关联仓房ID（必须存在于档案中，必填）
- `plan_date` - 熏蒸计划日期（必填）
- `estimated_duration_hours` - 预计熏蒸时长（小时，必填）
- `target_pests` - 目标害虫（必填）
- `operator` - 操作人员（必填）
- `chemicals_json` - 药剂清单（JSON数组）
- `evacuations_json` - 人员撤离记录（JSON数组）
- `status` - 计划状态（必填，有效值：草稿、已提交、已批准、进行中、已完成、已取消）
- `remarks` - 备注

**药剂 JSON 字段：**
```json
[
  {
    "chemical_name": "磷化铝",
    "chemical_type": "熏蒸剂",
    "dosage": 3000,
    "unit": "g",
    "batch_number": "PH202603001",
    "expiration_date": "2027-06-30",
    "supplier": "中化集团"
  }
]
```

**人员撤离 JSON 字段：**
```json
[
  {
    "personnel_name": "李四",
    "personnel_id": "E001",
    "department": "仓储部",
    "evacuation_time": "2026-05-15T08:00:00",
    "check_time": "2026-05-15T08:30:00",
    "check_person": "王五"
  }
]
```

**命令：**
```bash
python main.py plan import <csv_or_json>           # 导入计划
python main.py plan import --force                  # 强制覆盖重复计划
python main.py plan import --allow-status-conflict  # 允许同一仓房多计划状态冲突
python main.py plan list                             # 查看计划列表
python main.py plan show <plan_id>                   # 查看计划详情
```

---

### 3. check - 熏蒸安全核对

**功能：** 执行熏蒸前安全核对，覆盖四大检查维度

**四大核对主线：**
1. **药剂核对** - 名称有效性、剂量复核、有效期检查
2. **人员撤离核对** - 记录完整性、时序检查、去重检查、人数确认
3. **温湿度核对** - 温度范围(10-35°C)、湿度范围(30-70%)
4. **封仓核对** - 密封质量评分(≥80分)、封仓时间与计划时序

**CSV 字段：**
- `plan_id` - 关联计划ID（必须存在于计划中，必填）
- `temperature` - 仓内温度（°C，必填）
- `humidity` - 仓内湿度（%，必填）
- `seal_start_time` - 封仓开始时间（必填）
- `seal_quality_score` - 密封质量评分（0-100，必填）

**核对结果状态：**
- `通过` - 所有检查项通过
- `需人工确认` - 有检查项需要人工判断
- `不通过` - 有检查项明确失败（如药剂过期、密封评分不足）

**命令：**
```bash
python main.py check run <csv_or_json>   # 执行批量核对
python main.py check list                 # 查看核对记录列表
python main.py check show <check_id>      # 查看核对详情报告
python main.py check dashboard            # 查看汇总看板
python main.py check dashboard --output json  # JSON格式输出
```

## 边界情况处理

### 重复提交
- 仓房 ID 重复 → 默认跳过，提示使用 `--force` 覆盖
- 计划 ID 重复 → 默认跳过，提示使用 `--force` 覆盖
- 同一计划重复核对 → 检测已有核对记录，跳过新核对

### 状态冲突
- 同一仓房已有进行中的计划 → 默认拒绝导入，提示使用 `--allow-status-conflict`
- 计划状态非"已提交/已批准" → 拒绝执行核对

### 来源记录缺失
- 计划引用的仓房 ID 不存在 → 拒绝导入计划
- 核对引用的计划 ID 不存在 → 拒绝执行核对

### 数据质量问题
- 必填字段缺失 → 记录到"跳过记录"
- 数字字段格式错误 → 记录到"跳过记录"
- 状态值不在允许范围内 → 记录到"跳过记录"

## 输出示例

### 核对执行输出
```
【执行统计】
  输入记录数: 4
  成功处理: 4
  跳过记录: 0
  处理失败: 0

【核对结论分布】
  ✓ 通过: 0 条
  ? 需人工确认: 2 条
  ✗ 不通过: 2 条

【需人工确认的记录】
--------------------------------------------------------------------------------
  核对ID: ff20f018 | 计划: FP001 | 仓房: 一号粮仓
  需确认项:
    - 药剂剂量检查: 磷化铝: 药剂剂量需要人工复核...
    - 撤离人数统计: 撤离人数需要与仓房作业区域人员清单核对确认
```

### 看板输出
```
【数据概览】
  仓房总数: 5
  熏蒸计划总数: 4
  已执行核对: 4
  待核对计划: 0

【核对结果统计】
  不通过: 2 条
  需人工确认: 2 条
```

## 数据存储位置

- 粮仓档案：`data/grain_barns.csv`
- 熏蒸计划：`data/fumigation_plans.csv`
- 核对记录：`data/checks/check_<check_id>.json`

## 样例数据

可直接使用 `examples/` 目录下的样例文件：
- `grain_barns.csv` - 5条正常仓房数据
- `fumigation_plans.csv` - 4条熏蒸计划（含药剂和撤离记录）
- `check_requests.csv` - 4条核对请求
- `boundary_test_*.csv` - 边界情况测试数据
