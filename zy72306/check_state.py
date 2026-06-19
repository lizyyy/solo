import json
import sys
from collections import Counter

workdir = sys.argv[1] if len(sys.argv) > 1 else "./output_bug"
state_path = f"{workdir}/.state/state_store.json"

with open(state_path) as f:
    d = json.load(f)

print(f"Total results: {len(d['results'])}")
print(f"Audit trail count: {len(d['audit_trail'])}")

# 统计不同action数量
actions = Counter(a['action'] for a in d['audit_trail'])
print(f"Actions: {dict(actions)}")

# 统计每个row的动作数
row_actions = Counter(a['row_number'] for a in d['audit_trail'])
print(f"Actions per row: {dict(row_actions)}")

# 检查每个result的review_records和manual_modifications
results_list = list(d['results'].values()) if isinstance(d['results'], dict) else d['results']
for r in results_list:
    rn = r['row_number']
    rr = len(r.get('review_records', []))
    mm = len(r.get('manual_modifications', []))
    if rr > 0 or mm > 0:
        print(f"  row={rn} review_records={rr}, manual_modifications={mm}")

# 统计manual_modifications总数
total_mm = sum(len(r.get('manual_modifications', [])) for r in results_list)
total_rr = sum(len(r.get('review_records', [])) for r in results_list)
print(f"\nTotal manual_modifications in results: {total_mm}")
print(f"Total review_records in results: {total_rr}")
print(f"Audit trail manual_modification count: {actions.get('manual_modification', 0)}")
print(f"Audit trail review count: {actions.get('review', 0)}")
