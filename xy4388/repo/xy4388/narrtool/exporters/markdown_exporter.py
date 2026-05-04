"""Markdown 交付单导出器"""

from datetime import datetime
from pathlib import Path
from typing import List, Optional

from narrtool.database.models import (
    CheckResult,
    CheckStatus,
    CheckType,
    Screening,
)


class MarkdownExporter:
    """Markdown 交付单导出器"""
    
    def __init__(self, session):
        self.session = session
    
    def export(
        self,
        screening_id: int,
        output_path: str | Path,
    ) -> Path:
        """导出发付单"""
        screening = self.session.query(Screening).filter(
            Screening.id == screening_id
        ).first()
        
        if not screening:
            raise ValueError(f"场次不存在: {screening_id}")
        
        results = self.session.query(CheckResult).filter(
            CheckResult.screening_id == screening_id
        ).order_by(CheckResult.severity, CheckResult.created_at).all()
        
        markdown = self._generate_markdown(screening, results)
        
        output_path = Path(output_path)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(markdown)
        
        return output_path
    
    def _generate_markdown(
        self,
        screening: Screening,
        results: List[CheckResult],
    ) -> str:
        """生成 Markdown 内容"""
        lines = []
        
        lines.append("# 口述影像交付单")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 场次信息")
        lines.append("")
        lines.append(f"- **电影名称**: {screening.movie_name}")
        lines.append(f"- **放映时间**: {screening.screening_time.strftime('%Y-%m-%d %H:%M')}")
        lines.append(f"- **时长**: {screening.duration} 分钟")
        if screening.location:
            lines.append(f"- **地点**: {screening.location}")
        lines.append("")
        
        stats = self._calculate_statistics(results)
        lines.append("## 检查统计")
        lines.append("")
        lines.append(f"- **总问题数**: {stats['total']}")
        lines.append(f"- **待复核**: {stats['pending']}")
        lines.append(f"- **已确认**: {stats['confirmed']}")
        lines.append(f"- **已驳回**: {stats['dismissed']}")
        lines.append("")
        
        lines.append("### 按类型统计")
        lines.append("")
        lines.append(f"- 口述压住对白: {stats['by_type'].get('dialogue_overlap', 0)} 项")
        lines.append(f"- 关键场景问题: {stats['by_type'].get('missing_scene', 0)} 项")
        lines.append(f"- 志愿者冲突: {stats['by_type'].get('volunteer_conflict', 0)} 项")
        lines.append("")
        
        pending_results = [r for r in results if r.status == CheckStatus.PENDING]
        confirmed_results = [r for r in results if r.status == CheckStatus.CONFIRMED]
        
        if confirmed_results:
            lines.append("## 已确认问题")
            lines.append("")
            
            for i, result in enumerate(confirmed_results, 1):
                lines.append(f"### 问题 {i}")
                lines.append("")
                lines.append(f"- **类型**: {self._format_check_type(result.check_type)}")
                lines.append(f"- **严重程度**: {self._format_severity(result.severity)}")
                lines.append("")
                lines.append("**描述**:")
                lines.append("```")
                lines.append(result.description)
                lines.append("```")
                lines.append("")
                if result.notes:
                    lines.append(f"**备注**: {result.notes}")
                    lines.append("")
        
        if pending_results:
            lines.append("## 待复核问题")
            lines.append("")
            
            for i, result in enumerate(pending_results, 1):
                lines.append(f"### 问题 {i}")
                lines.append("")
                lines.append(f"- **类型**: {self._format_check_type(result.check_type)}")
                lines.append(f"- **严重程度**: {self._format_severity(result.severity)}")
                lines.append("")
                lines.append("**描述**:")
                lines.append("```")
                lines.append(result.description)
                lines.append("```")
                lines.append("")
        
        lines.append("---")
        lines.append("")
        lines.append("*本文档由口述影像检查工具自动生成*")
        
        return "\n".join(lines)
    
    def _calculate_statistics(self, results: List[CheckResult]) -> dict:
        """计算统计信息"""
        stats = {
            "total": len(results),
            "pending": 0,
            "confirmed": 0,
            "dismissed": 0,
            "by_type": {},
            "by_severity": {},
        }
        
        for result in results:
            if result.status == CheckStatus.PENDING:
                stats["pending"] += 1
            elif result.status == CheckStatus.CONFIRMED:
                stats["confirmed"] += 1
            elif result.status == CheckStatus.DISMISSED:
                stats["dismissed"] += 1
            
            type_key = result.check_type.value
            stats["by_type"][type_key] = stats["by_type"].get(type_key, 0) + 1
            
            severity_key = result.severity.value
            stats["by_severity"][severity_key] = stats["by_severity"].get(severity_key, 0) + 1
        
        return stats
    
    def _format_check_type(self, check_type: CheckType) -> str:
        """格式化检查类型"""
        type_names = {
            CheckType.DIALOGUE_OVERLAP: "口述压住对白",
            CheckType.MISSING_SCENE: "关键场景问题",
            CheckType.VOLUNTEER_CONFLICT: "志愿者冲突",
        }
        return type_names.get(check_type, check_type.value)
    
    def _format_severity(self, severity) -> str:
        """格式化严重程度"""
        severity_names = {
            "high": "高",
            "medium": "中",
            "low": "低",
        }
        return severity_names.get(severity.value, severity.value)
