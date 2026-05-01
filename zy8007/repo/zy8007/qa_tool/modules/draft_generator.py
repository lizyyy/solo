"""草稿生成模块"""

from typing import List, Dict, Any, Optional
from dataclasses import dataclass, field
from collections import defaultdict

from .data_import import QAEntry, ProductParam, CustomerQuestion
from .similarity_search import SimilaritySearch, SimilarMatch, ParamMatch
from .conflict_detector import ConflictDetector, QaConflict


@dataclass
class SourceReference:
    """来源引用"""
    source_type: str
    source_name: str
    content: str
    similarity_score: float = 0.0
    matched_keywords: List[str] = field(default_factory=list)


@dataclass
class ConflictWarning:
    """冲突警告"""
    conflict_type: str
    severity: str
    description: str
    conflicting_sources: List[str] = field(default_factory=list)
    suggestions: List[str] = field(default_factory=list)


@dataclass
class AnswerDraft:
    """答复草稿"""
    question: str
    question_id: Optional[str] = None
    draft_content: str = ""
    confidence: float = 0.0
    sources: List[SourceReference] = field(default_factory=list)
    conflicts: List[ConflictWarning] = field(default_factory=list)
    related_params: List[SourceReference] = field(default_factory=list)
    status: str = "draft"
    notes: List[str] = field(default_factory=list)


