from ..core import ForbiddenListEngine
from ..data.demo_data import DEMO_DATA


def run_complete_demo():
    engine = ForbiddenListEngine()

    print("\n" + "=" * 70)
    print("  🛒 导购推荐禁推清单 - 完整工作流演示")
    print("  👩‍💼 标注负责人：周姐")
    print("=" * 70)

    print("\n📋 准备的三条演示数据：")
    print("  1️⃣  顺利记录：保健品螺旋藻片（链接有效）")
    print("  2️⃣  链接404：美白祛斑霜特效版（培训文档链接失效）")
    print("  3️⃣  补录旧口径：七天长高营养液（后续从模型输出发现旧口径）")

    print("\n" + "-" * 70)
    print("  【第一步】标注员第一次导入留言")
    print("-" * 70)

    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    for i, r in enumerate(records, 1):
        status_icon = "✅" if r.status.value == "正常通过" else "⚠️"
        print(f"\n  {status_icon} 记录 {i}: {r.keyword}")
        print(f"      标注员: {engine.annotator_comments[i-1].annotator}")
        print(f"      状态: {r.status.value}")
        print(f"      引用链接: {r.reference_url or '无'}")
        if r.link_404:
            print(f"      ❗ 链接检查结果: 404 失效")
        else:
            print(f"      ✅ 链接检查结果: 正常")

    print(f"\n  📊 第一步完成，共导入 {len(records)} 条记录")

    print("\n" + "-" * 70)
    print("  【第二步】标注负责人周姐补看模型输出片段 + 复核")
    print("-" * 70)

    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]

    print("\n  周姐复核决策：")
    print("  • 记录1（保健品螺旋藻片）: pass_normal - 规则引用正确，放行")
    print("  • 记录2（美白祛斑霜特效版）: flag_404_for_pm - 链接404，不急着归正常，转产品经理")
    print("  • 记录3（七天长高营养液）: pass_normal - 临时口径先过，等下补录模型片段")

    engine.run_full_workflow_step2_review("周姐", review_decisions)

    print("\n  复核后状态：")
    for i, r in enumerate(engine.forbidden_records, 1):
        icon = "🟢" if "正常" in r.status.value else "🟡" if "复核" in r.status.value else "🔵"
        print(f"  {icon} 记录 {i}: {r.keyword} → {r.status.value}")

    print("\n" + "-" * 70)
    print("  【第三步】补录模型输出片段，冲突样本表自动更新")
    print("-" * 70)

    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]

    print("\n  📥 补录的模型输出片段（针对记录3）：")
    print(f"      模型版本: {DEMO_DATA['model_outputs_to_supplement']['third_record']['model_version']}")
    print(f"      内容: {DEMO_DATA['model_outputs_to_supplement']['third_record']['content']}")

    new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)

    print(f"\n  🔄 补录后自动检测...")
    if new_conflicts:
        print(f"  ❗ 发现 {len(new_conflicts)} 条口径冲突，已加入冲突样本表！")
        for c in new_conflicts:
            print(f"      • 冲突ID: {c.id}")
            print(f"      • 类型: {c.conflict_type.value}")
            print(f"      • 原关键词: {c.old_content}")
            print(f"      • 新发现: 该口径已废弃，属于旧口径")
    else:
        print("  ✅ 未发现冲突")

    print("\n" + "=" * 70)
    print("  📊 最终结果 - 三种处理结果对比")
    print("=" * 70)

    outcomes = [
        ("✅ 顺利记录", 0, "链接有效 → 正常通过", "保健品螺旋藻片"),
        ("🟡 链接404待复核", 1, "链接失效 → 标记后转产品经理，不急着归正常", "美白祛斑霜特效版"),
        ("🔴 补录发现旧口径", 2, "模型输出补录 → 检测到冲突 → 冲突样本表新增记录", "七天长高营养液"),
    ]

    for name, idx, desc, keyword in outcomes:
        if idx < len(engine.forbidden_records):
            r = engine.forbidden_records[idx]
            print(f"\n  {name}")
            print(f"      关键词: {keyword}")
            print(f"      最终状态: {r.status.value}")
            print(f"      处理说明: {desc}")
            if r.link_404:
                print(f"      失效链接: {r.reference_url}")
            if r.conflict_note:
                print(f"      冲突备注: {r.conflict_note}")

    print("\n" + "-" * 70)
    print("  📋 冲突样本表现状：")
    for i, c in enumerate(engine.conflict_samples, 1):
        print(f"  [{i}] 冲突ID: {c.id} | 类型: {c.conflict_type.value} | 已解决: {'是' if c.resolved else '否'}")

    stats = engine.get_statistics()
    print(f"\n  📈 统计: 总记录 {stats['总记录数']} 条 | 冲突样本 {stats['冲突样本数']} 条 | 待PM复核 {stats['待产品经理复核数']} 条")

    print("\n" + "=" * 70)
    print("  ✅ 演示完成！周姐可以拿这个给新人讲流程了~")
    print("=" * 70 + "\n")

    return engine


if __name__ == "__main__":
    run_complete_demo()
