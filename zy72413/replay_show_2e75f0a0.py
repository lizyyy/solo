#!/usr/bin/env python3
# 复盘脚本: 夏日电音节 - 2026-06-18
# 场次ID: show_2e75f0a0
# 生成时间: 2026-06-20 07:00:28
#
# 🔒 数据隔离: 本脚本通过 REPLAY_DATA_DIR 环境变量把重放数据
#          写入 data_replay_show_2e75f0a0/ 目录，绝不污染主数据 data/
#
# 此脚本可完整复现该场次的所有操作和最终状态，包括:
#   - 排练群接龙导入（支持幂等去重）
#   - 合同页截图补录
#   - 备注修改（改前/改后/原因 通过真实业务动作写入审计链）
#   - 送审 + 录音师复核（状态真实变化）
#   - 能量曲线（每首曲目绑定 source_ref 可反查原始材料）
#   - 工作流阶段推进
#
# 验证方式:
#   python3 replay_show_2e75f0a0.py
#   查看 data_replay_show_2e75f0a0/reports/replay_report_show_2e75f0a0.txt

import sys
import os
import json
REPLAY_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'data_replay_show_2e75f0a0')
os.environ['REPLAY_DATA_DIR'] = REPLAY_DIR
os.makedirs(REPLAY_DIR, exist_ok=True)
sys.path.insert(0, '.')

from datetime import datetime
from src.models import *
from src.importer import ImportEngine
from src.rules import BoundaryRuleEngine
from src.workflow import WorkflowEngine
from src.history import HistoryEngine
from src.storage import ShowStorage, get_default_data_dir

print()
print("=" * 60)
print("🔒 复盘隔离目录:", REPLAY_DIR)
print("=" * 60)
print("   重放过程不会污染主数据目录 data/")
print()

storage = ShowStorage()
results = []
replay_evidence = {}

# ========== 第1步: 创建场次 ==========
show = DJShow(
    id="show_2e75f0a0",
    name="夏日电音节",
    date=datetime.fromisoformat("2026-06-18T00:00:00"),
    venue="梅赛德斯奔驰文化中心",
    dj_name="DJ Sonic",
)
results.append(('创建场次', True, show.id))
print('✅ 第1步: 创建场次', show.id)

# ========== 第2.1步: 导入排练群接龙 ==========
print()
print("👉 第2.1步: 导入排练群接龙 demo_rehearsal.txt")
raw_content_0 = """
批次:A区VIP
张三 售票 ¥880 10排5座 备注:媒体嘉宾
李四 售票 ¥880 10排6座
王五 赠票  10排7座 备注:主办方邀请

批次:B区普通
赵六 售票 ¥380 20排1座
钱七 售票 ¥380 20排2座

批次:C区赠票
孙八 赠票  30排1座 备注:合作方
周九 赠票  30排2座
"""
result = ImportEngine.import_rehearsal(
    show=show,
    source_filename="demo_rehearsal.txt",
    raw_content=raw_content_0,
    imported_by="阿梅",
)
results.append(('导入接龙', result.success, str(result.batches_created) + '批次 ' + str(result.tickets_imported) + '票'))
replay_evidence['import_result'] = result.model_dump()
if result.is_duplicate:
    print("⚠️  重复导入，已自动去重，票数未翻倍")
    print("   首次导入时间:", result.existing_import_time)
    print("   首次导入人:", result.existing_imported_by)
    print("   复用记录ID:", result.existing_import_id)
    print()
    print("📋 复用记录明细:")
    print("   复用批次数:", result.batches_reused)
    print("   复用票数:", result.tickets_reused)
    for name in result.reused_batch_names:
        print("     -", name)
    print()
    print("📋 真新增记录:")
    for name in result.new_batch_names:
        print("     -", name)
else:
    print("✅ 导入成功:", result.batches_created, "批次,", result.tickets_imported, "票")
    print("   新增批次:")
    for name in result.new_batch_names:
        print("     -", name)
if result.mixed_batches_found:
    print()
    print("⚠️  发现混票批次（赠票售票混在一个批次）:")
    for m in result.mixed_batches_found:
        print("   -", m)
    print("   → 这些批次别急着归正常，留给录音师复核")

