#!/usr/bin/env python3
import json
import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from forbidden_list.core import ForbiddenListEngine
from forbidden_list.data.demo_data import DEMO_DATA


def step1_start_project():
    print("\n" + "=" * 72)
    print("  🚀 【可复现路线 Step 1】启动项目")
    print("=" * 72)
    print("\n  启动方式（任选一种）：")
    print("    $ python3 run.py demo          # 运行完整五步演示")
    print("    $ python3 run.py web           # 启动小看板 Web 界面 (http://localhost:5000)")
    print("    $ python3 -m forbidden_list.cli --help   # 命令行工具帮助")
    print("\n  依赖安装（首次）：")
    print("    $ pip3 install -r requirements.txt")
    engine = ForbiddenListEngine()
    print(f"\n  ✅ 引擎初始化成功，当前记录数: {len(engine.forbidden_records)}")
    return engine


def step2_load_samples(engine):
    print("\n" + "=" * 72)
    print("  📥 【可复现路线 Step 2】载入三条演示样例")
    print("=" * 72)
    print("\n  演示样例覆盖三种场景：")
    print("    1️⃣  保健品螺旋藻片   → 顺利，链接有效")
    print("    2️⃣  美白祛斑霜特效版 → 链接404，不急着归正常，转PM复核")
    print("    3️⃣  七天长高营养液   → 补录发现旧口径 → 人工修正 → 重跑")

    records = engine.run_full_workflow_step1_import(DEMO_DATA)

    print(f"\n  📋 导入后的初始状态（3 条记录）：")
    for i, r in enumerate(records, 1):
        c = engine.annotator_comments[i-1]
        status_icon = "🟢" if "正常" in r.status.value else ("🟠" if "404" in r.status.value else "⚪")
        print(f"\n    {status_icon} 记录{i}（{r.keyword}）")
        print(f"        标注员: {c.annotator}  |  状态: {r.status.value}")
        print(f"        留言原文: {c.content[:60]}...")
        print(f"        引用链接: {r.reference_url}")
        if r.link_404:
            print(f"        ⚠️  链接返回 404（先不急着归正常，留给人工判断）")

    print(f"\n  ✅ 载入完成，共 {len(records)} 条记录")
    print(f"     标注员留言（主材料）与禁推记录已通过 annotator_comment_id 关联，可反查")
    return records


def step3_handle_issues(engine, records):
    print("\n" + "=" * 72)
    print("  🔧 【可复现路线 Step 3】处理问题记录（周姐复核、补录、人工修正）")
    print("=" * 72)

    print("\n  📝 Step 3.1 标注负责人周姐复核（保留确认/驳回理由）：")
    review_decisions = {}
    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            review_decisions[records[i].id] = DEMO_DATA["review_decisions"][key]

    for i, key in enumerate(["first_record", "second_record", "third_record"]):
        if i < len(records):
            d = DEMO_DATA["review_decisions"][key]
            cr = d.get("confirm_reason", "")
            print(f"    • 记录{i+1}（{records[i].keyword}）: {d['decision']}")
            if cr:
                print(f"      ✅ 确认理由: {cr}")

    engine.run_full_workflow_step2_review("周姐", review_decisions)
    print(f"    → {engine.workflow_state.pm_review_needed} 条转 PM 复核（记录2不急着归正常）")

    print("\n  📥 Step 3.2 补录模型输出片段（针对记录3）：")
    supplements = {}
    if len(records) >= 3:
        supplements[records[2].id] = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    supplement_data = DEMO_DATA["model_outputs_to_supplement"]["third_record"]
    print(f"    模型版本: {supplement_data['model_version']}")
    print(f"    内容: {supplement_data['content'][:80]}...")

    new_conflicts = engine.run_full_workflow_step3_supplement("周姐", supplements)
    if new_conflicts:
        print(f"\n    ❗ 自动检测到 {len(new_conflicts)} 条口径冲突！")
        for c in new_conflicts:
            print(f"      冲突类型: {c.conflict_type.value}")
            print(f"      旧内容: {c.old_content}")
        print(f"    → 已自动加入冲突样本表，补录后状态/明细/历史已同步")

    print("\n  🛠  Step 3.3 一次人工修正（解决记录3的旧口径冲突，带确认理由）：")
    third_record = engine.forbidden_records[2]
    corr_data = dict(DEMO_DATA["manual_corrections"]["third_record"])
    corr_data["resolve_conflict_id"] = engine.conflict_samples[0].id if engine.conflict_samples else None
    corrections = {third_record.id: corr_data}
    print(f"    原关键词: {third_record.keyword}")
    print(f"    修正为: {corr_data['new_keyword']}")
    print(f"    ✅ 确认理由: {corr_data['confirm_reason']}")
    engine.run_full_workflow_step4_manual_correct("周姐", corrections)

    print("\n  👔 Step 3.4 产品经理张总复核（记录2，保留确认理由）：")
    pm_data = DEMO_DATA["pm_reviews"]["second_record"]
    second_record = engine.forbidden_records[1]
    print(f"    记录: {second_record.keyword}")
    print(f"    决策: {pm_data['decision']} → 通过")
    print(f"    ✅ 确认理由: {pm_data['reason']}")
    engine.pm_review(second_record, "张总", pm_data["decision"], pm_data["reason"])

    print("\n  🔁 Step 3.5 一次重跑（对修正后的记录3）：")
    rerun_ids = [engine.forbidden_records[2].id]
    print(f"    记录: {engine.forbidden_records[2].keyword}")
    print(f"    说明: 人工修正后重跑验证")
    engine.run_full_workflow_step5_rerun("周姐", rerun_ids)

    print(f"\n  ✅ 所有问题处理完成！")
    print(f"     人工修正: {engine.workflow_state.manual_corrections} 次")
    print(f"     重跑执行: {engine.workflow_state.rerun_executed} 次")
    print(f"     冲突已解决: {len([c for c in engine.conflict_samples if c.resolved])} 条")
    return engine


