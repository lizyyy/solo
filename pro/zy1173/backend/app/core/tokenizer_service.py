from typing import List, Dict, Any, Optional
from dataclasses import dataclass
import re
import jieba


@dataclass
class TokenResult:
    token: str
    token_id: int
    start_pos: int
    end_pos: int
    is_whitespace: bool = False


class SimpleTokenizer:
    def __init__(self):
        self.vocab: Dict[str, int] = {}
        self.id_to_token: Dict[int, str] = {}
        self._init_vocab()
    
    def _init_vocab(self):
        basic_tokens = [
            "<|endoftext|>", "<|startoftext|>", "<|pad|>", "<|unk|>",
            " ", "\n", "\t",
            "a", "b", "c", "d", "e", "f", "g", "h", "i", "j", "k", "l", "m",
            "n", "o", "p", "q", "r", "s", "t", "u", "v", "w", "x", "y", "z",
            "A", "B", "C", "D", "E", "F", "G", "H", "I", "J", "K", "L", "M",
            "N", "O", "P", "Q", "R", "S", "T", "U", "V", "W", "X", "Y", "Z",
            "0", "1", "2", "3", "4", "5", "6", "7", "8", "9",
            "!", "@", "#", "$", "%", "^", "&", "*", "(", ")", "-", "_", "+",
            "=", "[", "]", "{", "}", "|", "\\", ":", ";", "\"", "'", "<", ">",
            ",", ".", "?", "/", "~", "`",
            "hello", "world", "this", "is", "a", "test", "the", "and", "of",
            "to", "in", "for", "on", "with", "at", "by", "from", "as", "into",
            "through", "during", "before", "after", "above", "below", "between",
            "under", "again", "further", "then", "once", "here", "there", "when",
            "where", "why", "how", "all", "each", "few", "more", "most", "other",
            "some", "such", "no", "nor", "not", "only", "own", "same", "so",
            "than", "too", "very", "can", "will", "just", "should", "now",
            "我", "你", "他", "她", "它", "们", "是", "的", "了", "在", "有",
            "不", "这", "那", "个", "上", "下", "中", "大", "小", "多", "少",
            "一", "二", "三", "四", "五", "六", "七", "八", "九", "十",
            "人", "日", "月", "年", "天", "地", "山", "水", "风", "云",
        ]
        
        for idx, token in enumerate(basic_tokens):
            self.vocab[token] = idx
            self.id_to_token[idx] = token
        
        self._unk_id = self.vocab.get("<|unk|>", 0)
        self._eos_id = self.vocab.get("<|endoftext|>", 0)
        self._pad_id = self.vocab.get("<|pad|>", 0)
    
    def tokenize(self, text: str) -> List[TokenResult]:
        tokens: List[TokenResult] = []
        current_pos = 0
        text_len = len(text)
        
        while current_pos < text_len:
            char = text[current_pos]
            
            if char.isspace():
                tokens.append(TokenResult(
                    token=char,
                    token_id=self._unk_id,
                    start_pos=current_pos,
                    end_pos=current_pos + 1,
                    is_whitespace=True
                ))
                current_pos += 1
                continue
            
            if '\u4e00' <= char <= '\u9fff':
                tokens.append(TokenResult(
                    token=char,
                    token_id=self.vocab.get(char, self._unk_id),
                    start_pos=current_pos,
                    end_pos=current_pos + 1
                ))
                current_pos += 1
                continue
            
            matched = False
            for token_len in range(min(10, text_len - current_pos), 0, -1):
                candidate = text[current_pos:current_pos + token_len]
                if candidate in self.vocab:
                    tokens.append(TokenResult(
                        token=candidate,
                        token_id=self.vocab[candidate],
                        start_pos=current_pos,
                        end_pos=current_pos + token_len
                    ))
                    current_pos += token_len
                    matched = True
                    break
            
            if not matched:
                tokens.append(TokenResult(
                    token=char,
                    token_id=self._unk_id,
                    start_pos=current_pos,
                    end_pos=current_pos + 1
                ))
                current_pos += 1
        
        return tokens
    
    def encode(self, text: str) -> List[int]:
        tokens = self.tokenize(text)
        return [t.token_id for t in tokens if not t.is_whitespace]
    
    def decode(self, token_ids: List[int]) -> str:
        return "".join([self.id_to_token.get(tid, "<|unk|>") for tid in token_ids])
    
    def get_vocab_size(self) -> int:
        return len(self.vocab)


