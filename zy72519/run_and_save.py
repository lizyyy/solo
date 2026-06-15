#!/usr/bin/env python3
import sys
import json
import io
from pathlib import Path
from contextlib import redirect_stdout, redirect_stderr

sys.path.insert(0, str(Path(__file__).parent))

from core import WorkflowEngine

base_dir = Path(__file__).parent
sample_dir = base_dir / "data" / "samples"

log_capture = io.StringIO()

with redirect_stdout(log_capture), redirect_stderr(log_capture):
    engine = WorkflowEngine(
        data_dir=str(base_dir / "data"),
        output_dir=str(base_dir / "output"),
    )
    result = engine.run_three_step_workflow(
        normal_file=str(sample_dir / "normal_work_orders.json"),
        remarks_file=str(sample_dir / "desensitization_remarks.json"),
        wrong_caliber_file=str(sample_dir / "wrong_caliber_work_orders.json"),
        supplementary_file=str(sample_dir / "supplementary_work_orders.json"),
    )
    pending = engine.list_pending_conflicts()
    if pending:
        conflict_id = pending[0]["conflict_id"]
        engine.confirm_conflict(conflict_id, operator="周姐", notes="经核实，此冲突确实存在，需要重新分类")
        if len(pending) > 1:
            conflict_id2 = pending[1]["conflict_id"]
            engine.reject_conflict(conflict_id2, operator="周姐", notes="经核实，分类是正确的，备注描述有误")
    check_report = engine.run_self_check()
    engine.export_all()

log_output = log_capture.getvalue()
print(log_output)

with open(base_dir / "output" / "run_log.txt", "w", encoding="utf-8") as f:
    f.write(log_output)
