# 贝叶斯A/B试验报告 - EXP-005-DIRTY

**生成时间**: 2026-05-29 05:56:07
**输入哈希**: `02092205beb7f60a863bc6e0243e86158c03eb871d2fadd95990e315b4601b31`
**随机种子**: `3199727114`

> 💡 **可复算性说明**: 使用相同输入再次运行，将得到完全一致的结果。
> 输入哈希和随机种子可用于验证计算结果的一致性。

## 1. 数据验证

**数据质量**: ❌ 脏数据
**验证状态**: ❌ 未通过

### ⚠️ 缺失字段

- `treatment.conversions`: 缺少必需字段: 实验组转化数
- `prior.beta`: 缺少先验参数: beta（不假设默认值）

### ❌ 无效字段

- `control.conversions`: 对照组转化数不能大于样本量 (提供值: `600`)
- `treatment.sample_size`: 实验组样本量必须是非负整数 (提供值: `-100`)
- `prior.alpha`: 先验参数 alpha 必须是正数 (提供值: `-5`)
- `observation_window_days`: 观察窗口(天)已提供 (提供值: `0`)
- `planned_sample_size`: 计划样本量已提供 (提供值: `not_a_number`)
- `stopping_threshold`: 停测阈值已提供 (提供值: `1.5`)

### ⚡ 警告

- 缺少先验参数: prior.beta - 不假设默认值，将无法进行贝叶斯更新
- 当前试验天数 (20) 超过观察窗口 (0天)

### 🛑 错误

- 字段无效: 对照组转化数 (control.conversions) = 600 大于样本量 500
- 字段无效: 实验组样本量 (treatment.sample_size) 必须是非负整数，当前值: -100
- 缺少必需字段: 实验组转化数 (treatment.conversions)
- 字段无效: prior.alpha = -5 必须是正数
- 字段无效: observation_window_days = 0 必须是正整数
- 字段无效: planned_sample_size = not_a_number 必须是正整数
- 字段无效: stopping_threshold = 1.5 必须在(0, 1)之间

### 处理顺序

1. 开始验证试验ID和基本信息
2. 验证对照组数据
3. 验证实验组数据
4. 验证先验参数
5. 验证试验参数
6. 验证多指标数据
7. 检查数据质量和一致性
8. 验证完成 - 有效: False, 数据质量: dirty

## 2. 贝叶斯分析结果

### 后验分布统计

| 指标 | 对照组 | 实验组 |
|------|--------|--------|
| 均值 | 0.0000 | 0.0000 |
| 中位数 | 0.0000 | 0.0000 |
| 标准差 | 0.0000 | 0.0000 |
| 95%CI下限 | 0.0000 | 0.0000 |
| 95%CI上限 | 0.0000 | 0.0000 |

### 关键指标

- **P(实验组 > 对照组)**: **50.00%**
- **预期提升量**: **0.00%** (95%CI: [0.00%, 0.00%])
- **先验强度**: 0.0
- **有效样本量**: 0

## 3. 风险评估

**整体风险等级**: 🔴 严重

**风险检测**: ✅ 无重大风险

### 风险详情

#### 🔴 invalid_input

**风险等级**: 🔴 严重
**问题描述**: 输入数据无效，请修正缺失或错误的字段后重新运行
**建议**: 请参考验证结果修正输入数据，特别注意必填字段和数据类型要求

<details>
<summary>查看证据详情</summary>

```json
{
  "missing_fields": [
    "treatment.conversions",
    "prior.beta"
  ],
  "invalid_fields": [
    "control.conversions",
    "treatment.sample_size",
    "prior.alpha",
    "observation_window_days",
    "planned_sample_size",
    "stopping_threshold"
  ],
  "errors": [
    "字段无效: 对照组转化数 (control.conversions) = 600 大于样本量 500",
    "字段无效: 实验组样本量 (treatment.sample_size) 必须是非负整数，当前值: -100",
    "缺少必需字段: 实验组转化数 (treatment.conversions)",
    "字段无效: prior.alpha = -5 必须是正数",
    "字段无效: observation_window_days = 0 必须是正整数",
    "字段无效: planned_sample_size = not_a_number 必须是正整数",
    "字段无效: stopping_threshold = 1.5 必须在(0, 1)之间"
  ]
}
```
</details>

## 4. 停测建议

**建议**: ⏳ 继续试验

> 输入数据无效，无法给出停测建议。请先修正数据问题。

## 5. 结论

- ❌ 输入数据验证未通过
- 缺失字段: treatment.conversions, prior.beta
- 无效字段: control.conversions, treatment.sample_size, prior.alpha, observation_window_days, planned_sample_size, stopping_threshold

## 6. 行动建议

- 请修正上述缺失或无效的字段后重新运行分析
- 注意：本工具不会自动填充默认值，所有必需字段必须明确提供

---

*本报告由贝叶斯A/B试验台自动生成，所有计算结果可复现。*