from __future__ import annotations

import json
from pathlib import Path
from typing import Optional

from .fix_list import FixListGenerator, generate_fix_summary
from .models import CheckResult, CheckStatus, ScanReport, Severity


class ReportExporter:
    def __init__(self, report: ScanReport):
        self.report = report
        self.fix_gen = FixListGenerator(report)

    def to_markdown(self, include_ok: bool = False) -> str:
        lines: list[str] = []

        lines.append("# 文档链接腐烂扫描报告")
        lines.append("")
        lines.append(f"**扫描时间**: {self.report.scan_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"**扫描根目录**: `{self.report.root_dir}`")
        lines.append(f"**文档总数**: {self.report.total_docs}")
        lines.append(f"**链接总数**: {self.report.total_links}")
        lines.append("")

        lines.append("## 📊 总体结论")
        lines.append("")

        broken = self.report.broken_count
        warnings = self.report.warning_count
        review = self.report.review_count
        ok = self.report.ok_count

        if broken > 0:
            lines.append(f"> ⚠️ **检测到 {broken} 个严重问题**（链接失效、锚点缺失、文件缺失等），需要立即修复。")
        else:
            lines.append(f"> ✅ **没有严重问题**，文档链接状态良好。")

        if warnings > 0:
            lines.append(f"> ⚡ 有 {warnings} 个警告（重定向、大小写不匹配等），建议修复。")
        if review > 0:
            lines.append(f"> 🔍 有 {review} 条记录需要人工复核。")
        if ok > 0:
            lines.append(f"> ✔️  {ok} 条链接状态正常。")

        lines.append("")
        lines.append("### 问题统计")
        lines.append("")
        lines.append("| 类别 | 数量 |")
        lines.append("|------|------|")
        lines.append(f"| 🔴 严重问题 | {broken} |")
        lines.append(f"| 🟡 警告 | {warnings} |")
        lines.append(f"| 🔍 待复核 | {review} |")
        lines.append(f"| ✅ 正常 | {ok} |")
        lines.append(f"| **总计** | **{len(self.report.results)}** |")
        lines.append("")

        if self.report.versions:
            lines.append("## 📚 版本目录")
            lines.append("")
            for v in self.report.versions:
                latest_marker = " ⭐ (latest)" if v.is_latest else ""
                lines.append(f"- **{v.version_label}**{latest_marker}: {len(v.docs)} 个文档")
            lines.append("")

        lines.append("## 🔧 修复清单（按维护人分组）")
        lines.append("")

        for group in self.fix_gen.by_maintainer():
            lines.append(f"### 👤 {group.maintainer}")
            summary = generate_fix_summary(group.results)
            lines.append(f"**状态**: {summary}")
            lines.append("")

            if group.critical_count > 0:
                lines.append("#### 🔴 严重问题")
                lines.append("")
                self._render_result_table(
                    lines,
                    [
                        r for r in group.results
                        if r.severity == Severity.CRITICAL
                        and r.status != CheckStatus.PENDING_REVIEW
                    ],
                )
                lines.append("")

            if group.warning_count > 0:
                lines.append("#### 🟡 警告")
                lines.append("")
                self._render_result_table(
                    lines,
                    [
                        r for r in group.results
                        if r.severity == Severity.WARNING
                        and r.status != CheckStatus.PENDING_REVIEW
                    ],
                )
                lines.append("")

            if group.review_count > 0:
                lines.append("#### 🔍 待人工复核")
                lines.append("")
                self._render_result_table(
                    lines,
                    [r for r in group.results if r.status == CheckStatus.PENDING_REVIEW],
                )
                lines.append("")

        lines.append("## 📋 详细问题（按文件分组）")
        lines.append("")

        by_file = self.fix_gen.by_file()
        for file_path, results in by_file.items():
            lines.append(f"### 📄 {file_path}")
            lines.append("")
            self._render_result_table(lines, results)
            lines.append("")

        if include_ok:
            lines.append("## ✅ 正常链接")
            lines.append("")
            ok_results = [r for r in self.report.results if r.status == CheckStatus.OK]
            if ok_results:
                self._render_result_table(lines, ok_results)
            else:
                lines.append("无")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("_由文档链接腐烂扫描工具生成_")

        return "\n".join(lines)

    def _render_result_table(self, lines: list[str], results: list[CheckResult]) -> None:
        if not results:
            lines.append("_无_")
            return

        lines.append("| 状态 | 文件 | 行 | 链接 | 问题描述 | 修复建议 |")
        lines.append("|------|------|----|------|----------|----------|")

        for r in results:
            status = r.status_label
            file = self._format_file(r)
            line = r.link_ref.line_number if r.link_ref else "-"
            href = self._format_href(r)
            detail = self._escape_md(r.detail)
            suggestion = self._escape_md(r.suggestion)

            lines.append(
                f"| {status} | {file} | {line} | {href} | {detail} | {suggestion} |"
            )

    @staticmethod
    def _format_file(r: CheckResult) -> str:
        if r.source_doc:
            path = r.source_doc.rel_path
            if r.link_ref:
                return f"[{path}]({path}#L{r.link_ref.line_number})"
            return f"`{path}`"
        return "版本扫描"

    @staticmethod
    def _format_href(r: CheckResult) -> str:
        if not r.link_ref:
            return "-"
        href = r.link_ref.raw_href
        if len(href) > 60:
            display = href[:57] + "..."
        else:
            display = href
        return f"[`{display}`]({href})"

    @staticmethod
    def _escape_md(text: str) -> str:
        return text.replace("|", "\\|").replace("\n", " ").strip()

    def to_json(self, indent: int = 2) -> str:
        data = {
            "scan_time": self.report.scan_time.isoformat(),
            "root_dir": str(self.report.root_dir),
            "summary": {
                "total_docs": self.report.total_docs,
                "total_links": self.report.total_links,
                "broken_count": self.report.broken_count,
                "warning_count": self.report.warning_count,
                "review_count": self.report.review_count,
                "ok_count": self.report.ok_count,
            },
            "versions": [
                {
                    "version_label": v.version_label,
                    "dir_path": str(v.dir_path),
                    "doc_count": len(v.docs),
                    "is_latest": v.is_latest,
                }
                for v in self.report.versions
            ],
            "maintainer_groups": [
                {
                    "maintainer": g.maintainer,
                    "critical_count": g.critical_count,
                    "warning_count": g.warning_count,
                    "review_count": g.review_count,
                    "issues": [self._result_to_dict(r) for r in g.results],
                }
                for g in self.fix_gen.by_maintainer()
            ],
            "fix_list": [self._result_to_dict(r) for r in self.report.fix_list],
            "all_results": [self._result_to_dict(r) for r in self.report.results],
        }
        return json.dumps(data, indent=indent, ensure_ascii=False)

    @staticmethod
    def _result_to_dict(r: CheckResult) -> dict:
        d = {
            "status": r.status.value,
            "status_label": r.status_label,
            "severity": r.severity.value,
            "detail": r.detail,
            "suggestion": r.suggestion,
            "source_file": r.source_doc.rel_path if r.source_doc else None,
            "maintainer": r.source_doc.maintainer if r.source_doc else None,
        }
        if r.link_ref:
            d.update({
                "link_href": r.link_ref.raw_href,
                "link_kind": r.link_ref.link_kind.value,
                "line_number": r.link_ref.line_number,
                "context_line": r.link_ref.context_line,
                "target_file": str(r.link_ref.target_file) if r.link_ref.target_file else None,
                "anchor": r.link_ref.anchor,
            })
        if r.redirect_chain:
            d["redirect_chain"] = r.redirect_chain
        if r.final_url:
            d["final_url"] = r.final_url
        if r.http_status:
            d["http_status"] = r.http_status
        return d

    def to_console(self) -> str:
        lines: list[str] = []

        broken = self.report.broken_count
        warnings = self.report.warning_count
        review = self.report.review_count

        lines.append("=" * 70)
        lines.append("  文档链接腐烂扫描报告")
        lines.append("=" * 70)
        lines.append(f"  扫描时间: {self.report.scan_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append(f"  根目录: {self.report.root_dir}")
        lines.append(f"  文档数: {self.report.total_docs} | 链接数: {self.report.total_links}")
        lines.append("-" * 70)

        if broken > 0:
            lines.append(f"  🔴 严重问题: {broken} 个（需要立即修复）")
        if warnings > 0:
            lines.append(f"  🟡 警告: {warnings} 个（建议修复）")
        if review > 0:
            lines.append(f"  🔍 待复核: {review} 条（需要人工确认）")
        if broken == 0 and warnings == 0 and review == 0:
            lines.append(f"  ✅ 所有链接正常！")

        lines.append("-" * 70)

        by_file = self.fix_gen.by_file()
        for file_path, results in by_file.items():
            lines.append("")
            lines.append(f"  📄 {file_path}")
            for r in results:
                line_num = f"L{r.link_ref.line_number}" if r.link_ref else "   "
                href = r.link_ref.raw_href if r.link_ref else ""
                if len(href) > 50:
                    href = href[:47] + "..."
                lines.append(
                    f"    {r.status_label}  {line_num}  {href}"
                )
                lines.append(f"       {r.detail}")
                if r.suggestion:
                    lines.append(f"       💡 {r.suggestion}")

        return "\n".join(lines)

    def export(self, output_path: Path, fmt: str = "markdown", include_ok: bool = False) -> None:
        if fmt == "markdown":
            content = self.to_markdown(include_ok=include_ok)
        elif fmt == "json":
            content = self.to_json()
        else:
            raise ValueError(f"不支持的导出格式: {fmt}")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        output_path.write_text(content, encoding="utf-8")
