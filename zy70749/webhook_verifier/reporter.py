import json
import csv
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Any
import pandas as pd
from .models import DualDeliveryResult, SwitchConclusion, BadLine, ParseResult
from .tracker import SourceTracker


class ReportGenerator:
    def __init__(self, output_dir: str = "./reports"):
        self.output_dir = Path(output_dir)
        self.output_dir.mkdir(parents=True, exist_ok=True)

    def generate_console_summary(
        self,
        conclusions: Dict[str, SwitchConclusion],
        parse_result: ParseResult,
    ) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("Webhook供应商切换双投验证报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"解析总行数: {parse_result.total_lines}")
        lines.append(f"有效事件数: {len(parse_result.valid_events)}")
        lines.append(f"坏行数: {len(parse_result.bad_lines)}")
        lines.append("")

        lines.append("-" * 80)
        lines.append("各事件类型验证结果")
        lines.append("-" * 80)

        for key, conclusion in sorted(conclusions.items()):
            lines.append(f"\n供应商: {conclusion.vendor}")
            lines.append(f"事件类型: {conclusion.event_type}")
            lines.append(f"当前状态: {conclusion.state.value}")
            lines.append(f"总事件数: {conclusion.total_events}")
            lines.append(f"双投成功数: {conclusion.verified_count}")
            lines.append(f"失败数: {conclusion.failed_count}")
            lines.append(f"成功率: {conclusion.success_rate:.2%}")
            lines.append(f"可切换: {'是' if conclusion.can_switch else '否'}")
            lines.append(f"建议: {conclusion.recommendation}")
            lines.append(f"  - 连续成功: {conclusion.details.get('consecutive_success', 0)}")
            lines.append(f"  - 最大连续成功: {conclusion.details.get('max_consecutive_success', 0)}")
            lines.append(f"  - 要求连续成功: {conclusion.details.get('required_consecutive_success', 0)}")
            lines.append(f"  - 最低成功率: {conclusion.details.get('min_success_rate', 0):.2%}")

        lines.append("\n" + "=" * 80)
        return "\n".join(lines)

    def generate_json_report(
        self,
        conclusions: Dict[str, SwitchConclusion],
        dual_results: List[DualDeliveryResult],
        source_tracker: SourceTracker,
        filename: str = "verification_report.json",
    ) -> str:
        report_data = {
            "generated_at": datetime.now().isoformat(),
            "summary": self._build_summary(conclusions),
            "conclusions": {
                k: json.loads(c.model_dump_json()) for k, c in conclusions.items()
            },
            "dual_delivery_results": [
                json.loads(r.model_dump_json()) for r in dual_results
            ],
            "bad_lines": [
                json.loads(b.model_dump_json()) for b in source_tracker.get_bad_lines()
            ],
        }

        filepath = self.output_dir / filename
        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(report_data, f, ensure_ascii=False, indent=2)
        return str(filepath)

    def generate_csv_reports(
        self,
        conclusions: Dict[str, SwitchConclusion],
        dual_results: List[DualDeliveryResult],
        source_tracker: SourceTracker,
        prefix: str = "verification",
    ) -> Dict[str, str]:
        files = {}

        conclusions_path = self.output_dir / f"{prefix}_conclusions.csv"
        with open(conclusions_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "vendor", "event_type", "state", "can_switch", "success_rate",
                "verified_count", "failed_count", "total_events", "recommendation",
                "consecutive_success", "max_consecutive_success",
            ])
            for conclusion in conclusions.values():
                writer.writerow([
                    conclusion.vendor,
                    conclusion.event_type,
                    conclusion.state.value,
                    conclusion.can_switch,
                    f"{conclusion.success_rate:.4f}",
                    conclusion.verified_count,
                    conclusion.failed_count,
                    conclusion.total_events,
                    conclusion.recommendation,
                    conclusion.details.get("consecutive_success", 0),
                    conclusion.details.get("max_consecutive_success", 0),
                ])
        files["conclusions"] = str(conclusions_path)

        results_path = self.output_dir / f"{prefix}_dual_delivery_results.csv"
        with open(results_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "event_id", "vendor", "event_type", "old_received", "new_received",
                "old_timestamp", "new_timestamp", "time_diff_seconds",
                "old_status_code", "new_status_code",
                "old_status_success", "new_status_success",
                "payload_match", "within_window", "status",
            ])
            for r in dual_results:
                writer.writerow([
                    r.event_id,
                    r.vendor,
                    r.event_type,
                    r.old_received,
                    r.new_received,
                    r.old_timestamp.isoformat() if r.old_timestamp else "",
                    r.new_timestamp.isoformat() if r.new_timestamp else "",
                    f"{r.time_diff_seconds:.2f}" if r.time_diff_seconds else "",
                    r.old_status_code,
                    r.new_status_code,
                    r.old_status_success,
                    r.new_status_success,
                    r.payload_match,
                    r.within_window,
                    r.status.value,
                ])
        files["dual_delivery"] = str(results_path)

        bad_lines_path = self.output_dir / f"{prefix}_bad_lines.csv"
        with open(bad_lines_path, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow(["source_file", "line_number", "error", "content"])
            for b in source_tracker.get_bad_lines():
                writer.writerow([
                    b.source_file,
                    b.line_number,
                    b.error,
                    b.content,
                ])
        files["bad_lines"] = str(bad_lines_path)

        return files

    def generate_excel_report(
        self,
        conclusions: Dict[str, SwitchConclusion],
        dual_results: List[DualDeliveryResult],
        source_tracker: SourceTracker,
        filename: str = "verification_report.xlsx",
    ) -> str:
        filepath = self.output_dir / filename

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            conclusions_data = []
            for conclusion in conclusions.values():
                conclusions_data.append({
                    "vendor": conclusion.vendor,
                    "event_type": conclusion.event_type,
                    "state": conclusion.state.value,
                    "can_switch": conclusion.can_switch,
                    "success_rate": conclusion.success_rate,
                    "verified_count": conclusion.verified_count,
                    "failed_count": conclusion.failed_count,
                    "total_events": conclusion.total_events,
                    "recommendation": conclusion.recommendation,
                    "consecutive_success": conclusion.details.get("consecutive_success", 0),
                    "max_consecutive_success": conclusion.details.get("max_consecutive_success", 0),
                })
            pd.DataFrame(conclusions_data).to_excel(writer, sheet_name="结论汇总", index=False)

            results_data = []
            for r in dual_results:
                results_data.append({
                    "event_id": r.event_id,
                    "vendor": r.vendor,
                    "event_type": r.event_type,
                    "old_received": r.old_received,
                    "new_received": r.new_received,
                    "old_timestamp": r.old_timestamp.isoformat() if r.old_timestamp else None,
                    "new_timestamp": r.new_timestamp.isoformat() if r.new_timestamp else None,
                    "time_diff_seconds": r.time_diff_seconds,
                    "old_status_code": r.old_status_code,
                    "new_status_code": r.new_status_code,
                    "old_status_success": r.old_status_success,
                    "new_status_success": r.new_status_success,
                    "payload_match": r.payload_match,
                    "within_window": r.within_window,
                    "status": r.status.value,
                })
            pd.DataFrame(results_data).to_excel(writer, sheet_name="双投明细", index=False)

            bad_lines_data = []
            for b in source_tracker.get_bad_lines():
                bad_lines_data.append({
                    "source_file": b.source_file,
                    "line_number": b.line_number,
                    "error": b.error,
                    "content": b.content,
                })
            if bad_lines_data:
                pd.DataFrame(bad_lines_data).to_excel(writer, sheet_name="坏行记录", index=False)

        return str(filepath)

    def _build_summary(self, conclusions: Dict[str, SwitchConclusion]) -> Dict[str, Any]:
        total_events = sum(c.total_events for c in conclusions.values())
        total_verified = sum(c.verified_count for c in conclusions.values())
        total_failed = sum(c.failed_count for c in conclusions.values())
        can_switch_all = all(c.can_switch for c in conclusions.values())

        return {
            "total_event_types": len(conclusions),
            "total_events": total_events,
            "total_verified": total_verified,
            "total_failed": total_failed,
            "overall_success_rate": total_verified / total_events if total_events > 0 else 0,
            "all_can_switch": can_switch_all,
            "can_switch_count": sum(1 for c in conclusions.values() if c.can_switch),
        }
