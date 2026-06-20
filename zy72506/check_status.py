#!/usr/bin/env python3
import sys
sys.path.insert(0, '.')
from src import storage, engine

storage.init_db()
TARGET_BATCH = 'batch_ce7d1157'

for sid in ['S006', 'S007', 'S008', 'S003', 'S009', 'S010']:
    recs = storage.list_verification_records(batch_id=TARGET_BATCH, sample_id=sid)
    if recs:
        rec = recs[0]
        view = engine.get_record_for_review(rec.id)
        print(f"{sid}|{rec.id}|{rec.status}|{view['status_display']}|{rec.conflict_type}|{view['blocked_step']}|{len(rec.status_history)}")
        for i, h in enumerate(rec.status_history):
            print(f"  H{i}: {h['old_status']}->{h['new_status']} by {h['operator']}")
            print(f"       {h['comment'][:80]}")
    else:
        print(f"{sid}|NOT_FOUND")
