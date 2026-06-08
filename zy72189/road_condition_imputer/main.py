import json
from datetime import datetime

from .models import ReviewDecision, RecordStatus
from .data_loader import DataLoader
from .imputer import RoadConditionImputer
from .reviewer import Reviewer
from .metrics import MetricsComparator
from .audit import AuditTrail
from .reporter import Reporter
from .sample_data import get_all_sample_data, get_rerun_sample_data


def run_pipeline(raw_data, run_id, audit_trail=None, prev_snapshot=None, prev_results=None):
    if audit_trail is None:
        audit_trail = AuditTrail()

    shared_audit = []

    loader = DataLoader(audit_log=shared_audit, run_id=run_id)
    records = loader.load_records(raw_data)
    clean_records, validation_issues, rejected = loader.validate(records)

    imputer = RoadConditionImputer(audit_log=shared_audit, run_id=run_id)
    imputer.build_reference_pool(clean_records)

    results = []
    for rec in clean_records:
        missing_type = loader.classify_missing(rec)
        result = imputer.impute(rec, missing_type)
        results.append(result)

    reviewer = Reviewer(audit_log=shared_audit, run_id=run_id)
    for i in range(len(results)):
        results[i] = reviewer.auto_review(results[i])

    metrics_comp = MetricsComparator(audit_log=shared_audit, run_id=run_id)
    snapshot = metrics_comp.compute_snapshot(results, rejected_count=len(rejected))
    diffs = metrics_comp.diff_snapshots(prev_snapshot, snapshot, prev_results, results)

    audit_trail.add_entries(shared_audit)
    audit_trail.add_snapshot(snapshot)

    return {
        "run_id": run_id,
        "results": results,
        "validation_issues": validation_issues,
        "snapshot": snapshot,
        "diffs": diffs,
        "audit_trail": audit_trail,
        "rejected": rejected,
    }


def apply_manual_review(pipeline_output, decisions):
    results = pipeline_output["results"]
    audit_trail = pipeline_output["audit_trail"]
    run_id = pipeline_output["run_id"]

    review_audit = []
    reviewer = Reviewer(audit_log=review_audit, run_id=run_id)

    review_records = []
    for dec in decisions:
        for i, r in enumerate(results):
            if r.record_id == dec.record_id:
                results[i] = reviewer.manual_review(r, dec)
                review_records.append(dec)
                break

    audit_trail.add_entries(review_audit)
    return results, review_records


def apply_rework(pipeline_output, rework_corrections):
    results = pipeline_output["results"]
    audit_trail = pipeline_output["audit_trail"]
    run_id = pipeline_output["run_id"]

    rework_audit = []
    reviewer = Reviewer(audit_log=rework_audit, run_id=run_id)

    for record_id, corrections in rework_corrections:
        for i, r in enumerate(results):
            if r.record_id == record_id:
                results[i] = reviewer.rework_and_reimpute(r, corrections)
                break

    audit_trail.add_entries(rework_audit)
    return results