class DraftGenerator:
    """草稿生成器"""
    
    STATUS_DRAFT = "draft"
    STATUS_CONFLICT = "has_conflict"
    STATUS_NEEDS_REVIEW = "needs_review"
    STATUS_READY = "ready"
    
    def __init__(
        self,
        similarity_search: SimilaritySearch = None,
        conflict_detector: ConflictDetector = None
    ):
        self.similarity_search = similarity_search or SimilaritySearch()
        self.conflict_detector = conflict_detector or ConflictDetector(self.similarity_search)
    
    def generate_draft_for_question(
        self,
        question: CustomerQuestion,
        top_similar: int = 3,
        top_params: int = 2
    ) -> AnswerDraft:
        """为单个问题生成答复草稿"""
        draft = AnswerDraft(
            question=question.question,
            question_id=question.id
        )
        
        similar_matches = self.similarity_search.search_similar_qa(
            question.question, top_k=top_similar
        )
        
        param_matches = self.similarity_search.search_product_params(
            question.question, top_k=top_params
        )
        
        for match in similar_matches:
            source = SourceReference(
                source_type="qa",
                source_name=match.matched_qa.source,
                content=match.matched_qa.answer,
                similarity_score=match.similarity_score,
                matched_keywords=match.matched_keywords
            )
            draft.sources.append(source)
        
        for param_match in param_matches:
            param = param_match.matched_param
            param_content = f"{param.product_name} - {param.param_name}: {param.param_value}"
            if param.version:
                param_content += f" (版本: {param.version})"
            
            source = SourceReference(
                source_type="param",
                source_name=param.source,
                content=param_content,
                similarity_score=param_match.match_score,
                matched_keywords=param_match.matched_keywords
            )
            draft.related_params.append(source)
        
        if similar_matches:
            qa_conflicts = self.conflict_detector.get_conflicts_for_question(
                question.question,
                [m.matched_qa for m in similar_matches],
                similar_matches
            )
            
            for conflict in qa_conflicts:
                warning = ConflictWarning(
                    conflict_type=conflict.conflict_type,
                    severity=conflict.severity,
                    description=conflict.description,
                    conflicting_sources=[e.source for e in conflict.conflicting_entries],
                    suggestions=conflict.suggestions
                )
                draft.conflicts.append(warning)
        
        draft.draft_content = self._synthesize_draft_content(draft)
        draft.confidence = self._calculate_confidence(draft)
        draft.status = self._determine_status(draft)
        draft.notes = self._generate_notes(draft)
        
        return draft
    
    def _synthesize_draft_content(self, draft: AnswerDraft) -> str:
        """合成草稿内容"""
        content_parts = []
        
        if draft.sources:
            best_source = max(draft.sources, key=lambda x: x.similarity_score)
            
            content_parts.append("【参考答复】")
            content_parts.append(best_source.content)
            
            if len(draft.sources) > 1:
                content_parts.append("")
                content_parts.append("【其他相关参考】")
                for i, source in enumerate(draft.sources[1:], 1):
                    content_parts.append(f"参考{i} ({source.source_name}，相似度{source.similarity_score:.0%}):")
                    content_parts.append(f"  {source.content}")
        
        if draft.related_params:
            content_parts.append("")
            content_parts.append("【相关产品参数】")
            for param in draft.related_params:
                content_parts.append(f"- {param.content}")
        
        if not draft.sources and not draft.related_params:
            content_parts.append("【未找到直接参考】")
            content_parts.append("该问题未找到匹配的历史Q&A或产品参数，需要人工答复。")
        
        return "\n".join(content_parts)
    
    def _calculate_confidence(self, draft: AnswerDraft) -> float:
        """计算置信度"""
        if not draft.sources and not draft.related_params:
            return 0.0
        
        confidence = 0.0
        
        if draft.sources:
            best_score = max(s.similarity_score for s in draft.sources)
            confidence += best_score * 0.7
        
        if draft.related_params:
            param_score = max(p.similarity_score for p in draft.related_params)
            confidence += param_score * 0.3
        
        if draft.conflicts:
            high_conflicts = [c for c in draft.conflicts if c.severity == 'high']
            if high_conflicts:
                confidence *= 0.5
        
        return min(confidence, 1.0)
    
    def _determine_status(self, draft: AnswerDraft) -> str:
        """确定草稿状态"""
        if draft.confidence == 0.0:
            return self.STATUS_NEEDS_REVIEW
        
        if draft.conflicts:
            high_conflicts = [c for c in draft.conflicts if c.severity == 'high']
            if high_conflicts:
                return self.STATUS_CONFLICT
            return self.STATUS_NEEDS_REVIEW
        
        if draft.confidence >= 0.8:
            return self.STATUS_READY
        elif draft.confidence >= 0.5:
            return self.STATUS_DRAFT
        else:
            return self.STATUS_NEEDS_REVIEW
    
    def _generate_notes(self, draft: AnswerDraft) -> List[str]:
        """生成备注"""
        notes = []
        
        if draft.confidence == 0.0:
            notes.append("⚠️ 未找到匹配的参考资料，需要人工撰写答复")
        elif draft.confidence < 0.5:
            notes.append("⚠️ 参考资料匹配度较低，建议人工审核并补充内容")
        
        if draft.conflicts:
            for conflict in draft.conflicts:
                severity_tag = "🔴" if conflict.severity == 'high' else "🟡"
                notes.append(f"{severity_tag} 存在{conflict.severity}级冲突: {conflict.description}")
        
        if draft.sources:
            sources_info = [f"{s.source_name}({s.similarity_score:.0%})" for s in draft.sources]
            notes.append(f"📚 参考来源: {', '.join(sources_info)}")
        
        if draft.related_params:
            params_info = [p.source_name for p in draft.related_params]
            notes.append(f"📋 关联参数: {', '.join(params_info)}")
        
        return notes
    
    def generate_drafts_for_questions(
        self,
        questions: List[CustomerQuestion],
        top_similar: int = 3,
        top_params: int = 2
    ) -> List[AnswerDraft]:
        """为多个问题生成答复草稿"""
        drafts = []
        for question in questions:
            draft = self.generate_draft_for_question(
                question, top_similar=top_similar, top_params=top_params
            )
            drafts.append(draft)
        return drafts
    
    def group_drafts_by_status(self, drafts: List[AnswerDraft]) -> Dict[str, List[AnswerDraft]]:
        """按状态分组草稿"""
        groups = defaultdict(list)
        for draft in drafts:
            groups[draft.status].append(draft)
        return dict(groups)
    
    def get_statistics(self, drafts: List[AnswerDraft]) -> Dict[str, Any]:
        """获取草稿统计信息"""
        status_counts = defaultdict(int)
        total_confidence = 0.0
        has_conflict_count = 0
        has_params_count = 0
        
        for draft in drafts:
            status_counts[draft.status] += 1
            total_confidence += draft.confidence
            
            if draft.conflicts:
                has_conflict_count += 1
            if draft.related_params:
                has_params_count += 1
        
        avg_confidence = total_confidence / len(drafts) if drafts else 0.0
        
        return {
            'total_questions': len(drafts),
            'status_distribution': dict(status_counts),
            'average_confidence': avg_confidence,
            'has_conflict_count': has_conflict_count,
            'has_params_count': has_params_count,
            'confidence_levels': {
                'high': len([d for d in drafts if d.confidence >= 0.8]),
                'medium': len([d for d in drafts if 0.5 <= d.confidence < 0.8]),
                'low': len([d for d in drafts if d.confidence < 0.5])
            }
        }
