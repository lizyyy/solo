"""
跨运行持久化测试脚本
验证：人工复核状态、备注、处理人信息跨运行保留
"""
import os
import sys
import shutil
import json
import csv
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    ParameterManager,
    SensitivityEngine,
    AnomalyDetector,
    ConflictDetector,
    HistoryManager,
    ReportGenerator,
    Exporter,
    RunHistory,
    generate_id,
)
from data.test_samples import (
    create_test_samples,
    create_review_chart_data,
    create_manual_notes,
)


def run_analysis(
    data_dir: str,
    output_dir: str,
    set_manual_review: bool = False,
) -> dict:
    """运行一次完整分析"""
    param_manager = ParameterManager(data_dir)
    anomaly_detector = AnomalyDetector()
    conflict_detector = ConflictDetector(tolerance_pct=5.0)
    history_manager = HistoryManager(data_dir)
    report_generator = ReportGenerator(output_dir)
    exporter = Exporter(output_dir)

    latest_version = param_manager.get_latest_version()
    if latest_version is None:
        latest_version = param_manager.create_initial_version()

    if set_manual_review:
        print("  [模拟] 人工设置 LOAN-002 的复核状态...")

    active_version_id = param_manager.get_active_version_id()
    active_version = param_manager.get_version(active_version_id)

    samples = create_test_samples()
    chart_data = create_review_chart_data()
    manual_notes = create_manual_notes()

    sample_anomalies = anomaly_detector.detect_batch(samples)
    anomaly_summary = anomaly_detector.get_anomaly_summary(sample_anomalies)

    calc_params = param_manager.get_parameters_for_calculation()
    engine = SensitivityEngine(calc_params, active_version_id)
    results = engine.calculate_batch(samples, sample_anomalies)

    calc_scores = {r.sample_id: r.sensitivity_score for r in results}
    conflicts = conflict_detector.detect(samples, chart_data, calc_scores)
    conflict_summary = conflict_detector.get_conflict_summary(conflicts)

    merged_results, merged_conflicts = history_manager.merge_with_previous_results(
        results, conflicts
    )

    if set_manual_review:
        for r in merged_results:
            if r.loan_id == "LOAN-002":
                r.review_status = "approved"
                r.review_note = "经核对，LOAN-002为历史遗留测试数据，异常字段不影响本次分析。"
                r.reviewed_by = "QA测试员"
                r.reviewed_at = datetime.now().isoformat()
                print(f"  [模拟] LOAN-002 复核状态设为: approved")
                print(f"  [模拟] LOAN-002 复核人: QA测试员")
                print(f"  [模拟] LOAN-002 复核备注: {r.review_note}")

    run_id = generate_id("RUN")
    run_history = RunHistory(
        run_id=run_id,
        timestamp=datetime.now().isoformat(),
        parameter_version_id=active_version_id,
        sample_count=len(merged_results),
        anomaly_count=anomaly_summary["total_anomalies"],
        conflict_count=conflict_summary["total_conflicts"],
        manual_review_count=sum(1 for r in merged_results if r.needs_manual_review),
        results=merged_results,
        conflicts=merged_conflicts,
        status="completed",
    )
    history_manager.save_run(run_history)

    history_summary = history_manager.generate_run_history_summary()
    report_path = report_generator.generate(
        run_history,
        active_version,
        anomaly_summary,
        conflict_summary,
        manual_notes,
        history_summary,
    )

    export_files = exporter.export_all(
        merged_results,
        merged_conflicts,
        run_id,
        anomaly_summary,
        conflict_summary,
    )

    return {
        "run_id": run_id,
        "results": merged_results,
        "conflicts": merged_conflicts,
        "report_path": report_path,
        "export_files": export_files,
        "anomaly_summary": anomaly_summary,
        "conflict_summary": conflict_summary,
    }


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data", "storage")
    output_dir = os.path.join(base_dir, "output")

    backup_dir = f"{data_dir}_backup_{datetime.now().strftime('%Y%m%d%H%M%S')}"
    if os.path.exists(data_dir):
        shutil.copytree(data_dir, backup_dir)
        shutil.rmtree(data_dir)
    os.makedirs(data_dir, exist_ok=True)

    print("=" * 70)
    print("跨运行持久化测试")
    print("=" * 70)
    print()

    print("[1/3] 第一次运行（初始化 + 模拟人工复核）...")
    run1 = run_analysis(data_dir, output_dir, set_manual_review=True)
    print(f"  ✅ 运行ID: {run1['run_id']}")
    for r in run1["results"]:
        if r.loan_id == "LOAN-002":
            print(f"  ✅ LOAN-002 第一次运行状态:")
            print(f"     - review_status: {r.review_status}")
            print(f"     - review_note: {r.review_note}")
            print(f"     - reviewed_by: {r.reviewed_by}")
    print()

    print("[2/3] 第二次运行（验证复核状态保留）...")
    run2 = run_analysis(data_dir, output_dir, set_manual_review=False)
    print(f"  ✅ 运行ID: {run2['run_id']}")
    print()

    print("[3/3] 验证结果...")
    print("-" * 70)
    passed = True

    for r in run2["results"]:
        if r.loan_id == "LOAN-002":
            print(f"\n📋 LOAN-002 第二次运行状态:")
            print(f"   sample_id: {r.sample_id}")
            print(f"   loan_id: {r.loan_id}")

            checks = [
                ("review_status == 'approved'", r.review_status == "approved"),
                ("review_note 保留", r.review_note == "经核对，LOAN-002为历史遗留测试数据，异常字段不影响本次分析。"),
                ("reviewed_by 保留", r.reviewed_by == "QA测试员"),
                ("reviewed_at 保留", bool(r.reviewed_at)),
            ]

            for desc, result in checks:
                status = "✅ PASS" if result else "❌ FAIL"
                print(f"   {status}: {desc}")
                if not result:
                    passed = False

    print(f"\n📊 导出文件验证:")
    for key, filepath in run2["export_files"].items():
        exists = os.path.exists(filepath)
        size = os.path.getsize(filepath) if exists else 0
        status = "✅" if exists else "❌"
        print(f"   {status} {key}: {os.path.basename(filepath)} ({size} bytes)")
        if not exists:
            passed = False

    summary_file = run2["export_files"]["summary"]
    if os.path.exists(summary_file):
        print(f"\n📋 导出摘要一致性验证:")
        with open(summary_file, "r", encoding="utf-8-sig") as f:
            lines = f.readlines()
            summary_data = {}
            for line in lines[1:]:
                parts = line.strip().split(",")
                if len(parts) >= 2:
                    summary_data[parts[0]] = parts[1]

        expected_total = str(len(run2["results"]))
        actual_total = summary_data.get("总样本数", "")
        match = actual_total == expected_total
        print(f"   {'✅' if match else '❌'} 总样本数: 页面={expected_total}, 导出={actual_total}")
        if not match:
            passed = False

        expected_review = str(sum(1 for r in run2["results"] if r.needs_manual_review))
        actual_review = summary_data.get("需人工复核数", "")
        match = actual_review == expected_review
        print(f"   {'✅' if match else '❌'} 需人工复核: 页面={expected_review}, 导出={actual_review}")
        if not match:
            passed = False

        expected_critical = str(run2["anomaly_summary"]["critical_anomalies"])
        actual_critical = summary_data.get("严重异常总数", "")
        match = actual_critical == expected_critical
        print(f"   {'✅' if match else '❌'} 严重异常: 页面={expected_critical}, 导出={actual_critical}")
        if not match:
            passed = False

    conflicts_file = run2["export_files"].get("conflicts", "")
    if os.path.exists(conflicts_file) and run2["conflicts"]:
        print(f"\n⚔️  冲突追踪ID验证:")
        expected_conflict_count = len(run2["conflicts"])
        with open(conflicts_file, "r", encoding="utf-8-sig") as f:
            reader = csv.reader(f)
            header = next(reader, [])
            conflict_rows = list(reader)

        print(f"   - 冲突条数: 页面={expected_conflict_count}, 导出={len(conflict_rows)}")
        match_count = expected_conflict_count == len(conflict_rows)
        print(f"   {'✅' if match_count else '❌'} 冲突条数一致")
        if not match_count:
            passed = False

        expected_headers = [
            "冲突追踪ID(完整)", "冲突ID(显示用)", "贷款ID", "冲突字段",
            "系统计算值", "复盘图表值", "差异(%)", "系统数据来源",
            "图表数据来源", "建议动作", "是否已解决", "处理说明",
            "追溯锚点URL", "独立追踪KEY"
        ]
        headers_match = len(header) >= 14 and header[0] == expected_headers[0]
        print(f"   {'✅' if headers_match else '❌'} 导出表头包含追踪字段(共{len(header)}列)")
        if not headers_match:
            passed = False

        page_keys = set()
        for c in run2["conflicts"]:
            key = f"{c.loan_id}_{c.field_name}"
            page_keys.add(key)

        export_keys = set()
        has_complete_ids = True
        has_anchors = True
        for row in conflict_rows:
            if len(row) >= 14:
                full_id = row[0]
                short_id = row[1]
                loan_id = row[2]
                field_raw = row[3]
                anchor = row[12]
                trace_key = row[13]

                if "CONFLICT_" not in full_id or "_" not in full_id.split("CONFLICT_")[1]:
                    has_complete_ids = False
                if not anchor.startswith("#conflict-CONFLICT_"):
                    has_anchors = False

                field_key_map = {
                    "敏感性得分": "sensitivity_score",
                    "风险等级": "risk_level",
                    "贷款本金": "principal",
                }
                field_name = field_key_map.get(field_raw, field_raw)
                export_keys.add(f"{loan_id}_{field_name}")

        print(f"   {'✅' if has_complete_ids else '❌'} 冲突ID包含绑定信息(贷款+字段)")
        print(f"   {'✅' if has_anchors else '❌'} 追溯锚点格式正确(#conflict-CONFLICT_xxx)")
        if not has_complete_ids or not has_anchors:
            passed = False

        keys_match = page_keys == export_keys
        print(f"   {'✅' if keys_match else '❌'} 页面/导出 独立追踪KEY完全匹配")
        print(f"      - 页面KEY: {sorted(page_keys)}")
        print(f"      - 导出KEY: {sorted(export_keys)}")
        if not keys_match:
            passed = False

    print()
    print("-" * 70)
    if passed:
        print("✅ 所有测试通过！跨运行持久化和导出功能验证成功。")
    else:
        print("❌ 部分测试失败，请检查输出。")

    print(f"\n📂 输出目录: {output_dir}")
    print(f"📂 HTML报告: {run2['report_path']}")

    if shutil.os.path.exists(backup_dir):
        shutil.rmtree(data_dir)
        shutil.copytree(backup_dir, data_dir)
        shutil.rmtree(backup_dir)
        print(f"\n♻️  已恢复原始存储数据")

    return 0 if passed else 1


if __name__ == "__main__":
    sys.exit(main())
