# 物业报修中心物业材料领用 CLI 工具

专门用于处理物业报修中心物业材料领用记录，解决**反复修改同一条记录**导致的数据混乱问题。工具会自动合并重复记录，保留最新版本，并完整追踪所有修改历史。

## 功能特性

- ✅ 自动去重：合并同一领用单号的多次修改记录
- 📝 版本追踪：完整保留每一次修改的历史记录
- 🏷️ 特殊类型处理：正确处理返库、替代料、手写单、可复跑等特殊记录
- 👁️ 预览模式：先预览处理结果再正式执行
- 📊 汇总报告：生成详细的统计报告和输出文件说明

## 快速开始

### 第一步：预览处理结果

在正式执行前，先预览数据处理情况，不会实际写入文件：

```bash
python material_claim_cli.py --preview --input sample_input --rules rules/default_rules.json
```

**预期输出：**
```
✓ 加载规则文件: rules/default_rules.json
✓ 读取 3 个输入文件，共 15 条记录
✓ 处理完成: 10 条唯一记录
  - 警告: 5 条
  - 错误: 0 条

=== 预览模式: 不会实际写入文件 ===

统计信息:
  - 总记录数: 15
  - 唯一记录数: 10
  - 重复记录: 5
  - 返库记录: 1
  - 替代料记录: 1
  - 手写单记录: 2
  - 可复跑记录: 1

前5条警告:
  - 发现重复记录，共 3 个版本
  - 发现重复记录，共 2 个版本
  - 发现重复记录，共 2 个版本
  - 发现重复记录，共 2 个版本
```

### 第二步：正式执行处理

确认预览结果无误后，执行正式处理并输出到指定目录：

```bash
python material_claim_cli.py --input sample_input --rules rules/default_rules.json --output sample_output
```

**预期输出：**
```
✓ 加载规则文件: rules/default_rules.json
✓ 读取 3 个输入文件，共 15 条记录
✓ 处理完成: 10 条唯一记录
  - 警告: 5 条
  - 错误: 0 条
  - final_material_claims.csv: 10 条最终记录
  - version_history.csv: 所有版本历史记录
  - return_records.csv: 1 条
  - substitute_records.csv: 1 条
  - manual_records.csv: 2 条
  - retry_records.csv: 1 条
  - issues_report.csv: 5 个问题
  - summary_report.json: 汇总统计报告

✓ 输出文件已写入: sample_output
```

### 第三步：查看汇总报告

查看详细的处理汇总报告：

```bash
python material_claim_cli.py --report sample_output/summary_report.json
```

**报告将包含：**
- 处理时间
- 输入/输出目录信息
- 详细统计数据
- 所有输出文件的用途说明

## 输出文件说明

| 文件名 | 用途说明 |
|--------|----------|
| **final_material_claims.csv** | 去重合并后的最终材料领用记录（主文件） |
| **version_history.csv** | 所有记录的版本历史，追踪每次修改 |
| **return_records.csv** | 标记为"返库"的特殊记录 |
| **substitute_records.csv** | 标记为"替代料"的特殊记录 |
| **manual_records.csv** | 标记为"手写单"的特殊记录 |
| **retry_records.csv** | 标记为"可复跑"的特殊记录 |
| **issues_report.csv** | 处理过程中的警告和错误信息 |
| **summary_report.json** | 本次处理的汇总报告和统计数据 |

## 输入数据要求

- 格式：CSV 文件（UTF-8 编码）
- 必填字段：至少包含"领用单号"作为唯一标识
- 推荐字段：修改时间/领用时间（用于判断版本新旧）
- 特殊标记：在"备注"或"说明"字段中标记特殊类型

## 特殊类型识别

工具自动识别以下特殊类型（可在规则文件中配置）：

| 类型标识 | 触发关键词 | 说明 |
|----------|-----------|------|
| return | 返库 | 材料退回仓库的记录 |
| substitute | 替代料 | 使用替代材料的记录 |
| manual | 手写单 | 手工填写单据的记录 |
| retry | 可复跑 | 需要重新处理的记录 |

## 配置规则文件

编辑 `rules/default_rules.json` 自定义处理规则：

```json
{
  "id_fields": ["领用单号"],
  "special_types": {
    "return": "返库",
    "substitute": "替代料",
    "manual": "手写单",
    "retry": "可复跑"
  }
}
```

**配置说明：**
- `id_fields`: 用于唯一识别记录的字段组合
- `special_types`: 特殊类型的识别关键词

## 命令行参数

```
--input, -i    : 输入目录路径，包含CSV格式的材料领用记录
--rules, -r    : 规则文件路径 (JSON格式)
--output, -o   : 输出目录路径
--preview, -p  : 预览模式，不实际写入文件
--report       : 查看指定的汇总报告文件
```

## 示例场景

### 场景1：同一条记录多次修改

**输入：**
- WYCL202405001 第1次修改: 数量 10
- WYCL202405001 第2次修改: 数量 15
- WYCL202405001 第3次修改: 数量 12

**输出：**
- final_material_claims.csv: 保留最新版本（数量12）
- version_history.csv: 完整记录3次修改的全部信息

### 场景2：特殊类型记录

**输入：**
- 备注包含"返库"的记录
- 备注包含"手写单"的记录

**输出：**
- 最终记录正常保留
- 同时会单独分类到 return_records.csv、manual_records.csv
- 不会导致整批任务失败！

## 注意事项

- 仅在输入路径不可读时才会导致整批任务失败
- 返库、替代料、手写单、可复跑等特殊记录只会被标记，不会导致失败
- 重复记录会被合并，保留最新版本，所有历史版本均可追溯
