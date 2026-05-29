from __future__ import annotations

import logging
from pathlib import Path
from typing import Optional

from .anchor_checker import AnchorChecker
from .fix_list import FixListGenerator, generate_fix_summary
from .models import LinkKind, MarkdownDoc, ScanReport
from .parser import parse_document
from .report_exporter import ReportExporter
from .scanner import ExternalLinkScanner
from .version_scanner import detect_missing_version_docs, detect_version_dirs

logger = logging.getLogger(__name__)


class LinkRotScanner:
    def __init__(
        self,
        root_dir: Path,
        timeout: int = 15,
        max_redirects: int = 10,
        skip_external: bool = False,
        user_agent: str = "LinkRotScanner/1.0",
    ):
        self.root_dir = Path(root_dir).resolve()
        self.skip_external = skip_external
        self.external_scanner = ExternalLinkScanner(timeout=timeout, max_redirects=max_redirects)
        self._docs: list[MarkdownDoc] = []
        self._doc_index: dict[str, MarkdownDoc] = {}

    def scan(self, file_pattern: str = "**/*.md") -> ScanReport:
        logger.info(f"开始扫描目录: {self.root_dir}")
        self._load_documents(file_pattern)
        logger.info(f"已加载 {len(self._docs)} 个文档")

        report = ScanReport(root_dir=self.root_dir)
        report.total_docs = len(self._docs)

        total_links = sum(len(d.links) for d in self._docs)
        report.total_links = total_links
        logger.info(f"提取到 {total_links} 个链接引用")

        report.versions = detect_version_dirs(self.root_dir, self._docs)
        logger.info(f"检测到 {len(report.versions)} 个版本目录")

        version_issues = detect_missing_version_docs(report.versions)
        report.results.extend(version_issues)
        if version_issues:
            logger.info(f"版本一致性问题: {len(version_issues)} 条")

        anchor_checker = AnchorChecker(self._doc_index, self.root_dir)

        for doc in self._docs:
            logger.info(f"扫描文档: {doc.rel_path}")
            for link_ref in doc.links:
                result = None

                if link_ref.link_kind == LinkKind.EXTERNAL:
                    if not self.skip_external:
                        result = self.external_scanner.check(link_ref, doc)
                else:
                    result = anchor_checker.check(link_ref, doc)

                if result is not None:
                    report.results.append(result)

        report.results.sort(key=lambda r: (
            0 if r.severity.value == "critical" else
            1 if r.severity.value == "warning" else 2,
            r.source_doc.rel_path if r.source_doc else "",
        ))

        logger.info(f"扫描完成，共 {len(report.results)} 条检查结果")
        logger.info(generate_fix_summary(report.fix_list))

        return report

    def _load_documents(self, pattern: str) -> None:
        self._docs = []
        self._doc_index = {}

        exclude_dirs = {"scan_reports", "node_modules", ".git", ".hg", ".svn"}

        for path in sorted(self.root_dir.glob(pattern)):
            if not path.is_file():
                continue
            if any(part.startswith(".") for part in path.parts):
                continue
            if any(part in exclude_dirs for part in path.parts):
                continue

            try:
                doc = parse_document(path, self.root_dir)
                self._docs.append(doc)
                self._doc_index[doc.rel_path] = doc
            except Exception as e:
                logger.warning(f"解析文件失败 {path}: {e}")

    def export_report(
        self,
        report: ScanReport,
        output_dir: Optional[Path] = None,
        formats: tuple[str, ...] = ("markdown", "json"),
        include_ok: bool = False,
    ) -> dict[str, Path]:
        if output_dir is None:
            output_dir = self.root_dir / "scan_reports"

        output_dir = Path(output_dir).resolve()
        timestamp = report.scan_time.strftime("%Y%m%d_%H%M%S")

        exporter = ReportExporter(report)
        output_paths: dict[str, Path] = {}

        for fmt in formats:
            ext = "md" if fmt == "markdown" else fmt
            file_name = f"link_rot_report_{timestamp}.{ext}"
            file_path = output_dir / file_name

            try:
                exporter.export(file_path, fmt=fmt, include_ok=include_ok)
                output_paths[fmt] = file_path
                logger.info(f"已导出 {fmt} 报告: {file_path}")
            except Exception as e:
                logger.error(f"导出 {fmt} 报告失败: {e}")

        return output_paths

    def print_summary(self, report: ScanReport) -> None:
        exporter = ReportExporter(report)
        print(exporter.to_console())
