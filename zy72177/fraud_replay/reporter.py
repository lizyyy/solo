import pandas as pd
import numpy as np
from datetime import datetime
from typing import Dict, List, Optional
from tabulate import tabulate
from .config import Config, DEFAULT_CONFIG


class ReportGenerator:
    def __init__(self, config: Config = DEFAULT_CONFIG):
        self.config = config
        self.processing_log = []

    def generate_report(self,
                       processed_df: pd.DataFrame,
                       sample_summary: Dict,
                       model_summary: Dict,
                       review_summary: Dict,
                       metrics: Dict,
                       errors: Dict,
                       run_comparison: Optional[Dict] = None) -> str:
        self._log("=== 开始生成报告 ===")

        report = []
        report.append(self._generate_header())
        report.append(self._generate_data_overview(sample_summary, processed_df))
        report.append(self._generate_issue_warnings(sample_summary, model_summary))
        report.append(self._generate_label_section(review_summary))
        report.append(self._generate_metrics_section(metrics))
        report.append(self._generate_error_analysis(errors))

        if run_comparison:
            report.append(self._generate_comparison_section(run_comparison))

        report.append(self._generate_business_advice(sample_summary, model_summary, metrics, errors))
        report.append(self._generate_footer(processed_df))

        return "\n\n".join(report)

    def _generate_header(self) -> str:
        now = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        pad = ' ' * 38
        return (
            "\n╔══════════════════════════════════════════════════════════════╗\n"
            "║                     信贷欺诈样本回放报告                        ║\n"
            "╠══════════════════════════════════════════════════════════════╣\n"
            "║  生成时间: {now:<45}║\n"
            "║  工具版本: v1.0.0{pad}║\n"
            "║  分析师备注: 小乔同学整理，有问题直接喊我~                     ║\n"
            "╚══════════════════════════════════════════════════════════════╝\n"
        ).format(now=now, pad=pad).strip()

    def _generate_data_overview(self, sample_summary: Dict, df: pd.DataFrame) -> str:
        section = []
        section.append("📊 一、数据概览")
        section.append("─" * 60)

        overview_data = [
            ["总样本数", sample_summary.get("total_records", 0)],
            ["唯一用户数", sample_summary.get("unique_users", 0)],
            ["欺诈样本数", int(sample_summary.get("fraud_count", 0))],
            ["欺诈率", "{:.1%}".format(sample_summary.get("fraud_ratio", 0))],
        ]

        section.append(tabulate(overview_data, tablefmt="simple"))

        sources = sample_summary.get("sources", {})
        if sources:
            section.append("\n📋 数据来源分布:")
            for source, count in sources.items():
                section.append("  • {}: {} 条".format(source, count))

        time_range = sample_summary.get("time_range", {})
        if time_range.get("earliest") and time_range.get("latest"):
            section.append("\n⏰ 时间范围: {} ~ {}".format(time_range['earliest'], time_range['latest']))

        return "\n".join(section)

    def _generate_issue_warnings(self, sample_summary: Dict, model_summary: Dict) -> str:
        section = []
        section.append("⚠️ 二、问题预警")
        section.append("─" * 60)

        issues_found = []

        empty_issues = sample_summary.get("empty_value_issues", [])
        if empty_issues:
            section.append("\n🔍 空值问题:")
            for issue in empty_issues:
                section.append("  • 列 [{}]: {} 个空值 ({:.1%})".format(
                    issue['column'], issue['count'], issue['ratio']))
                if issue['count'] > 10:
                    issues_found.append("【注意】{} 空值较多，可能影响模型评估".format(issue['column']))

        dup_issues = sample_summary.get("duplicate_issues", [])
        if dup_issues:
            section.append("\n🔁 重复样本: 共发现 {} 组重复记录".format(len(dup_issues)))
            for issue in dup_issues[:3]:
                section.append("  • key={}...: {} 条，来源: {}".format(
                    issue['key'][:20], issue['count'], issue['sources']))
            issues_found.append("重复样本已自动去重，保留首条记录")

        boundary_issues = sample_summary.get("boundary_issues", [])
        if boundary_issues:
            section.append("\n📌 边界记录提醒:")
            for issue in boundary_issues:
                section.append("  • {}: {} 条".format(issue['description'], issue['count']))

        label_conflicts = model_summary.get("label_conflict_count", 0)
        if label_conflicts > 0:
            ratio = model_summary.get("label_conflict_ratio", 0)
            section.append("\n🚨 标签冲突: {} 条记录存在标签不一致 ({:.1%})".format(label_conflicts, ratio))
            section.append("  → 建议: 这些样本需要重点复核，确认正确标签")
            if ratio >= 0.05:
                issues_found.append("标签冲突比例较高，请优先处理！")

        leakage = model_summary.get("leakage_candidate_count", 0)
        if leakage > 0:
            section.append("\n💧 潜在样本泄漏: 发现 {} 组同一用户短期内多次申请".format(leakage))
            section.append("  → 建议: 检查这些样本是否应该纳入训练集，避免时间泄漏")
            issues_found.append("样本泄漏可能导致模型虚高，需排查")

        if not issues_found and not empty_issues and not dup_issues and not boundary_issues:
            section.append("\n✅ 数据质量良好，未发现明显问题")

        return "\n".join(section)

    def _generate_label_section(self, review_summary: Dict) -> str:
        section = []
        section.append("🏷️ 三、标签情况")
        section.append("─" * 60)

        label_sources = review_summary.get("label_source_distribution", {})
        if label_sources:
            section.append("\n标签来源分布:")
            for source, count in label_sources.items():
                section.append("  • {}: {} 条".format(source, count))

        changed = review_summary.get("label_changed_count", 0)
        if changed:
            section.append("\n🔄 标签变更记录: {} 条样本标签发生了变化".format(changed))

        return "\n".join(section)

    def _generate_metrics_section(self, metrics: Dict) -> str:
        section = []
        section.append("📈 四、模型指标")
        section.append("─" * 60)

        if not metrics:
            section.append("无有效指标数据")
            return "\n".join(section)

        metrics_data = [
            ["样本总数", metrics.get("sample_count", 0)],
            ["欺诈样本", metrics.get("positive_count", 0)],
            ["正常样本", metrics.get("negative_count", 0)],
            ["欺诈占比", "{:.1%}".format(metrics.get("positive_ratio", 0))],
            ["", ""],
            ["准确率", "{:.4f}".format(metrics.get("accuracy", 0))],
            ["精确率", "{:.4f}".format(metrics.get("precision", 0))],
            ["召回率", "{:.4f}".format(metrics.get("recall", 0))],
            ["F1分数", "{:.4f}".format(metrics.get("f1", 0))],
        ]

        if metrics.get("roc_auc"):
            metrics_data.append(["AUC", "{:.4f}".format(metrics.get("roc_auc", 0))])

        section.append(tabulate(metrics_data, tablefmt="simple"))

        section.append("\n📊 混淆矩阵:")
        cm_data = [
            ["", "预测正常", "预测欺诈"],
            ["实际正常", metrics.get("tn", 0), metrics.get("fp", 0)],
            ["实际欺诈", metrics.get("fn", 0), metrics.get("tp", 0)],
        ]
        section.append(tabulate(cm_data, tablefmt="grid"))

        if metrics.get("best_threshold"):
            section.append("\n💡 最佳阈值建议: {:.4f}".format(metrics['best_threshold']))
            section.append("   (F1={:.4f}, 精确率={:.4f}, 召回率={:.4f})".format(
                metrics.get('best_f1', 0),
                metrics.get('best_precision', 0),
                metrics.get('best_recall', 0)))

        return "\n".join(section)

    def _generate_error_analysis(self, errors: Dict) -> str:
        section = []
        section.append("🔍 五、错误分析")
        section.append("─" * 60)

        fp_count = errors.get("fp_count", 0)
        fn_count = errors.get("fn_count", 0)

        if fp_count == 0 and fn_count == 0:
            section.append("\n🎉 完美！没有预测错误的样本")
            return "\n".join(section)

        section.append("\n❌ 误报 (FP): {} 条 - 模型说有风险，其实没问题".format(fp_count))
        if fp_count > 0:
            section.append("  → 影响: 增加人工审核工作量，可能影响用户体验")
            section.append("  → 建议: 可以考虑调高阈值，或优化模型降低假阳性")

        section.append("\n⚠️  漏报 (FN): {} 条 - 模型没发现，实际有欺诈".format(fn_count))
        if fn_count > 0:
            section.append("  → 影响: 可能造成资金损失，风险较高！")
            section.append("  → 建议: 重点分析这些漏报样本的特征，补充训练数据")

        fp_df = errors.get("false_positives")
        fn_df = errors.get("false_negatives")

        if fp_df is not None and not fp_df.empty:
            section.append("\n📋 误报样本示例 (前5条):")
            cols = [c for c in ["sample_id", "user_id", "model_score", "loan_amount", "source"] if c in fp_df.columns]
            section.append(fp_df[cols].head().to_string(index=False))

        if fn_df is not None and not fn_df.empty:
            section.append("\n📋 漏报样本示例 (前5条):")
            cols = [c for c in ["sample_id", "user_id", "model_score", "loan_amount", "source"] if c in fn_df.columns]
            section.append(fn_df[cols].head().to_string(index=False))

        return "\n".join(section)

    def _generate_comparison_section(self, comparison: Dict) -> str:
        section = []
        section.append("🔄 六、两次运行对比")
        section.append("─" * 60)

        sample_diff = comparison.get("sample_diff", {})
        metric_diff = comparison.get("metric_diff", {})
        slc = comparison.get("sample_level_changes", {})
        slc_sample = slc.get("sample_changes", {})
        slc_metric = slc.get("metric_changes", {})
        score_lookup = comparison.get("_score_lookup", {})

        section.append("\n对比: {} vs {}".format(
            comparison.get('run1_name', '前次'),
            comparison.get('run2_name', '本次')))

        section.append("\n📊 汇总样本变化:")
        sample_data = [
            ["", comparison.get('run1_name', '前次'), comparison.get('run2_name', '本次'), "变化"],
            ["样本总数", sample_diff.get("run1_count", 0), sample_diff.get("run2_count", 0),
             "{:+d}".format(sample_diff.get("count_change", 0))],
            ["欺诈样本", sample_diff.get("run1_positive", 0), sample_diff.get("run2_positive", 0),
             "{:+d}".format(sample_diff.get("positive_change", 0))],
        ]
        section.append(tabulate(sample_data, tablefmt="simple"))

        section.append("\n🔍 样本级明细变化:")
        sample_level_data = [
            ["前次样本数", slc_sample.get("total_run1", "-")],
            ["本次样本数", slc_sample.get("total_run2", "-")],
            ["共有样本数", slc_sample.get("common_samples_count", "-")],
            ["新增样本", slc_sample.get("new_samples_count", 0)],
            ["移除样本", slc_sample.get("removed_samples_count", 0)],
            ["共有样本中分数变化", slc_metric.get("score_changed_count", 0)],
            ["分数变化占比", "{:.1%}".format(slc_metric.get("score_changed_ratio", 0)) if slc_metric else "N/A"],
            ["分数平均变化", "{:+.4f}".format(slc_metric.get("score_diff_mean", 0)) if slc_metric else "N/A"],
            ["分数变化标准差", "{:.4f}".format(slc_metric.get("score_diff_std", 0)) if slc_metric else "N/A"],
        ]
        section.append(tabulate(sample_level_data, tablefmt="simple"))

        new_ids = slc_sample.get("new_sample_ids", [])
        removed_ids = slc_sample.get("removed_sample_ids", [])

        if new_ids:
            section.append("\n📥 新增样本 ID ({} 条，只列前20):".format(len(new_ids)))
            section.append("  " + ", ".join(new_ids[:20]))
            if len(new_ids) > 20:
                section.append("  ... 其余 {} 条略".format(len(new_ids) - 20))

        if removed_ids:
            section.append("\n📤 移除样本 ID ({} 条，只列前20):".format(len(removed_ids)))
            section.append("  " + ", ".join(removed_ids[:20]))
            if len(removed_ids) > 20:
                section.append("  ... 其余 {} 条略".format(len(removed_ids) - 20))

        if slc_metric:
            top_inc = slc_metric.get("top_increases", {})
            top_dec = slc_metric.get("top_decreases", {})

            if top_inc:
                section.append("\n⬆️  模型分数涨幅 TOP (本次 - 前次):")
                inc_rows = [["sample_id", "前次分", "本次分", "涨分"]]
                for sid, diff in list(top_inc.items())[:10]:
                    prev_s, curr_s = "-", "-"
                    if sid in score_lookup:
                        prev_s = "{:.4f}".format(score_lookup[sid][0])
                        curr_s = "{:.4f}".format(score_lookup[sid][1])
                    inc_rows.append([sid, prev_s, curr_s, "{:+.4f}".format(diff)])
                section.append(tabulate(inc_rows, tablefmt="simple"))

            if top_dec:
                section.append("\n⬇️  模型分数跌幅 TOP (本次 - 前次):")
                dec_rows = [["sample_id", "前次分", "本次分", "跌分"]]
                for sid, diff in list(top_dec.items())[:10]:
                    prev_s, curr_s = "-", "-"
                    if sid in score_lookup:
                        prev_s = "{:.4f}".format(score_lookup[sid][0])
                        curr_s = "{:.4f}".format(score_lookup[sid][1])
                    dec_rows.append([sid, prev_s, curr_s, "{:+.4f}".format(diff)])
                section.append(tabulate(dec_rows, tablefmt="simple"))

        if metric_diff:
            section.append("\n📈 汇总指标变化:")
            metric_data = [["指标", "前次", "本次", "变化(%)"]]
            for key, value in metric_diff.items():
                diff_pct = value.get("diff_pct")
                diff_str = "{:+.1f}%".format(diff_pct) if diff_pct is not None else "N/A"
                metric_data.append([
                    key.upper(),
                    "{:.4f}".format(value.get("run1", 0)),
                    "{:.4f}".format(value.get("run2", 0)),
                    diff_str
                ])
            section.append(tabulate(metric_data, tablefmt="simple"))

            section.append("\n💡 复盘说明:")
            recall_diff = metric_diff.get("recall", {}).get("diff", 0)
            precision_diff = metric_diff.get("precision", {}).get("diff", 0)
            changed_count = slc_metric.get("score_changed_count", 0) if slc_metric else 0
            new_count = slc_sample.get("new_samples_count", 0)
            removed_count = slc_sample.get("removed_samples_count", 0)

            if new_count or removed_count:
                section.append(
                    "  🧾 样本组成有变化: 新增 {} 条、移除 {} 条，指标变化受样本集合影响".format(
                        new_count, removed_count))
            else:
                section.append("  🧾 样本集合相同，指标变化仅来自评分变动")

            if changed_count:
                section.append(
                    "  🧾 共有 {} 条样本的模型分数发生变化，可能由特征/权重更新导致".format(changed_count))
            else:
                section.append("  🧾 共有样本的分数完全一致，两次运行输出稳定")

            if recall_diff > 0.02:
                section.append("  ✅ 召回率提升明显，抓到的欺诈更多了！")
            elif recall_diff < -0.02:
                section.append("  ⚠️  召回率下降，需要关注是否漏了更多欺诈")

            if precision_diff > 0.02:
                section.append("  ✅ 精确率提升，审核效率更高了！")
            elif precision_diff < -0.02:
                section.append("  ⚠️  精确率下降，可能增加了审核压力")

        return "\n".join(section)

    def _generate_business_advice(self, sample_summary: Dict, model_summary: Dict,
                                  metrics: Dict, errors: Dict) -> str:
        section = []
        section.append("💡 七、给业务同学的建议")
        section.append("─" * 60)

        advice = []

        fn_count = errors.get("fn_count", 0)
        fp_count = errors.get("fp_count", 0)

        if fn_count > 0:
            advice.append("🔴 漏报有 {} 条，这些是高危！建议:".format(fn_count))
            advice.append("   1. 把这些漏报样本导出来给策略同学看看")
            advice.append("   2. 是不是有新的欺诈手法没覆盖到？")
            advice.append("   3. 考虑要不要先上几条规则兜底")

        if fp_count > 0:
            advice.append("🟡 误报有 {} 条，影响体验:".format(fp_count))
            advice.append("   1. 看看是不是某些正常用户被误伤了")
            advice.append("   2. 如果审核压力大，可以考虑调高点阈值")
            advice.append("   3. 或者加几条白名单规则")

        label_conflicts = model_summary.get("label_conflict_count", 0)
        if label_conflicts > 0:
            advice.append("📝 有 {} 条标签不一致，需要人工确认:".format(label_conflicts))
            advice.append("   1. 这些样本对模型影响很大")
            advice.append("   2. 建议优先处理，标签准了模型才能准")

        leakage = model_summary.get("leakage_candidate_count", 0)
        if leakage > 0:
            advice.append("💧 有 {} 组可能存在时间泄漏:".format(leakage))
            advice.append("   1. 同一用户短期内多次申请的要注意")
            advice.append("   2. 训练时只用第一条，避免信息泄漏")

        if metrics.get("recall", 0) < 0.7:
            advice.append("📉 召回率有点低，是不是:")
            advice.append("   1. 阈值设得太高了？")
            advice.append("   2. 欺诈样本不够多？")
            advice.append("   3. 可以考虑召回优先的策略")

        if metrics.get("precision", 0) < 0.5:
            advice.append("⏱️ 精确率一般，审核压力可能不小:")
            advice.append("   1. 如果审核人力够，先保召回")
            advice.append("   2. 人力紧张的话，可以调高点阈值")

        dup_issues = sample_summary.get("duplicate_issues", [])
        if dup_issues:
            advice.append("🔁 重复样本有 {} 组:".format(len(dup_issues)))
            advice.append("   1. 已自动去重，不用担心重复算指标")
            advice.append("   2. 但要注意是不是数据接入的问题")

        if not advice:
            advice.append("✅ 目前来看都挺好的，继续保持！")

        section.append("\n" + "\n".join(advice))

        section.append("\n" + "─" * 60)
        section.append("👋 写在最后:")
        section.append("  这份报告是给咱们团队内部看的，数据都保留了原始来源和处理时间")
        section.append("  有任何看不懂的、或者觉得算的不对的，直接找小乔就行~")
        section.append("  月底复盘或者要跟老板汇报的时候，拿这份报告出来讲就可以了！")

        return "\n".join(section)

    def _generate_footer(self, df: pd.DataFrame) -> str:
        section = []
        section.append("📎 附: 关键样本ID清单")
        section.append("─" * 60)

        if "error_type" in df.columns:
            fp_ids = df[df["error_type"] == "误报 (FP)"]["sample_id"].tolist()
            fn_ids = df[df["error_type"] == "漏报 (FN)"]["sample_id"].tolist()

            if fp_ids:
                section.append("\n误报样本ID (共{}条):".format(len(fp_ids)))
                section.append(", ".join(fp_ids[:20]))
                if len(fp_ids) > 20:
                    section.append("... 还有 {} 条".format(len(fp_ids) - 20))

            if fn_ids:
                section.append("\n漏报样本ID (共{}条):".format(len(fn_ids)))
                section.append(", ".join(fn_ids[:20]))
                if len(fn_ids) > 20:
                    section.append("... 还有 {} 条".format(len(fn_ids) - 20))

        if "has_label_conflict" in df.columns:
            conflict_ids = df[df["has_label_conflict"]]["sample_id"].tolist()
            if conflict_ids:
                section.append("\n标签冲突样本ID (共{}条):".format(len(conflict_ids)))
                section.append(", ".join(conflict_ids[:20]))

        return "\n".join(section)

    def save_report(self, report: str, output_path: str):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        self._log("报告已保存至: {}".format(output_path))

    def export_error_samples(self, errors: Dict, output_dir: str):
        fp_df = errors.get("false_positives")
        fn_df = errors.get("false_negatives")

        if fp_df is not None and not fp_df.empty:
            fp_path = "{}/false_positives.csv".format(output_dir)
            fp_df.to_csv(fp_path, index=False, encoding="utf-8-sig")
            self._log("误报样本已导出: {}".format(fp_path))

        if fn_df is not None and not fn_df.empty:
            fn_path = "{}/false_negatives.csv".format(output_dir)
            fn_df.to_csv(fn_path, index=False, encoding="utf-8-sig")
            self._log("漏报样本已导出: {}".format(fn_path))

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = "[{}] {}".format(timestamp, message)
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_log(self) -> List[str]:
        return self.processing_log
