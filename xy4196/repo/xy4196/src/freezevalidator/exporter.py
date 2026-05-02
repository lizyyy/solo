import csv
import json
from datetime import datetime
from pathlib import Path
from typing import Dict, Any, Optional
from .models import AuditSession, ValidationSeverity


class AuditExporter:
    def __init__(self, session: AuditSession):
        self.session = session
    
    def _count_issues_by_severity(self) -> Dict[str, int]:
        counts = {
            "error": 0,
            "warning": 0,
            "info": 0
        }
        for issue in self.session.validation_issues:
            counts[issue.severity.value] += 1
        return counts
    
    def _generate_summary(self) -> Dict[str, Any]:
        issue_counts = self._count_issues_by_severity()
        total_issues = sum(issue_counts.values())
        has_errors = issue_counts["error"] > 0
        
        return {
            "session_id": self.session.session_id,
            "created_at": self.session.created_at.isoformat(),
            "summary": {
                "total_files": len(self.session.ingested_files),
                "total_samples": len(self.session.sample_positions),
                "total_scans": len(self.session.scan_logs),
                "total_temperature_readings": len(self.session.temperature_readings),
                "has_transfer_form": self.session.transfer_form is not None
            },
            "validation": {
                "total_issues": total_issues,
                "errors": issue_counts["error"],
                "warnings": issue_counts["warning"],
                "infos": issue_counts["info"],
                "pass_validation": not has_errors and total_issues == 0,
                "has_critical_errors": has_errors
            },
            "review": {
                "total_reviews": len(self.session.review_entries)
            }
        }
    
    def export_json(self, output_path: Path, include_details: bool = True) -> Path:
        data = self._generate_summary()
        
        if include_details:
            data["ingested_files"] = [
                {
                    "file_type": f.file_type.value,
                    "file_name": f.file_name,
                    "file_hash": f.file_hash,
                    "row_count": f.row_count
                }
                for f in self.session.ingested_files
            ]
            
            data["validation_issues"] = [
                {
                    "rule": i.rule.value,
                    "severity": i.severity.value,
                    "message": i.message,
                    "affected_samples": i.affected_samples[:20],
                    "details": i.details
                }
                for i in self.session.validation_issues
            ]
            
            data["review_entries"] = [
                {
                    "reviewer_name": r.reviewer_name,
                    "action_taken": r.action_taken,
                    "resolution_status": r.resolution_status,
                    "timestamp": r.timestamp.isoformat()
                }
                for r in self.session.review_entries
            ]
        
        with open(output_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
        
        return output_path
    
    def export_csv(self, output_dir: Path) -> None:
        output_dir.mkdir(parents=True, exist_ok=True)
        
        summary_data = self._generate_summary()
        summary_path = output_dir / "summary.csv"
        with open(summary_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            writer.writerow(["类别", "项目", "值"])
            writer.writerow(["会话", "Session ID", summary_data["session_id"]])
            writer.writerow(["会话", "创建时间", summary_data["created_at"]])
            
            summary = summary_data["summary"]
            writer.writerow(["概要", "导入文件数", summary["total_files"]])
            writer.writerow(["概要", "样本总数", summary["total_samples"]])
            writer.writerow(["概要", "扫描记录数", summary["total_scans"]])
            writer.writerow(["概要", "温度记录数", summary["total_temperature_readings"]])
            writer.writerow(["概要", "有交接单", "是" if summary["has_transfer_form"] else "否"])
            
            validation = summary_data["validation"]
            writer.writerow(["校验", "问题总数", validation["total_issues"]])
            writer.writerow(["校验", "错误数", validation["errors"]])
            writer.writerow(["校验", "警告数", validation["warnings"]])
            writer.writerow(["校验", "提示数", validation["infos"]])
            writer.writerow(["校验", "是否通过", "是" if validation["pass_validation"] else "否"])
        
        issues_path = output_dir / "validation_issues.csv"
        if self.session.validation_issues:
            with open(issues_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["严重程度", "规则", "消息", "影响样本数"])
                for issue in self.session.validation_issues:
                    writer.writerow([
                        issue.severity.value,
                        issue.rule.value,
                        issue.message,
                        len(issue.affected_samples)
                    ])
        
        samples_path = output_dir / "samples.csv"
        if self.session.sample_positions:
            with open(samples_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["条码", "冻存盒", "孔位", "批次"])
                for pos in self.session.sample_positions:
                    writer.writerow([
                        pos.barcode,
                        pos.box_id,
                        pos.position_str,
                        pos.batch_id or ""
                    ])
        
        reviews_path = output_dir / "review_entries.csv"
        if self.session.review_entries:
            with open(reviews_path, 'w', encoding='utf-8', newline='') as f:
                writer = csv.writer(f)
                writer.writerow(["时间", "复核人", "动作", "状态", "备注"])
                for r in self.session.review_entries:
                    writer.writerow([
                        r.timestamp.isoformat(),
                        r.reviewer_name,
                        r.action_taken,
                        r.resolution_status,
                        r.comments or ""
                    ])
    
    def export_markdown(self, output_path: Path) -> Path:
        summary = self._generate_summary()
        issue_counts = self._count_issues_by_severity()
        
        md_lines = []
        
        md_lines.append("# 冻存盒交接核对审计报告")
        md_lines.append("")
        md_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        md_lines.append(f"**会话ID**: `{summary['session_id']}`")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        
        md_lines.append("## 1. 校验结果概要")
        md_lines.append("")
        
        status_emoji = "✅" if summary["validation"]["pass_validation"] else "❌"
        md_lines.append(f"**总体状态**: {status_emoji} {'通过' if summary['validation']['pass_validation'] else '存在问题'}")
        md_lines.append("")
        
        md_lines.append("| 严重程度 | 数量 |")
        md_lines.append("|---------|------|")
        md_lines.append(f"| 🔴 错误 | {issue_counts['error']} |")
        md_lines.append(f"| 🟡 警告 | {issue_counts['warning']} |")
        md_lines.append(f"| 🔵 提示 | {issue_counts['info']} |")
        md_lines.append(f"| **总计** | **{summary['validation']['total_issues']}** |")
        md_lines.append("")
        
        md_lines.append("---")
        md_lines.append("")
        
        md_lines.append("## 2. 数据统计")
        md_lines.append("")
        md_lines.append("| 类别 | 数量 |")
        md_lines.append("|------|------|")
        md_lines.append(f"| 导入文件 | {summary['summary']['total_files']} |")
        md_lines.append(f"| 样本记录 | {summary['summary']['total_samples']} |")
        md_lines.append(f"| 扫码记录 | {summary['summary']['total_scans']} |")
        md_lines.append(f"| 温度记录 | {summary['summary']['total_temperature_readings']} |")
        md_lines.append(f"| 复核记录 | {summary['review']['total_reviews']} |")
        md_lines.append("")
        
        md_lines.append("---")
        md_lines.append("")
        
        if self.session.ingested_files:
            md_lines.append("## 3. 导入文件清单")
            md_lines.append("")
            md_lines.append("| 文件类型 | 文件名 | 记录数 | SHA256哈希 |")
            md_lines.append("|---------|--------|--------|-----------|")
            for f in self.session.ingested_files:
                short_hash = f.file_hash[:16] + "..."
                md_lines.append(f"| {f.file_type.value} | {f.file_name} | {f.row_count} | `{short_hash}` |")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
        
        if self.session.validation_issues:
            md_lines.append("## 4. 校验问题详情")
            md_lines.append("")
            
            for issue in self.session.validation_issues:
                severity_emoji = {
                    ValidationSeverity.ERROR: "🔴",
                    ValidationSeverity.WARNING: "🟡",
                    ValidationSeverity.INFO: "🔵"
                }[issue.severity]
                
                md_lines.append(f"### {severity_emoji} [{issue.severity.value.upper()}] {issue.rule.value}")
                md_lines.append("")
                md_lines.append(f"**问题描述**: {issue.message}")
                md_lines.append("")
                
                if issue.affected_samples:
                    md_lines.append(f"**影响样本** ({len(issue.affected_samples)} 个):")
                    md_lines.append("")
                    md_lines.append("```")
                    for sample in issue.affected_samples[:10]:
                        md_lines.append(f"  - {sample}")
                    if len(issue.affected_samples) > 10:
                        md_lines.append(f"  ... 还有 {len(issue.affected_samples) - 10} 个")
                    md_lines.append("```")
                    md_lines.append("")
                
                md_lines.append("---")
                md_lines.append("")
        
        if self.session.review_entries:
            md_lines.append("## 5. 人工复核记录")
            md_lines.append("")
            md_lines.append("| 时间 | 复核人 | 动作 | 状态 | 备注 |")
            md_lines.append("|------|--------|------|------|------|")
            for r in self.session.review_entries:
                comments = r.comments or ""
                if len(comments) > 30:
                    comments = comments[:30] + "..."
                md_lines.append(f"| {r.timestamp.strftime('%Y-%m-%d %H:%M')} | {r.reviewer_name} | {r.action_taken} | {r.resolution_status} | {comments} |")
            md_lines.append("")
            md_lines.append("---")
            md_lines.append("")
        
        md_lines.append("## 6. 使用说明")
        md_lines.append("")
        md_lines.append("- **错误(ERROR)**: 必须修复的严重问题，会导致交接流程中止")
        md_lines.append("- **警告(WARNING)**: 需要关注的问题，建议复核确认")
        md_lines.append("- **提示(INFO)**: 仅供参考的信息，不影响流程")
        md_lines.append("")
        md_lines.append("---")
        md_lines.append("")
        md_lines.append(f"*报告由冻存盒交接核对员 v0.1.0 生成于 {datetime.now().isoformat()}*")
        
        content = "\n".join(md_lines)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
