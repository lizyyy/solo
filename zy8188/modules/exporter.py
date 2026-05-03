from typing import Dict, List, Any, Optional
from dataclasses import dataclass, field, asdict
from datetime import datetime
import csv
import json
from pathlib import Path

from .data_loader import DataLoader
from .quality_analyzer import QualityAnalyzer, ArchiveQuality, PageQuality, FieldQuality
from .data_cleaner import DataCleaner, DirtyDataIssue, ArchiveCleaningReport


@dataclass
class ReviewDecision:
    archive_id: str
    page_num: int
    reviewed_by: str
    reviewed_at: str
    decision: str
    comments: str = ""
    corrected_fields: Dict[str, str] = field(default_factory=dict)
    issues_resolved: List[str] = field(default_factory=list)


class ReviewManager:
    def __init__(self):
        self.decisions: Dict[str, ReviewDecision] = {}
    
    def add_decision(
        self,
        archive_id: str,
        page_num: int,
        reviewed_by: str,
        decision: str,
        comments: str = "",
        corrected_fields: Dict[str, str] = None,
        issues_resolved: List[str] = None
    ) -> ReviewDecision:
        key = f"{archive_id}_{page_num}"
        decision_obj = ReviewDecision(
            archive_id=archive_id,
            page_num=page_num,
            reviewed_by=reviewed_by,
            reviewed_at=datetime.now().isoformat(),
            decision=decision,
            comments=comments,
            corrected_fields=corrected_fields or {},
            issues_resolved=issues_resolved or []
        )
        self.decisions[key] = decision_obj
        return decision_obj
    
    def get_decision(self, archive_id: str, page_num: int) -> Optional[ReviewDecision]:
        key = f"{archive_id}_{page_num}"
        return self.decisions.get(key)
    
    def get_all_decisions(self) -> List[ReviewDecision]:
        return list(self.decisions.values())
    
    def get_decisions_by_archive(self, archive_id: str) -> List[ReviewDecision]:
        return [d for d in self.decisions.values() if d.archive_id == archive_id]
    
    def get_statistics(self) -> Dict[str, Any]:
        if not self.decisions:
            return {"total_reviewed": 0}
        
        decisions = list(self.decisions.values())
        decision_counts = {}
        for d in decisions:
            decision_counts[d.decision] = decision_counts.get(d.decision, 0) + 1
        
        return {
            "total_reviewed": len(decisions),
            "by_decision": decision_counts,
            "archives_covered": len(set(d.archive_id for d in decisions))
        }


