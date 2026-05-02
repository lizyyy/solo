import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Dict, List, Optional

from zhr_validator.models import (
    ZHRBatchResult,
    ZHRCalculation,
    BatchValidationResult,
    QuarantineLog,
    ObservationRecord,
)


class Reporter:
    def __init__(self, output_dir: Path):
        self.output_dir = output_dir
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_zhr_markdown(
        self,
        result: ZHRBatchResult,
        title: Optional[str] = None,
    ) -> str:
        if title is None:
            title = f"{result.shower_name} ZHR 分析报告"

        lines: List[str] = []

        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**生成时间**: {result.calculated_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 汇总统计")
        lines.append("")
        lines.append("| 指标 | 数值 |")
        lines.append("|------|------|")
        lines.append(f"| 总记录数 | {result.total_records} |")
        lines.append(f"| 可靠记录数 | {result.reliable_records} |")
        lines.append(f"| 不可靠记录数 | {result.unreliable_records} |")
        lines.append(f"| **加权平均 ZHR** | **{result.weighted_mean_zhr:.2f}** |")
        lines.append(f"| 简单平均 ZHR | {result.mean_zhr:.2f} |")
        lines.append(f"| 中位数 ZHR | {result.median_zhr:.2f} |")
        lines.append(f"| 置信区间 ({int(result.confidence_level*100)}%) | {result.zhr_lower_aggregate:.2f} - {result.zhr_upper_aggregate:.2f} |")
        lines.append("")

        lines.append("## 详细数据")
        lines.append("")
        lines.append("| 观测者 | 时段(UTC) | 时长(h) | 流星数 | 云量 | LM | 原始ZHR | 校正ZHR | 权重 | 状态 |")
        lines.append("|--------|-----------|---------|--------|------|-----|---------|---------|------|------|")

        for calc in result.calculations:
            status = "✅ 可靠" if calc.is_reliable else "⚠️ 需注意"
            if calc.is_bad_weather:
                status = "❌ 坏天气"

            time_str = f"{calc.utc_start.strftime('%H:%M')} - {calc.utc_end.strftime('%H:%M')}"

            lines.append(
                f"| {calc.observer_name} | {time_str} | {calc.duration_hours:.2f} | "
                f"{calc.meteor_count} | {calc.cloud_cover:.0%} | {calc.limiting_magnitude:.1f} | "
                f"{calc.raw_zhr:.2f} | {calc.corrected_zhr:.2f} | "
                f"{calc.observation_weight:.2f} | {status} |"
            )
        lines.append("")

        lines.append("## 校正因子说明")
        lines.append("")
        lines.append("- **云量校正**: 基于有效可视天空比例，公式 = 1 / (1 - 云量)")
        lines.append("- **极限星等校正**: 基于人口指数(r)，公式 = r^(6.5 - LM)")
        lines.append(f"- **使用的人口指数 (r)**: {result.calculations[0].population_index if result.calculations else 2.0}")
        lines.append("")

        lines.append("## 观测点权重计算")
        lines.append("")
        lines.append("权重基于以下因素综合计算：")
        lines.append("- 观测时长 (30%)：越长越可靠，最多 2 小时")
        lines.append("- 流星数量 (30%)：越多统计误差越小，最多 20 颗")
        lines.append("- 云量情况 (20%)：云量越少权重越高")
        lines.append("- 极限星等 (20%)：LM 越高权重越高，以 6.5 为上限")
        lines.append("")

        if result.unreliable_records > 0:
            lines.append("## 不可靠记录详情")
            lines.append("")
            lines.append("以下记录被标记为不可靠，可能影响 ZHR 估算：")
            lines.append("")
            for calc in result.calculations:
                if not calc.is_reliable:
                    reasons: List[str] = []
                    if calc.is_bad_weather:
                        reasons.append("坏天气")
                    if calc.meteor_count < 5:
                        reasons.append(f"流星数少({calc.meteor_count})")
                    if calc.duration_hours < 0.25:
                        reasons.append(f"时段短({calc.duration_hours*60:.0f}分钟)")

                    lines.append(f"- **{calc.observer_name}**: {', '.join(reasons)}")
            lines.append("")

        return "\n".join(lines)

    def generate_zhr_csv(
        self,
        result: ZHRBatchResult,
    ) -> str:
        import io

        output = io.StringIO()
        writer = csv.writer(output)

        writer.writerow([
            "观测者", "观测日期", "UTC开始", "UTC结束", "时长(小时)",
            "纬度", "经度", "流星数", "云量", "极限星等",
            "原始ZHR", "校正ZHR", "置信下限", "置信上限",
            "观测权重", "是否可靠", "是否坏天气"
        ])

        for calc in result.calculations:
            writer.writerow([
                calc.observer_name,
                calc.observation_date,
                calc.utc_start.strftime("%Y-%m-%d %H:%M:%S"),
                calc.utc_end.strftime("%Y-%m-%d %H:%M:%S"),
                f"{calc.duration_hours:.4f}",
                f"{calc.latitude:.4f}",
                f"{calc.longitude:.4f}",
                calc.meteor_count,
                f"{calc.cloud_cover:.4f}",
                f"{calc.limiting_magnitude:.2f}",
                f"{calc.raw_zhr:.4f}",
                f"{calc.corrected_zhr:.4f}",
                f"{calc.zhr_lower:.4f}",
                f"{calc.zhr_upper:.4f}",
                f"{calc.observation_weight:.4f}",
                "是" if calc.is_reliable else "否",
                "是" if calc.is_bad_weather else "否",
            ])

        return output.getvalue()

    def generate_validation_markdown(
        self,
        result: BatchValidationResult,
        title: str = "数据校验报告",
    ) -> str:
        lines: List[str] = []

        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")

        lines.append("## 校验汇总")
        lines.append("")
        lines.append("| 类别 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 总记录数 | {result.total_records} |")
        lines.append(f"| ✅ 有效记录 | {result.valid_records} |")
        lines.append(f"| ❌ 无效记录 | {result.invalid_records} |")
        lines.append(f"| ⚠️ 有警告的记录 | {result.records_with_warnings} |")
        lines.append("")

        lines.append("### 问题分布")
        lines.append("")
        for severity, count in result.issues_by_severity.items():
            if count > 0:
                emoji = "❌" if severity == "error" else "⚠️" if severity == "warning" else "ℹ️"
                lines.append(f"- {emoji} {severity}: {count} 个问题")
        lines.append("")

        if result.duplicate_observer_groups:
            lines.append("## ⚠️ 潜在重复提交")
            lines.append("")
            lines.append("以下记录来自同一观测者、同一地点，可能是重复提交：")
            lines.append("")
            for idx, group in enumerate(result.duplicate_observer_groups, 1):
                lines.append(f"**组 {idx}**:")
                for record_ref in group:
                    lines.append(f"  - {record_ref}")
                lines.append("")

        if result.overlapping_period_groups:
            lines.append("## ⚠️ 时段重叠")
            lines.append("")
            lines.append("以下记录的观测时段存在重叠（UTC 时间）：")
            lines.append("")
            for idx, group in enumerate(result.overlapping_period_groups, 1):
                lines.append(f"**组 {idx}**:")
                for record_ref in group:
                    lines.append(f"  - {record_ref}")
                lines.append("")

        if result.detailed_results:
            lines.append("## 详细校验结果")
            lines.append("")

            for vr in result.detailed_results:
                status = "✅ 通过" if vr.is_valid else "❌ 失败"
                lines.append(f"### {vr.source_file}: 行 {vr.record_index + 1} - {status}")
                lines.append("")

                if vr.issues:
                    for issue in vr.issues:
                        emoji = "❌" if issue.severity == "error" else "⚠️" if issue.severity == "warning" else "ℹ️"
                        lines.append(f"{emoji} **[{issue.code}]** {issue.message}")
                        if issue.field:
                            lines.append(f"   - 字段: `{issue.field}`")
                        if issue.value is not None:
                            lines.append(f"   - 值: `{issue.value}`")
                        if issue.suggestion:
                            lines.append(f"   - 💡 建议: {issue.suggestion}")
                        lines.append("")
                else:
                    lines.append("无问题")
                    lines.append("")

        return "\n".join(lines)

    def generate_quarantine_markdown(
        self,
        log: QuarantineLog,
        title: str = "隔离区报告",
    ) -> str:
        lines: List[str] = []

        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"**隔离时间**: {log.quarantined_at.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**隔离记录数**: {len(log.entries)}")
        lines.append("")

        if not log.entries:
            lines.append("隔离区为空。")
            return "\n".join(lines)

        for idx, entry in enumerate(log.entries, 1):
            lines.append(f"## 记录 {idx}: {entry.source_file} 行 {entry.record_index + 1}")
            lines.append("")

            lines.append("### 原始数据")
            lines.append("")
            lines.append("```json")
            lines.append(json.dumps(entry.raw_data, ensure_ascii=False, indent=2))
            lines.append("```")
            lines.append("")

            lines.append("### 问题列表")
            lines.append("")
            for issue in entry.issues:
                emoji = "❌" if issue.severity == "error" else "⚠️" if issue.severity == "warning" else "ℹ️"
                lines.append(f"{emoji} **[{issue.code}]** {issue.message}")
                if issue.suggestion:
                    lines.append(f"   - 💡 建议: {issue.suggestion}")
                lines.append("")

        return "\n".join(lines)

    def save_zhr_report(
        self,
        result: ZHRBatchResult,
        formats: List[str] = ["md", "csv", "json"],
        base_filename: Optional[str] = None,
    ) -> Dict[str, Path]:
        if base_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"zhr_report_{timestamp}"

        output_files: Dict[str, Path] = {}

        if "md" in formats:
            md_content = self.generate_zhr_markdown(result)
            md_path = self.output_dir / f"{base_filename}.md"
            md_path.write_text(md_content, encoding="utf-8")
            output_files["md"] = md_path

        if "csv" in formats:
            csv_content = self.generate_zhr_csv(result)
            csv_path = self.output_dir / f"{base_filename}.csv"
            csv_path.write_text(csv_content, encoding="utf-8-sig")
            output_files["csv"] = csv_path

        if "json" in formats:
            json_data = {
                "shower_name": result.shower_name,
                "observation_date": result.observation_date,
                "summary": {
                    "total_records": result.total_records,
                    "reliable_records": result.reliable_records,
                    "unreliable_records": result.unreliable_records,
                    "mean_zhr": result.mean_zhr,
                    "median_zhr": result.median_zhr,
                    "weighted_mean_zhr": result.weighted_mean_zhr,
                    "zhr_lower": result.zhr_lower_aggregate,
                    "zhr_upper": result.zhr_upper_aggregate,
                },
                "calculations": [
                    {
                        "observer": c.observer_name,
                        "utc_start": c.utc_start.isoformat(),
                        "utc_end": c.utc_end.isoformat(),
                        "duration_hours": c.duration_hours,
                        "meteor_count": c.meteor_count,
                        "cloud_cover": c.cloud_cover,
                        "limiting_magnitude": c.limiting_magnitude,
                        "raw_zhr": c.raw_zhr,
                        "corrected_zhr": c.corrected_zhr,
                        "weight": c.observation_weight,
                        "is_reliable": c.is_reliable,
                        "is_bad_weather": c.is_bad_weather,
                    }
                    for c in result.calculations
                ],
                "generated_at": result.calculated_at.isoformat(),
            }
            json_path = self.output_dir / f"{base_filename}.json"
            json_path.write_text(
                json.dumps(json_data, ensure_ascii=False, indent=2),
                encoding="utf-8",
            )
            output_files["json"] = json_path

        return output_files

    def save_validation_report(
        self,
        result: BatchValidationResult,
        formats: List[str] = ["md"],
        base_filename: Optional[str] = None,
    ) -> Dict[str, Path]:
        if base_filename is None:
            timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
            base_filename = f"validation_report_{timestamp}"

        output_files: Dict[str, Path] = {}

        if "md" in formats:
            md_content = self.generate_validation_markdown(result)
            md_path = self.output_dir / f"{base_filename}.md"
            md_path.write_text(md_content, encoding="utf-8")
            output_files["md"] = md_path

        if "json" in formats:
            json_data = {
                "summary": {
                    "total_records": result.total_records,
                    "valid_records": result.valid_records,
                    "invalid_records": result.invalid_records,
                    "records_with_warnings": result.records_with_warnings,
                    "issues_by_severity": dict(result.issues_by_severity),
                },
                "duplicate_groups": result.duplicate_observer_groups,
                "overlapping_groups": result.overlapping_period_groups,
                "generated_at": datetime.now().isoformat(),
            }
            json_path = self.output_dir / f"{base_filename}.json"
            json_path.write_text(
                json.dumps(json_data, ensure_ascii=False, indent=2, default=str),
                encoding="utf-8",
            )
            output_files["json"] = json_path

        return output_files
