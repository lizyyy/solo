import json
from ..core import ForbiddenListEngine
from ..data.demo_data import DEMO_DATA


def _print_record_status(engine, idx, r, show_detail=False):
    icons = {
        "正常通过": "🟢",
        "链接404但判通过": "🟠",
        "待产品经理复核": "🟡",
        "口径冲突": "🔴",
        "已补录修正": "🔵",
        "产品经理复核通过": "🟣",
        "产品经理驳回": "⚫",
        "已驳回": "⚫",
        "已重跑": "🟤",
        "待处理": "⚪",
    }
    icon = icons.get(r.status.value, "⚪")
    print(f"  {icon} 记录 {idx+1}: {r.keyword} → {r.status.value}")
    if show_detail:
        if r.confirm_reason:
            print(f"      ✅ 确认理由: {r.confirm_reason}")
        if r.reject_reason:
            print(f"      ❌ 驳回理由: {r.reject_reason}")
        if r.link_404:
            print(f"      🔗 失效链接: {r.reference_url}")
        if r.conflict_note:
            print(f"      ⚠️  冲突备注: {r.conflict_note}")
        if r.pm_review_note:
            print(f"      📝 PM备注: {r.pm_review_note}")
        if r.rerun_count > 0:
            print(f"      🔁 重跑次数: {r.rerun_count}")
        if r.resolved_keyword and r.resolved_keyword != r.keyword:
            print(f"      🔧 修正后口径: {r.resolved_keyword}")


