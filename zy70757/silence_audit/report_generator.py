import json
import csv
from datetime import datetime
from typing import List, Dict, Any, Optional
from pathlib import Path

from .models import Silence, Alert, MatchResult, ParseResult
from .risk_assessor import RiskAssessor


class ReportGenerator:
    def __init__(self, output_dir: str = "."):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def _stable_sort_silences(self, silences: List[Silence]) -> List[Silence]:
        return sorted(
            silences,
            key=lambda s: (
                s.created_by or "",
                s.ends_at.isoformat() if s.ends_at else "",
                s.id or "",
                s.source_file or "",
                s.source_line or 0,
            )
        )

    def _stable_sort_match_results(self, results: List[MatchResult]) -> List[MatchResult]:
        return sorted(
            results,
            key=lambda r: (
                -len(r.matched_alerts),
                r.silence.created_by or "",
                r.silence.id or "",
            )
        )

    def generate_json_report(self,
                             silence_parse_result: ParseResult,
                             alert_parse_result: ParseResult,
                             match_results: List[MatchResult],
                             risk_assessment: Dict[str, Any],
                             filename: str = "silence_audit_report.json") -> str:
        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": {
                "total_silences": silence_parse_result.total_count,
                "valid_silences": silence_parse_result.valid_count,
                "invalid_silences": silence_parse_result.invalid_count,
                "total_alerts": alert_parse_result.total_count,
                "valid_alerts": alert_parse_result.valid_count,
                "invalid_alerts": alert_parse_result.invalid_count,
            },
            "risk_summary": {
                "risk_distribution": risk_assessment.get("risk_distribution", {}),
                "high_risk_count": risk_assessment.get("high_risk_count", 0),
                "statistics": risk_assessment.get("statistics", {}),
            },
            "silences": [],
            "invalid_items": [],
        }

        sorted_results = self._stable_sort_match_results(match_results)
        for result in sorted_results:
            silence = result.silence
            risk_key = silence.id

            risk_data = risk_assessment.get("assessment_results", {}).get(risk_key, {})
            if not risk_data:
                for r in risk_assessment.get("high_risk_silences", []):
                    if r["silence"].id == risk_key:
                        risk_data = {"risk_level": r["risk_level"]}
                        break

            report["silences"].append({
                "id": silence.id,
                "created_by": silence.created_by,
                "comment": silence.comment,
                "status": silence.status,
                "starts_at": silence.starts_at.isoformat() if silence.starts_at else None,
                "ends_at": silence.ends_at.isoformat() if silence.ends_at else None,
                "matchers": [
                    {"name": m.name, "value": m.value, "is_regex": m.is_regex}
                    for m in silence.matchers
                ],
                "matched_alert_count": len(result.matched_alerts),
                "matched_alerts": [
                    {
                        "labels": alert.labels,
                        "annotations": alert.annotations,
                        "source": f"{alert.source_file}:{alert.source_line}",
                    }
                    for alert in sorted(result.matched_alerts, key=lambda a: str(a.labels))
                ],
                "source": f"{silence.source_file}:{silence.source_line}",
                "risk_level": risk_data.get("risk_level", {}).level if risk_data.get("risk_level") else None,
                "risk_score": risk_data.get("risk_level", {}).score if risk_data.get("risk_level") else None,
                "risk_reason": risk_data.get("risk_level", {}).reason if risk_data.get("risk_level") else None,
            })

        for invalid in silence_parse_result.invalid_items:
            if hasattr(invalid, "parse_error"):
                report["invalid_items"].append({
                    "type": "silence",
                    "raw_content": invalid.raw_content,
                    "source": f"{invalid.source_file}:{invalid.source_line}",
                    "error": invalid.parse_error,
                })
            elif isinstance(invalid, dict):
                report["invalid_items"].append({
                    "type": invalid.get("type", "unknown"),
                    "raw_content": invalid.get("raw_content", ""),
                    "source": f"{invalid.get('source_file', '')}:{invalid.get('source_line', '')}",
                    "error": invalid.get("parse_error", ""),
                })

        for invalid in alert_parse_result.invalid_items:
            if hasattr(invalid, "parse_error"):
                report["invalid_items"].append({
                    "type": "alert",
                    "raw_content": invalid.raw_content,
                    "source": f"{invalid.source_file}:{invalid.source_line}",
                    "error": invalid.parse_error,
                })
            elif isinstance(invalid, dict):
                report["invalid_items"].append({
                    "type": invalid.get("type", "unknown"),
                    "raw_content": invalid.get("raw_content", ""),
                    "source": f"{invalid.get('source_file', '')}:{invalid.get('source_line', '')}",
                    "error": invalid.get("parse_error", ""),
                })

        output_path = self.output_dir / filename
        with open(output_path, "w", encoding="utf-8") as f:
            json.dump(report, f, indent=2, ensure_ascii=False, sort_keys=True)

        return str(output_path)

    def generate_csv_report(self,
                            match_results: List[MatchResult],
                            risk_assessment: Dict[str, Any],
                            filename: str = "silence_audit_report.csv") -> str:
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow([
                "Silence ID",
                "Created By",
                "Comment",
                "Status",
                "Expires At",
                "Matched Alerts",
                "Risk Level",
                "Risk Score",
                "Risk Reason",
                "Source",
                "Matchers",
            ])

            sorted_results = self._stable_sort_match_results(match_results)
            for result in sorted_results:
                silence = result.silence

                risk_level = ""
                risk_score = ""
                risk_reason = ""

                for hr in risk_assessment.get("high_risk_silences", []):
                    if hr["silence"].id == silence.id:
                        risk_level = hr["risk_level"].level
                        risk_score = hr["risk_level"].score
                        risk_reason = hr["risk_level"].reason
                        break

                matchers_str = "; ".join([
                    f"{m.name}={'~' if m.is_regex else '='}{m.value}"
                    for m in silence.matchers
                ])

                writer.writerow([
                    silence.id,
                    silence.created_by,
                    silence.comment,
                    silence.status,
                    silence.ends_at.isoformat() if silence.ends_at else "",
                    len(result.matched_alerts),
                    risk_level,
                    risk_score,
                    risk_reason,
                    f"{silence.source_file}:{silence.source_line}",
                    matchers_str,
                ])

        return str(output_path)

    def generate_high_risk_report(self,
                                  risk_assessment: Dict[str, Any],
                                  filename: str = "high_risk_silences.txt") -> str:
        output_path = self.output_dir / filename

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("HIGH RISK SILENCES REPORT\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n")
            f.write(f"Total High/Critical Risk Silences: {risk_assessment.get('high_risk_count', 0)}\n\n")

            high_risk = risk_assessment.get("high_risk_silences", [])
            for idx, item in enumerate(high_risk, 1):
                silence = item["silence"]
                risk = item["risk_level"]

                f.write("-" * 80 + "\n")
                f.write(f"#{idx} - RISK {risk.level} ({risk.score}/100)\n")
                f.write("-" * 80 + "\n")
                f.write(f"Silence ID: {silence.id}\n")
                f.write(f"Created By: {silence.created_by}\n")
                f.write(f"Comment: {silence.comment}\n")
                f.write(f"Status: {silence.status}\n")
                f.write(f"Expires At: {silence.ends_at.isoformat() if silence.ends_at else 'N/A'}\n")
                f.write(f"Matched Alerts: {item['hit_count']}\n")
                f.write(f"Source: {silence.source_file}:{silence.source_line}\n")
                f.write(f"\nRisk Reasons: {risk.reason}\n")

                f.write("\nMatchers:\n")
                for matcher in silence.matchers:
                    prefix = "~" if matcher.is_regex else "="
                    f.write(f"  - {matcher.name}{prefix}{matcher.value}\n")

                f.write("\n")

        return str(output_path)

    def generate_summary_report(self,
                                silence_parse_result: ParseResult,
                                alert_parse_result: ParseResult,
                                risk_assessment: Dict[str, Any],
                                filename: str = "audit_summary.txt") -> str:
        output_path = self.output_dir / filename

        stats = risk_assessment.get("statistics", {})
        risk_dist = risk_assessment.get("risk_distribution", {})
        creator_summary = risk_assessment.get("creator_risk_summary", {})

        with open(output_path, "w", encoding="utf-8") as f:
            f.write("=" * 80 + "\n")
            f.write("SILENCE AUDIT SUMMARY REPORT\n")
            f.write("=" * 80 + "\n\n")
            f.write(f"Generated: {datetime.now().isoformat()}\n\n")

            f.write("--- SILENCE STATISTICS ---\n")
            f.write(f"Total Silences: {silence_parse_result.total_count}\n")
            f.write(f"  Valid: {silence_parse_result.valid_count}\n")
            f.write(f"  Invalid: {silence_parse_result.invalid_count}\n\n")

            f.write("--- ALERT STATISTICS ---\n")
            f.write(f"Total Alerts: {alert_parse_result.total_count}\n")
            f.write(f"  Valid: {alert_parse_result.valid_count}\n")
            f.write(f"  Invalid: {alert_parse_result.invalid_count}\n\n")

            f.write("--- MATCH STATISTICS ---\n")
            f.write(f"Total Hits: {stats.get('total_hits', 0)}\n")
            f.write(f"Average Hits per Silence: {stats.get('average_hits_per_silence', 0):.2f}\n")
            f.write(f"No Hit Silences: {stats.get('no_hit_count', 0)}\n")
            f.write(f"High Hit Silences (>=10): {stats.get('high_hit_count', 0)}\n\n")

            f.write("--- RISK DISTRIBUTION ---\n")
            for level in ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"]:
                count = risk_dist.get(level, 0)
                f.write(f"{level}: {count}\n")
            f.write(f"\nHigh/Critical Risk Total: {risk_assessment.get('high_risk_count', 0)}\n\n")

            if creator_summary:
                f.write("--- CREATOR RISK SUMMARY ---\n")
                for creator, data in sorted(creator_summary.items()):
                    f.write(f"\n{creator}:\n")
                    f.write(f"  Total Silences: {data['count']}\n")
                    f.write(f"  Critical/High Risk: {data['critical_high_count']}\n")
                    f.write(f"  Average Risk Score: {data['avg_score']:.1f}\n")

        return str(output_path)

    def generate_all_reports(self,
                             silence_parse_result: ParseResult,
                             alert_parse_result: ParseResult,
                             match_results: List[MatchResult],
                             risk_assessment: Dict[str, Any],
                             prefix: str = "") -> Dict[str, str]:
        outputs = {}

        prefix_str = f"{prefix}_" if prefix else ""

        outputs["json"] = self.generate_json_report(
            silence_parse_result, alert_parse_result,
            match_results, risk_assessment,
            f"{prefix_str}silence_audit_report.json"
        )

        outputs["csv"] = self.generate_csv_report(
            match_results, risk_assessment,
            f"{prefix_str}silence_audit_report.csv"
        )

        outputs["high_risk"] = self.generate_high_risk_report(
            risk_assessment,
            f"{prefix_str}high_risk_silences.txt"
        )

        outputs["summary"] = self.generate_summary_report(
            silence_parse_result, alert_parse_result,
            risk_assessment,
            f"{prefix_str}audit_summary.txt"
        )

        return outputs
