#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from src import storage, engine
from src.models import VerificationStatus

storage.init_db()
TARGET_BATCH = 'batch_ce7d1157'

print("===== 初始状态检查 =====")
records = {}
for sid in ['S006', 'S007', 'S008']:
    recs = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)
    if recs:
        rec = recs[0]
        records[sid] = rec
        view = engine.get_record_for_review(rec.id)
        print(f"{sid}:")
        print(f"  id = {rec.id}")
        print(f"  status = {rec.status} ({view['status_display']})")
        print(f"  conflict_type = {rec.conflict_type}")
        print(f"  blocked_step = {view['blocked_step']}")
        print(f"  history ({len(rec.status_history)} nodes):")
        for h in rec.status_history:
            print(f"    - {h['old_status']} -> {h['new_status']} by {h['operator']}")
            print(f"      {h['comment'][:80]}")
    else:
        print(f"{sid}: NOT FOUND")

print()
print("===== 开始状态推进 =====")

# S006: AI PM通过 → 运营驳回 → AI PM再通过 → 运营通过 → 完成
print()
print("--- S006 ---")
if 'S006' in records:
    rid = records['S006'].id
    rec = storage.get_verification_record_by_id(rid)
    
    # Step 1: AI PM review approve
    if rec.status in [VerificationStatus.PENDING_AI_PM_REVIEW, VerificationStatus.MODEL_VERSION_CONFLICT, VerificationStatus.IMPORTED]:
        print("S006 step1: ai_pm_review(approve=True)")
        rec = engine.ai_pm_review(rid, '阿宁', 'S006:v2正确通过#1', approve=True)
    else:
        print(f"S006 step1 SKIP: status={rec.status}")
    
    # Step 2: Operation reject
    rec = storage.get_verification_record_by_id(rid)
    if rec.status == VerificationStatus.PENDING_OPERATION_REVIEW:
        print("S006 step2: operation_review(approve=False)")
        rec = engine.operation_review(rid, '运营张姐', False, 'S006:证据不足驳回')
    else:
        print(f"S006 step2 SKIP: status={rec.status}")
    
    # Step 3: AI PM review approve again (need to rollback or handle OPERATION_REJECTED -> PENDING_OPERATION_REVIEW)
    # From OPERATION_REJECTED, we need to figure out how to get back. Let me check the engine...
    # The operation_review only works from PENDING_OPERATION_REVIEW.
    # From OPERATION_REJECTED, ai_pm_review? Let me check...
    # ai_pm_review doesn't check status, it just works. But let's see...
    # Actually OPERATION_REJECTED -> mark_review_page_updated can go to COMPLETED
    # But the user wants AI PM再通过 → 运营通过. Let me check if we can call ai_pm_review from OPERATION_REJECTED
    rec = storage.get_verification_record_by_id(rid)
    if rec.status == VerificationStatus.OPERATION_REJECTED:
        print("S006 step3: ai_pm_review(approve=True) [after rejection]")
        # ai_pm_review doesn't validate current status, so it should work
        # But looking at the code, for conflict_type=MODEL_VERSION_CHANGED_SAME_SAMPLE, approve=True -> PENDING_OPERATION_REVIEW
        rec = engine.ai_pm_review(rid, '阿宁', 'S006:补充证据后再次确认', approve=True)
    else:
        print(f"S006 step3 SKIP: status={rec.status}")
    
    # Step 4: Operation approve
    rec = storage.get_verification_record_by_id(rid)
    if rec.status == VerificationStatus.PENDING_OPERATION_REVIEW:
        print("S006 step4: operation_review(approve=True)")
        rec = engine.operation_review(rid, '运营张姐', True, 'S006:最终通过')
    else:
        print(f"S006 step4 SKIP: status={rec.status}")
    
    # Step 5: Mark review page updated
    rec = storage.get_verification_record_by_id(rid)
    if rec.status in [VerificationStatus.AI_PM_REVIEWED, VerificationStatus.OPERATION_APPROVED, VerificationStatus.OPERATION_REJECTED]:
        print("S006 step5: mark_review_page_updated")
        rec = engine.mark_review_page_updated(rid, 'system', 'S006:复盘页已更新')
    else:
        print(f"S006 step5 SKIP: status={rec.status}")
else:
    print("S006 not found, skipping")

# S007: AI PM通过 → 运营通过 → 完成
print()
print("--- S007 ---")
if 'S007' in records:
    rid = records['S007'].id
    rec = storage.get_verification_record_by_id(rid)
    
    if rec.status in [VerificationStatus.PENDING_AI_PM_REVIEW, VerificationStatus.MODEL_VERSION_CONFLICT, VerificationStatus.IMPORTED]:
        print("S007 step1: ai_pm_review(approve=True)")
        rec = engine.ai_pm_review(rid, '阿宁', 'S007:v2版本正确', approve=True)
    else:
        print(f"S007 step1 SKIP: status={rec.status}")
    
    rec = storage.get_verification_record_by_id(rid)
    if rec.status == VerificationStatus.PENDING_OPERATION_REVIEW:
        print("S007 step2: operation_review(approve=True)")
        rec = engine.operation_review(rid, '运营李哥', True, 'S007:事实准确')
    else:
        print(f"S007 step2 SKIP: status={rec.status}")
    
    rec = storage.get_verification_record_by_id(rid)
    if rec.status in [VerificationStatus.AI_PM_REVIEWED, VerificationStatus.OPERATION_APPROVED, VerificationStatus.OPERATION_REJECTED]:
        print("S007 step3: mark_review_page_updated")
        rec = engine.mark_review_page_updated(rid, 'system', 'S007:复盘页已更新')
    else:
        print(f"S007 step3 SKIP: status={rec.status}")
else:
    print("S007 not found, skipping")

# S008: AI PM驳回，无需运营，停在第三步
print()
print("--- S008 ---")
if 'S008' in records:
    rid = records['S008'].id
    rec = storage.get_verification_record_by_id(rid)
    
    if rec.status in [VerificationStatus.PENDING_AI_PM_REVIEW, VerificationStatus.MODEL_VERSION_CONFLICT, VerificationStatus.IMPORTED]:
        print("S008 step1: ai_pm_review(approve=False)")
        rec = engine.ai_pm_review(rid, '阿宁', 'S008:驳回，无需运营复核', approve=False)
    else:
        print(f"S008 step1 SKIP: status={rec.status}")
    
    # S008 should stop at AI_PM_REVIEWED (第三步), don't call mark_review_page_updated
    print("S008: Stopping at AI_PM_REVIEWED (第三步), no mark_review_page_updated")
else:
    print("S008 not found, skipping")

print()
print("===== 最终状态 =====")
for sid in ['S006', 'S007', 'S008']:
    recs = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)
    if recs:
        rec = recs[0]
        view = engine.get_record_for_review(rec.id)
        print(f"{sid}: status={rec.status} ({view['status_display']}), blocked_step={view['blocked_step']}")
        print(f"  history ({len(rec.status_history)} nodes):")
        for h in rec.status_history:
            print(f"    - {h['old_status']} -> {h['new_status']} by {h['operator']}: {h['comment'][:70]}")
