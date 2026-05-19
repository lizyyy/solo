import json
from datetime import datetime
from pathlib import Path
from typing import Optional

from tabulate import tabulate

from .git_scanner import ScanResult
from .analyzer import AnalysisResult, LFSAnalyzer


class ReportGenerator:
    def __init__(self, scan_result: ScanResult, analysis: AnalysisResult):
        self.scan_result = scan_result
        self.analysis = analysis
        self.analyzer = LFSAnalyzer()

    def _get_timestamp(self) -> str:
        return datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    def generate_human_report(self) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("           GIT LFS 额度侦察排查报告")
        lines.append("=" * 80)
        lines.append(f"生成时间: {self._get_timestamp()}")
        lines.append("")

        lines.append("【概要统计】")
        lines.append("-" * 80)
        lines.append(f"  LFS文件总数: {self.analysis.total_files}")
        lines.append(f"  唯一文件数: {self.analysis.unique_files}")
        lines.append(f"  总占用空间: {self.analyzer.format_size(self.analysis.total_size)}")
        lines.append(f"  唯一文件空间: {self.analyzer.format_size(self.analysis.unique_size)}")
        
        duplicate_summary = self.analyzer.get_duplicate_summary(self.analysis)
        if duplicate_summary["count"] > 0:
            lines.append(f"  重复文件数: {duplicate_summary['count']}")
            lines.append(f"  重复占用空间: {self.analyzer.format_size(duplicate_summary['total_duplicate_size'])}")
        lines.append("")

        if self.scan_result.errors:
            lines.append("【扫描警告/错误】")
            lines.append("-" * 80)
            for error in self.scan_result.errors[:10]:
                lines.append(f"  ! {error}")
            if len(self.scan_result.errors) > 10:
                lines.append(f"  ... 还有 {len(self.scan_result.errors) - 10} 条错误")
            lines.append("")

        lines.append("【最大文件 TOP 20】")
        lines.append("-" * 80)
        if self.analysis.top_files:
            table_data = []
            for i, f in enumerate(self.analysis.top_files[:20], 1):
                table_data.append([
                    i,
                    f.path[:50] + ("..." if len(f.path) > 50 else ""),
                    self.analyzer.format_size(f.size),
                    f.commit_author[:15] if f.commit_author else "N/A",
                    f.commit_hash[:8] if f.commit_hash else "N/A"
                ])
            lines.append(tabulate(table_data, headers=["#", "路径", "大小", "作者", "提交"], tablefmt="simple"))
        else:
            lines.append("  (无LFS文件)")
        lines.append("")

        lines.append("【按目录统计 TOP 20】")
        lines.append("-" * 80)
        top_paths = self.analyzer.get_paths_sorted_by_size(self.analysis, limit=20)
        if top_paths:
            table_data = []
            for i, p in enumerate(top_paths, 1):
                table_data.append([
                    i,
                    p.path[:60] + ("..." if len(p.path) > 60 else ""),
                    self.analyzer.format_size(p.total_size),
                    p.file_count,
                    len(p.unique_oids)
                ])
            lines.append(tabulate(table_data, headers=["#", "路径", "总大小", "文件数", "唯一文件数"], tablefmt="simple"))
        else:
            lines.append("  (无数据)")
        lines.append("")

        lines.append("【按作者统计 TOP 15】")
        lines.append("-" * 80)
        top_authors = self.analyzer.get_authors_sorted_by_size(self.analysis, limit=15)
        if top_authors:
            table_data = []
            for i, a in enumerate(top_authors, 1):
                table_data.append([
                    i,
                    a.author[:30] + ("..." if len(a.author) > 30 else ""),
                    self.analyzer.format_size(a.total_size),
                    a.file_count,
                    len(a.paths)
                ])
            lines.append(tabulate(table_data, headers=["#", "作者", "总大小", "文件数", "路径数"], tablefmt="simple"))
        else:
            lines.append("  (无作者数据)")
        lines.append("")

        if duplicate_summary["count"] > 0:
            lines.append("【重复文件详情 TOP 10】")
            lines.append("-" * 80)
            table_data = []
            for i, d in enumerate(duplicate_summary["details"][:10], 1):
                table_data.append([
                    i,
                    d["oid"][:16] + "...",
                    self.analyzer.format_size(d["size"]),
                    d["count"],
                    self.analyzer.format_size(d["duplicate_size"])
                ])
            lines.append(tabulate(table_data, headers=["#", "OID", "单文件大小", "出现次数", "重复占用"], tablefmt="simple"))
            lines.append("")

        lines.append("=" * 80)
        return "\n".join(lines)

    def generate_machine_report(self) -> dict:
        duplicate_summary = self.analyzer.get_duplicate_summary(self.analysis)
        
        return {
            "report_version": "1.0",
            "generated_at": self._get_timestamp(),
            "summary": {
                "total_files": self.analysis.total_files,
                "unique_files": self.analysis.unique_files,
                "total_size_bytes": self.analysis.total_size,
                "unique_size_bytes": self.analysis.unique_size,
                "duplicate_count": duplicate_summary["count"],
                "duplicate_size_bytes": duplicate_summary["total_duplicate_size"]
            },
            "errors": self.scan_result.errors,
            "top_files": [
                {
                    "path": f.path,
                    "size_bytes": f.size,
                    "oid": f.oid,
                    "author": f.commit_author,
                    "commit_hash": f.commit_hash,
                    "commit_date": f.commit_date,
                    "commit_message": f.commit_message
                }
                for f in self.analysis.top_files[:50]
            ],
            "by_path": [
                {
                    "path": p.path,
                    "total_size_bytes": p.total_size,
                    "file_count": p.file_count,
                    "unique_count": len(p.unique_oids)
                }
                for p in self.analyzer.get_paths_sorted_by_size(self.analysis, limit=50)
            ],
            "by_author": [
                {
                    "author": a.author,
                    "total_size_bytes": a.total_size,
                    "file_count": a.file_count,
                    "path_count": len(a.paths)
                }
                for a in self.analyzer.get_authors_sorted_by_size(self.analysis, limit=30)
            ],
            "duplicates": duplicate_summary["details"][:20]
        }

    def save_human_report(self, output_path: str) -> None:
        report = self.generate_human_report()
        Path(output_path).write_text(report, encoding="utf-8")

    def save_json_report(self, output_path: str) -> None:
        report = self.generate_machine_report()
        Path(output_path).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")

    def save_csv_report(self, output_path: str) -> None:
        lines = ["路径,大小,oid,作者,提交哈希,提交日期,提交信息"]
        for lfs_file in self.scan_result.lfs_files:
            line = ",".join([
                f'"{lfs_file.path}"',
                str(lfs_file.size),
                lfs_file.oid,
                f'"{lfs_file.commit_author}"',
                lfs_file.commit_hash,
                f'"{lfs_file.commit_date}"',
                f'"{lfs_file.commit_message}"'.replace("\n", " ")
            ])
            lines.append(line)
        Path(output_path).write_text("\n".join(lines), encoding="utf-8")
