from datetime import datetime, timedelta
from models import *
from boundary_rules import *
from import_service import *
from workflow import *
from visualization_review import *

threshold = SafetyThreshold()
re = BoundaryRuleEngine(threshold)
is_ = ImportService(re)
vs = VisualizationReviewService(is_, threshold)
wf = QualityInspectionWorkflow(re, is_, vs)

def create_original_note():
    base = datetime(2026,6,1)
    return ManualInspectionNote(
        note_id='NOTE_001',
        inspection_date='2026-06-01',
        inspector='巡检员老王',
        bracket_id='BRACKET_A01',
        azimuth_error=1.2, elevation_error=0.8,
        sampling_start_time=base.replace(hour=8,minute=0),
        sampling_end_time=base.replace(hour=8,minute=10),
        tracking_accuracy=96.5,
        raw_content='原始备注:6月1日A01，8:00-8:10，只采10分钟就下雨了')

orig_note = create_original_note()
orig_hash = orig_note.content_hash()

# 1.导入原始 NOTE_001
r1 = wf.step_1_import_notes([create_original_note()])
eid = is_._error_by_note_hash.get(orig_hash)
err = is_.get_error(eid)
print('='*60)
print(f'v1 首次导入 NOTE_001 原始 (8:00-8:10)')
print(f'  error_id={eid}')
print(f'  status={err.status.value} dur={err.sampling_duration_minutes}min ver=v{err.version}')
hist = is_.get_error_history(eid)
print(f'  历史条数={len(hist)}')
for h in hist: print(f'    v{h.version} by={h.modified_by} reason={h.modification_reason[:30]}')
print(f'  缺半小时提示? {any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in err.boundary_violations)}')
print(f'  store中NOTE_001 hash={is_.get_note("NOTE_001").content_hash()[:16]}... orig_hash[:16]={orig_hash[:16]}... match={is_.get_note("NOTE_001").content_hash()==orig_hash}')

# 2.补录到8:35
base = datetime(2026,6,1)
r2 = wf.reviewer_fix_duration_issue(
    eid,
    new_sampling_start=base.replace(hour=8,minute=0),
    new_sampling_end=base.replace(hour=8,minute=35),
    reviewer='质检员小白',
    review_comment='经核对原始巡检记录，实际采样到8:35才结束，之前少记25分钟')
err2 = is_.get_error(eid)
note_in_store_hash = is_.get_note('NOTE_001').content_hash()
print('='*60)
print(f'v2 补录结束时间到 8:35')
print(f'  status={err2.status.value} dur={err2.sampling_duration_minutes}min ver=v{err2.version}')
hist = is_.get_error_history(eid)
print(f'  历史条数={len(hist)}')
for h in hist: print(f'    v{h.version} by={h.modified_by} reason={h.modification_reason[:30]}')
print(f'  store中NOTE_001 hash={note_in_store_hash[:16]}... orig_hash[:16]={orig_hash[:16]}... match={note_in_store_hash==orig_hash}')
print(f'  缺半小时提示? {any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in err2.boundary_violations)}')

# 3.重复导入同一批原始 NOTE_001
r3 = wf.step_1_import_notes([create_original_note()])
print('='*60)
print(f'v3 重复导入同一批 NOTE_001 原始 (8:00-8:10)')
print(f'  import_result={r3.data.get("import_result")}')
for m in r3.human_messages[:3]: print(f'  MSG: {m}')
err3 = is_.get_error(eid) if eid in is_._error_store else None
if err3 is None:
    eid_new = is_._error_by_note_hash.get(orig_hash)
    err3 = is_.get_error(eid_new) if eid_new else None
    print(f'  ⚠️ error_id变了: orig={eid} → new={eid_new}')
if err3:
    print(f'  status={err3.status.value} dur={err3.sampling_duration_minutes}min ver=v{err3.version}')
    hist = is_.get_error_history(err3.error_id)
    print(f'  历史条数={len(hist)}')
    for h in hist: print(f'    v{h.version} by={h.modified_by} reason={h.modification_reason[:30]}')
    print(f'  缺半小时提示? {any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in err3.boundary_violations)}')

# 4.回滚
r4 = wf.rollback_modification(err3.error_id if err3 else eid, '质检员小白')
print('='*60)
print(f'v4 执行回滚')
for m in r4.human_messages: print(f'  {m}')
eid_final = err3.error_id if err3 else eid
err4 = is_.get_error(eid_final)
print(f'  status={err4.status.value} dur={err4.sampling_duration_minutes}min ver=v{err4.version}')
hist = is_.get_error_history(eid_final)
print(f'  历史条数={len(hist)}')
for h in hist: print(f'    v{h.version} by={h.modified_by} reason={h.modification_reason[:30]}')
has_issue = any(v.startswith("SAMPLING_DURATION_TOO_SHORT") for v in err4.boundary_violations)
print(f'  ❗ 用户核心问题:回滚后仍有缺半小时提示吗? → {has_issue}')
print(f'  ❗ 若为 False 就是 BUG! 正确应为: True')
print(f'  human_readable_issues={err4.human_readable_issues}')

print('='*60)
print('📊 最终摘要:')
s = vs.get_visualization_summary()
print(f'  {s["human_summary"]}')
print(f'  by_status={s["by_status"]}')
print(f'  duration_issues_count={s["duration_issues_count"]} (正确应为:≥1)')
detail = wf.get_full_error_detail(eid_final)
print(f'📋 人工复核信息包:')
for k,v in detail["manual_review_packet"].items():
    print(f'  {k}={str(v)[:80]}')
print(f'  原始问题说法 应包含"采样时间缺了..."? {"采样时间缺了" in str(detail["manual_review_packet"]["原始问题说法"])}')
