from __future__ import annotations

import json
import os
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from rehearsal_optimizer.state import AppState, FilterState
from rehearsal_optimizer.models import DataSource, ConflictType, ConflictSeverity
from rehearsal_optimizer.loader import DataLoader
from rehearsal_optimizer.validator import DataValidator
from rehearsal_optimizer.optimizer import ScheduleOptimizer
from rehearsal_optimizer.conflicts import ConflictDetector
from rehearsal_optimizer.audit import AuditTrail
from rehearsal_optimizer.renderer import TerminalRenderer
from rehearsal_optimizer.exporter import Exporter


DATA_DIR = Path(__file__).resolve().parent / "data"


def test_full_workflow():
    state = AppState()
    loader = DataLoader(state)
    validator = DataValidator(state)
    optimizer = ScheduleOptimizer(state)
    detector = ConflictDetector(state)
    audit = AuditTrail(state)
    renderer = TerminalRenderer(state)
    exporter = Exporter(state)

    print("=== 1. 加载数据 ===")
    loader.load_pieces_csv(str(DATA_DIR / "pieces.csv"), DataSource.SYSTEM)
    loader.load_sections_json(str(DATA_DIR / "sections.json"))
    loader.load_absences_csv(str(DATA_DIR / "absences.csv"), DataSource.SYSTEM)
    loader.load_performances_json(str(DATA_DIR / "performances.json"))
    loader.load_reports_json(str(DATA_DIR / "reports.json"))
    audit.record_load("示例数据", {"pieces": len(state.pieces), "sections": len(state.sections)})

    assert len(state.pieces) == 7, f"Expected 7 pieces, got {len(state.pieces)}"
    assert len(state.sections) == 5, f"Expected 5 sections, got {len(state.sections)}"
    assert len(state.absences) == 10, f"Expected 10 absences, got {len(state.absences)}"
    print(f"  ✅ 加载：{len(state.pieces)} 曲目, {len(state.sections)} 声部, {len(state.absences)} 缺勤, {len(state.performances)} 演出, {len(state.reports)} 报告")
    print(renderer.render_data_summary())
    print()

    print("=== 2. 冲突检测（按类型拆分） ===")
    conflicts = detector.detect_all(total_available_minutes=120)
    dups = conflicts["absence_duplicate"]
    inversions = conflicts["difficulty_inversion"]
    overruns = conflicts["time_overrun"]

    print(f"  缺勤重复：{len(dups)} 项")
    for c in dups:
        print(f"    - {c.title}")
        assert c.conflict_type == ConflictType.ABSENCE_DUPLICATE

    print(f"  难度权重反转：{len(inversions)} 项")
    for c in inversions:
        print(f"    - {c.title}")
        assert c.conflict_type == ConflictType.DIFFICULTY_INVERSION

    print(f"  时间超排：{len(overruns)} 项")
    for c in overruns:
        print(f"    - {c.title}")
        assert c.conflict_type == ConflictType.TIME_OVERRUN

    assert len(dups) > 0, "Should detect duplicate absences (张伟 on 2026-06-10)"
    assert len(inversions) > 0, "Should detect difficulty inversion (威尔第安魂曲 has weight -0.5)"
    assert len(overruns) > 0, "Should detect time overrun (250 min needed vs 120 available)"
    print()

    print("=== 3. 生成排练方案 ===")
    before_snap = audit.snapshot_state()
    plan = optimizer.optimize(total_available_minutes=120, reference_date="2026-06-01")
    after_snap = audit.snapshot_state()
    audit.record_recalculate(before_snap.get("schedule"), after_snap.get("schedule"))

    print(renderer.render_schedule(plan))
    assert plan.total_allocated_minutes <= 120 + 0.01, f"Allocated {plan.total_allocated_minutes} exceeds 120"
    assert len(plan.entries) > 0, "Should have scheduled entries"
    print()

    print("=== 4. 方案对比 ===")
    plan2 = optimizer.optimize(total_available_minutes=180, reference_date="2026-06-01")
    comparisons = optimizer.compare_plans()
    print(renderer.render_plan_comparison(comparisons))
    assert len(comparisons) == 2, "Should have 2 plans to compare"
    print()

    print("=== 5. 审计追踪 ===")
    log = audit.get_log()
    assert len(log) > 0, "Audit log should not be empty"
    print(renderer.render_audit_log())
    print()

    print("=== 6. 撤回 ===")
    entry = audit.undo_last()
    assert entry is not None, "Should be able to undo"
    assert len(state.schedules) == 1, "Should have 1 schedule after undo"
    print(f"  ✅ 撤回成功，剩余方案数：{len(state.schedules)}")
    print()

    print("=== 7. 手动补录 ===")
    before_snap = audit.snapshot_state()
    loader.add_piece_manual(name="巴赫勃兰登堡协奏曲", duration_minutes=25, difficulty_score=6)
    after_snap = audit.snapshot_state()
    audit.record_supplement("曲目 巴赫勃兰登堡协奏曲", before_snap, after_snap)
    assert len(state.pieces) == 8, f"Expected 8 pieces after supplement, got {len(state.pieces)}"
    print(f"  ✅ 补录后曲目数：{len(state.pieces)}")
    print()

    print("=== 8. 筛选 ===")
    state.current_filter.source_filter = DataSource.MANUAL
    filtered = state.filtered_pieces()
    manual_count = sum(1 for p in filtered.values() if p.source == DataSource.MANUAL)
    print(f"  筛选来源=manual 后曲目数：{len(filtered)}（其中手动补录：{manual_count}）")
    state.clear_filter()
    print()

    print("=== 9. 重新计算 ===")
    before_snap = audit.snapshot_state()
    plan3 = optimizer.optimize(total_available_minutes=150, reference_date="2026-06-01")
    after_snap = audit.snapshot_state()
    audit.record_recalculate(before_snap.get("schedule"), after_snap.get("schedule"))
    print(renderer.render_schedule(plan3))
    print()

    print("=== 10. 审计日志回放与对比 ===")
    log = audit.get_log()
    print(f"  审计条目总数：{len(log)}")
    if len(log) >= 2:
        diff = audit.diff_entries(0, len(log) - 1)
        print(f"  {diff['summary']}")
    print()

    print("=== 11. 导出 ===")
    with tempfile.TemporaryDirectory() as tmpdir:
        json_path = os.path.join(tmpdir, "report.json")
        md_path = os.path.join(tmpdir, "report.md")

        exporter.export_json(json_path, scope="full")
        with open(json_path, encoding="utf-8") as f:
            json_data = json.load(f)
        assert "schedule" in json_data, "JSON export should contain schedule"
        assert "conflicts" in json_data, "JSON export should contain conflicts"
        assert "audit_log" in json_data, "JSON export should contain audit_log"
        print(f"  ✅ JSON 导出成功：{json_path}")

        exporter.export_markdown(md_path, scope="full")
        with open(md_path, encoding="utf-8") as f:
            md_content = f.read()
        assert "排练方案" in md_content, "Markdown should contain schedule section"
        assert "冲突检测" in md_content, "Markdown should contain conflicts section"
        assert "审计日志" in md_content, "Markdown should contain audit section"
        print(f"  ✅ Markdown 导出成功：{md_path}")
        print()
        print("--- Markdown 预览（前 60 行）---")
        for line in md_content.split("\n")[:60]:
            print(line)

    print()
    print("=== 全部测试通过 ✅ ===")


if __name__ == "__main__":
    test_full_workflow()
