#!/usr/bin/env python3
import json
import os
import sys
from pathlib import Path

SCRIPTS_DIR = Path(__file__).parent
sys.path.insert(0, str(SCRIPTS_DIR))

from engine import ReviewEngine

BASE_DIR = SCRIPTS_DIR.parent
DATA_DIR = BASE_DIR / "data"
REPORTS_DIR = BASE_DIR / "reports"
HISTORY_DIR = BASE_DIR / "history"


def test_case_002_overwrite_consistency():
    print("=" * 70)
    print("🧪 一致性测试：场景2 覆盖报告摘要/上下文/历史/明细 对齐")
    print("=" * 70)
    
    engine = ReviewEngine()
    all_pass = True
    
    model_file = DATA_DIR / "model_outputs" / "model_output_batch_002.json"
    judgment_file = DATA_DIR / "manual_judgments" / "manual_judgment_batch_002.json"
    second_file = DATA_DIR / "model_outputs" / "model_output_batch_002_v2.json"
    
    print("\n[阶段1] 模型输出片段第一次导入")
    model_data = engine.load_model_output(str(model_file))
    orig_batch_id = model_data['batch_id']
    assert orig_batch_id == "BATCH_002_20260607_V1"
    state1 = engine.get_state()[orig_batch_id]
    assert state1['status'] == 'imported', "导入后状态应为 imported"
    print("  ✅ 导入后状态: imported")
    
    print("\n[阶段2] 小孟补看人工改判表并保存")
    judgments = engine.apply_manual_judgment(orig_batch_id, str(judgment_file))
    state2 = engine.get_state()[orig_batch_id]
    assert state2['status'] == 'has_manual_modifications', "人工改判后状态应为 has_manual_modifications"
    assert len(state2['manual_judgments']) == 1
    j = state2['manual_judgments']['REC_002_001']
    assert j['manual_score'] == 90
    assert j['manual_judgment'] == '优秀'
    assert j['status'] == 'modified'
    print("  ✅ 人工改判应用: status=has_manual_modifications, 分数=90, 优秀")
    
    print("\n[阶段3] 刷新重算（V2批跑覆盖V1）")
    overwrite_result = engine.apply_second_batch(orig_batch_id, str(second_file))
    new_batch_id = overwrite_result['new_batch_id']
    assert new_batch_id == "BATCH_002_20260607_V2"
    state3_new = engine.get_state()[new_batch_id]
    state3_orig = engine.get_state()[orig_batch_id]
    
    assert state3_new['status'] == 'pending_safety_review', "新批次状态应为 pending_safety_review"
    assert state3_new['overwrites_original'] == orig_batch_id
    assert len(state3_new.get('safety_conflicts', [])) == 1
    assert len(state3_orig.get('overwrites', [])) == 1, "原批次 overwrites 列表应记录被覆盖"
    print("  ✅ 新批次状态: pending_safety_review")
    print("  ✅ 新批次 overwrites_original:", orig_batch_id)
    print("  ✅ safety_conflicts 冲突记录数:", len(state3_new['safety_conflicts']))
    
    print("\n[阶段4] 评测报告更新（导出结果）")
    report_file = "test_report_case_002.json"
    report = engine.generate_report(new_batch_id, report_file)
    history_file_path = engine.save_history("test_case_002")
    history_file_name = os.path.basename(history_file_path)
    
    s = report['summary']
    ow = report['overwrite_context']
    rec = report['records'][0]
    
    checks = []
    
    checks.append((
        "summary.has_overwrites == True",
        s.get('has_overwrites') == True,
        f"actual={s.get('has_overwrites')}"
    ))
    checks.append((
        "summary.overwrites_original_batch == BATCH_002_20260607_V1",
        s.get('overwrites_original_batch') == "BATCH_002_20260607_V1",
        f"actual={s.get('overwrites_original_batch')}"
    ))
    checks.append((
        "summary.records_with_overwritten_manual_judgment == 1",
        s.get('records_with_overwritten_manual_judgment') == 1,
        f"actual={s.get('records_with_overwritten_manual_judgment')}"
    ))
    checks.append((
        "summary.needs_safety_review == True",
        s.get('needs_safety_review') == True,
        f"actual={s.get('needs_safety_review')}"
    ))
    checks.append((
        "batch_status == pending_safety_review",
        report.get('batch_status') == 'pending_safety_review',
        f"actual={report.get('batch_status')}"
    ))
    checks.append((
        "overwrite_context 存在",
        ow is not None,
        f"actual={ow}"
    ))
    if ow:
        checks.append((
            "overwrite_context.overwrites_original_batch == BATCH_002_20260607_V1",
            ow.get('overwrites_original_batch') == "BATCH_002_20260607_V1",
            f"actual={ow.get('overwrites_original_batch')}"
        ))
        checks.append((
            "overwrite_context.original_status_before_overwrite == has_manual_modifications",
            ow.get('original_status_before_overwrite') == "has_manual_modifications",
            f"actual={ow.get('original_status_before_overwrite')}"
        ))
        checks.append((
            "overwrite_context.original_manual_judgments_count == 1",
            ow.get('original_manual_judgments_count') == 1,
            f"actual={ow.get('original_manual_judgments_count')}"
        ))
        checks.append((
            "overwrite_context.safety_conflicts_count == 1",
            ow.get('safety_conflicts_count') == 1,
            f"actual={ow.get('safety_conflicts_count')}"
        ))
    checks.append((
        "record.has_overwritten_manual_judgment == True",
        rec.get('has_overwritten_manual_judgment') == True,
        f"actual={rec.get('has_overwritten_manual_judgment')}"
    ))
    if rec.get('overwritten_manual_judgment'):
        ovj = rec['overwritten_manual_judgment']
        checks.append((
            "overwritten_manual_judgment.manual_score == 90",
            ovj.get('manual_score') == 90,
            f"actual={ovj.get('manual_score')}"
        ))
        checks.append((
            "overwritten_manual_judgment.manual_judgment == 优秀",
            ovj.get('manual_judgment') == "优秀",
            f"actual={ovj.get('manual_judgment')}"
        ))
        checks.append((
            "overwritten_manual_judgment.judgment_status_before == modified",
            ovj.get('judgment_status_before') == "modified",
            f"actual={ovj.get('judgment_status_before')}"
        ))
    
    print("\n📝 报告字段检查:")
    for name, passed, detail in checks:
        status = "✅" if passed else "❌"
        if not passed:
            all_pass = False
        print(f"  {status} {name}  ({detail})")
    
    print("\n[阶段5] 历史事件核对")
    history_actions = [a['action'] for a in engine.history]
    expected_sequence = [
        'IMPORT_MODEL_OUTPUT',
        'APPLY_MANUAL_JUDGMENT',
        'BATCH_OVERWRITE_DETECTED',
        'GENERATE_REPORT',
    ]
    history_checks = []
    for exp in expected_sequence:
        history_checks.append((
            f"history 包含 {exp}",
            exp in history_actions,
            f"actual sequence={history_actions}"
        ))
    
    print("\n📝 历史事件检查:")
    for name, passed, detail in history_checks:
        status = "✅" if passed else "❌"
        if not passed:
            all_pass = False
        print(f"  {status} {name}  ({detail})")
    
    report_snapshot_actions = [a['action'] for a in report.get('history_snapshot', [])]
    snapshot_expected = ['IMPORT_MODEL_OUTPUT', 'APPLY_MANUAL_JUDGMENT', 'BATCH_OVERWRITE_DETECTED']
    snapshot_checks = []
    for exp in snapshot_expected:
        snapshot_checks.append((
            f"report history_snapshot 包含 {exp}",
            exp in report_snapshot_actions,
            f"actual snapshot={report_snapshot_actions}"
        ))
    
    print("\n📝 报告内嵌快照检查:")
    for name, passed, detail in snapshot_checks:
        status = "✅" if passed else "❌"
        if not passed:
            all_pass = False
        print(f"  {status} {name}  ({detail})")
    
    print("\n[阶段6] 对齐检查（引擎内置）")
    align = ReviewEngine.check_alignment(report_file, history_file_name)
    print(f"  check_alignment.pass = {align.get('pass')}")
    for c in align.get('checks', []):
        status = "✅" if c['pass'] else "❌"
        if not c['pass']:
            all_pass = False
        print(f"  {status} {c['name']}  ({c['detail']})")
    
    print("\n" + "=" * 70)
    if all_pass:
        print("🎉 一致性测试：✅ 全部通过！覆盖摘要/上下文/历史/明细/查看入口完全一致")
    else:
        print("⚠️  一致性测试：❌ 存在失败检查项，请排查")
    print("=" * 70)
    
    return all_pass


def main():
    for f in REPORTS_DIR.glob("test_*.json"):
        f.unlink()
    for f in HISTORY_DIR.glob("test_*.json"):
        f.unlink()
    
    ok = test_case_002_overwrite_consistency()
    sys.exit(0 if ok else 1)


if __name__ == "__main__":
    main()
