import csv
from typing import Dict, Any, List
from collections import defaultdict


def export_summary(result: Dict[str, Any], filepath: str):
    stats = result["stats"]

    lines = []
    lines.append("=" * 60)
    lines.append("矩阵分解边界复核 —— 摘要报告")
    lines.append("=" * 60)
    lines.append("")
    lines.append("一、基础数据")
    lines.append(f"  历史答案条目数：{stats['total_answers']}")
    lines.append(f"  归一化后组数：{stats['total_groups']}")
    lines.append(f"  别名映射条数：{len(result['aliases'])}")
    lines.append(f"  后补说明条数：{len(result['notes'])}")
    lines.append("")

    lines.append("二、卡点情况（重复样本）")
    lines.append(f"  重复疑点组数：{stats['dup_issues']}")
    lines.append(f"  受影响条目数：{stats['blocked']}")
    if result["blocked_items"]:
        lines.append("  卡点清单：")
        for iss in result["blocked_items"]:
            lines.append(f"    - [{iss.block_type}] {iss.key}")
            lines.append(f"      说明：{iss.reason}")
            lines.append(f"      涉及行号：{','.join(str(it.line_no) for it in iss.items)}")
    else:
        lines.append("  无重复样本卡点")
    lines.append("")

    lines.append("三、跳变情况")
    lines.append(f"  跳变疑点总数：{stats['jump_issues']}")
    if result["jump_issues"]:
        by_type = defaultdict(list)
        for iss in result["jump_issues"]:
            by_type[iss.jump_type].append(iss)
        for jtype, issues in by_type.items():
            lines.append(f"  {jtype}（{len(issues)}处）：")
            for iss in issues:
                lines.append(f"    - {iss.key}: {iss.detail}")
    else:
        lines.append("  无跳变疑点")
    lines.append("")

    lines.append("四、复核结论分布")
    lines.append(f"  复核通过：{stats['passed']} 条")
    lines.append(f"  卡点-暂不放行：{stats['blocked']} 条（重复样本待人工确认）")
    lines.append(f"  待核查：{stats['needs_review']} 条（存在跳变疑点）")
    lines.append("")

    if result.get("strict_stopped"):
        lines.append("【重要】严格模式下因检测到重复样本已终止，未生成完整明细。")
        lines.append("请先处理卡点后重新运行，或不加 --strict 参数继续。")
        lines.append("")

    lines.append("五、处理链说明")
    lines.append("  1. 加载历史答案 → 2. 别名归一化分组 → 3. 重复样本卡点检测")
    lines.append("  → 4. 跨版本跳变比对（阈值/单位/结论）→ 5. 后补说明校验 → 6. 输出结果")
    lines.append("")

    lines.append("六、三一致性校验规则")
    lines.append("  每一条复核记录均保证：状态 ↔ 备注 ↔ 文件结论 三者逻辑一致")
    lines.append("  - 复核通过：备注为空，结论沿用原文")
    lines.append("  - 卡点-暂不放行：备注注明重复原因，结论待确认")
    lines.append("  - 待核查：备注列出跳变类型与详情，结论待确认")
    lines.append("")

    lines.append("=" * 60)
    lines.append("明细数据请查看 review_details.csv")
    lines.append("卡点清单请查看 blocked_items.csv（如有）")
    lines.append("=" * 60)

    with open(filepath, "w", encoding="utf-8") as f:
        f.write("\n".join(lines) + "\n")


def export_details_csv(result: Dict[str, Any], details_path: str, blocked_path: str):
    items = result.get("reviewed_items", [])

    if items:
        fieldnames = [
            "题目编号", "样本名称", "标准名称(归一化后)", "分类",
            "边界值", "单位", "阈值",
            "文件结论", "备注", "版本", "状态",
            "复核状态", "复核备注", "复核结论", "三一致校验",
            "原始行号",
        ]
        with open(details_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for item in items:
                writer.writerow(item.to_dict())

    blocked = result.get("blocked_items", [])
    if blocked:
        fieldnames = [
            "疑点标识", "卡点类型", "卡点状态", "涉及条目数",
            "卡点说明", "涉及行号", "涉及样本名", "题目编号",
        ]
        with open(blocked_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            for iss in blocked:
                writer.writerow(iss.to_dict())
