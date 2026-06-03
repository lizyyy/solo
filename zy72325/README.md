# 动态规划补货策略 - 数据复核追踪系统

## 系统目标

解决运营规划阿岚面临的核心问题：当分母为0却被填成空字符串这类记录出现时，数据复核人追问"动态规划补货策略"前后不一致时，能够提供完整的证据链，而非仅展示汇总数据。

---

## 核心功能

### 1. 完整证据留存
- **原始行号记录**: 每条导入数据保留原始Excel/CSV行号，可回溯到源文件
- **人工改动追踪**: 所有修改记录操作人、时间、原因、改前改后值
- **状态流转记录**: pending → reviewing → approved/rejected/abnormal

### 2. 防重复导入
- 基于文件MD5哈希值判断重复
- 重复导入时返回原始批次ID，不产生重复数据
- 不会导致"动态规划补货策略"数量翻倍

### 3. 边界规则引擎
所有边界规则**同时写入代码和文档**，不再依赖口头约定。

#### 已实现的边界规则

| 规则名称 | 判定条件 | 处理方式 | 回滚方式 |
|---------|---------|---------|---------|
| **分母为0检测** | denominator_value == 0 | 标记为abnormal异常状态，异常类型设为zero_denominator，记录原始行号 | 执行rollback命令恢复原状态 |
| **空字符串检测** | result_value为空或'' | 标记为abnormal异常状态，异常类型设为empty_string | 执行rollback命令恢复原状态 |
| **分母为0结果异常** | 分母为0且结果异常 | 设置状态为abnormal，等待复核人确认 | 数据复核人在系统中审批后更新 |

#### 边界规则处理原则
> **重要**: 碰到分母为0却被填成空字符串时，**不急着归正常**，留给数据复核人复核。

系统会自动标记为`abnormal`状态，但不会自动修正。只有经过数据复核人确认后，才能进行后续处理。

### 4. 历史版本对比
- 每条记录版本号递增
- 可查看任意两个版本的字段差异
- 支持"改前改后"对比展示
- 即使只改了一条备注，也能看出差别

### 5. 批次回滚功能
- 支持整批次回滚
- 回滚操作记录原因和操作人
- 回滚后的数据仍可追溯，不会物理删除

---

## 目录结构

```
.
├── README.md                    # 本文档（含边界规则）
├── pyproject.toml              # 项目配置
├── src/
│   └── dp_strategy/
│       ├── __init__.py
│       ├── models.py           # 数据模型（含边界规则表结构）
│       ├── importer.py         # 导入逻辑（含边界判定代码）
│       ├── boundary_rules.py   # 边界规则引擎
│       └── cli.py              # 命令行工具
├── data/
│   ├── raw/                    # 原始数据（旧公式截图CSV）
│   └── processed/              # 处理后数据库
├── scripts/
│   └── demo_rework_scenario.py # 返工场景完整演示脚本
└── tests/
```

---

## 快速开始

### 1. 安装依赖

```bash
pip install pandas sqlalchemy click pydantic
```

### 2. 初始化边界规则

```bash
python -m dp_strategy.cli init_rules
```

### 3. 运行完整返工场景演示

```bash
python scripts/demo_rework_scenario.py
```

这个脚本会完整演示：
1. **第一步**: 第一次导入旧公式截图
2. **第二步**: 发现分母为0异常记录（数据复核人可看到证据）
3. **第三步**: 运营规划阿岚补看老师批注，修改备注
4. **第四步**: 查看历史变更记录
5. **第五步**: 对比版本差异（改前改后）
6. **第六步**: 课堂演示结果更新
7. **第七步**: 完整复盘，所有变更可追溯

---

## 命令行工具使用

### 导入文件

```bash
python -m dp_strategy.cli import-file data/raw/sample_formulas.csv --imported-by "阿兰"
```

### 查看异常记录

```bash
python -m dp_strategy.cli abnormal
```

### 编辑记录

```bash
python -m dp_strategy.cli edit 1 abnormal_note "老师批注：商品已下架" \
  --edited-by "阿兰" --reason "补看老师批注"
```

### 查看历史记录

```bash
python -m dp_strategy.cli history 1
```