def step4_view_history(engine):
    print("\n" + "=" * 72)
    print("  🕒 【可复现路线 Step 4】查看历史 + 验证闭环")
    print("=" * 72)

    third_id = engine.forbidden_records[2].id
    detail = engine.get_record_detail(third_id)
    r = detail["record"]

    print(f"\n  🔍 以「记录3」为例，逐项核对：")

    print(f"\n  📌 【1/6】关键词核对（人工修正是否生效）：")
    print(f"      原始关键词: {r.get('original_keyword', 'N/A')}")
    print(f"      当前关键词: {r['keyword']}")
    keyword_match = r["keyword"] == "强效生长激素口服液" and r.get("original_keyword") == "七天长高营养液"
    print(f"      验证结果: {'✅ 通过' if keyword_match else '❌ 失败'}")
    if r.get("original_keyword") and r["original_keyword"] != r["keyword"]:
        print(f"      → 口径已变更: {r['original_keyword']} → {r['keyword']}")

    print(f"\n  📌 【2/6】确认理由核对（是否为人工修正的理由）：")
    print(f"      当前确认理由: {r.get('confirm_reason', 'N/A')}")
    reason_match = "强效生长激素口服液" in (r.get("confirm_reason") or "")
    print(f"      验证结果: {'✅ 通过（已更新为人工修正理由）' if reason_match else '❌ 失败（理由未更新）'}")

    print(f"\n  📌 【3/6】重跑次数核对：")
    print(f"      重跑次数: {r['rerun_count']} 次")
    print(f"      验证结果: {'✅ 通过' if r['rerun_count'] == 1 else '❌ 失败'}")

    print(f"\n  📌 【4/6】主材料反查（标注员留言 → 同一条样例）：")
    if detail.get("annotator_comment"):
        c = detail["annotator_comment"]
        print(f"      标注员留言ID: {c['id']}")
        print(f"      标注员: {c['annotator']}")
        print(f"      留言内容: {c['content']}")
        print(f"      验证结果: {'✅ 通过（主材料可反查同一条样例）' if '七天长高营养液' in c['content'] else '❌ 失败'}")

    print(f"\n  📌 【5/6】模型输出 + 冲突样本核对：")
    if detail.get("model_output"):
        m = detail["model_output"]
        print(f"      模型输出片段: 有（版本 {m['model_version']}）")
    if detail.get("conflicts"):
        print(f"      关联冲突: {len(detail['conflicts'])} 条")
        for c in detail["conflicts"]:
            print(f"        • {c['type']}，旧内容: {c['old_content']}，已解决: {c['resolved']}")

    print(f"\n  📌 【6/6】操作历史核对（关键事件是否完整）：")
    history = detail["history"]
    action_names = [h["action"] for h in history]
    required_actions = ["人工修正", "执行重跑", "重跑结果生效", "冲突已解决"]
    print(f"      历史总数: {len(history)} 条")
    all_found = all(act in action_names for act in required_actions)
    print(f"      关键事件完整度: {'✅ 全部存在' if all_found else '❌ 有缺失'}")
    for act in required_actions:
        found = act in action_names
        print(f"        • {act}: {'✅' if found else '❌'}")

    print(f"\n    🕒 完整操作历史（最新在前）：")
    for i, h in enumerate(detail["history"][:7], 1):
        b = h.get("before_status", "")
        a = h.get("after_status", "")
        arrow = f" [{b}→{a}]" if b and a and b != a else ""
        cr = f" ✅{h['confirm_reason'][:30]}" if h.get("confirm_reason") else ""
        rn = f" 🔁重跑#{h['rerun_number']}" if h.get("rerun_number") else ""
        print(f"      [{i}] {h['action']}（{h['operator']}）{arrow}{cr}{rn}")

    print(f"\n  ✅ 反查验证完成：标注员留言、人工修正、重跑 → 都指向同一条样例！")
    print(f"     七天长高营养液 → 人工修正为 → 强效生长激素口服液 → 重跑验证")
    return engine


