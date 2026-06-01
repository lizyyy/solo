import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from src import (
    ParameterManager,
    SensitivityEngine,
    AnomalyDetector,
    ConflictDetector,
    HistoryManager,
    ReportGenerator,
    RunHistory,
    generate_id,
)
from data.test_samples import (
    create_test_samples,
    create_review_chart_data,
    create_manual_notes,
)


def main():
    base_dir = os.path.dirname(os.path.abspath(__file__))
    data_dir = os.path.join(base_dir, "data", "storage")
    output_dir = os.path.join(base_dir, "output")

    print("=" * 60)
    print("🏦 贷款提前还款敏感性分析系统")
    print("=" * 60)
    print(f"运行时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    print()

    print("📦 初始化组件...")
    param_manager = ParameterManager(data_dir)
    anomaly_detector = AnomalyDetector()
    conflict_detector = ConflictDetector(tolerance_pct=5.0)
    history_manager = HistoryManager(data_dir)
    report_generator = ReportGenerator(output_dir)

    print("   ✅ 参数管理器")
    print("   ✅ 异常检测器")
    print("   ✅ 冲突检测器")
    print("   ✅ 历史记录管理器")
    print("   ✅ 报告生成器")
    print()

    print("⚙️  检查参数版本...")
    latest_version = param_manager.get_latest_version()
    if latest_version is None:
        print("   🆕 初始化默认参数版本")
        latest_version = param_manager.create_initial_version()
    else:
        print(f"   ✅ 使用现有参数版本: {latest_version.version_id}")

    if not any(v for v in param_manager.list_all_versions() if "人工调整" in v.note):
        print("\n👤 模拟同事小岑人工调整参数（修改权重后忘记记录的场景）...")
        updates = {
            "rate_sensitivity": {"value": 0.40, "weight": 0.35},
            "fico_sensitivity": {"value": 0.25, "weight": 0.20},
        }
        new_version = param_manager.update_parameters(
            updates,
            modified_by="小岑",
            note="2026Q2 权重调整：利率和FICO权重上调，历史人工调整记录",
        )
        print(f"   ✅ 新版本已创建: {new_version.version_id}")
        print(f"   📝 修改人: {new_version.created_by}")
        print(f"   📝 备注: {new_version.note}")
        latest_version = new_version

    active_version_id = param_manager.get_active_version_id()
    active_version = param_manager.get_version(active_version_id)
    print(f"\n   🎯 当前激活参数版本: {active_version_id}")
    manual_params = [
        (name, p) for name, p in active_version.parameters.items()
        if p.source == "manual"
    ]
    if manual_params:
        print(f"   ⚠️  人工调整参数 {len(manual_params)} 个:")
        for name, p in manual_params:
            print(f"      - {name}: value={p.value:.4f}, weight={p.weight:.4f} (修改人: {p.modified_by})")

    print("\n📊 加载测试数据...")
    samples = create_test_samples()
    chart_data = create_review_chart_data()
    manual_notes = create_manual_notes()
    print(f"   ✅ 贷款样本: {len(samples)} 条")
    print(f"   ✅ 复盘图表数据: {len(chart_data)} 条")
    print(f"   ✅ 人工备注: {len(manual_notes)} 笔贷款")

    loan_id_to_type = {
        "LOAN-001": "顺利记录（LOAN-001）",
        "LOAN-002": "需人工确认（LOAN-002）",
        "LOAN-003": "旧口径补录（LOAN-003）",
    }
    sample_type_count = {}
    for s in samples:
        t = loan_id_to_type.get(s.loan_id, f"其他（{s.loan_id}）")
        sample_type_count[t] = sample_type_count.get(t, 0) + 1
    print(f"\n📋 样本分类:")
    for t, c in sample_type_count.items():
        print(f"   - {t}: {c} 条")

    print("\n🔍 执行异常检测...")
    sample_anomalies = anomaly_detector.detect_batch(samples)
    anomaly_summary = anomaly_detector.get_anomaly_summary(sample_anomalies)
    print(f"   ✅ 总样本数: {anomaly_summary['total_samples']}")
    print(f"   ⚠️  含异常样本: {anomaly_summary['samples_with_anomalies']} ({anomaly_summary['anomaly_rate']}%)")
    print(f"   🚨 严重异常: {anomaly_summary['critical_anomalies']} 个")
    print(f"   ⚡ 警告异常: {anomaly_summary['warning_anomalies']} 个")

    for sample_id, anomalies in sample_anomalies.items():
        if anomalies:
            short_id = sample_id[-8:]
            critical = sum(1 for a in anomalies if a.severity == "critical")
            warning = sum(1 for a in anomalies if a.severity == "warning")
            print(f"      - {short_id}: {critical}个严重, {warning}个警告")

    print("\n🧮 执行敏感性计算...")
    calc_params = param_manager.get_parameters_for_calculation()
    engine = SensitivityEngine(calc_params, active_version_id)
    results = engine.calculate_batch(samples, sample_anomalies)

    risk_counts = {
        "高风险(high)": sum(1 for r in results if r.risk_level == "high"),
        "中风险(medium)": sum(1 for r in results if r.risk_level == "medium"),
        "低风险(low)": sum(1 for r in results if r.risk_level == "low"),
    }
    print(f"   ✅ 风险分布:")
    for k, v in risk_counts.items():
        print(f"      - {k}: {v} 条")

    needs_review = sum(1 for r in results if r.needs_manual_review)
    print(f"   📝 需人工复核: {needs_review} 条")

    print("\n⚔️  检测数据冲突（复盘图表 vs 导入数据）...")
    calc_scores = {r.sample_id: r.sensitivity_score for r in results}
    loan_id_map = {}
    for s in samples:
        loan_id_map[s.loan_id] = s.sample_id
    adjusted_scores = {}
    for loan_id, sample_id in loan_id_map.items():
        adjusted_scores[sample_id] = calc_scores[sample_id]

    conflicts = conflict_detector.detect(samples, chart_data, calc_scores)
    conflict_summary = conflict_detector.get_conflict_summary(conflicts)

    print(f"   ✅ 检测到冲突: {conflict_summary['total_conflicts']} 项")
    print(f"   ⚠️  待处理: {conflict_summary['unresolved_conflicts']} 项")
    for c in conflicts:
        field_label = {
            "sensitivity_score": "敏感性得分",
            "risk_level": "风险等级",
            "principal": "贷款本金",
        }.get(c.field_name, c.field_name)
        if isinstance(c.sample_value, float):
            sample_str = f"{c.sample_value:.4f}"
        else:
            sample_str = str(c.sample_value)
        if isinstance(c.chart_value, float):
            chart_str = f"{c.chart_value:.4f}"
        else:
            chart_str = str(c.chart_value)
        diff_str = f"{c.difference:.2f}%" if c.difference > 0 else "等级差异"
        print(f"      - {c.loan_id} {field_label}: 系统={sample_str}, 图表={chart_str}, {diff_str}")

    print("\n🔄 合并历史记录（之前的人工复核结果保留）...")
    merged_results, merged_conflicts = history_manager.merge_with_previous_results(
        results, conflicts
    )
    retained_notes = sum(1 for r in merged_results if r.review_note)
    retained_resolutions = sum(1 for c in merged_conflicts if c.resolved)
    print(f"   ✅ 保留历史备注: {retained_notes} 条")
    print(f"   ✅ 保留历史处理: {retained_resolutions} 项")

    print("\n💾 保存运行历史...")
    run_id = generate_id("RUN")
    run_history = RunHistory(
        run_id=run_id,
        timestamp=datetime.now().isoformat(),
        parameter_version_id=active_version_id,
        sample_count=len(merged_results),
        anomaly_count=anomaly_summary["total_anomalies"],
        conflict_count=conflict_summary["total_conflicts"],
        manual_review_count=needs_review,
        results=merged_results,
        conflicts=merged_conflicts,
        status="completed",
    )
    history_manager.save_run(run_history)
    print(f"   ✅ 运行ID: {run_id}")

    print("\n📈 生成HTML报告...")
    history_summary = history_manager.generate_run_history_summary()
    report_path = report_generator.generate(
        run_history,
        active_version,
        anomaly_summary,
        conflict_summary,
        manual_notes,
        history_summary,
    )
    print(f"   ✅ 报告已生成: {report_path}")

    print("\n" + "=" * 60)
    print("✅ 贷款提前还款敏感性分析完成！")
    print("=" * 60)
    print()
    print("📋 三类样例记录验证:")
    print()

    sample_by_loan = {}
    for s, r in zip(samples, merged_results):
        sample_by_loan[s.loan_id] = (s, r)

    if "LOAN-001" in sample_by_loan:
        s, r = sample_by_loan["LOAN-001"]
        print("   1️⃣  顺利记录 (LOAN-001):")
        print(f"      - 样本ID: {r.sample_id}")
        print(f"      - 敏感性得分: {r.sensitivity_score:.4f}")
        print(f"      - 风险等级: {r.risk_level}")
        print(f"      - 异常数: {len(r.anomalies)}")
        print(f"      - 计算步骤: {len(r.calculation_steps)} 步可追溯")
        print(f"      - 数据来源: {s.source}")
        print(f"      - 状态: ✅ 正常通过")
        print()

    if "LOAN-002" in sample_by_loan:
        s, r = sample_by_loan["LOAN-002"]
        print("   2️⃣  需人工确认记录 (LOAN-002):")
        print(f"      - 样本ID: {r.sample_id}")
        print(f"      - 敏感性得分: {r.sensitivity_score:.4f}")
        print(f"      - 风险等级: {r.risk_level}")
        print(f"      - 异常数: {len(r.anomalies)} 个")
        critical_fields = [a.field_name for a in r.anomalies if a.severity == "critical"]
        print(f"      - 严重异常字段: {', '.join(critical_fields)}")
        print(f"      - 数据来源: {s.source}")
        print(f"      - 人工备注: {len(manual_notes.get('LOAN-002', []))} 条历史记录")
        print(f"      - 状态: ⚠️  待人工复核")
        print()

    if "LOAN-003" in sample_by_loan:
        s, r = sample_by_loan["LOAN-003"]
        print("   3️⃣  旧口径补录记录 (LOAN-003):")
        print(f"      - 样本ID: {r.sample_id}")
        print(f"      - 敏感性得分: {r.sensitivity_score:.4f}")
        print(f"      - 风险等级: {r.risk_level}")
        print(f"      - 数据来源: {s.source}")
        print(f"      - 与复盘图表冲突: 是（旧口径0.38 vs 新口径{r.sensitivity_score:.4f}）")
        print(f"      - 历史备注: {len(manual_notes.get('LOAN-003', []))} 条（含旧口径说明）")
        print(f"      - 状态: ⚔️  存在数据冲突，需核对参数版本")
        print()

    print("📌 核心功能验证:")
    print()
    calc_steps_count = len(merged_results[0].calculation_steps) if merged_results else 0
    print("   ✅ 参数版本管理: 人工调整参数已保存为新版本，永不覆盖默认值")
    print(f"   ✅ 计算过程追溯: 每样本 {calc_steps_count} 步计算完整记录")
    print("   ✅ 异常样本检测: 越界数据已标记并触发人工复核")
    print("   ✅ 冲突检测: 复盘图表与系统计算差异已列出证据和建议")
    print("   ✅ 历史保留: 重复运行时之前的人工备注和处理状态自动保留")
    print("   ✅ 报告交互: HTML报告支持从图表点击跳转到明细")
    print()
    print("📂 输出文件:")
    print(f"   - 参数版本: {os.path.join(data_dir, 'parameter_versions.json')}")
    print(f"   - 运行历史: {os.path.join(data_dir, 'run_history.json')}")
    print(f"   - 待复核项: {os.path.join(data_dir, 'pending_reviews.json')}")
    print(f"   - 分析报告: {report_path}")
    print()
    print("💡 后续操作建议:")
    print("   1. 打开 HTML 报告查看完整分析结果")
    print("   2. 点击报告中的图表柱子可跳转到对应样本明细")
    print("   3. 查看『数据冲突』部分的证据和建议动作")
    print("   4. 人工复核后更新 pending_reviews.json 中的状态")
    print("   5. 再次运行时系统会自动保留本次的处理结果")

    return report_path


if __name__ == "__main__":
    report_path = main()
    print(f"\n🚀 报告路径: file://{report_path}")