### 对比版本差异

```bash
python -m dp_strategy.cli diff 1 1 2
```

### 回滚批次

```bash
python -m dp_strategy.cli rollback batch_20240101_120000 \
  --reason "数据错误，需要重新导入" --by "系统管理员"
```

---

## 返工场景详细说明

### 场景描述

> **旧公式截图先给出旧结论 → 后来老师批注补到现场说法 → 运营规划阿岚能看到课堂演示结果为什么变了**

### 完整流程

1. **阶段一：旧公式截图导入**
   - 运营规划阿岚导入旧公式截图CSV
   - 系统自动检测到SKU002（原始行号3）分母为0但结果为空字符串
   - 该记录被标记为`abnormal`状态

2. **阶段二：数据复核人追问**
   - 数据复核人执行 `abnormal` 命令看到异常记录
   - 追问：为什么前后不一致？
   - 阿兰执行 `history` 命令展示完整证据链

3. **阶段三：补看老师批注**
   - 阿兰找到老师批注："此商品已下架，分母为0属正常情况"
   - 执行 `edit` 命令更新备注，版本从1→2

4. **阶段四：课堂演示更新**
   - 课堂演示系统确认该商品应标记为"N/A(下架)"
   - 执行 `edit` 命令更新结果值，版本从2→3

5. **阶段五：最终复盘**
   - 执行 `history` 命令可看到完整变更轨迹
   - 执行 `diff` 命令可对比任意两个版本的差异
   - 所有操作有记录，所有修改可回滚

---

## 数据模型说明

### FormulaScreenshot（公式截图主表）

| 字段 | 说明 |
|-----|------|
| original_row_number | 原始文件行号（Excel行号，从2开始） |
| source_file | 源文件路径 |
| batch_id | 导入批次ID |
| denominator_value | 分母值 |
| numerator_value | 分子值 |
| result_value | 当前结果值 |
| original_result | 原始结果值（首次导入时的值） |
| status | 状态（pending/reviewing/approved/rejected/rollbacked/abnormal） |
| abnormal_type | 异常类型 |
| abnormal_note | 异常说明（可追加老师批注） |
| current_version | 当前版本号 |

### FormulaHistory（历史版本表）

| 字段 | 说明 |
|-----|------|
| version | 版本号 |
| change_type | 变更类型（import/manual_edit/auto_correct/rollback/teacher_comment/demo_update） |
| changed_by | 操作人 |
| change_reason | 变更原因 |
| before_data | 改前数据 |
| after_data | 改后数据 |
| diff_fields | 变更字段列表 |

---

## 边界规则代码位置

边界规则同时存在于以下位置：

1. **配置化规则**: [boundary_rules.py](src/dp_strategy/boundary_rules.py#L149-L212) `init_boundary_rules()` 函数
2. **导入时判定**: [importer.py](src/dp_strategy/importer.py#L133-L148) 异常检测逻辑
3. **数据库持久化**: `boundary_rules` 表，可通过SQL查询所有规则

修改边界规则需要同时更新：
- 代码中的规则定义
- 本文档的边界规则表格
- （可选）数据库中的规则记录

---

## 可复盘的命令清单

```bash
# 1. 查看所有异常记录（数据复核人用）
python -m dp_strategy.cli abnormal

# 2. 查看单条记录完整历史
python -m dp_strategy.cli history <记录ID>

# 3. 对比两个版本差异
python -m dp_strategy.cli diff <记录ID> <版本1> <版本2>

# 4. 回滚整个批次
python -m dp_strategy.cli rollback <批次ID> --reason "原因" --by "操作人"

# 5. 完整演示流程（一键复现）
python scripts/demo_rework_scenario.py
```

---

## 注意事项

1. **异常不自动修正**: 分母为0等异常情况只会标记，不会自动修改值，需人工复核
2. **原始值保留**: `original_result` 字段永远保存首次导入的值，不受后续修改影响
3. **防重导入**: 同一文件重复导入会被拒绝，返回原批次ID
4. **版本递增**: 每次修改版本号+1，历史记录永不删除
5. **可回滚**: 所有操作支持回滚，回滚操作本身也会被记录
