"""测试文本清洗模块"""

import pytest

from qa_tool.modules.text_cleaner import TextCleaner, CleanResult
from qa_tool.modules.data_import import QAEntry


class TestTextCleaner:
    """测试文本清洗器"""
    
    def setup_method(self):
        """每个测试前设置"""
        self.cleaner = TextCleaner()
    
    def test_normalize_text_basic(self):
        """测试基本文本标准化"""
        text = "  测试  文本  \n\n  换行  "
        normalized = self.cleaner.normalize_text(text)
        
        assert normalized == "测试 文本\n换行"
    
    def test_normalize_text_fullwidth(self):
        """测试全角转半角"""
        text = "全角：；，。"
        normalized = self.cleaner.normalize_text(text)
        
        assert ":" in normalized
        assert ";" in normalized
        assert "," in normalized
        assert "." in normalized
    
    def test_is_empty_answer(self):
        """测试空答案检测"""
        empty_entries = [
            QAEntry(question="问题", answer="", source="测试"),
            QAEntry(question="问题", answer="无", source="测试"),
            QAEntry(question="问题", answer="暂无", source="测试"),
            QAEntry(question="问题", answer="待补充", source="测试"),
        ]
        
        for entry in empty_entries:
            assert self.cleaner.is_empty_answer(entry), f"答案 '{entry.answer}' 应该被检测为空答案"
    
    def test_is_not_empty_answer(self):
        """测试非空答案"""
        valid_entries = [
            QAEntry(question="问题", answer="这是一个有效的答案", source="测试"),
            QAEntry(question="问题", answer="支持该功能", source="测试"),
        ]
        
        for entry in valid_entries:
            assert not self.cleaner.is_empty_answer(entry), f"答案 '{entry.answer}' 不应该被检测为空答案"
    
    def test_generate_entry_hash(self):
        """测试哈希生成"""
        entry1 = QAEntry(question="问题", answer="答案", source="测试")
        entry2 = QAEntry(question="问题", answer="答案", source="不同来源")
        
        hash1 = self.cleaner.generate_entry_hash(entry1)
        hash2 = self.cleaner.generate_entry_hash(entry2)
        
        assert hash1 == hash2
    
    def test_clean_qa_entries_empty_answer(self):
        """测试清洗空答案"""
        entries = [
            QAEntry(question="有效问题", answer="有效答案", source="测试"),
            QAEntry(question="空答案问题", answer="无", source="测试"),
        ]
        
        cleaned, result = self.cleaner.clean_qa_entries(entries)
        
        assert len(cleaned) == 1
        assert result.removed_empty == 1
        assert result.removed_duplicates == 0
    
    def test_clean_qa_entries_duplicates(self):
        """测试清洗重复项"""
        entries = [
            QAEntry(question="问题", answer="答案", source="测试1"),
            QAEntry(question="问题", answer="答案", source="测试2"),
        ]
        
        cleaned, result = self.cleaner.clean_qa_entries(entries)
        
        assert len(cleaned) == 1
        assert result.removed_duplicates == 1
    
    def test_clean_qa_entries_full(self):
        """测试完整清洗流程"""
        entries = [
            QAEntry(question="有效问题1", answer="有效答案1", source="测试"),
            QAEntry(question="空答案问题", answer="无", source="测试"),
            QAEntry(question="有效问题1", answer="有效答案1", source="测试2"),
            QAEntry(question="有效问题2", answer="有效答案2", source="测试"),
        ]
        
        cleaned, result = self.cleaner.clean_qa_entries(entries)
        
        assert len(cleaned) == 2
        assert result.original_count == 4
        assert result.cleaned_count == 2
        assert result.removed_empty == 1
        assert result.removed_duplicates == 1
    
    def test_issues_recording(self):
        """测试问题记录"""
        entries = [
            QAEntry(question="问题1", answer="无", source="来源A"),
            QAEntry(question="问题2", answer="答案2", source="来源B"),
        ]
        
        cleaned, result = self.cleaner.clean_qa_entries(entries)
        
        assert len(result.issues) == 1
        assert result.issues[0]['type'] == 'empty_answer'
        assert result.issues[0]['source'] == '来源A'
