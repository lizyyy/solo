import json
from datetime import datetime, date
from pathlib import Path
from typing import Dict, List, Optional, Any, Union

from podcast_checker.models.schemas import (
    EpisodeCheckResult,
    CheckStatus,
    AuditPackage,
    Episode,
)


class MarkdownExporter:
    STATUS_ICONS = {
        CheckStatus.PASS: "✅",
        CheckStatus.WARNING: "⚠️",
        CheckStatus.FAIL: "❌",
        CheckStatus.PENDING: "⏳",
    }
    
    @classmethod
    def generate_release_list(
        cls,
        check_results: List[EpisodeCheckResult],
        title: str = "播客发布清单",
    ) -> str:
        lines = []
        
        lines.append(f"# {title}")
        lines.append("")
        lines.append(f"> 生成时间: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        pass_count = sum(1 for r in check_results if r.overall_status == CheckStatus.PASS)
        warning_count = sum(1 for r in check_results if r.overall_status == CheckStatus.WARNING)
        fail_count = sum(1 for r in check_results if r.overall_status == CheckStatus.FAIL)
        pending_count = sum(1 for r in check_results if r.overall_status == CheckStatus.PENDING)
        total_count = len(check_results)
        
        lines.append("## 统计概览")
        lines.append("")
        lines.append(f"| 状态 | 数量 | 说明 |")
        lines.append(f"|------|------|------|")
        lines.append(f"| ✅ 通过 | {pass_count} | 符合所有发布要求 |")
        lines.append(f"| ⚠️ 警告 | {warning_count} | 存在问题但不阻断发布 |")
        lines.append(f"| ❌ 失败 | {fail_count} | 存在严重问题，需修复 |")
        lines.append(f"| ⏳ 待定 | {pending_count} | 检查未完成 |")
        lines.append(f"| **总计** | **{total_count}** | |")
        lines.append("")
        
        publishable = [r for r in check_results if r.can_publish]
        lines.append(f"**可发布集数**: {len(publishable)}/{total_count}")
        lines.append("")
        
        lines.append("---")
        lines.append("")
        
        lines.append("## 详细清单")
        lines.append("")
        
        for result in sorted(check_results, key=lambda r: r.episode_number):
            icon = cls.STATUS_ICONS[result.overall_status]
            
            lines.append(f"### {icon} 第 {result.episode_number} 集: {result.title}")
            lines.append("")
            
            lines.append(f"- **整体状态**: `{result.overall_status.value.upper()}`")
            lines.append(f"- **响度检查**: {cls.STATUS_ICONS[result.loudness_status]} {result.loudness_status.value}")
            lines.append(f"- **广告授权**: {cls.STATUS_ICONS[result.ad_status]} {result.ad_status.value}")
            lines.append(f"- **音乐授权**: {cls.STATUS_ICONS[result.music_status]} {result.music_status.value}")
            lines.append(f"- **封面检查**: {cls.STATUS_ICONS[result.cover_status]} {result.cover_status.value}")
            lines.append("")
            
            if result.issues:
                lines.append("#### 问题列表")
                lines.append("")
                
                fail_issues = result.fail_issues
                warning_issues = result.warning_issues
                
                if fail_issues:
                    lines.append("##### ❌ 严重问题 (需修复)")
                    lines.append("")
                    for issue in fail_issues:
                        lines.append(f"- **{issue.issue_type.value}**: {issue.message}")
                        if issue.details:
                            details_str = ", ".join(
                                f"{k}: {v}" for k, v in issue.details.items()
                            )
                            lines.append(f"  - 详情: {details_str}")
                    lines.append("")
                
                if warning_issues:
                    lines.append("##### ⚠️ 警告 (建议检查)")
                    lines.append("")
                    for issue in warning_issues:
                        lines.append(f"- **{issue.issue_type.value}**: {issue.message}")
                        if issue.details:
                            details_str = ", ".join(
                                f"{k}: {v}" for k, v in issue.details.items()
                            )
                            lines.append(f"  - 详情: {details_str}")
                    lines.append("")
            
            if result.review_notes:
                lines.append("#### 复核备注")
                lines.append("")
                for note in result.review_notes:
                    reviewer = note.reviewer or "未知"
                    time = note.created_at.strftime('%Y-%m-%d %H:%M')
                    lines.append(f"> [{time}] @{reviewer}: {note.note}")
                    lines.append("")
            
            lines.append("---")
            lines.append("")
        
        lines.append("## 可发布列表")
        lines.append("")
        
        if publishable:
            lines.append("以下集数符合所有发布要求:")
            lines.append("")
            lines.append("| 集号 | 标题 | 检查时间 |")
            lines.append("|------|------|----------|")
            for result in publishable:
                check_time = result.checked_at.strftime('%Y-%m-%d %H:%M') if result.checked_at else "-"
                lines.append(f"| {result.episode_number} | {result.title} | {check_time} |")
        else:
            lines.append("*当前没有可发布的集数*")
        
        lines.append("")
        
        return "\n".join(lines)
    
    @classmethod
    def export(
        cls,
        output_path: Path,
        check_results: List[EpisodeCheckResult],
        title: str = "播客发布清单",
    ) -> None:
        content = cls.generate_release_list(check_results, title)
        output_path.write_text(content, encoding="utf-8")


class JSONExporter:
    @staticmethod
    def model_to_dict(obj: Any) -> Any:
        if hasattr(obj, "model_dump"):
            data = obj.model_dump()
            for key, value in data.items():
                if hasattr(value, "value"):
                    data[key] = value.value
                elif isinstance(value, list):
                    data[key] = [JSONExporter.model_to_dict(item) for item in value]
                elif isinstance(value, dict):
                    data[key] = {k: JSONExporter.model_to_dict(v) for k, v in value.items()}
                elif isinstance(value, (datetime, date)):
                    data[key] = value.isoformat()
            return data
        elif hasattr(obj, "value"):
            return obj.value
        elif isinstance(obj, (datetime, date)):
            return obj.isoformat()
        elif isinstance(obj, list):
            return [JSONExporter.model_to_dict(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: JSONExporter.model_to_dict(v) for k, v in obj.items()}
        return obj
    
    @classmethod
    def generate_audit_package(
        cls,
        check_results: List[EpisodeCheckResult],
        episodes: Optional[List[Episode]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
    ) -> AuditPackage:
        statistics = cls._calculate_statistics(check_results)
        
        return AuditPackage(
            episodes=check_results,
            statistics=statistics,
            raw_data=raw_data or {},
        )
    
    @classmethod
    def _calculate_statistics(
        cls, check_results: List[EpisodeCheckResult]
    ) -> Dict[str, Any]:
        status_counts: Dict[str, int] = {}
        issue_counts: Dict[str, int] = {}
        
        for result in check_results:
            status = result.overall_status.value
            status_counts[status] = status_counts.get(status, 0) + 1
            
            for issue in result.issues:
                issue_type = issue.issue_type.value
                issue_counts[issue_type] = issue_counts.get(issue_type, 0) + 1
        
        return {
            "total_episodes": len(check_results),
            "status_counts": status_counts,
            "issue_counts": issue_counts,
            "pass_count": sum(1 for r in check_results if r.overall_status == CheckStatus.PASS),
            "fail_count": sum(1 for r in check_results if r.overall_status == CheckStatus.FAIL),
            "warning_count": sum(1 for r in check_results if r.overall_status == CheckStatus.WARNING),
            "can_publish_count": sum(1 for r in check_results if r.can_publish),
        }
    
    @classmethod
    def export(
        cls,
        output_path: Path,
        check_results: List[EpisodeCheckResult],
        episodes: Optional[List[Episode]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
        indent: int = 2,
    ) -> None:
        audit_package = cls.generate_audit_package(check_results, episodes, raw_data)
        
        data = {
            "generated_at": audit_package.generated_at.isoformat(),
            "version": audit_package.version,
            "statistics": audit_package.statistics,
            "episodes": [cls.model_to_dict(ep) for ep in audit_package.episodes],
            "raw_data": cls.model_to_dict(audit_package.raw_data),
        }
        
        output_path.write_text(
            json.dumps(data, ensure_ascii=False, indent=indent),
            encoding="utf-8",
        )


class ExportManager:
    def __init__(
        self,
        output_dir: Path,
        markdown_exporter: Optional[MarkdownExporter] = None,
        json_exporter: Optional[JSONExporter] = None,
    ):
        self.output_dir = output_dir
        self.markdown_exporter = markdown_exporter or MarkdownExporter()
        self.json_exporter = json_exporter or JSONExporter()
    
    def export_all(
        self,
        check_results: List[EpisodeCheckResult],
        episodes: Optional[List[Episode]] = None,
        raw_data: Optional[Dict[str, Any]] = None,
        base_filename: str = "podcast_check",
    ) -> Dict[str, Path]:
        self.output_dir.mkdir(parents=True, exist_ok=True)
        
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        
        outputs: Dict[str, Path] = {}
        
        md_path = self.output_dir / f"{base_filename}_release_list_{timestamp}.md"
        self.markdown_exporter.export(md_path, check_results)
        outputs["markdown"] = md_path
        
        json_path = self.output_dir / f"{base_filename}_audit_package_{timestamp}.json"
        self.json_exporter.export(json_path, check_results, episodes, raw_data)
        outputs["json"] = json_path
        
        return outputs
