# 峡谷风向决策报告

生成时间: 2026-05-31 10:06:59

## 决策明细

| 决策ID | 战斗 | 回合 | 结论 | 风向 | 置信度 | 状态 | 异常 | 追溯 |
|--------|------|------|------|------|--------|------|------|------|
| DEC-CANYON-001-R1 | CANYON-001 | 1 | 本回合共执行 0 个有效行动；造成总伤害 0；存活 150 单位，伤亡 0 单位；判定风向: 均衡（无主导风向）；⚠️  有 2 条记录待确认，已标记为PENDING | 均衡（无主导风向） | 0% | 待确认 | boundary_crossing, report_settlement_mismatch | [记录_BR-001](battle_record://BR-001) [原文_BR-001](file:///Users/lzy/pro/solo/workspaces/zy71839/data/battle_records_001.json#L1) [边界复核_BR-001](boundary_review://BR-001:A002) |
| DEC-CANYON-001-R2 | CANYON-001 | 2 | 本回合共执行 0 个有效行动；造成总伤害 0；存活 177 单位，伤亡 1 单位；判定风向: 均衡（无主导风向）；⚠️  有 2 条记录待确认，已标记为PENDING；已排除 1 条作废记录 | 均衡（无主导风向） | 0% | 待确认 | boundary_crossing, report_settlement_mismatch, suspected_duplicate, turn_order_error | [记录_BR-002-CORR](battle_record://BR-002-CORR) [原文_BR-002-CORR](file:///Users/lzy/pro/solo/workspaces/zy71839/data/battle_records_manual_correction.json#L1) [边界复核_BR-002-CORR](boundary_review://BR-002-CORR:A006) |
| DEC-CANYON-001-R3 | CANYON-001 | 3 | 本回合共执行 0 个有效行动；造成总伤害 0；存活 110 单位，伤亡 2 单位；判定风向: 均衡（无主导风向）；⚠️  有 1 条记录待确认，已标记为PENDING | 均衡（无主导风向） | 0% | 待确认 | boundary_crossing, report_settlement_mismatch | [记录_BR-003](battle_record://BR-003) [原文_BR-003](file:///Users/lzy/pro/solo/workspaces/zy71839/data/battle_records_001.json#L3) [边界复核_BR-003](boundary_review://BR-003:A009) |

## 边界穿越待复核

| 分析ID | 单位 | 轨迹 | 判定原因 |
|--------|------|------|----------|
| [BR-002-CORR:A005](boundary_review://BR-002-CORR:A005) | 重装步兵 | (3,7)→(6,7) | 移动路径经过【不可通行断崖】区域；轨迹: (3,7)→(6,7) |
| [BR-002-CORR:A006](boundary_review://BR-002-CORR:A006) | 盾卫战士 | (16,7)→(13,7) | 移动距离3.0格超过【盾卫战士】移动力上限2格；移动路径经过【不可通行断崖】区域；轨迹: (16,7)→(13,7) |
| [BR-001:A002](boundary_review://BR-001:A002) | 烈焰骑兵 | (15,8)→(10,8) | 穿越边界区域【峡谷通道】；轨迹: (15,8)→(10,8) |
| [BR-003:A008](boundary_review://BR-003:A008) | 暗影刺客 | (18,3)→(2,3) | 穿越边界区域【东部边界、A风区】；移动距离16.0格超过【暗影刺客】移动力上限4格；轨迹: (18,3)→(2,3) |
| [BR-003:A009](boundary_review://BR-003:A009) | 峡谷弓手 | (5,3)→(14,10) | 穿越边界区域【A风区、B风区】；移动距离11.4格超过【峡谷弓手】移动力上限2格；轨迹: (5,3)→(14,10) |
| [BR-001-DUP:A002](boundary_review://BR-001-DUP:A002) | 烈焰骑兵 | (15,8)→(10,8) | 穿越边界区域【峡谷通道】；轨迹: (15,8)→(10,8) |