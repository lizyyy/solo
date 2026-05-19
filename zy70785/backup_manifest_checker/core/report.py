import json
import csv
from pathlib import Path
from typing import List, Dict, Any
from dataclasses import dataclass, asdict, field
from datetime import datetime

from .parser import ParseResult
from .checksum import ChecksumReport, CheckStatus
from .attribution import AttributionReport, Attribution


@dataclass
class FullReport:
    manifest_path: str
    backup_dir: str
    generated_at: str = field(default_factory=lambda: datetime.now().isoformat())
    parse_result: ParseResult = None
    checksum_report: ChecksumReport = None
    attribution_report: AttributionReport = None
    extra_files: List[str] = field(default_factory=list)


class ReportGenerator:
    def __init__(self, full_report: FullReport):
        self.full_report = full_report

    def generate_text(self, verbose: bool = False) -> str:
        lines = []
        lines.append("=" * 70)
        lines.append("备份 Manifest 校验报告")
        lines.append("=" * 70)
        lines.append(f"生成时间: {self.full_report.generated_at}")
        lines.append(f"Manifest 文件: {self.full_report.manifest_path}")
        lines.append(f"备份目录: {self.full_report.backup_dir}")
        lines.append("")

        lines.append("-" * 70)
        lines.append("一、Manifest 解析情况")
        lines.append("-" * 70)
        pr = self.full_report.parse_result
        lines.append(f"解析格式: {pr.format.value}")
        lines.append(f"成功解析块数: {len(pr.chunks)}")
        lines.append(f"解析错误数: {len(pr.errors)}")

        if pr.errors and verbose:
            for error in sorted(pr.errors, key=lambda e: e.line_number):
                lines.append(f"  [行 {error.line_number}] {error.error_type}: {error.error_message}")
                lines.append(f"    原始内容: {error.raw_line}")

        lines.append("")

        lines.append("-" * 70)
        lines.append("二、校验和检查结果")
        lines.append("-" * 70)
        cr = self.full_report.checksum_report
        lines.append(f"总块数: {cr.total_chunks}")
        lines.append(f"  通过 (PASS): {cr.passed}")
        lines.append(f"  失败 (FAIL): {cr.failed}")
        lines.append(f"  缺失 (MISSING): {cr.missing}")
        lines.append(f"  跳过 (SKIPPED): {cr.skipped}")

        if cr.failed > 0 or cr.missing > 0:
            lines.append("")
            lines.append("问题详情:")
            for result in sorted(cr.results, key=lambda r: r.chunk.chunk_id):
                if result.status != CheckStatus.PASS:
                    lines.append(f"  {result.chunk.chunk_id}: {result.status.value}")
                    if result.error_message:
                        lines.append(f"    原因: {result.error_message}")
                    if result.chunk.line_number:
                        lines.append(f"    行号: {result.chunk.line_number}")

        lines.append("")

        lines.append("-" * 70)
        lines.append("三、归因分析")
        lines.append("-" * 70)
        ar = self.full_report.attribution_report
        if ar.attributions:
            lines.append("故障原因统计:")
            for cause, count in sorted(ar.summary.items()):
                lines.append(f"  {cause}: {count}")
            lines.append("")

            if ar.patterns:
                lines.append("发现的模式:")
                for pattern in ar.patterns:
                    lines.append(f"  {pattern}")
                lines.append("")

            if verbose:
                lines.append("详细归因:")
                for attr in sorted(ar.attributions, key=lambda a: a.chunk_id):
                    lines.append(f"  {attr.chunk_id}:")
                    lines.append(f"    原因: {attr.cause.value} (置信度: {attr.confidence:.1%})")
                    if attr.line_number:
                        lines.append(f"    行号: {attr.line_number}")
                    if attr.evidence:
                        lines.append(f"    证据:")
                        for ev in attr.evidence:
                            lines.append(f"      - {ev}")
                    lines.append(f"    建议: {attr.suggested_action}")
                    lines.append("")
        else:
            lines.append("未发现问题，无需归因分析")
            lines.append("")

        if self.full_report.extra_files:
            lines.append("-" * 70)
            lines.append("四、额外文件（不在Manifest中）")
            lines.append("-" * 70)
            lines.append(f"发现 {len(self.full_report.extra_files)} 个额外文件:")
            for f in sorted(self.full_report.extra_files):
                lines.append(f"  {f}")
            lines.append("")

        lines.append("=" * 70)
        lines.append("报告结束")
        lines.append("=" * 70)

        return "\n".join(lines)

    def generate_json(self) -> str:
        data = {
            "manifest_path": self.full_report.manifest_path,
            "backup_dir": self.full_report.backup_dir,
            "generated_at": self.full_report.generated_at,
            "parse_result": {
                "format": self.full_report.parse_result.format.value,
                "chunks_count": len(self.full_report.parse_result.chunks),
                "errors_count": len(self.full_report.parse_result.errors),
                "errors": [
                    {
                        "line_number": e.line_number,
                        "raw_line": e.raw_line,
                        "error_message": e.error_message,
                        "error_type": e.error_type
                    }
                    for e in sorted(self.full_report.parse_result.errors, key=lambda x: x.line_number)
                ]
            },
            "checksum_report": {
                "total_chunks": self.full_report.checksum_report.total_chunks,
                "passed": self.full_report.checksum_report.passed,
                "failed": self.full_report.checksum_report.failed,
                "missing": self.full_report.checksum_report.missing,
                "skipped": self.full_report.checksum_report.skipped,
                "results": [
                    {
                        "chunk_id": r.chunk.chunk_id,
                        "status": r.status.value,
                        "file_path": r.file_path,
                        "file_size": r.file_size,
                        "expected_checksum": r.expected_checksum,
                        "actual_checksum": r.actual_checksum,
                        "error_message": r.error_message,
                        "line_number": r.chunk.line_number
                    }
                    for r in sorted(self.full_report.checksum_report.results, key=lambda x: x.chunk.chunk_id)
                ]
            },
            "attribution_report": {
                "summary": dict(sorted(self.full_report.attribution_report.summary.items())),
                "patterns": self.full_report.attribution_report.patterns,
                "attributions": [
                    {
                        "chunk_id": a.chunk_id,
                        "cause": a.cause.value,
                        "confidence": a.confidence,
                        "evidence": a.evidence,
                        "suggested_action": a.suggested_action,
                        "line_number": a.line_number,
                        "raw_line": a.raw_line
                    }
                    for a in sorted(self.full_report.attribution_report.attributions, key=lambda x: x.chunk_id)
                ]
            },
            "extra_files": sorted(self.full_report.extra_files)
        }
        return json.dumps(data, ensure_ascii=False, indent=2, sort_keys=True)

    def generate_csv(self, output_dir: str) -> List[str]:
        output_path = Path(output_dir)
        output_path.mkdir(parents=True, exist_ok=True)

        files_generated = []

        chunks_csv = output_path / "checksum_results.csv"
        with open(chunks_csv, "w", newline="", encoding="utf-8") as f:
            writer = csv.writer(f)
            writer.writerow([
                "chunk_id", "status", "file_path", "file_size",
                "expected_checksum", "actual_checksum", "error_message", "line_number"
            ])
            for r in sorted(self.full_report.checksum_report.results, key=lambda x: x.chunk.chunk_id):
                writer.writerow([
                    r.chunk.chunk_id,
                    r.status.value,
                    r.file_path or "",
                    r.file_size or "",
                    r.expected_checksum or "",
                    r.actual_checksum or "",
                    r.error_message or "",
                    r.chunk.line_number or ""
                ])
        files_generated.append(str(chunks_csv))

        if self.full_report.attribution_report.attributions:
            attr_csv = output_path / "attributions.csv"
            with open(attr_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow([
                    "chunk_id", "cause", "confidence", "suggested_action",
                    "line_number", "evidence"
                ])
                for a in sorted(self.full_report.attribution_report.attributions, key=lambda x: x.chunk_id):
                    writer.writerow([
                        a.chunk_id,
                        a.cause.value,
                        f"{a.confidence:.4f}",
                        a.suggested_action,
                        a.line_number or "",
                        " | ".join(a.evidence)
                    ])
            files_generated.append(str(attr_csv))

        if self.full_report.parse_result.errors:
            errors_csv = output_path / "parse_errors.csv"
            with open(errors_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["line_number", "error_type", "error_message", "raw_line"])
                for e in sorted(self.full_report.parse_result.errors, key=lambda x: x.line_number):
                    writer.writerow([
                        e.line_number,
                        e.error_type,
                        e.error_message,
                        e.raw_line
                    ])
            files_generated.append(str(errors_csv))

        if self.full_report.extra_files:
            extra_csv = output_path / "extra_files.csv"
            with open(extra_csv, "w", newline="", encoding="utf-8") as f:
                writer = csv.writer(f)
                writer.writerow(["file_path"])
                for fpath in sorted(self.full_report.extra_files):
                    writer.writerow([fpath])
            files_generated.append(str(extra_csv))

        return files_generated

    def save_report(self, output_path: str, format: str = "text", verbose: bool = False):
        path = Path(output_path)

        if format == "json":
            content = self.generate_json()
            if not path.suffix:
                path = path.with_suffix(".json")
            path.write_text(content, encoding="utf-8")
        elif format == "csv":
            if path.is_file():
                path = path.parent
            return self.generate_csv(str(path))
        else:
            content = self.generate_text(verbose)
            if not path.suffix:
                path = path.with_suffix(".txt")
            path.write_text(content, encoding="utf-8")

        return [str(path)]
