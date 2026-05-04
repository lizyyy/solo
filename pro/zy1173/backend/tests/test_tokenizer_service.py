import pytest
from app.core.tokenizer_service import SimpleTokenizer, TokenizerService, TokenResult


class TestSimpleTokenizer:
    def test_init(self):
        tokenizer = SimpleTokenizer()
        assert tokenizer.vocab is not None
        assert len(tokenizer.vocab) > 0
        assert tokenizer.id_to_token is not None
    
    def test_tokenize_english(self):
        tokenizer = SimpleTokenizer()
        result = tokenizer.tokenize("Hello world")
        
        assert len(result) > 0
        assert all(isinstance(t, TokenResult) for t in result)
    
    def test_tokenize_chinese(self):
        tokenizer = SimpleTokenizer()
        result = tokenizer.tokenize("你好")
        
        assert len(result) >= 2
        assert all(isinstance(t, TokenResult) for t in result)
    
    def test_tokenize_empty(self):
        tokenizer = SimpleTokenizer()
        result = tokenizer.tokenize("")
        
        assert len(result) == 0
    
    def test_tokenize_whitespace(self):
        tokenizer = SimpleTokenizer()
        result = tokenizer.tokenize("   ")
        
        assert len(result) == 3
        assert all(t.is_whitespace for t in result)
    
    def test_encode(self):
        tokenizer = SimpleTokenizer()
        result = tokenizer.encode("Hello")
        
        assert isinstance(result, list)
        assert all(isinstance(t, int) for t in result)
    
    def test_decode(self):
        tokenizer = SimpleTokenizer()
        tokens = tokenizer.encode("Hello")
        decoded = tokenizer.decode(tokens)
        
        assert isinstance(decoded, str)
    
    def test_get_vocab_size(self):
        tokenizer = SimpleTokenizer()
        size = tokenizer.get_vocab_size()
        
        assert isinstance(size, int)
        assert size > 0


class TestTokenizerService:
    def test_init(self):
        service = TokenizerService()
        
        assert service.simple_tokenizer is not None
        assert hasattr(service, 'use_hf')
        assert isinstance(service.use_hf, bool)
    
    def test_tokenize_simple(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["english"], use_hf=False)
        
        assert "text" in result
        assert "tokens" in result
        assert "token_ids" in result
        assert "token_count" in result
        assert "char_count" in result
        assert result["tokenizer"] == "simple-builtin"
    
    def test_tokenize_with_whitespace(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["whitespace"], use_hf=False)
        
        assert result is not None
        assert "token_count" in result
    
    def test_truncate_needs_truncation(self):
        service = TokenizerService()
        
        result = service.truncate("This is a long sentence that needs to be truncated", max_tokens=5)
        
        assert "truncated" in result
        assert result["truncated"] == True
        assert "original_count" in result
        assert "max_tokens" in result
        assert "removed_count" in result
    
    def test_truncate_no_need(self):
        service = TokenizerService()
        
        result = service.truncate("Short", max_tokens=100)
        
        assert result["truncated"] == False
    
    def test_truncate_left_side(self):
        service = TokenizerService()
        
        result = service.truncate("This is a long sentence for testing truncation", max_tokens=5, truncation_side="left")
        
        assert result["truncated"] == True
        assert result["truncation_side"] == "left"
    
    def test_get_vocab_size(self):
        service = TokenizerService()
        
        size = service.get_vocab_size()
        
        assert isinstance(size, int)
        assert size > 0


class TestTokenEdgeCases:
    def test_empty_text(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["empty"], use_hf=False)
        
        assert result["token_count"] == 0
        assert result["char_count"] == 0
        assert len(result["tokens"]) == 0
    
    def test_special_characters(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["special"], use_hf=False)
        
        assert result is not None
        assert "tokens" in result
    
    def test_long_text(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["long"], use_hf=False)
        
        assert result["char_count"] == len(test_texts["long"])
        assert result["token_count"] > 0
    
    def test_mixed_language(self, test_texts):
        service = TokenizerService()
        
        result = service.tokenize(test_texts["mixed"], use_hf=False)
        
        assert result is not None
        assert result["token_count"] > 0
