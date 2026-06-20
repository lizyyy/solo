
import sys
sys.path.insert(0, '.')
from app.workflow import WorkflowManager
from app.models import RecordStatus, ConflictResolution
from app.result_store import UnifiedResultStore
from tests.test_core import create_test_record

wf = WorkflowManager()
session = wf.create_session("tester")
bucket = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True)]
session = wf.step1_import_bucket(session.session_id, bucket)
r1 = session.bucket_records[0]
print(f"After step1: status={r1.status.value}, default_value_used={r1.default_value_used}")

negative = [create_test_record(sample_id="s001", feature_value=None, default_value_used=True, bucket_id="neg")]
session = wf.step2_review_negatives(session.session_id, negative)
r2 = session.bucket_records[0]
n2 = session.negative_records[0]
print(f"After step2 bucket: status={r2.status.value}, history={len(r2.status_history)}")
print(f"After step2 negative: status={n2.status.value}")
print(f"Conflicts: {[(c.record_id, c.conflict_type) for c in session.conflicts]}")

for c in session.conflicts:
    print(f"Resolving: {c.record_id}")
    session = wf.resolve_conflict(session.session_id, c.record_id, ConflictResolution.CONFIRM, "xiaomeng")
    r3 = session.bucket_records[0]
    n3 = session.negative_records[0]
    print(f"  After resolve bucket: status={r3.status.value}")
    print(f"  After resolve negative: status={n3.status.value}")
    for h in r3.status_history:
        print(f"  bucket history: {h.from_status} -> {h.to_status} reason={h.reason}")

store = UnifiedResultStore(session)
all_recs = store.get_all_records_for_api()
print(f"\nFinal API records ({len(all_recs)}):")
for rec in all_recs:
    print(f"  sample={rec.get('样本ID')}, status_en={rec.get('最终状态(英文)')}")
    print(f"  desc={rec.get('结果说明(可解释)')[:120]}")
