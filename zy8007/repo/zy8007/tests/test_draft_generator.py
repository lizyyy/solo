"""测试草稿生成模块"""

import pytest

from qa_tool.modules.draft_generator import (
    DraftGenerator, AnswerDraft, SourceReference, ConflictWarning
)
from qa_tool.modules.similarity_search import SimilaritySearch
from qa_tool.modules.data_import import QAEntry, ProductParam, CustomerQuestion


class TestDraftGenerator:
    """测试草稿生成器"""
    
    def setup_method(self):
        self.similarity_search = SimilaritySearch(similarity_threshold=0.3)
        
        self.qa_entries = [
            QAEntry(
                question="系统支持多少并发用户？",
                answer="系统支持最多1000个并发用户同时在线。",
                source="技术文档"
            ),
            QAEntry(
                question="系统支持哪些数据库？",
                answer="系统支持MySQL、PostgreSQL、Oracle等主流数据库。",
                source="产品白皮书"
            ),
        ]
        
        self.product_params = [
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="1000",
                version="V3.0",
                source="参数表"
            ),
        ]
        
        self.similarity_search.index_qa_entries(self.qa_entries)
        self.similarity_search.index_product_params(self.product_params)
        
        self.generator = DraftGenerator(
            similarity_search=self.similarity_search
        )
    
    def test_generate_draft_for_question_matched(self):
        """测试生成匹配问题的草稿"""
        question = CustomerQuestion(
            question="系统能够支持多少并发用户？",
            id="Q001"
        )
        
        draft = self.generator.generate_draft_for_question(question)
        
        assert draft.question == "系统能够支持多少并发用户？"
        assert draft.question_id == "Q001"
        assert len(draft.sources) > 0
        assert draft.confidence > 0
    
    def test_generate_draft_for_question_no_match(self):
        """测试生成无匹配问题的草稿"""
        question = CustomerQuestion(
            question="这是一个完全不相关的问题，没有任何匹配。",
            id="Q002"
        )
        
        draft = self.generator.generate_draft_for_question(question)
        
        assert len(draft.sources) == 0
        assert draft.confidence == 0.0
        assert "未找到" in draft.draft_content
    
    def test_synthesize_draft_content(self):
        """测试草稿内容合成"""
        sources = [
            SourceReference(
                source_type="qa",
                source_name="测试来源",
                content="这是测试答案内容。",
                similarity_score=0.9
            )
        ]
        
        draft = AnswerDraft(
            question="测试问题",
            sources=sources
        )
        
        content = self.generator._synthesize_draft_content(draft)
        
        assert "参考答复" in content
        assert "测试答案内容" in content
    
    def test_calculate_confidence(self):
        """测试置信度计算"""
        draft_with_sources = AnswerDraft(
            question="测试",
            sources=[
                SourceReference(
                    source_type="qa",
                    source_name="测试",
                    content="测试",
                    similarity_score=0.8
                )
            ]
        )
        
        confidence = self.generator._calculate_confidence(draft_with_sources)
        
        assert confidence > 0
        assert confidence <= 1.0
    
    def test_determine_status(self):
        """测试状态确定"""
        draft_ready = AnswerDraft(
            question="测试",
            confidence=0.9,
            conflicts=[]
        )
        
        status = self.generator._determine_status(draft_ready)
        
        assert status == "ready"
    
    def test_generate_drafts_for_questions(self):
        """测试批量生成草稿"""
        questions = [
            CustomerQuestion(question="并发用户数？", id="Q1"),
            CustomerQuestion(question="数据库支持？", id="Q2"),
            CustomerQuestion(question="不相关问题？", id="Q3"),
        ]
        
        drafts = self.generator.generate_drafts_for_questions(questions)
        
        assert len(drafts) == 3
    
    def test_get_statistics(self):
        """测试获取统计信息"""
        drafts = [
            AnswerDraft(question="问题1", confidence=0.9, status="ready"),
            AnswerDraft(question="问题2", confidence=0.6, status="draft"),
            AnswerDraft(question="问题3", confidence=0.0, status="needs_review"),
        ]
        
        stats = self.generator.get_statistics(drafts)
        
        assert stats['total_questions'] == 3
        assert stats['average_confidence'] > 0
        assert stats['confidence_levels']['high'] == 1
        assert stats['confidence_levels']['medium'] == 1
        assert stats['confidence_levels']['low'] == 1
