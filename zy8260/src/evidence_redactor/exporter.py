import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Any, Optional

from evidence_redactor.models import (
    CaseConfig,
    ManifestLoader,
    ParticipantsLoader,
)


class Exporter:
    def __init__(self, config: CaseConfig, verbose: bool = False):
        self.config = config
        self.verbose = verbose
        self.missing_files: list[str] = []

    def export(self, pack_results_path: Optional[Path] = None) -> dict[str, Any]:
        if self.verbose:
            print("开始导出报告...")

        self.config.output_path.mkdir(parents=True, exist_ok=True)

        output_files: dict[str, str] = {}

        missing_files_path = self._export_missing_files()
        output_files["missing_files"] = str(missing_files_path)

        redaction_mapping = self._load_redaction_mapping(pack_results_path)
        
        report_path = self._export_redaction_report(redaction_mapping)
        output_files["redaction_report"] = str(report_path)

        audit_log_path = self._export_audit_log(redaction_mapping)
        output_files["audit_log"] = str(audit_log_path)

        summary_path = self._export_summary(redaction_mapping)
        output_files["summary"] = str(summary_path)

        return {
            "files": output_files,
            "missing_files": self.missing_files,
            "redaction_mapping": redaction_mapping,
        }

    def _export_missing_files(self) -> Path:
        if self.verbose:
            print("  检查缺失文件...")

        manifest_loader = ManifestLoader(self.config.manifest_path)
        listed_files = set(manifest_loader.get_all_filenames())

        actual_files = set()
        if self.config.evidence_dir.exists():
            for f in self.config.evidence_dir.iterdir():
                if f.is_file():
                    actual_files.add(f.name)

        self.missing_files = sorted(list(listed_files - actual_files))

        extra_files = sorted(list(actual_files - listed_files))

        output_path = self.config.output_path / "missing_files.csv"

        with open(output_path, "w", encoding="utf-8", newline="") as f:
            writer = csv.writer(f)
            writer.writerow(["状态", "文件名", "说明"])

            for f in self.missing_files:
                writer.writerow(["缺失", f, "清单中列出但文件不存在"])

            for f in extra_files:
                writer.writerow(["额外", f, "存在但未列入清单"])

        if self.verbose:
            print(f"    缺失文件: {len(self.missing_files)} 个")
            print(f"    额外文件: {len(extra_files)} 个")

        return output_path

    def _load_redaction_mapping(self, path: Optional[Path]) -> dict[str, Any]:
        if path and path.exists():
            try:
                with open(path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        default_path = self.config.output_path / "redaction_mapping.json"
        if default_path.exists():
            try:
                with open(default_path, "r", encoding="utf-8") as f:
                    return json.load(f)
            except Exception:
                pass

        return {"generated_at": datetime.now().isoformat(), "packages": {}}

    def _export_redaction_report(self, mapping: dict[str, Any]) -> Path:
        if self.verbose:
            print("  生成脱敏报告...")

        manifest_loader = ManifestLoader(self.config.manifest_path)
        case_info = manifest_loader.get_case_info()

        participants_loader = ParticipantsLoader(self.config.participants_path)
        participants = participants_loader.get_participants()
        duplicates = participants_loader.get_duplicate_names()

        report_path = self.config.output_path / "redaction_report.html"

        html = self._build_html_report(case_info, mapping, participants, duplicates)

        with open(report_path, "w", encoding="utf-8") as f:
            f.write(html)

        return report_path

    def _build_html_report(
        self,
        case_info: dict[str, Any],
        mapping: dict[str, Any],
        participants: list[Any],
        duplicates: dict[str, list[str]],
    ) -> str:
        packages = mapping.get("packages", {})
        generated_at = mapping.get("generated_at", datetime.now().isoformat())

        total_redactions = 0
        for pkg_data in packages.values():
            total_redactions += pkg_data.get("count", 0)

        role_names = {
            "plaintiff": "原告",
            "defendant": "被告",
            "judge": "法官",
        }

        html_parts = [
            """<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>案件证据脱敏报告</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; line-height: 1.6; color: #333; padding: 20px; }
        .container { max-width: 1000px; margin: 0 auto; }
        h1 { color: #1a5276; border-bottom: 3px solid #3498db; padding-bottom: 10px; margin-bottom: 20px; }
        h2 { color: #2c3e50; margin-top: 30px; margin-bottom: 15px; border-left: 4px solid #3498db; padding-left: 10px; }
        h3 { color: #34495e; margin-top: 20px; margin-bottom: 10px; }
        .info-box { background: #f8f9fa; border: 1px solid #dee2e6; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .info-row { display: flex; margin-bottom: 8px; }
        .info-label { font-weight: bold; width: 120px; color: #6c757d; }
        .info-value { color: #495057; }
        .warning-box { background: #fff3cd; border: 1px solid #ffc107; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .warning-box h4 { color: #856404; margin-bottom: 10px; }
        .error-box { background: #f8d7da; border: 1px solid #dc3545; border-radius: 5px; padding: 15px; margin-bottom: 20px; }
        .error-box h4 { color: #721c24; margin-bottom: 10px; }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
        th, td { border: 1px solid #dee2e6; padding: 12px; text-align: left; }
        th { background: #e9ecef; font-weight: bold; color: #495057; }
        tr:hover { background: #f8f9fa; }
        .stats-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 15px; margin-bottom: 20px; }
        .stat-card { background: #e8f4fc; border: 1px solid #85c1e9; border-radius: 8px; padding: 15px; text-align: center; }
        .stat-value { font-size: 2em; font-weight: bold; color: #2980b9; }
        .stat-label { color: #5499c7; font-size: 0.9em; margin-top: 5px; }
        .redaction-item { background: #fff; border: 1px solid #e0e0e0; border-radius: 4px; padding: 10px; margin-bottom: 8px; }
        .redaction-original { color: #c0392b; font-family: monospace; }
        .redaction-redacted { color: #27ae60; font-family: monospace; }
        .redaction-rule { color: #7f8c8d; font-size: 0.85em; margin-top: 5px; }
        .file-group { margin-bottom: 20px; }
        .file-group h4 { background: #f1f1f1; padding: 10px; border-radius: 4px; margin-bottom: 10px; }
        .footer { margin-top: 40px; padding-top: 20px; border-top: 1px solid #dee2e6; text-align: center; color: #6c757d; font-size: 0.9em; }
    </style>
</head>
<body>
    <div class="container">
""",
            f"<h1>案件证据脱敏报告</h1>",
        ]

        html_parts.append('<div class="info-box">')
        html_parts.append("  <h3>案件基本信息</h3>")
        html_parts.append(f'  <div class="info-row"><span class="info-label">案号:</span><span class="info-value">{case_info.get("case_id", "未提供")}</span></div>')
        html_parts.append(f'  <div class="info-row"><span class="info-label">案件名称:</span><span class="info-value">{case_info.get("case_name", "未提供")}</span></div>')
        html_parts.append(f'  <div class="info-row"><span class="info-label">法院:</span><span class="info-value">{case_info.get("court", "未提供")}</span></div>')
        html_parts.append(f'  <div class="info-row"><span class="info-label">生成时间:</span><span class="info-value">{generated_at}</span></div>')
        html_parts.append("</div>")

        html_parts.append('<div class="stats-grid">')
        html_parts.append(f'<div class="stat-card"><div class="stat-value">{total_redactions}</div><div class="stat-label">总脱敏次数</div></div>')
        html_parts.append(f'<div class="stat-card"><div class="stat-value">{len(packages)}</div><div class="stat-label">资料包数量</div></div>')
        html_parts.append(f'<div class="stat-card"><div class="stat-value">{len(self.missing_files)}</div><div class="stat-label">缺失文件</div></div>')
        html_parts.append("</div>")

        if duplicates:
            html_parts.append('<div class="warning-box">')
            html_parts.append("  <h4>⚠️ 同名当事人警告</h4>")
            html_parts.append("  <p>以下当事人存在同名情况，请确认是否为同一人：</p>")
            html_parts.append("  <ul>")
            for name, ids in duplicates.items():
                html_parts.append(f'    <li>{name} (ID: {", ".join(ids)})</li>')
            html_parts.append("  </ul>")
            html_parts.append("</div>")

        html_parts.append("<h2>各角色脱敏统计</h2>")
        html_parts.append("<table>")
        html_parts.append("<tr><th>角色</th><th>脱敏次数</th><th>资料包</th></tr>")
        for role, pkg_data in packages.items():
            count = pkg_data.get("count", 0)
            html_parts.append(f'<tr><td>{role_names.get(role, role)}</td><td>{count}</td><td>{role}_package</td></tr>')
        html_parts.append("</table>")

        for role, pkg_data in packages.items():
            mappings = pkg_data.get("mappings", [])
            if mappings:
                html_parts.append(f"<h2>{role_names.get(role, role)}包脱敏详情</h2>")

                by_file: dict[str, list[dict]] = {}
                for m in mappings:
                    fp = m.get("file_path", "unknown")
                    if fp not in by_file:
                        by_file[fp] = []
                    by_file[fp].append(m)

                for file_path, file_mappings in by_file.items():
                    display_name = Path(file_path).name if file_path != "unknown" else "未知文件"
                    html_parts.append(f'<div class="file-group"><h4>📄 {display_name} ({len(file_mappings)} 处)</h4>')
                    for m in file_mappings[:20]:
                        html_parts.append('<div class="redaction-item">')
                        html_parts.append(f'  <div>原始: <span class="redaction-original">{m.get("original", "")}</span></div>')
                        html_parts.append(f'  <div>脱敏: <span class="redaction-redacted">{m.get("redacted", "")}</span></div>')
                        line_num = m.get("line_number", "")
                        html_parts.append(f'  <div class="redaction-rule">规则: {m.get("rule_id", "")} | 行: {line_num}</div>')
                        html_parts.append("</div>")
                    if len(file_mappings) > 20:
                        html_parts.append(f'<p style="color: #666; font-style: italic;">... 还有 {len(file_mappings) - 20} 处脱敏</p>')
                    html_parts.append("</div>")

        html_parts.append("""
    <div class="footer">
        <p>此报告由 evidence-redactor 工具自动生成</p>
        <p>生成时间: """ + generated_at + """</p>
    </div>
    </div>
</body>
</html>
""")

        return "\n".join(html_parts)

    def _export_audit_log(self, mapping: dict[str, Any]) -> Path:
        if self.verbose:
            print("  生成审计日志...")

        log_path = self.config.output_path / "audit_log.json"

        output = {
            "audit_version": "1.0",
            "generated_at": datetime.now().isoformat(),
            "case_info": {
                "manifest": str(self.config.manifest_path),
                "evidence_dir": str(self.config.evidence_dir),
            },
            "redaction_details": mapping,
        }

        with open(log_path, "w", encoding="utf-8") as f:
            json.dump(output, f, ensure_ascii=False, indent=2)

        return log_path

    def _export_summary(self, mapping: dict[str, Any]) -> Path:
        if self.verbose:
            print("  生成摘要报告...")

        summary_path = self.config.output_path / "summary.txt"

        packages = mapping.get("packages", {})
        total_redactions = sum(pkg.get("count", 0) for pkg in packages.values())

        lines = [
            "=" * 60,
            "案件证据脱敏处理摘要",
            "=" * 60,
            "",
            f"处理时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}",
            "",
            "-" * 60,
            "处理结果概览",
            "-" * 60,
            "",
            f"  生成资料包: {len(packages)} 个",
            f"  总脱敏次数: {total_redactions} 处",
            f"  缺失文件: {len(self.missing_files)} 个",
            "",
            "-" * 60,
            "各角色包详情",
            "-" * 60,
        ]

        role_names = {
            "plaintiff": "原告",
            "defendant": "被告",
            "judge": "法官",
        }

        for role, pkg_data in packages.items():
            count = pkg_data.get("count", 0)
            lines.append(f"\n  [{role_names.get(role, role)}]")
            lines.append(f"    脱敏次数: {count} 处")
            lines.append(f"    输出目录: {role}_package/")

        lines.extend([
            "",
            "-" * 60,
            "输出文件清单",
            "-" * 60,
            "",
            "  报告类:",
            "    - redaction_report.html - 脱敏报告",
            "    - summary.txt - 摘要报告",
            "    - audit_log.json - 审计日志",
            "    - redaction_mapping.json - 脱敏映射",
            "",
            "  数据类:",
            "    - missing_files.csv - 缺失/额外文件列表",
            "",
            "  压缩包:",
            "    - plaintiff_package_*.zip - 原告资料包",
            "    - defendant_package_*.zip - 被告资料包",
            "    - judge_package_*.zip - 法官资料包",
            "",
            "=" * 60,
        ])

        with open(summary_path, "w", encoding="utf-8") as f:
            f.write("\n".join(lines))

        return summary_path