def run_complete_demo():
    engine = ForbiddenListEngine()

    print("\n" + "=" * 72)
    print("  🛒 导购推荐禁推清单 - 五步完整工作流演示")
    print("  👩‍💼 标注负责人：周姐  |  产品经理：张总")
    print("=" * 72)

    print("\n📋 三条演示样例覆盖的场景：")
    print("  1️⃣  顺利记录：保健品螺旋藻片 → 链接有效，复核通过")
    print("  2️⃣  链接404仍被判通过：美白祛斑霜特效版 → 不急着归正常，转PM复核")
    print("  3️⃣  补录旧口径+人工修正+重跑：七天长高营养液 → 发现旧口径，修正后重跑")

    # ========== 第一步：标注员导入 ==========
    print("\n" + "-" * 72)
    print("  【第一步】标注员第一次导入留言（主材料：标注员留言）")
    print("-" * 72)

    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    for i, r in enumerate(records):
        comment = engine.annotator_comments[i]
        print(f"\n  [记录{i+1}]")
        print(f"      标注员: {comment.annotator}")
        print(f"      留言原文: {comment.content}")
        print(f"      标注员理由: {comment.reason}")
        _print_record_status(engine, i, r, show_detail=True)
        if r.link_404:
            print(f"      ⚠️  注意：引用链接返回404，但系统先标记为'链接404但判通过'，等待人工判断")

    print(f"\n  ✅ 第一步完成，共导入 {len(records)} 条记录")
    print(f"     （标注员留言可反查到同一条样例：通过 annotator_comment_id 关联）")

    # ========== 第二步：周姐复核 ==========
    print("\n" + "-" * 72)
    print("  【第二步】标注负责人周姐复核（需要判断的地方保留确认/驳回理由）")
    print("-" * 72)

    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]

    print("\n  周姐的复核决策与理由：")
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            d = DEMO_DATA["review_decisions"][key]
            print(f"  • 记录{i+1}（{records[i].keyword}）:")
            print(f"      决策: {d['decision']}")
            print(f"      说明: {d['note']}")
            if "confirm_reason" in d and d["confirm_reason"]:
                print(f"      ✅ 确认理由: {d['confirm_reason']}")
            if "reject_reason" in d and d["reject_reason"]:
                print(f"      ❌ 驳回理由: {d['reject_reason']}")

    print("\n  复核后状态：")
    engine.run_full_workflow_step2_review("周姐", review_decisions)
    for i, r in enumerate(engine.forbidden_records):
        _print_record_status(engine, i, r, show_detail=True)

    print(f"\n  ✅ 第二步完成，{engine.workflow_state.pm_review_needed} 条记录转产品经理复核")
    print(f"     （记录2未急于归正常，留给PM复核）")

    # ========== 第三步：补录模型输出片段 ==========
    print("\n" + "-" * 72)
    print("  【第三步】补录模型输出片段（模型输出藏着关键备注），冲突样本表同步更新")
    print("-" * 72)

    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]

    supplement_data = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    print(f"\n  📥 补录的模型输出片段（针对记录3）：")
    print(f"      模型版本: {supplement_data['model_version']}")
    print(f"      任务ID: {supplement_data['source_task_id']}")
    print(f"      内容摘要: {supplement_data['content']}")

    new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)

    print(f"\n  🔄 补录后自动检测...")
    if new_conflicts:
        print(f"  ❗ 发现 {len(new_conflicts)} 条口径冲突，已自动加入冲突样本表！")
        for c in new_conflicts:
            print(f"      • 冲突ID: {c.id}")
            print(f"      • 冲突类型: {c.conflict_type.value}")
            print(f"      • 旧内容/原关键词: {c.old_content}")
            print(f"      • 新内容: 检测到该口径已废弃（旧口径）")
    else:
        print("  ✅ 未发现冲突")

    print("\n  第三步完成后各记录状态：")
    for i, r in enumerate(engine.forbidden_records):
        _print_record_status(engine, i, r, show_detail=True)

    print(f"\n  ✅ 第三步完成，冲突样本表当前 {len(engine.conflict_samples)} 条")
    print(f"     （补录后状态、明细、历史已同步：查看 get_record_detail 可确认）")

    # ========== 第四步：人工修正 ==========
    print("\n" + "-" * 72)
    print("  【第四步】一次人工修正（解决旧口径冲突，保留确认理由）")
    print("-" * 72)

    corrections = {}
    third_record = engine.forbidden_records[2]
    corr_data = dict(DEMO_DATA["manual_corrections"]["third_record"])
    corr_data["resolve_conflict_id"] = engine.conflict_samples[0].id if engine.conflict_samples else None
    corrections[third_record.id] = corr_data

    print(f"\n  🛠  对记录3执行人工修正：")
    print(f"      原关键词: {third_record.keyword}")
    print(f"      修正为: {corr_data['new_keyword']}")
    print(f"      修正说明: {corr_data['note']}")
    print(f"      ✅ 确认理由: {corr_data['confirm_reason']}")
    print(f"      冲突解决结论: {corr_data['resolution']}")

    engine.run_full_workflow_step4_manual_correct("周姐", corrections)

    print("\n  第四步完成后各记录状态：")
    for i, r in enumerate(engine.forbidden_records):
        _print_record_status(engine, i, r, show_detail=True)

    print(f"\n  ✅ 第四步完成，人工修正 {engine.workflow_state.manual_corrections} 次")
    print(f"     冲突样本已解决: {len([c for c in engine.conflict_samples if c.resolved])} 条")

    # ========== 第五步：PM 复核 + 重跑 ==========
    print("\n" + "-" * 72)
    print("  【第五步】产品经理复核 + 一次重跑")
    print("-" * 72)

    pm_review_data = DEMO_DATA["pm_reviews"]["second_record"]
    second_record = engine.forbidden_records[1]
    print(f"\n  👔 产品经理张总复核记录2（{second_record.keyword}）：")
    print(f"      决策: {'approve → 通过' if pm_review_data['decision'] == 'approve' else 'reject → 驳回'}")
    print(f"      ✅ 确认理由: {pm_review_data['reason']}")
    engine.pm_review(second_record, "张总", pm_review_data["decision"], pm_review_data["reason"])

    rerun_ids = [engine.forbidden_records[2].id]
    print(f"\n  🔁 对记录3（{engine.forbidden_records[2].keyword}）执行重跑：")
    print(f"      操作人: 周姐")
    print(f"      说明: 人工修正后重跑一次验证")
    engine.run_full_workflow_step5_rerun("周姐", rerun_ids)

    print("\n  第五步完成后各记录最终状态：")
    for i, r in enumerate(engine.forbidden_records):
        _print_record_status(engine, i, r, show_detail=True)

    # ========== 最终三种结果对比 ==========
    print("\n" + "=" * 72)
    print("  📊 最终结果 - 三种处理结果对比")
    print("=" * 72)

    outcomes = [
        ("✅ 顺利记录", 0,
         "标注员留言（主材料）→ 链接有效 → 负责人复核通过（带确认理由）→ 最终正常通过",
         "保健品螺旋藻片"),
        ("🟡 链接404待复核→PM确认", 1,
         "标注员留言 → 链接404但判通过 → 负责人不急着归正常 → 转PM复核 → PM确认通过（带确认理由）",
         "美白祛斑霜特效版"),
        ("🔴 补录旧口径→人工修正→重跑", 2,
         "标注员留言 → 补录模型输出片段（发现旧口径）→ 生成冲突样本 → 人工修正（带确认理由）→ 重跑 → 已补录修正",
         "七天长高营养液 → 强效生长激素口服液"),
    ]

    for name, idx, desc, keyword in outcomes:
        r = engine.forbidden_records[idx]
        print(f"\n  {name}")
        print(f"      关键词: {keyword}")
        print(f"      最终状态: {r.status.value}")
        print(f"      完整路径: {desc}")
        print(f"      操作历史条数: {len(r.history)}")

    # ========== 详情与历史 ==========
    print("\n" + "-" * 72)
    print("  📋 查看单条样例详情：可反查标注员留言、模型输出、冲突、历史")
    print("-" * 72)

    third_detail = engine.get_record_detail(engine.forbidden_records[2].id)
    print(f"\n  🔍 记录3（{third_detail['record']['keyword']}）详情：")
    print(f"      标注员留言: {third_detail['annotator_comment']['content']}")
    print(f"      标注员: {third_detail['annotator_comment']['annotator']}")
    print(f"      模型输出: {third_detail['model_output']['content'][:60]}...")
    print(f"      模型版本: {third_detail['model_output']['model_version']}")
    print(f"      关联冲突: {len(third_detail['conflicts'])} 条")
    for c in third_detail['conflicts']:
        print(f"        • {c['type']}  已解决: {c['resolved']}  理由: {c['confirm_reason'] or '无'}")
    print(f"      重跑次数: {third_detail['record']['rerun_count']}")
    print(f"      确认理由: {third_detail['record']['confirm_reason']}")

    print(f"\n  🕒 记录3操作历史（最新在前）：")
    for i, h in enumerate(third_detail['history'][:7], 1):
        b = h.get('before_status', '-')
        a = h.get('after_status', '-')
        cr = h.get('confirm_reason', '')
        print(f"    [{i}] {h['action']}（{h['operator']}）")
        if b and a and b != a:
            print(f"        状态: {b} → {a}")
        if cr:
            print(f"        ✅ 理由: {cr[:50]}...")
        if h.get('rerun_number'):
            print(f"        🔁 第 {h['rerun_number']} 次重跑")

    # ========== 冲突样本表 ==========
    print("\n" + "-" * 72)
    print("  📋 冲突样本表最终状态：")
    print("-" * 72)
    for i, c in enumerate(engine.conflict_samples, 1):
        print(f"  [{i}] 冲突ID: {c.id}")
        print(f"      关联记录ID: {c.forbidden_record_id}")
        print(f"      冲突类型: {c.conflict_type.value}")
        print(f"      旧内容: {c.old_content}")
        print(f"      是否已解决: {'是（解决人：' + str(c.resolved_by) + '）' if c.resolved else '否'}")
        print(f"      解决结论: {c.resolution_note}")
        print(f"      确认理由: {c.confirm_reason}")

    # ========== 生成结果报告 ==========
    print("\n" + "-" * 72)
    print("  📄 生成结果报告（概要）：")
    print("-" * 72)
    report = engine.generate_report()
    stats = report["统计概览"]
    print(f"  总记录: {stats['总记录数']}  冲突样本: {stats['冲突样本数']}（已解决{stats['已解决冲突数']}）")
    print(f"  人工修正: {stats['人工修正次数']} 次  重跑: {stats['重跑执行次数']} 次  待PM复核: {stats['待产品经理复核数']}")
    print(f"  状态分布: {json.dumps(stats['状态分布'], ensure_ascii=False)}")

    print("\n" + "=" * 72)
    print("  ✅ 五步演示完成！周姐可以拿这个给新人讲流程了~")
    print("=" * 72)

    return engine


if __name__ == "__main__":
    run_complete_demo()
