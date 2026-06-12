#!/usr/bin/env python3
"""
农贸市场装卸时窗 - 完整演示流程
社区书记周姐给新人讲流程用
"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from models import DataStore
from service import MarketLoadingService

DEMO_DB = "data/demo_store.json"


def banner(title):
    print("\n" + "=" * 70)
    print(f"  {title}")
    print("=" * 70)


def section(title):
    print("\n" + "─" * 62)
    print(f"▶ {title}")
    print("─" * 62)


def wait():
    input("\n按回车继续...")


def main():
    if os.path.exists(DEMO_DB):
        os.remove(DEMO_DB)

    svc = MarketLoadingService(DataStore(DEMO_DB))

    banner("🥬 农贸市场装卸时窗 - 完整流程演示")
    print("场景：社区书记周姐带新人小李走一遍完整流程")
    print("真实样例：TS20260607-001 阳光花园 农贸市场凌晨装卸扰民")
    wait()

    section("第零步：先登记小区新旧名称映射")
    print("（背景：市政去年把'阳光花园'更名为'阳光佳苑'，系统先记下来）")
    wait()
    svc.register_community_alias("阳光花园", "阳光佳苑")
    print("✅ 已登记：阳光花园 ↔ 阳光佳苑（待确认）")

    section("第一步：小李第一次导入居民投诉 TS20260607-001")
    print("→ 关键点：导入后直接出完整报告，还缺什么材料的来源、状态、结论都在同一份里")
    wait()

    c, note, report = svc.import_complaint(
        complaint_no="TS20260607-001",
        community_name="阳光花园",
        content="农贸市场北入口凌晨4点半开始装卸货，大货车喇叭声、卸货哐当声很大，3号楼5户居民都被吵醒，6月5日、6日连续发生，居民要求调整装卸时段或加强降噪措施。",
        raw_conclusion="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。",
        operator="小李"
    )
    print(note)
    print()
    print(svc.get_import_report_text(c.id))
    wait()

    section("第二步：用投诉编号查详情（历史摘要、操作日志、缺失材料都能看到）")
    print("→ 关键点：用居民投诉编号就能查，不用记内部ID")
    wait()
    detail = svc.get_complaint_detail("TS20260607-001")
    print(f"投诉编号：{detail['complaint']['complaint_no']}")
    print(f"小区：{detail['complaint']['community_name']}")
    print(f"状态：{detail['complaint']['status']}")
    print()
    print(f"📋 历史摘要：{len(detail['summaries'])} 版")
    for s in detail['summaries']:
        print(f"   v{s['version']}：{s['why_kept'][:30]}...")
    print()
    print(f"📜 操作日志：{len(detail['audit_log'])} 条")
    for a in detail['audit_log']:
        print(f"   [{a['timestamp'][:19]}] {a['action']} - {a['detail'][:40]}")
    print()
    print(f"📦 缺失材料：{len(detail['missing_materials'])} 项")
    for m in detail['missing_materials']:
        icon = "□" if m["status"] == "待补" else "■"
        print(f"   {icon} {m['name']} [{m['status']}]")
    wait()

    section("第三步：路口照片后来才补到群里，周姐回看时补上")
    print("→ 关键点：补录照片后，给街道的摘要和操作日志一起变")
    wait()
    svc.add_road_photo(
        "TS20260607-001",
        "农贸市场北入口_20260607_凌晨5点.jpg",
        "周姐"
    )
    print(svc.get_street_summary_text("TS20260607-001"))
    wait()

    section("第四步：周姐做一次人工修正（原始结论不能直接照抄）")
    wait()
    svc.manual_correct(
        "TS20260607-001",
        field="raw_conclusion",
        old_val="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。",
        new_val="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。（人工修正：经查照片，装卸位距离3号楼仅12米，且未采取降噪措施，原始结论不能直接照抄，需重新评估）",
        operator="周姐"
    )
    print("✅ 周姐已人工修正原始结论")
    print("   修正内容：标注'装卸位距离3号楼仅12米，未采取降噪措施'")
    wait()

    section("第五步：重跑一次摘要，确认材料进度")
    wait()
    s = svc.rerun_summary("TS20260607-001")
    print(f"📝 摘要 v{s.version}")
    print(f"   还剩 {len(s.missing_materials)} 项待补材料")
    for m in s.missing_materials:
        print(f"   □ {m}")
    wait()

    section("第六步：市政巡检员王师傅复核小区名称")
    print("→ 关键点：市政巡检员确认后，待复核标记解除")
    wait()
    svc.resolve_missing_material(
        "TS20260607-001",
        material_name="市政巡检员对小区名称的复核确认",
        operator="市政巡检员 王师傅",
        remark="阳光花园已于2025年12月更名为阳光佳苑，门牌号已更新，确认对应同一小区"
    )
    print(svc.get_street_summary_text("TS20260607-001"))
    wait()

    section("第七步：完整详情（所有版本摘要 + 操作日志 + 缺失材料状态）")
    wait()
    detail = svc.get_complaint_detail("TS20260607-001")

    print(f"\n📦 缺失材料（全 {len(detail['missing_materials'])} 项）：")
    for m in detail['missing_materials']:
        icon = "■" if m["status"] == "已补" else "□"
        print(f"  {icon} {m['name']}")
        print(f"     来源：{m['source']}")
        if m.get("resolved_by"):
            print(f"     补录人：{m['resolved_by']}")

    print(f"\n📋 历史摘要（共 {len(detail['summaries'])} 版）：")
    for s in detail["summaries"]:
        print(f"\n  --- v{s['version']} ---")
        print(f"  留下原因：{s['why_kept']}")
        print(f"  缺材料：{', '.join(s['missing_materials']) or '无'}")
        print(f"  对接人：{s['next_contact']}")

    print(f"\n📜 操作日志（可复盘，共 {len(detail['audit_log'])} 条）：")
    for a in detail["audit_log"]:
        print(f"  [{a['timestamp'][:19]}] {a['operator']:6s} | {a['action']:18s} | {a['detail']}")
    wait()

    section("第八步：复盘记录 - 每一步都有痕迹，可以重新跑")
    wait()
    logs = svc.store.get_audit_log(svc._resolve_cid("TS20260607-001"))
    print(f"\n🔄 投诉 TS20260607-001 复盘记录：")
    print("-" * 60)
    for a in logs:
        print(f"\n[{a['timestamp'][:19]}] {a['action'].upper()}")
        print(f"    操作人：{a['operator']}")
        print(f"    详情：{a['detail']}")
    print("-" * 60)
    print(f"\n💡 重跑命令：")
    print(f"  python3 cli.py --db {DEMO_DB} summary --cid TS20260607-001 --auto")
    wait()

    section("演示完成！")
    print("\n📌 给新人小李的总结：")
    print("   1. 用居民投诉编号就能查所有信息，不用记内部ID")
    print("   2. 同一小区有新旧名字 → 自动标记待市政巡检员复核，不直接归正常")
    print("   3. 原始结论不能直接照抄 → 周姐看过照片后做人工修正")
    print("   4. 给街道的摘要有三要素：为什么留下、缺什么材料、下一步找谁")
    print("   5. 补录任何材料 → 摘要自动更新版本，操作日志留痕")
    print("   6. 首次导入就出完整报告：材料来源、处理状态、结论都在一起")
    print("   7. 所有操作都有日志 → 随时可以复盘和重跑")
    print(f"\n💾 演示数据保存在：{DEMO_DB}")
    print(f"🔄 随时重跑演示：python3 cli.py --db {DEMO_DB} demo")


if __name__ == "__main__":
    main()
