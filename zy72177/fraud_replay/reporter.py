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
        return f"""
╔══════════════════════════════════════════════════════════════╗
║                     信贷欺诈样本回放报告                        ║
╠══════════════════════════════════════════════════════════════╣
║  生成时间: {now.ljust(45)}║
║  工具版本: v1.0.0{' '*38}║
║  分析师备注: 小乔同学整理，有问题直接喊我~                     ║
╚══════════════════════════════════════════════════════════════╝
        """.strip()

    def _generate_data_overview(self, sample_summary: Dict, df: pd.DataFrame) -> str:
        section = []
        section.append("📊 一、数据概览")
        section.append("─" * 60)
        
        overview_data = [
            ["总样本数", sample_summary.get("total_records", 0)],
            ["唯一用户数", sample_summary.get("unique_users", 0)],
            ["欺诈样本数", int(sample_summary.get("fraud_count", 0))],
            ["欺诈率", f"{sample_summary.get('fraud_ratio', 0):.1%}"],
        ]
        
        section.append(tabulate(overview_data, tablefmt="simple"))
        
        sources = sample_summary.get("sources", {})
        if sources:
            section.append("\n📋 数据来源分布:")
            for source, count in sources.items():
                section.append(f"  • {source}: {count} 条")
        
        time_range = sample_summary.get("time_range", {})
        if time_range.get("earliest") and time_range.get("latest"):
            section.append(f"\n⏰ 时间范围: {time_range['earliest']} ~ {time_range['latest']}")
        
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
                section.append(f"  • 列 [{issue['column']}]: {issue['count']} 个空值 ({issue['ratio']:.1%})")
                if issue['count'] > 10:
                    issues_found.append(f"【注意】{issue['column']} 空值较多，可能影响模型评估")
        
        dup_issues = sample_summary.get("duplicate_issues", [])
        if dup_issues:
            section.append(f"\n🔁 重复样本: 共发现 {len(dup_issues)} 组重复记录")
            for issue in dup_issues[:3]:
                section.append(f"  • key={issue['key'][:20]}...: {issue['count']} 条，来源: {issue['sources']}")
            issues_found.append("重复样本已自动去重，保留首条记录")
        
        boundary_issues = sample_summary.get("boundary_issues", [])
        if boundary_issues:
            section.append("\n📌 边界记录提醒:")
            for issue in boundary_issues:
                section.append(f"  • {issue['description']}: {issue['count']} 条")
        
        label_conflicts = model_summary.get("label_conflict_count", 0)
        if label_conflicts > 0:
            ratio = model_summary.get("label_conflict_ratio", 0)
            section.append(f"\n🚨 标签冲突: {label_conflicts} 条记录存在标签不一致 ({ratio:.1%})")
            section.append("  → 建议: 这些样本需要重点复核，确认正确标签")
            if ratio >= 0.05:
                issues_found.append("标签冲突比例较高，请优先处理！")
        
        leakage = model_summary.get("leakage_candidate_count", 0)
        if leakage > 0:
            section.append(f"\n💧 潜在样本泄漏: 发现 {leakage} 组同一用户短期内多次申请")
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
                section.append(f"  • {source}: {count} 条")
        
        changed = review_summary.get("label_changed_count", 0)
        if changed:
            section.append(f"\n🔄 标签变更记录: {changed} 条样本标签发生了变化")
        
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
            ["欺诈占比", f"{metrics.get('positive_ratio', 0):.1%}"],
            ["", ""],
            ["准确率", f"{metrics.get('accuracy', 0):.4f}"],
            ["精确率", f"{metrics.get('precision', 0):.4f}"],
            ["召回率", f"{metrics.get('recall', 0):.4f}"],
            ["F1分数", f"{metrics.get('f1', 0):.4f}"],
        ]
        
        if metrics.get("roc_auc"):
            metrics_data.append(["AUC", f"{metrics.get('roc_auc', 0):.4f}"])
        
        section.append(tabulate(metrics_data, tablefmt="simple"))
        
        section.append("\n📊 混淆矩阵:")
        cm_data = [
            ["", "预测正常", "预测欺诈"],
            ["实际正常", metrics.get("tn", 0), metrics.get("fp", 0)],
            ["实际欺诈", metrics.get("fn", 0), metrics.get("tp", 0)],
        ]
        section.append(tabulate(cm_data, tablefmt="grid"))
        
        if metrics.get("best_threshold"):
            section.append(f"\n💡 最佳阈值建议: {metrics['best_threshold']:.4f}")
            section.append(f"   (F1={metrics.get('best_f1', 0):.4f}, 精确率={metrics.get('best_precision', 0):.4f}, 召回率={metrics.get('best_recall', 0):.4f})")
        
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
        
        section.append(f"\n❌ 误报 (FP): {fp_count} 条 - 模型说有风险，其实没问题")
        if fp_count > 0:
            section.append("  → 影响: 增加人工审核工作量，可能影响用户体验")
            section.append("  → 建议: 可以考虑调高阈值，或优化模型降低假阳性")
        
        section.append(f"\n⚠️  漏报 (FN): {fn_count} 条 - 模型没发现，实际有欺诈")
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
        
        section.append(f"\n对比: {comparison.get('run1_name', '前次')} vs {comparison.get('run2_name', '本次')}")
        
        section.append("\n📊 样本变化:")
        sample_data = [
            ["", comparison.get('run1_name', '前次'), comparison.get('run2_name', '本次'), "变化"],
            ["样本总数", sample_diff.get("run1_count", 0), sample_diff.get("run2_count", 0), 
             f"{sample_diff.get('count_change', 0):+d}"],
            ["欺诈样本", sample_diff.get("run1_positive", 0), sample_diff.get("run2_positive", 0),
             f"{sample_diff.get('positive_change', 0):+d}"],
        ]
        section.append(tabulate(sample_data, tablefmt="simple"))
        
        if metric_diff:
            section.append("\n📈 指标变化:")
            metric_data = [["指标", "前次", "本次", "变化(%)"]]
            for key, value in metric_diff.items():
                diff_pct = value.get("diff_pct")
                diff_str = f"{diff_pct:+.1f}%" if diff_pct is not None else "N/A"
                metric_data.append([
                    key.upper(),
                    f"{value.get('run1', 0):.4f}",
                    f"{value.get('run2', 0):.4f}",
                    diff_str
                ])
            section.append(tabulate(metric_data, tablefmt="simple"))
            
            section.append("\n💡 解读:")
            recall_diff = metric_diff.get("recall", {}).get("diff", 0)
            precision_diff = metric_diff.get("precision", {}).get("diff", 0)
            
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
            advice.append(f"🔴 漏报有 {fn_count} 条，这些是高危！建议:")
            advice.append("   1. 把这些漏报样本导出来给策略同学看看")
            advice.append("   2. 是不是有新的欺诈手法没覆盖到？")
            advice.append("   3. 考虑要不要先上几条规则兜底")
        
        if fp_count > 0:
            advice.append(f"🟡 误报有 {fp_count} 条，影响体验:")
            advice.append("   1. 看看是不是某些正常用户被误伤了")
            advice.append("   2. 如果审核压力大，可以考虑调高点阈值")
            advice.append("   3. 或者加几条白名单规则")
        
        label_conflicts = model_summary.get("label_conflict_count", 0)
        if label_conflicts > 0:
            advice.append(f"📝 有 {label_conflicts} 条标签不一致，需要人工确认:")
            advice.append("   1. 这些样本对模型影响很大")
            advice.append("   2. 建议优先处理，标签准了模型才能准")
        
        leakage = model_summary.get("leakage_candidate_count", 0)
        if leakage > 0:
            advice.append(f"💧 有 {leakage} 组可能存在时间泄漏:")
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
            advice.append(f"🔁 重复样本有 {len(dup_issues)} 组:")
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
                section.append(f"\n误报样本ID (共{len(fp_ids)}条):")
                section.append(", ".join(fp_ids[:20]))
                if len(fp_ids) > 20:
                    section.append(f"... 还有 {len(fp_ids)-20} 条")
            
            if fn_ids:
                section.append(f"\n漏报样本ID (共{len(fn_ids)}条):")
                section.append(", ".join(fn_ids[:20]))
                if len(fn_ids) > 20:
                    section.append(f"... 还有 {len(fn_ids)-20} 条")
        
        if "has_label_conflict" in df.columns:
            conflict_ids = df[df["has_label_conflict"]]["sample_id"].tolist()
            if conflict_ids:
                section.append(f"\n标签冲突样本ID (共{len(conflict_ids)}条):")
                section.append(", ".join(conflict_ids[:20]))
        
        return "\n".join(section)

    def save_report(self, report: str, output_path: str):
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(report)
        self._log(f"报告已保存至: {output_path}")

    def export_error_samples(self, errors: Dict, output_dir: str):
        fp_df = errors.get("false_positives")
        fn_df = errors.get("false_negatives")
        
        if fp_df is not None and not fp_df.empty:
            fp_path = f"{output_dir}/false_positives.csv"
            fp_df.to_csv(fp_path, index=False, encoding="utf-8-sig")
            self._log(f"误报样本已导出: {fp_path}")
        
        if fn_df is not None and not fn_df.empty:
            fn_path = f"{output_dir}/false_negatives.csv"
            fn_df.to_csv(fn_path, index=False, encoding="utf-8-sig")
            self._log(f"漏报样本已导出: {fn_path}")

    def _log(self, message: str):
        timestamp = datetime.now().strftime("%H:%M:%S")
        log_msg = f"[{timestamp}] {message}"
        self.processing_log.append(log_msg)
        print(log_msg)

    def get_log(self) -> List[str]:
        return self.processing_log
