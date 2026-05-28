from __future__ import annotations

import csv
import io
import json
from typing import Dict, List, Optional

from .models import (
    AnomalyFlag,
    BinRecord,
    CheckReport,
    FeatureCheckResult,
    Severity,
    Violation,
)


class ReportGenerator:
    @staticmethod
    def generate_summary(results: List[FeatureCheckResult], overall_pass: bool) -> str:
        lines: List[str] = []
        sep = "=" * 72

        if overall_pass:
            lines.append("【检查结论】全部特征通过单调性约束检查 ✓")
        else:
            lines.append("【检查结论】存在特征未通过单调性约束检查 ✗")

        lines.append(sep)

        pass_count = sum(1 for r in results if r.overall_severity == Severity.PASS)
        warn_count = sum(1 for r in results if r.overall_severity == Severity.WARNING)
        fail_count = sum(1 for r in results if r.overall_severity == Severity.FAIL)

        lines.append(f"特征总数: {len(results)}  通过: {pass_count}  警告: {warn_count}  不通过: {fail_count}")
        lines.append(sep)

        for r in results:
            icon = {"PASS": "✓", "WARNING": "⚠", "FAIL": "✗"}[r.overall_severity.value]
            lines.append("")
            lines.append(f"特征: {r.feature_name}  [{icon} {r.overall_severity.value}]")
            lines.append(f"  模型版本: {r.model_version}")
            lines.append(f"  检测方向: {r.detected_direction.value}")
            lines.append(f"  总样本: {r.total_samples}  总坏账: {r.total_bad}  整体坏账率: {r.overall_bad_rate:.4f}")
            lines.append(f"  分箱数: {len(r.bins)}")

            lines.append("  分箱明细:")
            lines.append(f"  {'箱名':<14} {'样本量':>8} {'坏账数':>8} {'坏账率':>10} {'权重':>10} {'缺失':>6}")
            lines.append(f"  {'-' * 60}")
            for b in r.bins:
                missing_tag = "是" if b.is_missing else "否"
                lines.append(
                    f"  {b.bin_name:<14} {b.total_count:>8} {b.bad_count:>8} "
                    f"{b.bad_rate:>10.4f} {b.score_weight:>10.2f} {missing_tag:>6}"
                )

            if r.violations:
                lines.append(f"  单调违规 ({len(r.violations)} 项):")
                for v in r.violations:
                    severity_icon = "⚠" if v.severity == Severity.WARNING else "✗"
                    lines.append(f"    {severity_icon} {v.reason}")

            if r.anomaly_flags:
                lines.append(f"  异常标记 ({len(r.anomaly_flags)} 项):")
                for a in r.anomaly_flags:
                    severity_icon = "⚠" if a.severity == Severity.WARNING else "✗"
                    lines.append(f"    {severity_icon} [{a.flag_type}] {a.detail}")

            if r.weight_interpretation:
                wt = r.weight_interpretation
                align_icon = "✓" if wt.direction_aligned else "✗"
                lines.append(f"  权重与风险排序: {align_icon} {'一致' if wt.direction_aligned else '不一致'}")
                lines.append(f"    {wt.explanation}")

        lines.append("")
        lines.append(sep)

        if not overall_pass:
            lines.append("【下一步建议】")
            fail_features = [r.feature_name for r in results if r.overall_severity == Severity.FAIL]
            warn_features = [r.feature_name for r in results if r.overall_severity == Severity.WARNING]

            if fail_features:
                lines.append(
                    f"  1. 不通过特征 {fail_features} 需立即处理: "
                    "检查分箱合并策略, 消除单调反转"
                )
            if warn_features:
                lines.append(
                    f"  2. 警告特征 {warn_features} 需关注: "
                    "低样本箱建议合并, 缺失箱需确认填充逻辑"
                )
            lines.append("  3. 修正后重新运行本工具, 确认全部通过后再上线")
        else:
            lines.append("所有特征满足单调性约束, 可进入下一步模型评审")

        return "\n".join(lines)

    @staticmethod
    def to_json(report: CheckReport, indent: int = 2) -> str:
        return json.dumps(report.to_dict(), ensure_ascii=False, indent=indent)

    @staticmethod
    def to_csv(report: CheckReport) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "model_version",
            "check_timestamp",
            "input_hash",
            "feature_name",
            "bin_name",
            "bad_count",
            "total_count",
            "bad_rate",
            "score_weight",
            "is_missing",
            "detected_direction",
            "overall_severity",
            "violation_count",
            "anomaly_flag_count",
            "weight_direction_aligned",
        ])

        for r in report.results:
            for b in r.bins:
                writer.writerow([
                    report.model_version,
                    report.check_timestamp,
                    report.input_hash,
                    r.feature_name,
                    b.bin_name,
                    b.bad_count,
                    b.total_count,
                    f"{b.bad_rate:.6f}",
                    b.score_weight,
                    b.is_missing,
                    r.detected_direction.value,
                    r.overall_severity.value,
                    len(r.violations),
                    len(r.anomaly_flags),
                    r.weight_interpretation.direction_aligned if r.weight_interpretation else "",
                ])

        return output.getvalue()

    @staticmethod
    def to_violation_csv(report: CheckReport) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "model_version",
            "feature_name",
            "prev_bin_name",
            "bin_name",
            "prev_bad_rate",
            "bad_rate",
            "severity",
            "reason",
        ])

        for r in report.results:
            for v in r.violations:
                writer.writerow([
                    report.model_version,
                    r.feature_name,
                    v.prev_bin_name,
                    v.bin_name,
                    f"{v.prev_bad_rate:.6f}",
                    f"{v.bad_rate:.6f}",
                    v.severity.value,
                    v.reason,
                ])

        return output.getvalue()

    @staticmethod
    def to_anomaly_csv(report: CheckReport) -> str:
        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "model_version",
            "feature_name",
            "bin_name",
            "flag_type",
            "severity",
            "detail",
        ])

        for r in report.results:
            for a in r.anomaly_flags:
                writer.writerow([
                    report.model_version,
                    r.feature_name,
                    a.bin_name,
                    a.flag_type,
                    a.severity.value,
                    a.detail,
                ])

        return output.getvalue()

    @staticmethod
    def export_report(
        report: CheckReport,
        output_dir: str,
        prefix: str = "",
    ) -> Dict[str, str]:
        import os

        os.makedirs(output_dir, exist_ok=True)

        tag = prefix or report.model_version
        files: Dict[str, str] = {}

        summary_path = os.path.join(output_dir, f"{tag}_summary.txt")
        with open(summary_path, "w", encoding="utf-8") as f:
            f.write(report.summary)
        files["summary"] = summary_path

        json_path = os.path.join(output_dir, f"{tag}_detail.json")
        with open(json_path, "w", encoding="utf-8") as f:
            f.write(ReportGenerator.to_json(report))
        files["detail_json"] = json_path

        bin_csv_path = os.path.join(output_dir, f"{tag}_bins.csv")
        with open(bin_csv_path, "w", encoding="utf-8") as f:
            f.write(ReportGenerator.to_csv(report))
        files["bins_csv"] = bin_csv_path

        violation_csv_path = os.path.join(output_dir, f"{tag}_violations.csv")
        with open(violation_csv_path, "w", encoding="utf-8") as f:
            f.write(ReportGenerator.to_violation_csv(report))
        files["violations_csv"] = violation_csv_path

        anomaly_csv_path = os.path.join(output_dir, f"{tag}_anomalies.csv")
        with open(anomaly_csv_path, "w", encoding="utf-8") as f:
            f.write(ReportGenerator.to_anomaly_csv(report))
        files["anomalies_csv"] = anomaly_csv_path

        return files
