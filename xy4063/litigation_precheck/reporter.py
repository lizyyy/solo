import csv
from pathlib import Path
from typing import Dict, Any, List, Optional
from datetime import datetime


class Reporter:
    def __init__(self, output_config: Dict[str, Any]):
        self.output_config = output_config
        self.report_md_filename = output_config.get("report_md_filename", "预检报告.md")
        self.report_csv_filename = output_config.get("report_csv_filename", "预检报告.csv")
    
    def generate_markdown_report(
        self,
        check_result: Dict[str, Any],
        manifest: Optional[Dict[str, Any]] = None,
        csv_validation: Optional[Dict[str, Any]] = None,
        project_info: Optional[Dict[str, Any]] = None
    ) -> str:
        lines = []
        
        lines.append("# 诉讼材料递交包预检报告")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        if project_info:
            lines.append("## 项目信息")
            lines.append("")
            if project_info.get("project_name"):
                lines.append(f"- **项目名称**: {project_info['project_name']}")
            if project_info.get("case_number"):
                lines.append(f"- **案号**: {project_info['case_number']}")
            if project_info.get("court"):
                lines.append(f"- **法院**: {project_info['court']}")
            lines.append("")
        
        lines.append("## 预检概览")
        lines.append("")
        
        is_valid = check_result.get("is_valid", False)
        status_emoji = "✅" if is_valid else "❌"
        status_text = "通过" if is_valid else "存在问题"
        lines.append(f"**整体状态**: {status_emoji} {status_text}")
        lines.append("")
        
        total_issues = check_result.get("total_issues", 0)
        error_count = check_result.get("error_count", 0)
        warning_count = check_result.get("warning_count", 0)
        
        lines.append(f"- **总问题数**: {total_issues}")
        lines.append(f"- **错误数 (必须修复)**: {error_count}")
        lines.append(f"- **警告数 (建议检查)**: {warning_count}")
        lines.append("")
        
        if manifest:
            lines.append("## 文件扫描概览")
            lines.append("")
            lines.append(f"- **扫描文件数**: {manifest.get('total_files', 0)}")
            lines.append(f"- **总文件大小**: {self._format_size(manifest.get('total_size', 0))}")
            lines.append(f"- **扫描时间**: {manifest.get('scan_time', '未知')}")
            lines.append("")
        
        lines.append("## 问题详情")
        lines.append("")
        
        issues = check_result.get("issues", [])
        
        if not issues:
            lines.append("🎉 未发现任何问题！")
            lines.append("")
        else:
            error_issues = [i for i in issues if i.get("severity") == "error"]
            warning_issues = [i for i in issues if i.get("severity") == "warning"]
            
            if error_issues:
                lines.append("### ❌ 错误（必须修复）")
                lines.append("")
                lines.append("| 序号 | 问题类型 | 描述 | 相关文件 |")
                lines.append("|------|----------|------|----------|")
                for idx, issue in enumerate(error_issues, 1):
                    issue_type = self._get_issue_type_name(issue.get("issue_type", ""))
                    message = issue.get("message", "")
                    file_name = issue.get("file_name", "") or issue.get("file_path", "") or "-"
                    lines.append(f"| {idx} | {issue_type} | {message} | {file_name} |")
                lines.append("")
            
            if warning_issues:
                lines.append("### ⚠️ 警告（建议检查）")
                lines.append("")
                lines.append("| 序号 | 问题类型 | 描述 | 相关文件 |")
                lines.append("|------|----------|------|----------|")
                for idx, issue in enumerate(warning_issues, 1):
                    issue_type = self._get_issue_type_name(issue.get("issue_type", ""))
                    message = issue.get("message", "")
                    file_name = issue.get("file_name", "") or issue.get("file_path", "") or "-"
                    lines.append(f"| {idx} | {issue_type} | {message} | {file_name} |")
                lines.append("")
        
        passed_files = check_result.get("passed_files", [])
        failed_files = check_result.get("failed_files", [])
        
        lines.append("## 文件状态")
        lines.append("")
        lines.append(f"- **通过文件数**: {len(passed_files)}")
        lines.append(f"- **未通过文件数**: {len(failed_files)}")
        lines.append("")
        
        if failed_files:
            lines.append("### 未通过的文件")
            lines.append("")
            for f in failed_files:
                lines.append(f"- ❌ {f}")
            lines.append("")
        
        if passed_files:
            lines.append("### 通过的文件")
            lines.append("")
            for f in passed_files:
                lines.append(f"- ✅ {f}")
            lines.append("")
        
        if csv_validation:
            lines.append("## 证据目录校验详情")
            lines.append("")
            
            csv_valid = csv_validation.get("is_valid", False)
            lines.append(f"**校验状态**: {'✅ 通过' if csv_valid else '❌ 存在问题'}")
            lines.append("")
            
            missing_files = csv_validation.get("missing_files", [])
            extra_files = csv_validation.get("extra_files", [])
            number_gaps = csv_validation.get("number_gaps", [])
            duplicate_numbers = csv_validation.get("duplicate_numbers", [])
            
            if missing_files:
                lines.append(f"### 缺失的证据文件 ({len(missing_files)} 个)")
                lines.append("")
                for f in missing_files:
                    lines.append(f"- ❌ {f}")
                lines.append("")
            
            if extra_files:
                lines.append(f"### 清单外的证据文件 ({len(extra_files)} 个)")
                lines.append("")
                for f in extra_files:
                    lines.append(f"- ⚠️ {f}")
                lines.append("")
            
            if number_gaps:
                lines.append(f"### 证据编号跳号 ({len(number_gaps)} 处)")
                lines.append("")
                for gap in number_gaps:
                    if len(gap) >= 2:
                        if gap[0] == gap[1]:
                            lines.append(f"- ❌ 编号 {gap[0]} 缺失")
                        else:
                            lines.append(f"- ❌ 编号 {gap[0]} - {gap[1]} 缺失")
                lines.append("")
            
            if duplicate_numbers:
                lines.append(f"### 证据编号重复 ({len(duplicate_numbers)} 个)")
                lines.append("")
                for num in duplicate_numbers:
                    lines.append(f"- ❌ 编号 {num} 重复")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本报告由诉讼材料递交包预检器自动生成*")
        
        return "\n".join(lines)
    
    def generate_csv_report(
        self,
        check_result: Dict[str, Any],
        manifest: Optional[Dict[str, Any]] = None,
        project_info: Optional[Dict[str, Any]] = None
    ) -> List[List[str]]:
        rows = []
        
        rows.append([
            "报告生成时间",
            datetime.now().strftime('%Y-%m-%d %H:%M:%S')
        ])
        
        if project_info:
            if project_info.get("project_name"):
                rows.append(["项目名称", project_info["project_name"]])
            if project_info.get("case_number"):
                rows.append(["案号", project_info["case_number"]])
            if project_info.get("court"):
                rows.append(["法院", project_info["court"]])
        
        rows.append([])
        rows.append([
            "整体状态",
            "通过" if check_result.get("is_valid", False) else "存在问题"
        ])
        rows.append(["总问题数", str(check_result.get("total_issues", 0))])
        rows.append(["错误数", str(check_result.get("error_count", 0))])
        rows.append(["警告数", str(check_result.get("warning_count", 0))])
        
        rows.append([])
        rows.append(["=== 问题详情 ==="])
        rows.append([
            "序号",
            "严重程度",
            "问题类型",
            "描述",
            "相关文件",
            "证据编号",
            "详情"
        ])
        
        issues = check_result.get("issues", [])
        for idx, issue in enumerate(issues, 1):
            severity = "错误" if issue.get("severity") == "error" else "警告"
            issue_type = self._get_issue_type_name(issue.get("issue_type", ""))
            message = issue.get("message", "")
            file_name = issue.get("file_name", "") or issue.get("file_path", "") or ""
            evidence_number = str(issue.get("evidence_number", "")) if issue.get("evidence_number") else ""
            
            details = ""
            if issue.get("details"):
                details = str(issue["details"])
            
            rows.append([
                str(idx),
                severity,
                issue_type,
                message,
                file_name,
                evidence_number,
                details
            ])
        
        rows.append([])
        rows.append(["=== 通过文件列表 ==="])
        rows.append(["序号", "文件路径"])
        
        passed_files = check_result.get("passed_files", [])
        for idx, f in enumerate(passed_files, 1):
            rows.append([str(idx), f])
        
        rows.append([])
        rows.append(["=== 未通过文件列表 ==="])
        rows.append(["序号", "文件路径"])
        
        failed_files = check_result.get("failed_files", [])
        for idx, f in enumerate(failed_files, 1):
            rows.append([str(idx), f])
        
        return rows
    
    def save_markdown_report(
        self,
        output_path: Path,
        check_result: Dict[str, Any],
        manifest: Optional[Dict[str, Any]] = None,
        csv_validation: Optional[Dict[str, Any]] = None,
        project_info: Optional[Dict[str, Any]] = None
    ) -> None:
        content = self.generate_markdown_report(
            check_result, manifest, csv_validation, project_info
        )
        with open(output_path, "w", encoding="utf-8") as f:
            f.write(content)
    
    def save_csv_report(
        self,
        output_path: Path,
        check_result: Dict[str, Any],
        manifest: Optional[Dict[str, Any]] = None,
        project_info: Optional[Dict[str, Any]] = None
    ) -> None:
        rows = self.generate_csv_report(check_result, manifest, project_info)
        with open(output_path, "w", encoding="utf-8-sig", newline="") as f:
            writer = csv.writer(f)
            writer.writerows(rows)
    
    @staticmethod
    def _format_size(size_bytes: int) -> str:
        if size_bytes < 1024:
            return f"{size_bytes} B"
        elif size_bytes < 1024 * 1024:
            return f"{size_bytes / 1024:.1f} KB"
        elif size_bytes < 1024 * 1024 * 1024:
            return f"{size_bytes / (1024 * 1024):.1f} MB"
        else:
            return f"{size_bytes / (1024 * 1024 * 1024):.1f} GB"
    
    @staticmethod
    def _get_issue_type_name(issue_type: str) -> str:
        type_names = {
            "missing_required_material": "缺少必备材料",
            "missing_signature_mark": "缺少签名标记",
            "duplicate_hash": "重复文件",
            "page_count_out_of_range": "页数异常",
            "invalid_naming": "命名不规范",
            "evidence_number_gap": "证据编号跳号",
            "duplicate_evidence_number": "证据编号重复",
            "missing_evidence_file": "缺少证据文件",
            "extra_evidence_file": "多余证据文件",
            "csv_parse_error": "CSV解析错误"
        }
        return type_names.get(issue_type, issue_type)