class Exporter:
    def __init__(
        self,
        data_loader: DataLoader,
        quality_analyzer: QualityAnalyzer,
        data_cleaner: DataCleaner,
        review_manager: ReviewManager
    ):
        self.data_loader = data_loader
        self.quality_analyzer = quality_analyzer
        self.data_cleaner = data_cleaner
        self.review_manager = review_manager
        self.export_time = datetime.now()
    
    def export_review_report(self, output_path: str) -> str:
        report = self._generate_markdown_report()
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            f.write(report)
        
        return str(output_file)
    
    def export_issues_csv(self, output_path: str) -> str:
        rows = self._generate_issues_rows()
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        fieldnames = [
            'archive_id', 'page_num', 'issue_type', 'severity',
            'description', 'token_id', 'original_value', 'suggested_fix',
            'needs_manual_review', 'reviewed', 'review_decision', 'comments'
        ]
        
        with open(output_file, 'w', encoding='utf-8-sig', newline='') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(rows)
        
        return str(output_file)
    
    def export_all(
        self,
        report_path: str = "output/review_report.md",
        issues_path: str = "output/issues.csv"
    ) -> Dict[str, str]:
        return {
            "review_report": self.export_review_report(report_path),
            "issues_csv": self.export_issues_csv(issues_path)
        }
    
    def _generate_markdown_report(self) -> str:
        lines = []
        
        lines.append("# OCR 质检复核报告")
        lines.append("")
        lines.append(f"**生成时间**: {self.export_time.strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        data_summary = self.data_loader.get_summary()
        lines.append("## 数据概览")
        lines.append("")
        lines.append(f"- **总案卷数**: {data_summary['total_archives']}")
        lines.append(f"- **总页数**: {data_summary['total_pages']}")
        lines.append(f"- **总Token数**: {data_summary['total_tokens']}")
        lines.append(f"- **模板名称**: {data_summary['template_name']}")
        lines.append(f"- **模板版本**: {data_summary['template_version']}")
        lines.append("")
        
        quality_summary = self.quality_analyzer.get_quality_summary()
        lines.append("## 质检分析概览")
        lines.append("")
        lines.append(f"- **问题案卷数**: {quality_summary['archives_with_issues']} / {quality_summary['total_archives']}")
        lines.append(f"- **问题页数**: {quality_summary['pages_with_issues']} / {quality_summary['total_pages']}")
        lines.append(f"- **需复核页数**: {quality_summary['review_pages_count']}")
        lines.append(f"- **低置信度Token**: {quality_summary['low_confidence_tokens']}")
        lines.append(f"- **极低置信度Token**: {quality_summary['critical_confidence_tokens']}")
        lines.append(f"- **缺页总数**: {quality_summary['missing_pages_total']}")
        lines.append("")
        
        cleaning_summary = self.data_cleaner.get_cleaning_summary()
        lines.append("## 脏数据清理概览")
        lines.append("")
        lines.append(f"- **总问题数**: {cleaning_summary['total_issues']}")
        lines.append(f"- **缺页**: {cleaning_summary['missing_pages_total']}")
        lines.append(f"- **旋转页**: {cleaning_summary['rotated_pages_total']}")
        lines.append(f"- **坐标越界Token**: {cleaning_summary['out_of_bounds_tokens_total']}")
        lines.append("")
        
        if cleaning_summary['issue_types']:
            lines.append("### 问题类型分布")
            lines.append("")
            for issue_type, count in cleaning_summary['issue_types'].items():
                lines.append(f"- **{issue_type}**: {count}")
            lines.append("")
        
        if cleaning_summary['severity_distribution']:
            lines.append("### 严重程度分布")
            lines.append("")
            for severity, count in cleaning_summary['severity_distribution'].items():
                lines.append(f"- **{severity}**: {count}")
            lines.append("")
        
        review_stats = self.review_manager.get_statistics()
        if review_stats['total_reviewed'] > 0:
            lines.append("## 复核进度")
            lines.append("")
            lines.append(f"- **已复核页数**: {review_stats['total_reviewed']}")
            lines.append(f"- **涉及案卷数**: {review_stats['archives_covered']}")
            lines.append("")
            if review_stats.get('by_decision'):
                lines.append("### 复核结果分布")
                lines.append("")
                for decision, count in review_stats['by_decision'].items():
                    lines.append(f"- **{decision}**: {count}")
                lines.append("")
        
        lines.append("## 案卷详情")
        lines.append("")
        
        for archive_id in self.data_loader.get_all_archive_ids():
            lines.append(f"### 案卷: {archive_id}")
            lines.append("")
            
            archive_pages = self.data_loader.get_archive_pages(archive_id)
            archive_quality = self.quality_analyzer.archives_quality.get(archive_id)
            archive_cleaning = self.data_cleaner.archives_report.get(archive_id)
            archive_decisions = self.review_manager.get_decisions_by_archive(archive_id)
            
            lines.append(f"- **总页数**: {len(archive_pages)}")
            
            if archive_quality:
                lines.append(f"- **问题页数**: {archive_quality.pages_with_issues}")
                if archive_quality.missing_pages:
                    lines.append(f"- **缺页**: {archive_quality.missing_pages}")
            
            if archive_cleaning:
                lines.append(f"- **脏数据问题数**: {archive_cleaning.total_issues}")
            
            lines.append(f"- **已复核页数**: {len(archive_decisions)}")
            lines.append("")
            
            for page_num in sorted([p.page_num for p in archive_pages]):
                page_quality = archive_quality.pages_quality.get(page_num) if archive_quality else None
                page_cleaning = archive_cleaning.pages.get(page_num) if archive_cleaning else None
                page_decision = self.review_manager.get_decision(archive_id, page_num)
                
                status_icon = "✅" if page_decision and page_decision.decision == "通过" else "⚠️" if page_quality and page_quality.needs_review else "✅"
                
                lines.append(f"#### 第 {page_num} 页 {status_icon}")
                lines.append("")
                
                if page_quality:
                    if page_quality.needs_review:
                        lines.append(f"- **需复核原因**: {'; '.join(page_quality.review_reasons)}")
                    
                    if page_quality.fields_quality:
                        lines.append(f"- **字段质量**:")
                        for field_name, fq in page_quality.fields_quality.items():
                            if fq.needs_review:
                                lines.append(f"  - ❌ **{field_name}**: {fq.review_reason}")
                            elif fq.detected:
                                lines.append(f"  - ✅ **{field_name}**: 置信度 {fq.confidence:.2f}")
                            else:
                                lines.append(f"  - ⚠️ **{field_name}**: 未检测到")
                
                if page_cleaning and page_cleaning.issues:
                    lines.append(f"- **脏数据问题**:")
                    for issue in page_cleaning.issues:
                        lines.append(f"  - [{issue.severity}] {issue.description}")
                
                if page_decision:
                    lines.append(f"- **复核状态**: {page_decision.decision}")
                    if page_decision.comments:
                        lines.append(f"- **复核意见**: {page_decision.comments}")
                    if page_decision.corrected_fields:
                        lines.append(f"- **修正字段**:")
                        for field, value in page_decision.corrected_fields.items():
                            lines.append(f"  - {field}: {value}")
                
                lines.append("")
        
        lines.append("## 附录")
        lines.append("")
        lines.append("### 术语说明")
        lines.append("")
        lines.append("- **置信度**: OCR引擎对识别结果的置信程度，范围0-1")
        lines.append("- **版式漂移**: 识别字段位置与模板预期位置的偏差")
        lines.append("- **坐标越界**: OCR Token坐标超出页面边界")
        lines.append("- **缺页**: 案卷中连续页码之间缺少的页面")
        lines.append("")
        
        lines.append("### 复核结果说明")
        lines.append("")
        lines.append("- **通过**: 页面质量合格，无需修改")
        lines.append("- **需修正**: 页面存在问题，需要人工修正")
        lines.append("- **重新扫描**: 页面质量过差，需要重新扫描")
        lines.append("")
        
        return "\n".join(lines)
    
    def _generate_issues_rows(self) -> List[Dict[str, Any]]:
        rows = []
        
        for issue in self.data_cleaner.all_issues:
            decision = self.review_manager.get_decision(issue.archive_id, issue.page_num)
            
            row = {
                'archive_id': issue.archive_id,
                'page_num': issue.page_num,
                'issue_type': issue.issue_type,
                'severity': issue.severity,
                'description': issue.description,
                'token_id': issue.token_id or '',
                'original_value': json.dumps(issue.original_value, ensure_ascii=False) if issue.original_value else '',
                'suggested_fix': issue.suggested_fix or '',
                'needs_manual_review': '是' if issue.needs_manual_review else '否',
                'reviewed': '是' if decision else '否',
                'review_decision': decision.decision if decision else '',
                'comments': decision.comments if decision else ''
            }
            rows.append(row)
        
        quality_issues = self._extract_quality_issues()
        rows.extend(quality_issues)
        
        return rows
    
    def _extract_quality_issues(self) -> List[Dict[str, Any]]:
        issues = []
        
        for archive_id, archive_quality in self.quality_analyzer.archives_quality.items():
            for page_num, page_quality in archive_quality.pages_quality.items():
                decision = self.review_manager.get_decision(archive_id, page_num)
                
                if page_quality.has_rotation:
                    issues.append({
                        'archive_id': archive_id,
                        'page_num': page_num,
                        'issue_type': 'page_rotation',
                        'severity': 'high',
                        'description': f"页面旋转 {page_quality.rotation_angle} 度",
                        'token_id': '',
                        'original_value': page_quality.rotation_angle,
                        'suggested_fix': f"旋转 {-page_quality.rotation_angle} 度",
                        'needs_manual_review': '是',
                        'reviewed': '是' if decision else '否',
                        'review_decision': decision.decision if decision else '',
                        'comments': decision.comments if decision else ''
                    })
                
                if page_quality.critical_confidence_tokens > 0:
                    issues.append({
                        'archive_id': archive_id,
                        'page_num': page_num,
                        'issue_type': 'low_confidence_tokens',
                        'severity': 'critical',
                        'description': f"存在 {page_quality.critical_confidence_tokens} 个极低置信度Token",
                        'token_id': '',
                        'original_value': page_quality.critical_confidence_tokens,
                        'suggested_fix': "建议人工核对或重新OCR",
                        'needs_manual_review': '是',
                        'reviewed': '是' if decision else '否',
                        'review_decision': decision.decision if decision else '',
                        'comments': decision.comments if decision else ''
                    })
                
                for field_name, field_quality in page_quality.fields_quality.items():
                    if field_quality.needs_review:
                        issues.append({
                            'archive_id': archive_id,
                            'page_num': page_num,
                            'issue_type': f'field_issue_{field_name}',
                            'severity': 'high' if field_quality.confidence < 0.5 else 'medium',
                            'description': f"字段[{field_name}]: {field_quality.review_reason}",
                            'token_id': '',
                            'original_value': json.dumps({
                                'confidence': field_quality.confidence,
                                'layout_drift': field_quality.layout_drift_distance,
                                'detected_text': field_quality.detected_text
                            }, ensure_ascii=False),
                            'suggested_fix': "建议人工核对",
                            'needs_manual_review': '是',
                            'reviewed': '是' if decision else '否',
                            'review_decision': decision.decision if decision else '',
                            'comments': decision.comments if decision else ''
                        })
        
        return issues