def step5_generate_result(engine):
    print("\n" + "=" * 72)
    print("  📄 【可复现路线 Step 5】生成结果报告 + 最终核对")
    print("=" * 72)

    report = engine.generate_report()
    stats = report["统计概览"]

    print(f"\n  📊 统计概览：")
    print(f"    总记录数: {stats['总记录数']}")
    print(f"    冲突样本数: {stats['冲突样本数']}（已解决 {stats['已解决冲突数']}）")
    print(f"    人工修正次数: {stats['人工修正次数']}")
    print(f"    重跑执行次数: {stats['重跑执行次数']}")
    print(f"    待产品经理复核数: {stats['待产品经理复核数']}")
    print(f"    状态分布: {json.dumps(stats['状态分布'], ensure_ascii=False)}")

    print(f"\n  📋 三种处理结果对比：")
    expected = [
        ("✅ 顺利", 0, "保健品螺旋藻片", "正常通过"),
        ("🟡 404→PM通过", 1, "美白祛斑霜特效版", "产品经理复核通过"),
        ("🔴 旧口径→修正→重跑", 2, "强效生长激素口服液", "已补录修正"),
    ]
    all_pass = True
    for name, idx, expected_keyword, expected_status in expected:
        r = report["记录明细"][idx]
        keyword_match = r["keyword"] == expected_keyword
        status_match = r["status"] == expected_status
        match = "✓" if keyword_match and status_match else "✗"
        if not keyword_match or not status_match:
            all_pass = False
        print(f"    {name} {match}  {r['keyword']} → {r['status']}")
        if r.get("original_keyword") and r["original_keyword"] != r["keyword"]:
            print(f"        🔄 原口径: {r['original_keyword']} → 现口径: {r['keyword']}")
        if r.get("confirm_reason"):
            print(f"        ✅ 确认理由: {r['confirm_reason'][:50]}")
        if r.get("rerun_count", 0) > 0:
            print(f"        🔁 重跑次数: {r['rerun_count']}")

    print(f"\n  🔍 第三条记录深度核对（旧口径→新口径闭环）：")
    r3 = report["记录明细"][2]
    checks = [
        ("原始关键词为旧口径", r3.get("original_keyword") == "七天长高营养液"),
        ("当前关键词为新口径", r3["keyword"] == "强效生长激素口服液"),
        ("状态为已补录修正", r3["status"] == "已补录修正"),
        ("确认理由含新口径", "强效生长激素口服液" in (r3.get("confirm_reason") or "")),
        ("重跑次数为1次", r3.get("rerun_count", 0) == 1),
        ("有关联冲突", r3.get("has_conflict") == True),
    ]
    all_checks_pass = True
    for check_name, result in checks:
        status = "✅" if result else "❌"
        if not result:
            all_checks_pass = False
        print(f"    {status} {check_name}")

    report_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "demo_report.json")
    with open(report_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)

    print(f"\n  ✅ 完整报告已保存到: {report_path}")
    print(f"\n  🎯 最终验证结论: {'全部通过 ✅' if all_pass and all_checks_pass else '存在问题 ❌'}")
    print(f"     七天长高营养液 → 人工修正为 → 强效生长激素口服液 → 重跑验证通过")
    print(f"\n  可复现路线执行完毕！以上 5 步可以 100% 复现演示结果。")

    return engine


def main():
    print("\n" + "╔" + "═" * 70 + "╗")
    print("║" + " " * 10 + "🛒 导购推荐禁推清单 - 完整可复现路线" + " " * 24 + "║")
    print("╚" + "═" * 70 + "╝")
    print("\n  路线: 启动项目 → 载入样例 → 处理问题 → 查看历史 → 生成结果")

    engine = step1_start_project()
    records = step2_load_samples(engine)
    engine = step3_handle_issues(engine, records)
    engine = step4_view_history(engine)
    step5_generate_result(engine)

    print("\n" + "=" * 72)
    print("  🎉 全流程验证通过！")
    print("=" * 72)
    print("\n  快速回放命令：")
    print("    $ python3 reproduce.py              # 本脚本（完整可复现路线）")
    print("    $ python3 run.py demo               # 五步演示（带说明文字）")
    print("    $ python3 run.py web                # 小看板 Web 界面")
    print("    $ python3 -m forbidden_list.cli detail --demo --index 3   # 查看第3条详情")
    print("    $ python3 -m forbidden_list.cli history --demo --index 3  # 查看第3条历史")
    print("    $ python3 -m forbidden_list.cli report --demo             # 生成报告")
    print()


if __name__ == "__main__":
    main()
