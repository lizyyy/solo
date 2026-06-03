from __future__ import annotations

from combo_odds_checker.models import OldFormulaScreenshot
from combo_odds_checker.workflow import WorkflowEngine


DEMO_WEIGHT_ROWS = [
    {"category": "C(10,3)基础赔率", "weight": 0.30, "raw_value": 120.0, "note": "标准组合"},
    {"category": "C(10,3)追加赔率", "weight": 0.15, "raw_value": -5.0, "note": "旧表将此标记为缺失"},
    {"category": "C(8,2)基础赔率", "weight": 0.25, "raw_value": 28.0, "note": "标准组合"},
    {"category": "C(8,2)追加赔率", "weight": 0.10, "raw_value": -3.0, "note": "旧表将此标记为缺失"},
    {"category": "C(6,4)基础赔率", "weight": 0.20, "raw_value": 15.0, "note": "标准组合"},
]


def build_demo_screenshot(category: str, screenshot_id: str) -> OldFormulaScreenshot:
    return OldFormulaScreenshot(
        screenshot_id=screenshot_id,
        description=f"{category} 旧公式截图",
        image_ref=f"screenshots/{screenshot_id}.png",
        related_category=category,
        uploaded_by="教研负责人吴老师",
    )


def run_demo() -> WorkflowEngine:
    engine = WorkflowEngine()

    print("【第一步】导入评分权重表")
    print("-" * 40)
    table = engine.step1_import_table("demo-table-001", DEMO_WEIGHT_ROWS)
    print(f"  导入表 {table.table_id}，共 {len(table.entries)} 条记录")
    flagged = [e for e in table.entries if e.old_table_treats_as_missing]
    print(f"  其中 {len(flagged)} 条负数被旧表当成缺失：")
    for e in flagged:
        print(f"    - {e.category}：raw_value={e.raw_value}")
    print()
    print(engine.get_human_report())
    print()

    print("【第二步】教研负责人吴老师补看旧公式截图")
    print("-" * 40)
    ss1 = build_demo_screenshot("C(10,3)追加赔率", "SS-001")
    engine.step2_add_screenshot(ss1)
    print(f"  补录截图 {ss1.screenshot_id}（{ss1.related_category}）")
    print(engine.get_human_report())
    print()

    ss2 = build_demo_screenshot("C(8,2)追加赔率", "SS-002")
    engine.step2_add_screenshot(ss2)
    print(f"  补录截图 {ss2.screenshot_id}（{ss2.related_category}）")
    print()
    print("  截图补录后，负数样本状态更新为「待学生助教复核」")
    print()

    print("【第三步】边界样本报告更新 + 人工修正 + 重跑")
    print("-" * 40)
    report = engine.step3_update_report_after_screenshot()
    print(engine.get_human_report())
    print()

    print("  教研负责人吴老师执行人工修正：")
    correction = engine.apply_manual_correction(
        sample_id="S-001",
        new_value=5.0,
        reason="经核对旧公式截图，原值 -5.0 为口径差异，修正为 5.0",
        corrected_by="教研负责人吴老师",
    )
    print(f"  修正 {correction.sample_id}：{correction.old_value} → {correction.new_value}")
    print(f"  原因：{correction.reason}")
    print()

    print("  执行重跑：")
    rerun = engine.rerun()
    print(f"  重跑编号 {rerun.rerun_id}，应用修正 {len(rerun.corrections_applied)} 条")
    print()
    print("  重跑后报告：")
    print(engine.get_human_report())

    return engine
