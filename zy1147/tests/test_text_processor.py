import pytest
from app.core.text_processor import TextProcessor


class TestTextProcessor:
    
    @pytest.fixture
    def processor(self):
        return TextProcessor()
    
    def test_normalize_full_to_half(self, processor):
        result = processor.normalize("ＡＢＣ１２３")
        assert result == "abc123"
    
    def test_normalize_lowercase(self, processor):
        result = processor.normalize("HELLO WORLD")
        assert "hello" in result.lower()
        assert "world" in result.lower()
    
    def test_normalize_remove_spaces(self, processor):
        result = processor.normalize("赌 博")
        assert "赌博" in result
    
    def test_normalize_remove_symbols(self, processor):
        result = processor.normalize("赌*博")
        assert "赌博" in result
    
    def test_segment_basic(self, processor):
        segments = processor.segment("今天天气很好")
        assert len(segments) > 0
        words = [s['word'] for s in segments]
        assert len(words) > 0
        assert any(len(w) > 0 for w in words)
    
    def test_to_pinyin(self, processor):
        result = processor.to_pinyin("赌博")
        assert "du" in result.lower() or "bo" in result.lower()
    
    def test_to_pinyin_initial(self, processor):
        result = processor.to_pinyin("赌博", style='initial')
        assert len(result) <= 4
    
    def test_generate_variants(self, processor):
        variants = processor.generate_variants("赌博")
        assert len(variants) > 0
        
        variant_types = [v['type'] for v in variants]
        assert 'pinyin' in variant_types
    
    def test_extract_context(self, processor):
        text = "这是一段很长的测试文本，用来测试上下文提取功能"
        before, after = processor.extract_context(text, 10, 12, context_length=5)
        
        assert before is not None
        assert after is not None
    
    def test_process_for_detection(self, processor):
        result = processor.process_for_detection("今天去赌博")
        
        assert 'original' in result
        assert 'normalized' in result
        assert 'segments' in result
        assert 'pinyin' in result
        assert 'length' in result
        
        assert result['original'] == "今天去赌博"
        assert result['length'] == 5
    
    def test_normalize_empty_string(self, processor):
        result = processor.normalize("")
        assert result == ""
    
    def test_normalize_whitespace_only(self, processor):
        result = processor.normalize("   ")
        assert result == ""
    
    def test_segment_empty_string(self, processor):
        segments = processor.segment("")
        assert segments == []
    
    def test_segment_whitespace_only(self, processor):
        segments = processor.segment("   ")
        assert segments == []
    
    def test_to_pinyin_empty_string(self, processor):
        result = processor.to_pinyin("")
        assert result == ""
    
    def test_generate_variants_empty_string(self, processor):
        variants = processor.generate_variants("")
        assert len(variants) > 0
