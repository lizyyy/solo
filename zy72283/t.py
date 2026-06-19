#!/usr/bin/env python3
import os, sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from lab_cabinet_layout.service import run_standard_three_step_process
from lab_cabinet_layout.workflow import client_review_issue
from lab_cabinet_layout.models import Handler

outdir = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'output_final')
r = run_standard_three_step_process(use_demo=True, output_dir=outdir)
p = r["project"]
iss = p.issues[0]
print("=" * 60)
print("BEFORE REVIEW")
print("  status:", iss.status.value)
print("  handler:", iss.current_handler.value)
print("  why_kept:", iss.why_kept())
print("  missing_info:", iss.missing_info())
print("  next_step:", iss.next_step())
print("  filled_count:", len(iss.filled_materials))

client_review_issue(p, iss.issue_id, True,
    "已核对步测记录与校准数据，差值合理，同意通过",
    Handler.EXHIBITION_CLIENT)

print("=" * 60)
print("AFTER REVIEW (RESOLVED)")
print("  status:", iss.status.value)
print("  handler:", iss.current_handler.value)
print("  why_kept:", iss.why_kept())
print("  missing_info:", iss.missing_info())
print("  next_step:", iss.next_step())
print("  resolved_note:", iss.resolved_note)
print("  filled_count:", len(iss.filled_materials))
for m in iss.filled_materials: print("   -", m)
print("=" * 60)

from lab_cabinet_layout.service import get_project_serializable
from lab_cabinet_layout.visualization import export_layout_screenshot, export_issue_detail_screenshot

sf = get_project_serializable(p)
sif = next(i for i in sf["issues"])
print("SERIALIZED")
print("  missing_info:", sif["missing_info"])
print("  why_kept:", sif["why_kept"])
print("  next_step:", sif["next_step"])
print("  resolved_note:", bool(sif.get("resolved_note")))
print("  filled_info:", sif["filled_info"][:80] if len(sif["filled_info"]) > 80 else sif["filled_info"])

# Export final screenshots
final_m = os.path.join(outdir, "final_report_resolved.png")
final_d = os.path.join(outdir, "final_issue_resolved_detail.png")
export_layout_screenshot(p, final_m)
export_issue_detail_screenshot(p, iss.issue_id, final_d)
print("FINAL EXPORTS")
print("  main:", final_m, os.path.getsize(final_m), "bytes")
print("  detail:", final_d, os.path.getsize(final_d), "bytes")

assert iss.missing_info() == "无", "FAIL: missing not empty!"
assert "已解决" in iss.why_kept()
assert iss.next_step() == "流程已完成"
assert len(iss.filled_materials) >= 7
assert iss.resolved_note
assert sif["missing_info"] == "无"
print("\n== ALL CHECKS PASSED ==")
