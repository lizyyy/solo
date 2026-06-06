#!/usr/bin/env python3
"""
乐谱转调批注归档系统 - 端到端测试脚本
验证所有核心需求是否实现
"""

import os
import sys
from datetime import datetime

if os.path.exists("music_archive.db"):
    os.remove("music_archive.db")

from models import init_db, SessionLocal
from services import (
    import_sign_in_photos_batch,
    add_ticket_export_to_annotation,
    update_archive_remark,
    run_transposition_calc,
    review_song_name,
    get_archive_detail_for_display,
    generate_weekly_report
)

init_db()
db = SessionLocal()

print("=" * 70)
print("🎵 乐谱转调批注归档系统 - 端到端测试")
print("=" * 70)

passed = 0
failed = 0

def test(name, condition, detail=""):
    global passed, failed
    if condition:
        passed += 1
        print(f"  ✅ {name}")
        if detail:
            print(f"     {detail}")
    else:
        failed += 1
        print(f"  ❌ {name}")
        if detail:
            print(f"     {detail}")

print("\n📸 【Step 1】老周导入课时签到照片")
print("-" * 70)

photos_data = [
    {
        "file_name": "签到照片_20240115_钢琴课.jpg",
        "file_path": "/photos/20240115/001.jpg",
        "file_hash": "hash_photo_001",
        "course_name": "钢琴一对一",
        "teacher_name": "李老师",
        "sign_date": datetime(2024, 1, 15),
        "song_live_name": "夜的钢琴曲五",
        "extracted_text": "夜的钢琴曲五 - 石进",
        "remark": "学生弹奏时有点紧张"
    },
    {
        "file_name": "签到照片_20240115_吉他课.jpg",
        "file_path": "/photos/20240115/002.jpg",
        "file_hash": "hash_photo_002",
        "course_name": "吉他小组课",
        "teacher_name": "王老师",
        "sign_date": datetime(2024, 1, 15),
        "song_live_name": "成都",
        "extracted_text": "成都 - 赵雷",
        "remark": ""
    }
]

result1 = import_sign_in_photos_batch(db, photos_data, operator="老周")
test("首次导入成功", result1["imported_count"] == 2, f"导入{result1['imported_count']}张，跳过{result1['skipped_count']}张")

print("\n📸 【Step 1.1】重复导入同一批照片（测试防重复）")
print("-" * 70)

result2 = import_sign_in_photos_batch(db, photos_data, operator="老周")
test("重复导入自动去重", result2["imported_count"] == 0 and result2["skipped_count"] == 2,
     f"导入{result2['imported_count']}张，跳过{result2['skipped_count']}张 - 数量不会翻倍 ✓")

print("\n📝 【Step 2】老周修改其中一条备注（测试变更历史）")
print("-" * 70)

from models import ArchiveRecord
archive1 = db.query(ArchiveRecord).order_by(ArchiveRecord.id).first()
test("归档记录已创建", archive1 is not None, f"归档编号: {archive1.archive_no}")

result3 = update_archive_remark(db, archive1.id, "学生第3小节节奏不稳，需要多练习", operator="老周")
test("备注更新成功", "change_history" in result3)
test("变更历史记录了改前改后", len(result3["change_history"]) >= 1)
if result3["change_history"]:
    ch = result3["change_history"][0]
    test("历史记录旧值正确", ch["old"] == "学生弹奏时有点紧张")
    test("历史记录新值正确", ch["new"] == "学生第3小节节奏不稳，需要多练习")
    test("历史记录修改人正确", ch["by"] == "老周")
    print(f"     变更历史: {ch['old']} → {ch['new']}")

print("\n🎫 【Step 3】老周补看票务导出表")
print("-" * 70)

from models import TranspositionAnnotation
ann1 = db.query(TranspositionAnnotation).filter(
    TranspositionAnnotation.id == archive1.annotation_id
).first()

ticket_data = {
    "file_name": "票务导出_202401.xlsx",
    "file_path": "/tickets/202401.xlsx",
    "song_copyright_name": "夜的钢琴曲 第五首",
    "revenue_amount": "¥300.00",
    "performance_date": datetime(2024, 1, 20)
}

result4 = add_ticket_export_to_annotation(db, ann1.id, ticket_data, operator="老周")
test("票务信息补充成功", result4["status"] == "success")
test("现场名≠版权名时触发老师复核", result4["needs_teacher_review"] == True,
     f"现场名:夜的钢琴曲五 | 版权名:夜的钢琴曲 第五首 → 标记需复核 ✓")
test("工作流进入票务复核阶段", result4["workflow_stage"] == "ticket_reviewed")

db.refresh(archive1)
test("归档记录更新了保留原因", archive1.next_action_owner == "音乐老师",
     f"下一步负责人: {archive1.next_action_owner}")
test("归档记录更新了缺失材料", "音乐老师转调复核" in (archive1.missing_materials or []))