def main():
    print("=" * 60)
    print("  路况预测缺失值修补工具 - 闭环演示")
    print("=" * 60)

    audit_trail = AuditTrail()
    reporter = Reporter()

    # ── 第一次运行：含脏数据 ──
    print("\n>>> 第一次运行: 含脏数据（空ID、重复项、边界记录、整行空）\n")
    run1 = run_pipeline(get_all_sample_data(), run_id="RUN-001", audit_trail=audit_trail)

    print(f"校验问题数: {len(run1['validation_issues'])}")
    for issue in run1['validation_issues']:
        print(f"  [{issue.severity.value}] {issue.record_id}: {issue.description}")

    if run1['rejected']:
        print(f"\n被拒绝记录数: {len(run1['rejected'])}")
        for rec in run1['rejected']:
            rid = rec.record_id if rec.record_id else "(空ID)"
            print(f"  - {rid}  来源: {rec.source}")

    print(f"\n修补结果状态分布:")
    status_counts = {}
    for r in run1['results']:
        status_counts[r.status.value] = status_counts.get(r.status.value, 0) + 1
    for s, c in sorted(status_counts.items()):
        print(f"  {s}: {c}")

    # ── 人工复核：RC-002 顺利通过，RC-004 返工 ──
    print("\n>>> 人工复核阶段\n")

    decisions = [
        ReviewDecision(
            record_id="RC-002",
            reviewer="小孟",
            decision="approve",
            comment="congestion_level 修补值合理，与前后时段趋势一致",
        ),
        ReviewDecision(
            record_id="RC-004",
            reviewer="小孟",
            decision="rework",
            corrections={
                "congestion_level": 5.5,
                "weather": "阴",
                "temperature": 24.0,
                "surface_condition": "潮湿",
                "traffic_volume": 950,
            },
            comment="现场反馈该时段路面潮湿、流量中等，模型修补偏离较大需修正",
        ),
    ]
    results1, reviews1 = apply_manual_review(run1, decisions)

    for dec in decisions:
        for r in results1:
            if r.record_id == dec.record_id:
                print(f"  {dec.record_id} 复核决定={dec.decision} → 状态={r.status.value}")

    # ── 返工修正 ──
    print("\n>>> 返工修正 RC-004\n")
    rework_corrections = [
        ("RC-004", {
            "congestion_level": 5.5,
            "weather": "阴",
            "temperature": 24.0,
            "surface_condition": "潮湿",
            "traffic_volume": 950,
        }),
    ]
    results1 = apply_rework(run1, rework_corrections)
    for r in results1:
        if r.record_id == "RC-004":
            print(f"  RC-004 返工后状态={r.status.value}")

    # ── 生成第一次报告 ──
    print("\n>>> 生成第一次运行报告\n")
    report1 = reporter.generate_report(
        run_id="RUN-001",
        results=results1,
        validation_issues=run1['validation_issues'],
        snapshot=run1['snapshot'],
        diffs=run1['diffs'],
        reviews=reviews1,
        audit_trail=audit_trail,
        rejected=run1['rejected'],
    )
    print(report1)

    # ── 第二次运行：修正后的数据重跑 ──
    print("\n\n>>> 第二次运行: 修正后数据重跑，对比指标变化\n")
    run2 = run_pipeline(
        get_rerun_sample_data(),
        run_id="RUN-002",
        audit_trail=audit_trail,
        prev_snapshot=run1['snapshot'],
        prev_results=run1['results'],
    )

    print(f"第二次运行指标:")
    print(f"  总记录数: {run2['snapshot'].total_records}")
    print(f"  缺失记录数: {run2['snapshot'].missing_count}")
    print(f"  修补成功数: {run2['snapshot'].imputed_count}")
    print(f"  平均置信度: {run2['snapshot'].avg_confidence:.2%}")

    if run2['diffs']:
        print(f"\n与第一次运行对比:")
        for d in run2['diffs']:
            print(f"  {d.metric_name}: {d.previous_value} → {d.current_value}  原因: {d.cause}")

    # ── 审计追踪：样本变化与指标变化分开解释 ──
    print("\n>>> 审计追踪: 两次运行对比分析\n")
    explanation = audit_trail.explain_run_diff("RUN-001", "RUN-002")
    print(f"  样本变化: {explanation['sample_change']}")
    print(f"  指标变化: {explanation['metric_change']}")
    print(f"  综合解释: {explanation['explanation']}")

    # ── 查看单条记录审计链 ──
    print("\n>>> 单条记录审计追踪: RC-004\n")
    print(audit_trail.format_audit_for_record("RC-004"))

    # ── 导出结果表格 ──
    print("\n>>> 第一次运行导出（含被拒绝记录，可直接对接看板）\n")
    export_rows1 = reporter.export_results_table(
        results1,
        rejected=run1.get('rejected'),
        validation_issues=run1['validation_issues'],
    )
    for row in export_rows1:
        print(json.dumps(row, ensure_ascii=False, default=str))

    print("\n>>> 第二次运行导出（修正后数据，可直接对接看板）\n")
    export_rows2 = reporter.export_results_table(
        run2['results'],
        rejected=run2.get('rejected'),
        validation_issues=run2['validation_issues'],
    )
    for row in export_rows2:
        print(json.dumps(row, ensure_ascii=False, default=str))


if __name__ == "__main__":
    main()