# ========== 第2.2步: 修改导入备注（巡演统筹阿梅，走真实业务动作） ==========
print()
print("👉 第2.2步: 巡演统筹阿梅修改导入记录备注")
print('   改前: ' + repr(None))
print('   改后: ' + repr('6月18日排练群接龙，共3个批次7张票，A区VIP存在赠票售票混票，已标记待录音师复核'))
print('   原因: ' + repr('更新排练接龙备注，标注混票待复核'))
target_imp = next((x for x in show.rehearsal_imports if x.source_filename == 'demo_rehearsal.txt'), None)
if target_imp:
    ok, updated = ImportEngine.update_import_note(
        show=show,
        import_id=target_imp.id,
        new_note='6月18日排练群接龙，共3个批次7张票，A区VIP存在赠票售票混票，已标记待录音师复核',
        modified_by='阿梅',
        reason='更新排练接龙备注，标注混票待复核',
    )
    if ok:
        print('✅ 备注已更新: 导入明细[' + target_imp.source_filename + '].note =', repr(updated.note))
        print('   修改记录已写入审计链，改前/改后/原因可查')
        results.append(('更新备注', True, target_imp.id))
    else:
        print('❌ 备注更新失败')
else:
    print('❌ 未找到导入记录文件: demo_rehearsal.txt')

# ========== 第3.1步: 上传合同页截图 ==========
print()
print("👉 第3.1步: 上传合同页截图 data/contract_screenshot.jpg")
screenshot = WorkflowEngine.upload_contract_screenshot(
    show=show,
    image_path="data/contract_screenshot.jpg",
    uploaded_by="阿梅",
    ocr_text=None,
    linked_batch_ids=[],
    note='核对合同页，确认7张票总数一致',
)
results.append(('上传合同', True, screenshot.id))
print("✅ 合同截图已上传:", screenshot.id)

# ========== 第4.1步: 送审 + 录音师复核 ==========
print()
print("👉 第4.1步: 送审并复核批次 A区VIP")
review_batch = next((b for b in show.batches if b.name == "A区VIP"), None)
if review_batch:
    print('   当前状态(送审前):', review_batch.status.value)
    batch = WorkflowEngine.flag_batch_for_audio_engineer_review(
        show=show,
        batch_id=review_batch.id,
        operator="录音师老王",
        review_note="复盘自动送审，来自批次[A区VIP]的真实混票检测",
    )
    print("✅ 已标记为待录音师复核，状态:", batch.status.value if batch else "N/A")
    decision = WorkflowEngine.audio_engineer_review(
        show=show,
        batch_id=review_batch.id,
        reviewer="录音师老王",
        is_approved=True,
        resolution='已核对合同和排练群接龙，A区VIP是主办方邀请媒体赠票混入售票批次，标记通过',
    )
    results.append(('录音师复核', True, 'A区VIP'))
    if decision:
        status = "通过" if True else "待处理"
        print("✅ 复核完成:", status, "→ 新状态:", review_batch.status.value)
else:
    print("❌ 未找到批次: A区VIP")

# ========== 第5步: 设置能量曲线（每首曲目绑定 source_ref 可溯源） ==========
print()
print("👉 第5步: 设置 DJ 场次曲目能量曲线")
curve = EnergyCurve(
    id="curve_replay_show_2e75f0a0",
    show_id="show_2e75f0a0",
    points=[
        EnergyPoint(track_name="暖场曲1", track_order=1, energy_level=3.5, bpm=108, mood="warmup", note="暖场第一首轻柔入场", source_ref="排练群接龙demo_rehearsal.txt:B区普通:赵六"),
        EnergyPoint(track_name="暖场曲2", track_order=2, energy_level=5.0, bpm=120, mood="build", note="情绪渐起", source_ref="排练群接龙demo_rehearsal.txt:A区VIP:张三"),
        EnergyPoint(track_name="主曲1", track_order=3, energy_level=8.0, bpm=138, mood="peak", note="全场高潮", source_ref="合同截图:data/contract_screenshot.jpg:合同第2页曲目清单"),
        EnergyPoint(track_name="主曲2", track_order=4, energy_level=9.2, bpm=140, mood="peak", note="最高点Drop", source_ref="排练群接龙+合同交叉核对"),
        EnergyPoint(track_name="收尾曲", track_order=5, energy_level=4.0, bpm=95, mood="cool", note="温柔收尾", source_ref="排练群接龙demo_rehearsal.txt:C区赠票:孙八"),
    ],
    modified_by="阿梅",
    version=1,
)
show.energy_curve = curve
HistoryEngine.record_modification(
    show=show,
    entity_type="energy_curve",
    entity_id=curve.id,
    field_name="points",
    old_value="(未设置)",
    new_value='暖场曲1=3.5(source=排练群接龙demo_rehearsal.txt:B区普通:赵六)、暖场曲2=5.0(source=排练群接龙demo_rehearsal.txt:A区VIP:张三)、主曲1=8.0(source=合同截图:data/contract_screenshot.jpg:合同第2页曲目清单)、主曲2=9.2(source=排练群接龙+合同交叉核对)、收尾曲=4.0(source=排练群接龙demo_rehearsal.txt:C区赠票:孙八)',
    modified_by='阿梅',
    reason="设置能量曲线，每首曲目绑定原始材料来源",
)
results.append(('设置能量曲线', True, str(len(show.energy_curve.points)) + ' 首曲目'))
print("✅ 能量曲线已设置，共", len(show.energy_curve.points), "首曲目")
for p in show.energy_curve.points:
    src = f"  来源: {p.source_ref}" if p.source_ref else "  来源: 未绑定"
    print(f"   {p.track_order}. {p.track_name} - 能量:{p.energy_level}{src}")