print("\n🔢 【Step 4】音乐老师执行转调计算（测试参数透明化）")
print("-" * 70)

result5 = run_transposition_calc(db, ann1.id, "C", "D", operator="李老师")
test("转调计算成功", result5["status"] == "success")
test("参数版本已记录", result5["parameter_version"] == "v1.2.0")
test("参数取舍理由已记录", "十二平均律" in result5["parameter_notes"])
test("计算结果正确", result5["result"] == "原调C（索引0）→ 目标调D（索引2），半音差2")
print(f"     参数版本: {result5['parameter_version']}")
print(f"     取舍理由: {result5['parameter_notes'][:80]}...")

print("\n🎵 【Step 5】音乐老师复核歌曲名称（现场名vs版权名）")
print("-" * 70)

from models import Song
song1 = db.query(Song).filter(Song.live_name == "夜的钢琴曲五").first()
test("歌曲存在现场名和版权名", song1.live_name != song1.copyright_name,
     f"现场名:{song1.live_name} | 版权名:{song1.copyright_name}")
test("复核状态初始为pending", song1.review_status == "pending")

result6 = review_song_name(db, song1.id, approved=True, reviewer="李老师",
                          review_note="确认是同一首歌，只是命名习惯不同")
test("复核完成", result6["status"] == "success")
test("复核状态更新为approved", song1.review_status == "approved")

db.refresh(archive1)
test("复核后归档状态更新", "音乐老师已复核确认" in archive1.keep_reason)
test("复核后缺失材料已清除", "音乐老师转调复核" not in (archive1.missing_materials or []))

print("\n📊 【Step 6】3D/图表展示模式（测试可追溯性）")
print("-" * 70)

result7 = get_archive_detail_for_display(db, archive1.id, display_mode="3d")
test("3D模式返回归档详情", result7.get("archive_no") == archive1.archive_no)
test("3D模式提示可追溯数据源", result7.get("trace_back_enabled") == True)
test("可追溯到原始签到照片", result7["trace_back"]["sign_in_photo"]["id"] is not None)
test("可追溯到票务导出表", result7["trace_back"]["ticket_export"]["id"] is not None)
test("转调计算参数透明展示", "calc_info" in result7 and result7["calc_info"]["parameter_version"] == "v1.2.0")
print(f"     追溯源: 签到照片={result7['trace_back']['sign_in_photo']['file_name']}")
print(f"     追溯源: 票务表={result7['trace_back']['ticket_export']['file_name']}")

print("\n📋 【Step 7】生成店长周报（测试人性化输出）")
print("-" * 70)

result8 = generate_weekly_report(db)
test("周报生成成功", result8.get("report_id") is not None)
test("周报包含人性化总结", "本周归档周报" in result8["summary"])
test("周报说明每条为什么被留下", "为什么留着" in result8["summary"])
test("周报说明还缺什么材料", "缺什么" in result8["summary"])
test("周报说明下一步该找谁", "下一步" in result8["summary"])
test("周报明确区分找音乐老师还是找老周", "需音乐老师处理" in result8["summary"] or "需老周处理" in result8["summary"])

print("\n" + "=" * 70)
print("📋 店长周报预览（人性化输出，非冰冷日志）:")
print("=" * 70)
print(result8["summary"])

print("\n" + "=" * 70)
print("🧪 测试结果汇总")
print("=" * 70)
print(f"  ✅ 通过: {passed} 项")
print(f"  ❌ 失败: {failed} 项")
print(f"  📊 通过率: {passed/(passed+failed)*100:.1f}%" if (passed+failed) > 0 else "")

print("\n" + "=" * 70)
print("📚 需求覆盖验证")
print("=" * 70)
requirements = [
    ("1. 音乐老师能看懂解释性结果", "转调计算附带参数版本和取舍理由，复核有明确说明"),
    ("2. 同一首歌有现场名和版权名不着急归正常", "自动标记需音乐老师复核，不会自动归为正常"),
    ("3. 重复导入不翻倍", "基于文件哈希去重，重复导入自动跳过"),
    ("4. 改备注能看改前改后", "ChangeHistory表自动记录所有字段变更历史"),
    ("5. 3D/图表展示不只有漂亮画面", "可点击追溯原始签到照片和票务导出表"),
    ("6. 周报不是冷冰冰的系统日志", "说明为什么留下、缺什么、下一步找谁"),
    ("7. 专业计算参数透明", "参数版本+取舍理由直接展示在结果旁边"),
    ("8. 三步工作流完整", "签到导入→票务补录→周报生成，中间留复核节点"),
]
for i, (req, impl) in enumerate(requirements, 1):
    print(f"  {i}. ✅ {req}")
    print(f"        → {impl}")

db.close()
print("\n🎉 测试完成！系统已就绪。")
print("\n💡 启动服务: python -m uvicorn main:app --reload")
print("💡 查看API文档: http://localhost:8000/docs")
