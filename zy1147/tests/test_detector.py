import pytest
from app.core.text_processor import TextProcessor
from app.core.semantic import SemanticMatcher
from app.core.detector import ContentDetector


class TestContentDetector:
    
    @pytest.fixture
    def detector(self):
        return ContentDetector()
    
    @pytest.fixture
    def test_lexicon(self):
        return {
            "sensitive_words": [
                {
                    "id": 1,
                    "word": "赌博",
                    "normalized_word": "赌博",
                    "category": "gambling",
                    "severity": "high",
                    "description": "赌博相关敏感词",
                    "suggestion": "建议拦截",
                    "pinyin": "dubo",
                    "is_regex": False
                },
                {
                    "id": 2,
                    "word": "色情",
                    "normalized_word": "色情",
                    "category": "pornographic",
                    "severity": "high",
                    "description": "色情相关敏感词",
                    "suggestion": "建议拦截",
                    "pinyin": "seqing",
                    "is_regex": False
                },
                {
                    "id": 3,
                    "word": "傻逼",
                    "normalized_word": "傻逼",
                    "category": "abusive",
                    "severity": "high",
                    "description": "辱骂相关敏感词",
                    "suggestion": "建议拦截",
                    "pinyin": "shabi",
                    "is_regex": False
                }
            ],
            "synonyms": [
                {
                    "normalized_synonym": "赌钱",
                    "sensitive_word_id": 1
                }
            ],
            "whitelist": [
                {
                    "normalized_term": "赌博罪"
                }
            ],
            "context_rules": []
        }
    
    def test_load_lexicon(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules'],
            version="1.0.0"
        )
        
        stats = detector.get_lexicon_stats()
        
        assert stats['sensitive_words'] == 3
        assert stats['synonyms'] == 1
        assert stats['whitelist'] == 1
        assert stats['version'] == "1.0.0"
    
    def test_detect_exact_match(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("今天去赌博")
        
        assert result.is_sensitive == True
        assert result.total_hits >= 1
        assert result.highest_severity == "high"
        
        hit_categories = [h.category for h in result.hits]
        assert "gambling" in hit_categories
    
    def test_detect_normal_text(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("今天天气很好，适合出去散步")
        
        assert result.is_sensitive == False
        assert result.total_hits == 0
    
    def test_detect_synonym(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("去赌钱")
        
        assert result.is_sensitive == True
    
    def test_detect_whitelist(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("赌博罪是刑法规定的罪名")
        
        assert result.is_sensitive == False
    
    def test_detect_with_variant_space(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("今天去赌 博")
        
        assert result.is_sensitive == True
    
    def test_detect_with_variant_symbol(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("今天去赌*博")
        
        assert result.is_sensitive == True
    
    def test_detect_batch(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        texts = [
            "今天去赌博",
            "今天天气很好",
            "你这个傻逼"
        ]
        
        results = detector.detect_batch(texts)
        
        assert len(results) == 3
        assert results[0].is_sensitive == True
        assert results[1].is_sensitive == False
        assert results[2].is_sensitive == True
    
    def test_detect_empty_lexicon(self, detector):
        result = detector.detect("今天天气很好，适合出去散步")
        
        assert result.is_sensitive == False
    
    def test_detect_highest_severity(self, detector, test_lexicon):
        test_lexicon['sensitive_words'].append({
            "id": 4,
            "word": "枪支",
            "normalized_word": "枪支",
            "category": "violent",
            "severity": "critical",
            "description": "枪支相关敏感词",
            "suggestion": "必须拦截",
            "pinyin": "qiangzhi",
            "is_regex": False
        })
        
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("我有枪支，想去赌博")
        
        assert result.is_sensitive == True
        assert result.highest_severity == "critical"
    
    def test_detect_result_structure(self, detector, test_lexicon):
        detector.load_lexicon(
            sensitive_words=test_lexicon['sensitive_words'],
            synonyms=test_lexicon['synonyms'],
            whitelist=test_lexicon['whitelist'],
            context_rules=test_lexicon['context_rules']
        )
        
        result = detector.detect("今天去赌博")
        
        assert result.request_id is not None
        assert result.original_text == "今天去赌博"
        assert result.normalized_text is not None
        assert result.segments is not None
        assert result.processing_time_ms >= 0
        assert result.lexicon_version is not None
        
        for hit in result.hits:
            assert hit.hit_word is not None
            assert hit.matched_word is not None
            assert hit.start_position >= 0
            assert hit.end_position >= hit.start_position
            assert hit.match_type is not None
            assert hit.category is not None
            assert hit.severity is not None
            assert hit.description is not None
            assert hit.suggestion is not None
            assert 0 <= hit.confidence <= 1
