import csv
import io
import json
import os
from typing import Any, Dict, List, Optional

from .models import PracticeReport, save_json, _gen_id, _now_iso
from .masking import mask_dict


class ReportExporter:
    def __init__(self, output_dir: str):
        self.reports_dir = os.path.join(output_dir, "reports")
        os.makedirs(self.reports_dir, exist_ok=True)

    def _report_path(self, report_id: str, fmt: str) -> str:
        ext = {"json": "json", "csv": "csv", "txt": "txt"}.get(fmt, "json")
        return os.path.join(self.reports_dir, f"{report_id}.{ext}")

    def save_report(self, report: PracticeReport, fmt: str = "json") -> str:
        report_id = report.report_id
        if fmt == "json":
            return self._save_json(report)
        elif fmt == "csv":
            return self._save_csv(report)
        elif fmt == "txt":
            return self._save_txt(report)
        else:
            raise ValueError(f"Unsupported format: {fmt}")

    def _save_json(self, report: PracticeReport) -> str:
        path = self._report_path(report.report_id, "json")
        data = report.to_dict(masked=True)
        data["export_info"] = {
            "format": "json",
            "exported_at": _now_iso(),
            "masking_applied": True,
        }
        save_json(data, path)
        return path

    def _save_csv(self, report: PracticeReport) -> str:
        path = self._report_path(report.report_id, "csv")
        masked_data = mask_dict(report.to_dict(masked=True))

        with open(path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["字段", "值"])
            writer.writerow(["报告ID", masked_data["report_id"]])
            writer.writerow(["会话ID", masked_data["session_id"]])
            writer.writerow(["学生ID", masked_data["student_id"]])
            writer.writerow(["综合评分", masked_data["overall_score"]])
            writer.writerow([])
            writer.writerow(["段落", "目标MIDI", "目标频率", "平均偏差(音分)", "最大偏差(音分)", "方向", "准确度"])

            for seg in masked_data.get("segment_scores", []):
                writer.writerow([
                    seg.get("label", ""),
                    seg.get("target_midi", ""),
                    seg.get("target_freq", ""),
                    seg.get("avg_cents_error", ""),
                    seg.get("max_cents_error", ""),
                    seg.get("direction", ""),
                    seg.get("accuracy", ""),
                ])

            writer.writerow([])
            for k, v in masked_data.get("error_stats", {}).items():
                writer.writerow([f"统计_{k}", v])

            writer.writerow([])
            for w in masked_data.get("edge_case_warnings", []):
                writer.writerow(["警告", w.get("message", "")])

        return path

    def _save_txt(self, report: PracticeReport) -> str:
        path = self._report_path(report.report_id, "txt")
        masked_data = mask_dict(report.to_dict(masked=True))

        lines = []
        lines.append("=" * 50)
        lines.append("  儿童音准练习报告")
        lines.append("=" * 50)
        lines.append(f"报告ID: {masked_data['report_id']}")
        lines.append(f"会话ID: {masked_data['session_id']}")
        lines.append(f"学生ID: {masked_data['student_id']}")
        lines.append(f"综合评分: {masked_data['overall_score']:.1f} / 100")
        lines.append("")

        lines.append("-" * 40)
        lines.append("各段落评分:")
        lines.append("-" * 40)
        for seg in masked_data.get("segment_scores", []):
            direction = seg.get("direction", "")
            direction_text = f" ({direction})" if direction and direction != "准确" else ""
            lines.append(
                f"  {seg.get('label', '?'):>4s} | "
                f"目标: {seg.get('target_freq', 0):.1f}Hz | "
                f"偏差: {seg.get('avg_cents_error', 0):+.1f}音分{direction_text} | "
                f"准确度: {seg.get('accuracy', '?')}"
            )
        lines.append("")

        lines.append("-" * 40)
        lines.append("统计信息:")
        lines.append("-" * 40)
        for k, v in masked_data.get("error_stats", {}).items():
            lines.append(f"  {k}: {v}")
        lines.append("")

        warnings = masked_data.get("edge_case_warnings", [])
        if warnings:
            lines.append("-" * 40)
            lines.append("注意事项:")
            lines.append("-" * 40)
            for w in warnings:
                lines.append(f"  [{w.get('severity', '?')}] {w.get('message', '')}")
                lines.append(f"       建议: {w.get('suggestion', '')}")
            lines.append("")

        lines.append(f"导出时间: {_now_iso()}")
        lines.append("注: 敏感字段已按统一口径脱敏处理")

        with open(path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))
        return path

    def load_report(self, report_id: str) -> Optional[Dict]:
        path = self._report_path(report_id, "json")
        if not os.path.exists(path):
            return None
        from .models import load_json
        return load_json(path)

    def list_reports(self) -> List[Dict]:
        results = []
        seen_ids = set()
        if not os.path.exists(self.reports_dir):
            return results
        from .models import load_json
        for fname in sorted(os.listdir(self.reports_dir)):
            if not fname.endswith(".json"):
                continue
            rid = fname.rsplit(".", 1)[0]
            seen_ids.add(rid)
            results.append(load_json(os.path.join(self.reports_dir, fname)))
        for fname in sorted(os.listdir(self.reports_dir)):
            if fname.endswith(".json"):
                continue
            rid = fname.rsplit(".", 1)[0]
            if rid in seen_ids:
                continue
            txt_path = os.path.join(self.reports_dir, rid + ".txt")
            csv_path = os.path.join(self.reports_dir, rid + ".csv")
            if os.path.exists(txt_path):
                with open(txt_path, "r", encoding="utf-8") as f:
                    results.append({"report_id": rid, "format": "txt", "preview": f.read(200)})
            elif os.path.exists(csv_path):
                results.append({"report_id": rid, "format": "csv"})
        return results
