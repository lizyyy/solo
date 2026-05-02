"""测试相似检索模块"""

import pytest

from qa_tool.modules.similarity_search import (
    SimilaritySearch, SimilarMatch, SynonymHandler, KeywordExtractor,
    SimilarityCalculator
)
from qa_tool.modules.data_import import QAEntry, ProductParam


class TestSynonymHandler:
    """测试同义词处理器"""
    
    def setup_method(self):
        self.handler = SynonymHandler()
    
    def test_default_synonyms(self):
        """测试默认同义词"""
        synonyms = self.handler.get_all_synonyms('支持')
        
        assert '支持' in synonyms
        assert '兼容' in synonyms
        assert '能够' in synonyms
    
    def test_normalize_word(self):
        """测试词语标准化"""
        normalized = self.handler.normalize_word('兼容')
        
        assert normalized == '支持'
    
    def test_expand_keywords(self):
        """测试关键词扩展"""
        keywords = ['支持', '功能']
        expanded = self.handler.expand_keywords(keywords)
        
        assert '支持' in expanded
        assert '兼容' in expanded
        assert '功能' in expanded
        assert '特性' in expanded
    
    def test_add_synonyms(self):
        """测试添加同义词"""
        self.handler.add_synonyms('测试', ['试验', '验证'])
        
        synonyms = self.handler.get_all_synonyms('测试')
        assert '测试' in synonyms
        assert '试验' in synonyms
        assert '验证' in synonyms


class TestKeywordExtractor:
    """测试关键词提取器"""
    
    def setup_method(self):
        self.extractor = KeywordExtractor()
    
    def test_extract_keywords(self):
        """测试关键词提取"""
        text = "系统支持多少并发用户？"
        
        keywords = self.extractor.extract_keywords(text, use_synonyms=False)
        
        assert len(keywords) > 0
        assert '系统' in keywords
        assert '支持' in keywords
        assert '并发' in keywords
        assert '用户' in keywords


class TestSimilarityCalculator:
    """测试相似度计算器"""
    
    def setup_method(self):
        self.calculator = SimilarityCalculator()
    
    def test_jaccard_similarity(self):
        """测试Jaccard相似度"""
        set1 = {'a', 'b', 'c'}
        set2 = {'b', 'c', 'd'}
        
        similarity = self.calculator.jaccard_similarity(set1, set2)
        
        assert similarity == 0.5
    
    def test_jaccard_similarity_empty(self):
        """测试空集相似度"""
        similarity = self.calculator.jaccard_similarity(set(), {'a'})
        
        assert similarity == 0.0


class TestSimilaritySearch:
    """测试相似检索器"""
    
    def setup_method(self):
        self.searcher = SimilaritySearch(similarity_threshold=0.3)
        
        self.qa_entries = [
            QAEntry(
                question="系统支持多少并发用户？",
                answer="系统支持最多1000个并发用户。",
                source="测试1"
            ),
            QAEntry(
                question="系统支持哪些数据库？",
                answer="系统支持MySQL、PostgreSQL等数据库。",
                source="测试2"
            ),
            QAEntry(
                question="是否支持数据备份？",
                answer="是的，系统支持自动备份。",
                source="测试3"
            ),
        ]
        
        self.product_params = [
            ProductParam(
                product_name="企业版",
                param_name="最大并发用户数",
                param_value="1000",
                version="V3.0",
                source="测试"
            ),
            ProductParam(
                product_name="企业版",
                param_name="支持数据库",
                param_value="MySQL, PostgreSQL",
                version="V3.0",
                source="测试"
            ),
        ]
        
        self.searcher.index_qa_entries(self.qa_entries)
        self.searcher.index_product_params(self.product_params)
    
    def test_index_qa_entries(self):
        """测试Q&A索引"""
        assert len(self.searcher.qa_entries) == 3
    
    def test_index_product_params(self):
        """测试产品参数索引"""
        assert len(self.searcher.product_params) == 2
    
    def test_search_similar_qa_exact(self):
        """测试精确匹配搜索"""
        matches = self.searcher.search_similar_qa(
            "系统支持多少并发用户？",
            top_k=2
        )
        
        assert len(matches) > 0
        assert "并发" in matches[0].matched_qa.question
    
    def test_search_similar_qa_synonym(self):
        """测试同义词匹配"""
        matches = self.searcher.search_similar_qa(
            "系统能够支持多少用户同时在线？",
            top_k=2
        )
        
        assert len(matches) > 0
    
    def test_search_product_params(self):
        """测试产品参数搜索"""
        matches = self.searcher.search_product_params(
            "并发用户数",
            top_k=2
        )
        
        assert len(matches) > 0
        assert "并发" in matches[0].matched_param.param_name
