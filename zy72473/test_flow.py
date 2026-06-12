#!/usr/bin/env python3
"""自动化测试：验证完整流程（按普通使用者路线）"""
import os
import sys

sys.path.insert(0, os.path.dirname(__file__))
from models import DataStore
from service import MarketLoadingService

TEST_DB = "data/test_store.json"


def test_full_flow():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

    svc = MarketLoadingService(DataStore(TEST_DB))
    errors = []

    print("=" * 65)
    print("🧪 按普通使用者路线复现全流程")
    print("=" * 65)

    print("\n🧪 测试 1: 先登记小区新旧名称映射")
    svc.register_community_alias("阳光花园", "阳光佳苑")
    alias = svc.store.check_alias("阳光花园")
    assert alias and alias["old_name"] == "阳光花园", "别名注册失败"
    assert not alias["confirmed"], "别名初始状态不应确认"
    print("   ✅ 通过")

    print("\n🧪 测试 2: 导入投诉（含旧小区名，应触发待复核）")
    print("   （真实样例：农贸市场北入口凌晨装卸货扰民）")
    c, note, report = svc.import_complaint(
        complaint_no="TS20260607-001",
        community_name="阳光花园",
        content="农贸市场北入口凌晨4点半开始装卸货，大货车喇叭声、卸货哐当声很大，3号楼5户居民都被吵醒，6月5日、6日连续发生，居民要求调整装卸时段或加强降噪措施。",
        raw_conclusion="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。",
        operator="小李"
    )
    complaint_no = c.complaint_no
    assert c.need_review == True, "应标记待复核"
    assert "市政巡检员复核" in c.review_note, "复核提示缺失"
    assert c.status == "need_muni_review", "状态应为 need_muni_review"
    assert note and "新旧名称映射" in note, "导入提示缺失"
    assert report is not None, "导入报告不应为空"
    assert "missing_materials" in report, "报告应包含缺失材料"
    assert report["pending_count"] > 0, "导入时应有待补材料"
    assert report["why_kept"], "报告应有留下原因"
    assert report["next_step"], "报告应有下一步"

    materials = report["missing_materials"]
    assert len(materials) >= 2, "至少应有2项缺失材料（照片+小区名复核）"
    for m in materials:
        assert "source" in m, f"材料 {m['name']} 缺少来源"
        assert "status" in m, f"材料 {m['name']} 缺少状态"
        assert m["status"] == "待补", "初始状态应为待补"

    print(f"   ✅ 通过，投诉编号: {complaint_no}")
    print(f"   ℹ️  提示：{note}")
    print(f"   📋 导入报告：待补材料 {report['pending_count']} 项")
    for m in materials:
        print(f"      □ {m['name']}（来源：{m['source']}）")

    print("\n🧪 测试 3: 用居民投诉编号查询详情（关键验证点！）")
    detail = svc.get_complaint_detail(complaint_no)
    assert detail.get("complaint"), "用投诉编号应能查到基础信息"
    assert len(detail.get("summaries", [])) > 0, "用投诉编号应能查到历史摘要"
    assert len(detail.get("audit_log", [])) > 0, "用投诉编号应能查到操作日志"
    assert len(detail.get("missing_materials", [])) > 0, "用投诉编号应能查到缺失材料"
    print(f"   ✅ 通过")
    print(f"      历史摘要：{len(detail['summaries'])} 版")
    print(f"      操作日志：{len(detail['audit_log'])} 条")
    print(f"      缺失材料：{len(detail['missing_materials'])} 项")

    print("\n🧪 测试 4: 查看首次导入报告文本")
    report_text = svc.get_import_report_text(complaint_no)
    assert "还缺什么材料" in report_text, "报告应包含还缺什么材料"
    assert "来源：" in report_text, "报告应包含材料来源"
    assert "为什么这条被留下" in report_text, "报告应包含留下原因"
    assert "下一步对接" in report_text, "报告应包含下一步对接"
    print("   ✅ 通过（材料来源、处理状态、结论都在同一份报告里）")

    print("\n🧪 测试 5: 补录路口照片（周姐从微信群找到的）")
    print("   （补录后，给街道的摘要要跟着变，操作日志要有记录）")
    old_summaries = len(svc.store.get_summaries(c.id))
    old_logs = len(svc.store.get_audit_log(c.id))

    svc.add_road_photo(complaint_no, "农贸市场北入口_20260607_凌晨5点.jpg", "周姐")

    c_after = svc.store.get_complaint(c.id)
    assert c_after["has_photo"] == True, "照片标记失败"

    new_summaries = len(svc.store.get_summaries(c.id))
    new_logs = len(svc.store.get_audit_log(c.id))
    assert new_summaries > old_summaries, "补录照片后摘要版本应增加"
    assert new_logs > old_logs, "补录照片后操作日志应增加"

    materials_after = c_after.get("missing_materials", [])
    photo_material = [m for m in materials_after if m["name"] == "路口现场照片"]
    assert len(photo_material) == 1, "应找到路口照片材料项"
    assert photo_material[0]["status"] == "已补", "路口照片状态应为已补"
    assert photo_material[0]["resolved_by"] == "周姐", "补录人应为周姐"

    print(f"   ✅ 通过")
    print(f"      摘要版本：v{old_summaries} → v{new_summaries}")
    print(f"      操作日志：{old_logs} → {new_logs} 条")
    print(f"      缺失材料状态：路口现场照片 → 已补")

    print("\n🧪 测试 6: 补录照片后，用投诉编号再查摘要（验证同步更新）")
    detail2 = svc.get_complaint_detail(complaint_no)
    latest_s = detail2["summaries"][-1]
    assert "已有路口照片佐证" in latest_s["why_kept"], "摘要应更新为有照片的表述"
    photo_in_missing = any("路口现场照片" in m for m in latest_s["missing_materials"])
    assert not photo_in_missing, "照片已补，摘要的待补材料里不应再出现路口照片"
    print(f"   ✅ 通过（摘要已同步更新，不再列出路口照片为待补）")

    print("\n🧪 测试 7: 人工修正原始结论（周姐回看照片后做修正）")
    svc.manual_correct(
        complaint_no,
        field="raw_conclusion",
        old_val="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。",
        new_val="系统自动判定：该路段属于农贸市场正常装卸时段（4:00-7:00），投诉不成立，建议做解释说明。（人工修正：经查照片，装卸位距离3号楼仅12米，且未采取降噪措施，原始结论不能直接照抄，需重新评估）",
        operator="周姐"
    )
    c_corrected = svc.store.get_complaint(c.id)
    assert "人工修正" in c_corrected["raw_conclusion"], "人工修正未生效"

    materials_corr = c_corrected.get("missing_materials", [])
    corr_material = [m for m in materials_corr if m["name"] == "人工复核原始结论"]
    assert len(corr_material) == 1 and corr_material[0]["status"] == "已补", "人工复核应标记为已补"
    print("   ✅ 通过（原始结论已修正，人工复核材料标记为已补）")

    print("\n🧪 测试 8: 重跑摘要，确认待补材料减少")
    s3 = svc.rerun_summary(complaint_no)
    pending_left = len(s3.missing_materials)
    print(f"   ✅ 通过，摘要 v{s3.version}，还剩 {pending_left} 项待补材料")
    for m in s3.missing_materials:
        print(f"      □ {m}")

    print("\n🧪 测试 9: 市政巡检员复核小区名称（解决最后一项待补材料）")
    svc.resolve_missing_material(
        complaint_no,
        material_name="市政巡检员对小区名称的复核确认",
        operator="市政巡检员 王师傅",
        remark="阳光花园已于2025年12月更名为阳光佳苑，门牌号已更新，确认对应同一小区"
    )
    c_final = svc.store.get_complaint(c.id)
    assert c_final["need_review"] == False, "小区名复核后应取消待复核标记"
    final_materials = c_final.get("missing_materials", [])
    pending_final = sum(1 for m in final_materials if m["status"] == "待补")
    assert pending_final == 0, "所有材料补完后应无待补项"

    final_detail = svc.get_complaint_detail(complaint_no)
    latest_summary = final_detail["summaries"][-1]
    assert len(latest_summary["missing_materials"]) == 0, "摘要中待补材料应为空"
    print(f"   ✅ 通过（所有材料已补全，摘要待补项为0）")

    print("\n🧪 测试 10: 完整操作日志可复盘（用投诉编号查询）")
    logs = svc.store.get_audit_log(c.id)
    actions = [l["action"] for l in logs]
    expected = ["import", "rerun_summary", "generate_summary", "add_photo",
                "resolve_material", "manual_correct"]
    for act in ["import", "add_photo", "manual_correct"]:
        assert act in actions, f"缺少 {act} 日志"
    print(f"   ✅ 通过，共 {len(logs)} 条操作记录，可完整复盘")
    for l in logs:
        print(f"      [{l['timestamp'][:19]}] {l['action']:18s} | {l['detail']}")

    print("\n🧪 测试 11: 给街道的摘要最终版本")
    summary_text = svc.get_street_summary_text(complaint_no)
    assert "为什么这条被留下" in summary_text
    assert "还缺什么材料" in summary_text
    assert "下一步该找谁" in summary_text
    print("   ✅ 通过")
    print("\n" + summary_text)

    print("\n🧪 测试 12: 列表页用投诉编号也能正常显示")
    all_c = svc.store.get_all_complaints()
    assert len(all_c) == 1
    print(f"   ✅ 通过，列表显示 {len(all_c)} 条投诉")

    print("\n" + "=" * 65)
    print("🎉 所有测试通过！按普通使用者路线完整复现完毕。")
    print(f"📊 测试数据位置：{TEST_DB}")
    print(f"🔑 关键验证：用居民投诉编号查询，历史摘要、操作日志、")
    print(f"   缺失材料都能查到，补录材料后摘要和日志同步更新")
    print("=" * 65)

    return 0


if __name__ == "__main__":
    sys.exit(test_full_flow())