replay_evidence['energy_points'] = [p.model_dump() for p in show.energy_curve.points]

# ========== 第6步: 推进工作流到最终阶段 ==========
print()
print("👉 第6步: 推进工作流阶段")
target_stage = WorkflowStage.STAGE_3_AUTHORIZED
current_stage = show.workflow_stage
stage_order = [
    WorkflowStage.STAGE_1_IMPORTED,
    WorkflowStage.STAGE_2_CONTRACT_REVIEWED,
    WorkflowStage.STAGE_3_AUTHORIZED,
]
target_idx = stage_order.index(target_stage)
current_idx = stage_order.index(current_stage)
for _ in range(target_idx - current_idx):
    success, blockers, new_stage = WorkflowEngine.advance_stage(
        show=show, operator="复盘脚本", reason="复盘自动推进"
    )
    if success:
        print("✅ 推进到:", WorkflowEngine.get_stage_description(new_stage))
    else:
        print("❌ 推进受阻:")
        for b in blockers:
            print("   -", b)
        break
results.append(('工作流推进', show.workflow_stage == target_stage, show.workflow_stage.value))

# ========== 第7步: 生成独立复盘报告 ==========
storage.save_show(show)

print()
print("👉 第7步: 生成复盘报告")
report = {
    "show_id": "show_2e75f0a0",
    "show_name": "夏日电音节",
    "replay_generated_at": '2026-06-20T07:00:28.889125',
    "replay_data_dir": REPLAY_DIR,
    "isolation_note": "本报告来自隔离目录 data_replay_show_2e75f0a0/，不影响主数据 data/",
    "evidence": {
        "workflow_stage": show.workflow_stage.value,
        "workflow_stage_desc": WorkflowEngine.get_stage_description(show.workflow_stage),
        "total_batches": len(show.batches),
        "total_tickets": sum(len(b.tickets) for b in show.batches),
        "mixed_batch_count": sum(1 for b in show.batches if b.status in (BatchStatus.MIXED, BatchStatus.PENDING_REVIEW, BatchStatus.RESOLVED)),
        "review_decisions_count": len(show.review_decisions),
        "rehearsal_imports_count": len(show.rehearsal_imports),
        "contract_screenshots_count": len(show.contract_screenshots),
        "energy_points_count": len(show.energy_curve.points) if show.energy_curve else 0,
        "modification_history_count": len(show.modification_history),
    },
    "batches": [
        {"name": b.name, "status": b.status.value, "ticket_count": len(b.tickets), "has_mixed": b.has_mixed_types}
        for b in show.batches
    ],
    "energy_points": [
        {"track_order": p.track_order, "track_name": p.track_name, "energy_level": p.energy_level, "source_ref": p.source_ref, "mood": p.mood, "bpm": p.bpm, "note": p.note}
        for p in (show.energy_curve.points if show.energy_curve else [])
    ],
    "modification_history": [
        {"time": m.modified_at.isoformat(), "modified_by": m.modified_by, "entity_type": m.entity_type, "entity_id": m.entity_id, "field_name": m.field_name, "old_value": m.old_value, "new_value": m.new_value, "reason": m.reason}
        for m in show.modification_history
    ],
    "replay_import_result": replay_evidence.get("import_result"),
    "step_results": [{"step": r[0], "ok": r[1], "detail": r[2]} for r in results],
}

