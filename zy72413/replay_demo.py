#!/usr/bin/env python3
# 复盘脚本: 夏日电音节 - 2026-07-15
# 生成时间: 2026-06-12 08:12:36
# 此脚本可完整复现该场次的所有操作和最终状态
# 运行后可得到与原场次一致的: 批次、票数、能量曲线、工作流阶段、审核记录

import sys
sys.path.insert(0, '.')

from datetime import datetime
from src.models import *
from src.importer import ImportEngine
from src.rules import BoundaryRuleEngine
from src.workflow import WorkflowEngine
from src.history import HistoryEngine
from src.storage import ShowStorage

storage = ShowStorage()
results = []

# ========== 第1步: 创建场次 ==========
show = DJShow(
    id="show_7ac8a217",
    name="夏日电音节",
    date=datetime.fromisoformat("2026-07-15T00:00:00"),
    venue="上海体育馆",
    dj_name="DJ MAX",
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

# ========== 第3.1步: 上传合同页截图 ==========
print()
print("👉 第3.1步: 上传合同页截图 data/contract_screenshot.jpg")
screenshot = WorkflowEngine.upload_contract_screenshot(
    show=show,
    image_path="data/contract_screenshot.jpg",
    uploaded_by="阿梅",
    ocr_text=None,
    linked_batch_ids=[],
    note='合同页第一页',
)
results.append(('上传合同', True, screenshot.id))
print("✅ 合同截图已上传:", screenshot.id)

# ========== 第4.1步: 送审 + 录音师复核 ==========
print()
print("👉 第4.1步: 送审并复核批次 A区VIP")
review_batch = next((b for b in show.batches if b.name == "A区VIP"), None)
if review_batch:
    batch = WorkflowEngine.flag_batch_for_audio_engineer_review(
        show=show,
        batch_id=review_batch.id,
        operator="复盘脚本",
        review_note="复盘自动送审",
    )
    print("✅ 已标记为待录音师复核")
    decision = WorkflowEngine.audio_engineer_review(
        show=show,
        batch_id=review_batch.id,
        reviewer="录音师老王",
        is_approved=True,
        resolution='已确认，没问题',
    )
    results.append(('录音师复核', True, 'A区VIP'))
    if decision:
        status = "通过" if True else "待处理"
        print("✅ 复核完成:", status)
else:
    print("❌ 未找到批次: A区VIP")

# ========== 第5步: 设置能量曲线 ==========
print()
print("👉 第5步: 设置 DJ 场次曲目能量曲线")
curve = EnergyCurve(
    id="curve_replay_show_7ac8a217",
    show_id="show_7ac8a217",
    points=[
        EnergyPoint(track_name="暖场曲1", track_order=1, energy_level=3.5),
        EnergyPoint(track_name="暖场曲2", track_order=2, energy_level=5.0),
        EnergyPoint(track_name="主场曲1", track_order=3, energy_level=8.5),
        EnergyPoint(track_name="主场曲2", track_order=4, energy_level=9.0),
        EnergyPoint(track_name="收尾曲", track_order=5, energy_level=6.0),
    ],
    modified_by="阿梅",
    version=1,
)
show.energy_curve = curve
results.append(('设置能量曲线', True, str(len(show.energy_curve.points)) + ' 首曲目'))
print("✅ 能量曲线已设置，共", len(show.energy_curve.points), "首曲目")

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

# ========== 修改记录审计 ==========
# 以下是该场次发生的所有修改，供复盘时核对
# 共 4 条修改记录:
# [1] 2026-06-12 08:06:45.312950 - 阿梅 - rehearsal_import.note: None → 6月6日排练群接龙，共3个批次7张票，A区有混票待复核 (更新备注)
# [2] 2026-06-12 08:06:45.313939 - 阿梅 - batch.status: mixed → pending_review (送录音师复核)
# [3] 2026-06-12 08:06:45.315423 - 阿梅 - workflow.stage: stage_1_imported → stage_2_contract_reviewed (合同已核对)
# [4] 2026-06-12 08:06:45.316220 - 阿梅 - workflow.stage: stage_2_contract_reviewed → stage_3_authorized (授权更新)

# ========== 第7步: 保存并输出复盘结果 ==========
print()
print("=" * 60)
print("📋 复盘结果汇总")
print("=" * 60)
summary = WorkflowEngine.get_workflow_summary(show)
for k, v in summary.items():
    if isinstance(v, list) and v:
        print(f"{k}:")
        for item in v:
            print(f"  - {item}")
    elif v:
        print(f"{k}: {v}")

storage.save_show(show)
print()
print("✅ 复盘完成! 所有状态已重放并保存")
print("   场次ID:", show.id)
print("   最终阶段:", WorkflowEngine.get_stage_description(show.workflow_stage))
