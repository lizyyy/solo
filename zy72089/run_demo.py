"""演示脚本 - 完整展示钢琴练习进步曲线分析系统的所有功能"""

import json
import os
import sys
from datetime import datetime

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from piano_progress.tracer import DataTracer
from piano_progress.calculator import ProgressCalculator
from piano_progress.reporter import ReportGenerator


def print_section(title):
    """打印章节标题"""
    line = "=" * 70
    print(f"\n{line}")
    print(f"  {title}")
    print(f"{line}\n")


def demo_basic_analysis():
    """演示1：基础分析"""
    print_section("🎹 演示1：基础分析 - 日常练习记录")

    with open("data/params.json", "r", encoding="utf-8") as f:
        params = json.load(f)
    with open("data/records.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        records = data["records"]

    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    print("📊 正在分析 8 条日常练习记录...")
    print(f"   统计周期: {records[0]['date']} ~ {records[-1]['date']}")
    print()

    scores, summary = calculator.calculate_curve(records, "data/records.json")

    sections = [
        reporter.generate_header("🎹 钢琴练习进步曲线分析报告"),
        reporter.generate_summary(summary),
        reporter.generate_progress_table(scores),
        reporter.generate_exception_list(scores),
        reporter.generate_alert_summary(scores),
    ]

    reporter.print_report(sections, "console")

    # 保存报告
    os.makedirs("report", exist_ok=True)
    with open("report/basic_analysis.md", "w", encoding="utf-8") as f:
        md_report = reporter.print_report(sections, "markdown")
        f.write(md_report)

    print(f"\n💾 报告已保存到: report/basic_analysis.md")

    return scores, summary, tracer


def demo_sample_records():
    """演示2：三类样例记录"""
    print_section("🎯 演示2：三类样例记录 - 顺利/待确认/旧口径")

    with open("data/params.json", "r", encoding="utf-8") as f:
        params = json.load(f)
    with open("data/sample_records.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        records = data["records"]
    with open("data/history_samples.json", "r", encoding="utf-8") as f:
        history_data = json.load(f)
        history_samples = history_data["records"]
    with open("data/legacy_mapping.json", "r", encoding="utf-8") as f:
        legacy_map = json.load(f)

    tracer = DataTracer()

    # 标记旧口径记录
    for record in records:
        rid = record.get("record_id", "")
        if rid in legacy_map:
            criteria = legacy_map[rid]
            matched = tracer.find_legacy_record(criteria, history_samples, rid)
            if matched:
                record["_source_type"] = "legacy"
                record["_legacy_source"] = matched

    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    print("📋 三类样例记录说明:")
    print("  ✅ REC-SMOOTH-001  - 顺利记录，所有指标正常")
    print("  ⚠️  REC-CONFIRM-001 - 待人工确认，练习时长低于软下限")
    print("  📜 REC-LEGACY-001  - 旧口径补录，从历史样本匹配")
    print("  📜 REC-LEGACY-002  - 旧口径补录，从历史样本匹配")
    print()

    scores, summary = calculator.calculate_curve(records, "data/sample_records.json")

    sections = [
        reporter.generate_header("🎯 样例记录分析报告"),
        reporter.generate_summary(summary),
        reporter.generate_progress_table(scores),
        reporter.generate_exception_list(scores),
    ]

    reporter.print_report(sections, "console")

    # 查看追溯链
    print("\n" + "=" * 70)
    print("  🔍 查看 REC-LEGACY-001 的完整追溯链")
    print("=" * 70)
    trace_section = reporter.generate_trace_report("REC-LEGACY-001")
    reporter.print_report([trace_section], "console")

    # 保存报告
    with open("report/sample_analysis.md", "w", encoding="utf-8") as f:
        md_report = reporter.print_report(
            sections + [trace_section], "markdown"
        )
        f.write(md_report)

    print(f"\n💾 报告已保存到: report/sample_analysis.md")

    return scores, summary, tracer


def demo_outlier_analysis():
    """演示3：越界样本分析"""
    print_section("🚨 演示3：越界样本分析 - 明显越界的样本")

    with open("data/params.json", "r", encoding="utf-8") as f:
        params = json.load(f)
    with open("data/outliers.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        records = data["records"]

    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    print("⚠️  本次分析包含 3 条明显越界的样本:")
    for r in records:
        print(f"  - {r['record_id']}: {r['_notes'][0]}")
    print()

    scores, summary = calculator.calculate_curve(records, "data/outliers.json", include_prediction=False)

    sections = [
        reporter.generate_header("🚨 越界样本分析报告"),
        reporter.generate_summary(summary),
        reporter.generate_progress_table(scores),
        reporter.generate_exception_list(scores),
        reporter.generate_alert_summary(scores),
    ]

    reporter.print_report(sections, "console")

    with open("report/outlier_analysis.md", "w", encoding="utf-8") as f:
        md_report = reporter.print_report(sections, "markdown")
        f.write(md_report)

    print(f"\n💾 报告已保存到: report/outlier_analysis.md")

    return scores, summary, tracer


def demo_note_diff():
    """演示4：补录备注并对比差异"""
    print_section("📝 演示4：补录备注并对比差异")

    with open("data/params.json", "r", encoding="utf-8") as f:
        params = json.load(f)
    with open("data/records.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        records = data["records"]

    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)
    reporter = ReportGenerator(tracer)

    record_id = "REC-006"
    note = "已与学员确认，2026-05-25当天有期末考试，确实只有10分钟练习时间，属真实情况，无需修正"

    # 第一次计算
    print("📊 第一次计算（补录备注前）")
    print("-" * 40)
    scores_before, _ = calculator.calculate_curve(records, "data/records.json", include_prediction=False)

    # 显示REC-006的状态
    rec_before = [s for s in scores_before if s.record_id == record_id][0]
    print(f"  {record_id} 当前状态: {'⚠️ 待人工确认' if rec_before.need_manual_confirm else '✓ 正常'}")
    if rec_before.confirm_reason:
        print(f"  待确认原因: {rec_before.confirm_reason}")

    # 补录备注
    print(f"\n📝 补录备注: {note}")
    for rec in records:
        if rec.get("record_id") == record_id:
            if "_notes" not in rec:
                rec["_notes"] = []
            timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            rec["_notes"].append(f"[{timestamp}] {note}")
            traces = tracer.get_record_history(record_id)
            if traces:
                tracer.add_note(traces[0].trace_id, note)
            break

    # 第二次计算
    print("\n📊 第二次计算（补录备注后）")
    print("-" * 40)
    scores_after, _ = calculator.calculate_curve(records, "data/records.json", include_prediction=False)

    rec_after = [s for s in scores_after if s.record_id == record_id][0]
    print(f"  {record_id} 当前状态: {'⚠️ 待人工确认' if rec_after.need_manual_confirm else '✓ 正常'}")

    # 生成差异报告
    sections = [
        reporter.generate_header("📝 备注补录差异分析报告"),
        reporter.generate_diff_report(scores_before, scores_after, note),
        reporter.generate_progress_table(scores_after),
        reporter.generate_exception_list(scores_after),
    ]

    reporter.print_report(sections, "console")

    with open("report/diff_analysis.md", "w", encoding="utf-8") as f:
        md_report = reporter.print_report(sections, "markdown")
        f.write(md_report)

    print(f"\n💾 差异报告已保存到: report/diff_analysis.md")

    return scores_before, scores_after, tracer


def demo_prediction_reasoning():
    """演示5：预测及理由说明"""
    print_section("🔮 演示5：趋势预测及理由说明")

    with open("data/params.json", "r", encoding="utf-8") as f:
        params = json.load(f)
    with open("data/records.json", "r", encoding="utf-8") as f:
        data = json.load(f)
        records = data["records"]

    tracer = DataTracer()
    calculator = ProgressCalculator(params, tracer)

    scores, summary = calculator.calculate_curve(records, "data/records.json")

    print("📈 历史进步分数趋势:")
    print("-" * 50)
    for i, s in enumerate(scores, 1):
        bar = "█" * int(s.total_score / 5)
        print(f"  {s.date}: {s.total_score:6.2f} {bar}")

    print()
    print("🔮 下期预测:")
    print("-" * 50)
    print(f"  预测分数: {summary['next_predicted_score']:.2f}")
    print(f"  整体趋势: {summary['trend']}")
    print()
    print("  📝 预测理由:")
    print(f"     {summary['prediction_reason']}")
    print()
    print("  📊 预测详情:")
    details = summary["prediction_details"]
    print(f"     - 预测方法: {details.get('method', 'N/A')}")
    print(f"     - 回看天数: {details.get('lookback_days', 'N/A')}")
    print(f"     - 近期平均: {details.get('average', 0):.2f}")
    if "slope" in details:
        print(f"     - 趋势斜率: {details['slope']:.3f}")
        print(f"     - 趋势判断: {details.get('trend', 'N/A')}")

    # 预测说明
    print()
    print("💡 如何使用预测结果:")
    print("  1. 如果预测呈'上升'趋势，可适当增加练习难度")
    print("  2. 如果预测呈'下降'趋势，需要检查近期练习效率")
    print("  3. 如果预测'平稳'，可能处于平台期，建议调整练习内容")
    print("  4. 预测仅供参考，请结合实际情况做出判断")


def main():
    """主函数"""
    print("\n" + "=" * 70)
    print("  🎹 钢琴练习进步曲线分析系统 - 完整演示")
    print("=" * 70)
    print()
    print("  本演示将展示以下功能:")
    print("  1. 基础分析 - 日常练习记录计算")
    print("  2. 样例记录 - 三类典型记录分析")
    print("  3. 越界检测 - 异常样本识别与提醒")
    print("  4. 备注补录 - 差异对比与追溯")
    print("  5. 趋势预测 - 包含详细理由说明")
    print()

    try:
        demo_basic_analysis()
        demo_sample_records()
        demo_outlier_analysis()
        demo_note_diff()
        demo_prediction_reasoning()

        print_section("✅ 演示完成")
        print("📁 生成的报告文件:")
        for f in os.listdir("report"):
            if f.endswith(".md"):
                size = os.path.getsize(os.path.join("report", f))
                print(f"  - report/{f} ({size} bytes)")

        print()
        print("💡 提示: 可以直接在浏览器中打开 Markdown 文件查看报告")
        print()
        print("🎯 运行测试命令:")
        print("  python -m pytest tests/test_calculator.py -v")
        print("  python -m unittest tests.test_calculator -v")
        print()

    except Exception as e:
        print(f"\n❌ 演示出错: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    main()
