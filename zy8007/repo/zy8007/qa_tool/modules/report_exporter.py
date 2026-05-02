"""报告导出模块"""

import os
import csv
from typing import List, Dict, Any, Optional
from datetime import datetime

from .data_import import QAEntry, ProductParam, CustomerQuestion
from .similarity_search import ClusterResult
from .conflict_detector import ConflictReport, QaConflict, ParamConflict
from .draft_generator import AnswerDraft, SourceReference, ConflictWarning
from .text_cleaner import CleanResult


class ReportExporter:
    """报告导出器"""
    
    STATUS_ICONS = {
        'ready': '✅',
        'draft': '📝',
        'has_conflict': '⚠️',
        'needs_review': '🔍'
    }
    
    STATUS_NAMES = {
        'ready': '已就绪',
        'draft': '草稿',
        'has_conflict': '存在冲突',
        'needs_review': '需要审核'
    }
    
    SEVERITY_ICONS = {
        'high': '🔴',
        'medium': '🟡',
        'low': '🟢'
    }
    
    def __init__(self, output_dir: str = "out"):
        self.output_dir = output_dir
        self._ensure_output_dir()
    
    def _ensure_output_dir(self):
        """确保输出目录存在"""
        if not os.path.exists(self.output_dir):
            os.makedirs(self.output_dir)
    
    def export_qa_report(
        self,
        drafts: List[AnswerDraft],
        conflict_report: ConflictReport,
        clean_result: Optional[CleanResult] = None,
        clusters: Optional[List[ClusterResult]] = None,
        stats: Optional[Dict[str, Any]] = None
    ) -> str:
        """导出QA报告为Markdown格式"""
        report_lines = []
        
        report_lines.append("# 招投标问答资料整理报告")
        report_lines.append("")
        report_lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        report_lines.append("")
        
        report_lines.extend(self._generate_summary_section(drafts, conflict_report, stats))
        report_lines.append("")
        
        if clean_result and clean_result.issues:
            report_lines.extend(self._generate_cleaning_issues_section(clean_result))
            report_lines.append("")
        
        if conflict_report and (conflict_report.qa_conflicts or conflict_report.param_conflicts):
            report_lines.extend(self._generate_conflicts_section(conflict_report))
            report_lines.append("")
        
        if clusters:
            report_lines.extend(self._generate_clusters_section(clusters))
            report_lines.append("")
        
        report_lines.extend(self._generate_drafts_section(drafts))
        
        report_content = "\n".join(report_lines)
        
        output_path = os.path.join(self.output_dir, "qa_report.md")
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(report_content)
        
        return output_path
    
    def _generate_summary_section(
        self,
        drafts: List[AnswerDraft],
        conflict_report: ConflictReport,
        stats: Optional[Dict[str, Any]]
    ) -> List[str]:
        """生成摘要部分"""
        lines = []
        lines.append("## 📊 处理摘要")
        lines.append("")
        
        if stats:
            lines.append("### 问题处理统计")
            lines.append("")
            lines.append(f"- **总问题数**: {stats['total_questions']}")
            lines.append(f"- **平均置信度**: {stats['average_confidence']:.1%}")
            lines.append(f"- **存在冲突**: {stats['has_conflict_count']} 个问题")
            lines.append(f"- **关联参数**: {stats['has_params_count']} 个问题")
            lines.append("")
            
            lines.append("#### 置信度分布")
            lines.append("")
            conf_levels = stats['confidence_levels']
            total = stats['total_questions']
            for level, name in [('high', '高置信度 (≥80%)'), 
                                ('medium', '中置信度 (50%-80%)'), 
                                ('low', '低置信度 (<50%)')]:
                count = conf_levels.get(level, 0)
                pct = count / total * 100 if total > 0 else 0
                lines.append(f"- {name}: {count} 个 ({pct:.1f}%)")
            lines.append("")
            
            lines.append("#### 状态分布")
            lines.append("")
            status_dist = stats.get('status_distribution', {})
            for status, count in status_dist.items():
                icon = self.STATUS_ICONS.get(status, '❓')
                name = self.STATUS_NAMES.get(status, status)
                lines.append(f"- {icon} {name}: {count} 个")
            lines.append("")
        
        if conflict_report:
            lines.append("### 冲突统计")
            lines.append("")
            lines.append(f"- **Q&A冲突**: {conflict_report.total_qa_conflicts} 个")
            lines.append(f"- **参数冲突**: {conflict_report.total_param_conflicts} 个")
            lines.append("")
            
            if conflict_report.high_severity_count > 0:
                lines.append(f"- 🔴 **高优先级冲突**: {conflict_report.high_severity_count} 个")
            if conflict_report.medium_severity_count > 0:
                lines.append(f"- 🟡 **中优先级冲突**: {conflict_report.medium_severity_count} 个")
            if conflict_report.low_severity_count > 0:
                lines.append(f"- 🟢 **低优先级冲突**: {conflict_report.low_severity_count} 个")
            lines.append("")
        
        return lines
    
    def _generate_cleaning_issues_section(self, clean_result: CleanResult) -> List[str]:
        """生成清洗问题部分"""
        lines = []
        lines.append("## 🧹 数据清洗问题")
        lines.append("")
        
        lines.append(f"- **原始条目数**: {clean_result.original_count}")
        lines.append(f"- **清洗后条目数**: {clean_result.cleaned_count}")
        lines.append(f"- **移除空答案**: {clean_result.removed_empty} 个")
        lines.append(f"- **移除重复项**: {clean_result.removed_duplicates} 个")
        lines.append("")
        
        if clean_result.issues:
            lines.append("### 问题详情")
            lines.append("")
            for idx, issue in enumerate(clean_result.issues, 1):
                issue_type = issue.get('type', 'unknown')
                question = issue.get('question', 'N/A')
                source = issue.get('source', 'N/A')
                action = issue.get('action', 'N/A')
                
                type_name = {
                    'empty_answer': '空答案',
                    'duplicate': '重复条目'
                }.get(issue_type, issue_type)
                
                lines.append(f"{idx}. **{type_name}** ({source})")
                lines.append(f"   - 问题: {question[:80]}...")
                lines.append(f"   - 操作: {action}")
                lines.append("")
        
        return lines
    
    def _generate_conflicts_section(self, conflict_report: ConflictReport) -> List[str]:
        """生成冲突部分"""
        lines = []
        lines.append("## ⚠️ 冲突检测结果")
        lines.append("")
        
        if conflict_report.qa_conflicts:
            lines.append("### Q&A冲突")
            lines.append("")
            for idx, conflict in enumerate(conflict_report.qa_conflicts, 1):
                icon = self.SEVERITY_ICONS.get(conflict.severity, '❓')
                lines.append(f"{idx}. {icon} **{conflict.question_group[:60]}...**")
                lines.append(f"   - 类型: {conflict.conflict_type}")
                lines.append(f"   - 优先级: {conflict.severity}")
                lines.append(f"   - 描述: {conflict.description}")
                lines.append(f"   - 冲突来源: {', '.join([e.source for e in conflict.conflicting_entries])}")
                if conflict.suggestions:
                    lines.append(f"   - 建议:")
                    for suggestion in conflict.suggestions:
                        lines.append(f"     - {suggestion}")
                lines.append("")
        
        if conflict_report.param_conflicts:
            lines.append("### 参数冲突")
            lines.append("")
            for idx, conflict in enumerate(conflict_report.param_conflicts, 1):
                icon = self.SEVERITY_ICONS.get(conflict.severity, '❓')
                lines.append(f"{idx}. {icon} **{conflict.product_name} - {conflict.param_name}**")
                lines.append(f"   - 类型: {conflict.conflict_type}")
                lines.append(f"   - 优先级: {conflict.severity}")
                lines.append(f"   - 描述: {conflict.description}")
                lines.append(f"   - 冲突值:")
                for param in conflict.conflicting_params:
                    version_info = f" (版本: {param.version})" if param.version else ""
                    lines.append(f"     - {param.param_value}{version_info} (来源: {param.source})")
                if conflict.suggestions:
                    lines.append(f"   - 建议:")
                    for suggestion in conflict.suggestions:
                        lines.append(f"     - {suggestion}")
                lines.append("")
        
        return lines
    
    def _generate_clusters_section(self, clusters: List[ClusterResult]) -> List[str]:
        """生成聚类部分"""
        lines = []
        lines.append("## 🔗 相似问题聚类")
        lines.append("")
        
        large_clusters = [c for c in clusters if c.size > 1]
        if not large_clusters:
            lines.append("未发现明显的相似问题组。")
            lines.append("")
            return lines
        
        lines.append(f"共发现 {len(large_clusters)} 个相似问题组:")
        lines.append("")
        
        for idx, cluster in enumerate(clusters, 1):
            if cluster.size <= 1:
                continue
            
            lines.append(f"### 问题组 {idx} ({cluster.size} 个问题)")
            lines.append("")
            lines.append(f"**代表问题**: {cluster.representative_question}")
            lines.append("")
            
            if cluster.size > 1:
                lines.append("**相似问题**:")
                lines.append("")
                for q in cluster.questions[1:]:
                    lines.append(f"- {q}")
                lines.append("")
        
        return lines
    
    def _generate_drafts_section(self, drafts: List[AnswerDraft]) -> List[str]:
        """生成草稿部分"""
        lines = []
        lines.append("## 📋 答复草稿")
        lines.append("")
        
        if not drafts:
            lines.append("没有生成任何草稿。")
            return lines
        
        for idx, draft in enumerate(drafts, 1):
            icon = self.STATUS_ICONS.get(draft.status, '❓')
            status_name = self.STATUS_NAMES.get(draft.status, draft.status)
            
            lines.append(f"### {idx}. {icon} {status_name} (置信度: {draft.confidence:.0%})")
            lines.append("")
            lines.append(f"**问题**: {draft.question}")
            lines.append("")
            
            lines.append("**草稿内容**:")
            lines.append("")
            lines.append("```")
            for line in draft.draft_content.split('\n'):
                lines.append(line)
            lines.append("```")
            lines.append("")
            
            if draft.notes:
                lines.append("**备注**:")
                lines.append("")
                for note in draft.notes:
                    lines.append(f"- {note}")
                lines.append("")
        
        return lines
    
    def export_drafts_csv(self, drafts: List[AnswerDraft]) -> str:
        """导起草稿为CSV格式"""
        output_path = os.path.join(self.output_dir, "drafts.csv")
        
        with open(output_path, 'w', encoding='utf-8', newline='') as f:
            writer = csv.writer(f)
            
            writer.writerow([
                '序号', '问题', '状态', '置信度', '草稿内容',
                '参考来源', '关联参数', '冲突警告', '备注'
            ])
            
            for idx, draft in enumerate(drafts, 1):
                sources = '; '.join([
                    f"{s.source_name}({s.similarity_score:.0%})" 
                    for s in draft.sources
                ]) if draft.sources else ''
                
                params = '; '.join([
                    p.content 
                    for p in draft.related_params
                ]) if draft.related_params else ''
                
                conflicts = '; '.join([
                    f"[{c.severity}] {c.description}" 
                    for c in draft.conflicts
                ]) if draft.conflicts else ''
                
                notes = '; '.join(draft.notes) if draft.notes else ''
                
                writer.writerow([
                    idx,
                    draft.question,
                    self.STATUS_NAMES.get(draft.status, draft.status),
                    f"{draft.confidence:.0%}",
                    draft.draft_content.replace('\n', '\\n'),
                    sources,
                    params,
                    conflicts,
                    notes
                ])
        
        return output_path
    
    def export_processing_summary(
        self,
        qa_count: int,
        param_count: int,
        question_count: int,
        clean_result: Optional[CleanResult] = None
    ) -> str:
        """导出处理摘要"""
        output_path = os.path.join(self.output_dir, "processing_summary.md")
        
        lines = []
        lines.append("# 数据处理摘要")
        lines.append("")
        lines.append(f"**生成时间**: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
        lines.append("")
        
        lines.append("## 数据加载统计")
        lines.append("")
        lines.append(f"- **历史Q&A条目**: {qa_count} 个")
        lines.append(f"- **产品参数条目**: {param_count} 个")
        lines.append(f"- **客户问题**: {question_count} 个")
        lines.append("")
        
        if clean_result:
            lines.append("## 数据清洗统计")
            lines.append("")
            lines.append(f"- **原始Q&A条目**: {clean_result.original_count} 个")
            lines.append(f"- **清洗后条目**: {clean_result.cleaned_count} 个")
            lines.append(f"- **移除空答案**: {clean_result.removed_empty} 个")
            lines.append(f"- **移除重复项**: {clean_result.removed_duplicates} 个")
            lines.append("")
        
        content = "\n".join(lines)
        with open(output_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        return output_path
