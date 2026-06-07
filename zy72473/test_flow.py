#!/usr/bin/env python3
"""自动化测试：验证完整流程"""
import os
import sys
import json

sys.path.insert(0, os.path.dirname(__file__))
from models import DataStore
from service import MarketLoadingService

TEST_DB = "data/test_store.json"


def test_full_flow():
    if os.path.exists(TEST_DB):
        os.remove(TEST_DB)

    svc = MarketLoadingService(DataStore(TEST_DB))
    errors = []

    print("🧪 测试 1: 注册小区新旧名称映射")
    svc.register_community_alias("阳光花园", "阳光佳苑")
    alias = svc.store.check_alias("阳光花园")
    assert alias and alias["old_name"] == "阳光花园", "别名注册失败"
    assert not alias["confirmed"], "别名初始状态不应确认"
    print("   ✅ 通过")

    print("\n🧪 测试 2: 导入投诉（含旧小区名，应触发待复核）")
    c, note = svc.import_complaint(
        complaint_no="TS20260607-001",
        community_name="阳光花园",
        content="农贸市场北入口凌晨装卸货噪音大",
        raw_conclusion="系统自动判定：正常时段，投诉不成立",
        operator="小李"
    )
    cid = c.id
    assert c.need_review == True, "应标记待复核"
    assert "市政巡检员复核" in c.review_note, "复核提示缺失"
    assert c.status == "need_muni_review", "状态应为 need_muni_review"
    assert note and "新旧名称映射" in note, "导入提示缺失"
    print(f"   ✅ 通过，投诉ID: {cid}")
    print(f"   ℹ️  {note}")

    print("\n🧪 测试 3: 补录路口照片")
    photo = svc.add_road_photo(cid, "路口照片_20260607.jpg", "周姐")
    c_after = svc.store.get_complaint(cid)
    assert c_after["has_photo"] == True, "照片标记失败"
    print("   ✅ 通过")

    print("\n🧪 测试 4: 自动生成第一次给街道的摘要")
    s1 = svc.rerun_summary(cid)
    assert s1.version == 1, "第一版摘要版本号不对"
    assert s1.next_contact == "市政巡检员", "有别名时对接人应为市政巡检员"
    assert "照片已补" in s1.why_kept or "新旧名称" in s1.why_kept, "摘要原因缺失"
    print(f"   ✅ 通过，摘要 v{s1.version}")
    print(f"   留下原因：{s1.why_kept}")
    print(f"   缺材料：{s1.missing_materials}")
    print(f"   对接人：{s1.next_contact}")

    print("\n🧪 测试 5: 人工修正原始结论")
    svc.manual_correct(
        cid,
        field="raw_conclusion",
        old_val="系统自动判定：正常时段，投诉不成立",
        new_val="系统自动判定：正常时段，投诉不成立（已人工修正：实际时段不在规定范围内）",
        operator="周姐"
    )
    c_corrected = svc.store.get_complaint(cid)
    assert "已人工修正" in c_corrected["raw_conclusion"], "人工修正未生效"
    print("   ✅ 通过")

    print("\n🧪 测试 6: 重跑摘要（补录照片后应更新）")
    s2 = svc.rerun_summary(cid)
    assert s2.version == 2, "第二版摘要版本号不对"
    summaries = svc.store.get_summaries(cid)
    assert len(summaries) == 2, "应该有两个版本的摘要"
    print(f"   ✅ 通过，摘要 v{s2.version}")

    print("\n🧪 测试 7: 街道摘要文本格式正确")
    summary_text = svc.get_street_summary_text(cid)
    assert "为什么这条被留下" in summary_text, "摘要文本缺少关键信息"
    assert "还缺什么材料" in summary_text, "摘要文本缺少关键信息"
    assert "下一步该找谁" in summary_text, "摘要文本缺少关键信息"
    print("   ✅ 通过")
    print("\n" + summary_text)

    print("\n🧪 测试 8: 操作日志完整可复盘")
    logs = svc.store.get_audit_log(cid)
    actions = [l["action"] for l in logs]
    assert "import" in actions, "缺少导入日志"
    assert "add_photo" in actions, "缺少补照片日志"
    assert "manual_correct" in actions, "缺少人工修正日志"
    assert "rerun_summary" in actions, "缺少重跑日志"
    print(f"   ✅ 通过，共 {len(logs)} 条操作记录")
    for l in logs:
        print(f"   - {l['action']}: {l['detail']}")

    print("\n🧪 测试 9: 确认小区别名（市政巡检员操作）")
    svc.confirm_alias("阳光花园", "阳光佳苑", "市政巡检员")
    alias2 = svc.store.check_alias("阳光花园")
    assert alias2 is None, "确认后不应再触发待复核"
    print("   ✅ 通过")

    print("\n🧪 测试 10: 别名确认后导入新投诉（同一小区名不再触发复核）")
    c2, note2 = svc.import_complaint(
        complaint_no="TS20260607-002",
        community_name="阳光花园",
        content="另一条投诉",
        raw_conclusion="测试",
        operator="小李"
    )
    assert c2.need_review == False, "别名确认后不应再标记待复核"
    assert c2.status == "imported", "状态应为 imported"
    print("   ✅ 通过")

    print("\n" + "=" * 60)
    print("🎉 所有测试通过！完整流程验证完毕。")
    print(f"📊 测试数据位置：{TEST_DB}")
    print("=" * 60)

    return 0


if __name__ == "__main__":
    sys.exit(test_full_flow())