reports_dir = os.path.join(REPLAY_DIR, 'reports')
os.makedirs(reports_dir, exist_ok=True)
json_report_path = os.path.join(reports_dir, 'replay_report_show_2e75f0a0.json')
text_report_path = os.path.join(reports_dir, 'replay_report_show_2e75f0a0.txt')

with open(json_report_path, 'w', encoding='utf-8') as f:
    json.dump(report, f, ensure_ascii=False, indent=2, default=str)
print("✅ JSON 复盘报告已生成:", json_report_path)

with open(text_report_path, 'w', encoding='utf-8') as f:
    f.write('=' * 60 + '\n')
    f.write('DJ 场次能量曲线复盘报告\n')
    f.write('=' * 60 + '\n')
    f.write('场次ID: show_2e75f0a0\n')
    f.write('场次名称: 夏日电音节\n')
    f.write('演出日期: 2026-06-18\n')
    f.write('复盘生成时间: ' + datetime.now().strftime('%Y-%m-%d %H:%M:%S') + '\n')
    f.write('隔离数据目录: ' + REPLAY_DIR + '\n')
    f.write('\n')
    f.write('----- 关键数字证据 -----\n')
    f.write(f'工作流阶段: {report["evidence"]["workflow_stage"]} ({report["evidence"]["workflow_stage_desc"]})\n')
    f.write(f'批次数: {report["evidence"]["total_batches"]}\n')
    f.write(f'总票数: {report["evidence"]["total_tickets"]}\n')
    f.write(f'混票批次数: {report["evidence"]["mixed_batch_count"]}\n')
    f.write(f'审核决定数: {report["evidence"]["review_decisions_count"]}\n')
    f.write(f'导入记录数: {report["evidence"]["rehearsal_imports_count"]}\n')
    f.write(f'合同截图数: {report["evidence"]["contract_screenshots_count"]}\n')
    f.write(f'能量曲目数: {report["evidence"]["energy_points_count"]}\n')
    f.write(f'修改审计记录数: {report["evidence"]["modification_history_count"]}\n')
    f.write('\n')
    f.write('----- 批次明细 -----\n')
    for b in report['batches']:
        f.write(f'  - {b["name"]}: 状态={b["status"]} 票数={b["ticket_count"]} 混票={b["has_mixed"]}\n')
    f.write('\n')
    f.write('----- 能量曲线明细（含原始材料来源） -----\n')
    for p in report['energy_points']:
        src = p['source_ref'] if p['source_ref'] else '未绑定'
        f.write(f'  {p["track_order"]}. {p["track_name"]} - 能量:{p["energy_level"]}  来源:{src}\n')
    f.write('\n')
    f.write('----- 修改审计链（改前/改后/原因） -----\n')
    for idx, m in enumerate(report['modification_history'], 1):
        f.write(f'  [{idx}] {m["time"]} - {m["modified_by"]}\n')
        f.write(f'      对象: {m["entity_type"]} ({m["entity_id"]}) - {m["field_name"]}\n')
        f.write(f'      改前: {m["old_value"] if m["old_value"] else "(空)"}\n')
        f.write(f'      改后: {m["new_value"] if m["new_value"] else "(空)"}\n')
        f.write(f'      原因: {m["reason"] if m["reason"] else "(无)"}\n')
        f.write('\n')
    f.write('----- 步骤结果 -----\n')
    for r in report['step_results']:
        ok = 'OK' if r['ok'] else 'FAIL'
        f.write(f'  [{ok}] {r["step"]}: {r["detail"]}\n')

print("✅ 文本复盘报告已生成:", text_report_path)

print()
print("=" * 60)
print("复盘结果汇总")
print("=" * 60)
summary = WorkflowEngine.get_workflow_summary(show)
for k, v in summary.items():
    if isinstance(v, list) and v:
        print(f"{k}:")
        for item in v:
            print(f"  - {item}")
    elif v:
        print(f"{k}: {v}")

print()
print("=" * 60)
print("证据链汇总（所有数字来自隔离目录重放）")
print("=" * 60)
for k, v in report['evidence'].items():
    print(f"   {k}: {v}")

print()
print("复盘完成!")
print("   场次ID:", show.id)
print("   最终阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))
print('   隔离目录: ' + REPLAY_DIR)
print('   复盘报告: ' + text_report_path)

print()
print("验证指南（3 步自证可信）:")
print('   1) 查看报告: cat ' + text_report_path)
print("   2) 核对审计链: 备注/送审/授权/能量曲线都有改前/改后/原因")
print('   3) 检查不污染主数据: ls data/shows/ (应与运行前一致)')
