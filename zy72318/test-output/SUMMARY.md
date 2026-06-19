# 风险价值 VaR 回放 - 端到端验证报告

**验证时间**: 2026-06-19T08:52:14.508Z
**验证结果**: ✅ 全部通过

## 流程覆盖

| 步骤 | 操作 | 关键验证点 |
|------|------|------------|
| 1 | 重置样例数据 | 5 行问卷、4 条计算、2 条冲突、2 条边界值说明 |
| 2 | 裁决 c1（1.7 → 1.7%） | originalFields 保留、fields 更新、valueChanges 记录、自动重算 |
| 3 | 裁决 c2（0.99 → 99%） | originalFields 保留、fields 更新、自动重算 |
| 4 | 全量重算 | 版本号递增、versionHistory 追加 |
| 5 | 活动负责人复核 r3 | reviewStatus: pending → released、同步释放发布 |
| 6 | 验证四项信息保留 | 原始说法、改后值、处理原因、下一步找谁 |
| 7 | 验证边界值备注 | 原文完整保留、appliedRowIds 正确 |
| 8 | 发布后重算 | 已发布记录不被打回 |
| 9 | 四项自检 | formatConsistency/recalcAfterSupplement/exportConsistency = pass |
| 10 | 导出 JSON | 与 store 完全同源 |

## 处理重算样例（r3 国债 10Y）验证

| 数据项 | 原值 | 改后值 | 位置 |
|--------|------|--------|------|
| originalFields.varAmount | 1.7 | 1.7（永不修改） | 行详情、导出 |
| fields.varAmount | 1.7 | 1.7% | 行详情、计算表、导出 |
| CalculationDetail.displayValue | 1.7 | 1.7% | 计算表、导出 |
| CalculationDetail.released | false | true | 计算表、导出 |
| reviewStatus | pending | released | 行详情、导出 |
| reviewedBy | - | 活动负责人 | 行详情、导出 |
| reviewReason | - | 人工复核说明 | 行详情、导出 |
| versionHistory | 1 版 | 4 版 | 行详情、导出 |
| valueChanges | 0 条 | 1 条（1.7→1.7%） | 行详情、导出 |
| bn2.appliedRowIds | [] | [r3Id] | 备注详情、导出 |

## 核心修复验证

1. ✅ **绝不自动归正常 ≠ 永不发布**：formatType='mixed' 不自动修正，但 reviewStatus='released' 后可发布
2. ✅ **同源数据**：列表、详情、摘要、历史记录、导出 全部读取同一份 Zustand store
3. ✅ **边界值说明备注比正式表更重要**：originalText 完整保留，不清洗为整齐数据
4. ✅ **完整审计**：每一步操作都有 audit 记录，包含原始字段、当前字段、变更历史
5. ✅ **导出按钮禁用真实反映状态**：核心自检项通过即可启用，不会在已复核发布后继续卡死

## 输出文件

- `test-output/01-reset-done.json` - 初始状态
- `test-output/02-conflict-c1-resolved.json` - c1 裁决后状态
- `test-output/03-conflict-c2-resolved.json` - c2 裁决后状态
- `test-output/04-recalculate-all.json` - 全量重算后状态
- `test-output/05-review-r3-done.json` - r3 复核后状态
- `test-output/06-selfcheck-done.json` - 自检后状态
- `test-output/final-export.json` - 最终导出 JSON
- `test-output/SUMMARY.md` - 本报告

---

**结论**：项目可安装、可启动、可按完整流程使用。