class TokenizerService:
    def __init__(self):
        self.simple_tokenizer = SimpleTokenizer()
        try:
            from transformers import AutoTokenizer
            self.hf_tokenizer = AutoTokenizer.from_pretrained("gpt2")
            self.use_hf = True
        except Exception:
            self.hf_tokenizer = None
            self.use_hf = False
    
    def tokenize(self, text: str, use_hf: bool = True) -> Dict[str, Any]:
        if use_hf and self.use_hf:
            return self._tokenize_with_hf(text)
        else:
            return self._tokenize_with_simple(text)
    
    def _tokenize_with_hf(self, text: str) -> Dict[str, Any]:
        tokens = self.hf_tokenizer.tokenize(text)
        token_ids = self.hf_tokenizer.encode(text)
        offsets = self.hf_tokenizer(text, return_offsets_mapping=True)["offset_mapping"]
        
        results = []
        for i, (token, tid, offset) in enumerate(zip(tokens, token_ids, offsets)):
            results.append({
                "token": token,
                "token_id": int(tid),
                "start_pos": offset[0],
                "end_pos": offset[1],
                "is_whitespace": token.strip() == ""
            })
        
        return {
            "text": text,
            "tokens": results,
            "token_ids": [int(t) for t in token_ids],
            "token_count": len(tokens),
            "char_count": len(text),
            "tokenizer": "gpt2-huggingface"
        }
    
    def _tokenize_with_simple(self, text: str) -> Dict[str, Any]:
        tokens = self.simple_tokenizer.tokenize(text)
        
        results = []
        token_ids = []
        for token in tokens:
            results.append({
                "token": token.token,
                "token_id": int(token.token_id),
                "start_pos": token.start_pos,
                "end_pos": token.end_pos,
                "is_whitespace": token.is_whitespace
            })
            if not token.is_whitespace:
                token_ids.append(token.token_id)
        
        return {
            "text": text,
            "tokens": results,
            "token_ids": [int(t) for t in token_ids],
            "token_count": len([t for t in tokens if not t.is_whitespace]),
            "char_count": len(text),
            "tokenizer": "simple-builtin"
        }
    
    def truncate(self, text: str, max_tokens: int, truncation_side: str = "right") -> Dict[str, Any]:
        tokenized = self.tokenize(text)
        tokens = tokenized["tokens"]
        token_ids = tokenized["token_ids"]
        
        if len(token_ids) <= max_tokens:
            return {
                **tokenized,
                "truncated": False,
                "max_tokens": max_tokens
            }
        
        if truncation_side == "right":
            truncated_ids = token_ids[:max_tokens]
            truncated_tokens = tokens[:max_tokens]
            truncated_text = text[:truncated_tokens[-1]["end_pos"]]
        else:
            truncated_ids = token_ids[-max_tokens:]
            truncated_tokens = tokens[-max_tokens:]
            truncated_text = text[truncated_tokens[0]["start_pos"]:]
        
        if self.use_hf:
            decoded_text = self.hf_tokenizer.decode(truncated_ids)
        else:
            decoded_text = truncated_text
        
        return {
            "original_text": text,
            "truncated_text": decoded_text,
            "truncated_tokens": [
                {
                    "token": t["token"],
                    "token_id": t["token_id"],
                    "start_pos": t["start_pos"],
                    "end_pos": t["end_pos"]
                }
                for t in truncated_tokens
            ],
            "truncated_ids": [int(t) for t in truncated_ids],
            "original_count": len(token_ids),
            "max_tokens": max_tokens,
            "truncated": True,
            "truncation_side": truncation_side,
            "removed_count": len(token_ids) - max_tokens
        }
    
    def get_vocab_size(self) -> int:
        if self.use_hf:
            return self.hf_tokenizer.vocab_size
        return self.simple_tokenizer.get_vocab_size()


tokenizer_service = TokenizerService()
