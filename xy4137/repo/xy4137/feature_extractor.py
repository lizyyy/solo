import re
import jieba
from dataclasses import dataclass, field
from typing import Dict, List, Optional, Tuple
from collections import Counter

from config import (
    HIGH_RISK_KEYWORDS,
    MEDIUM_RISK_KEYWORDS,
    TEMPLATE_PHRASES
)


@dataclass
class TextFeatures:
    call_id: str
    high_risk_keywords: List[Tuple[str, int]] = field(default_factory=list)
    medium_risk_keywords: List[Tuple[str, int]] = field(default_factory=list)
    template_phrases: List[Tuple[str, int]] = field(default_factory=list)
    word_count: int = 0
    unique_word_count: int = 0
    avg_sentence_length: float = 0.0
    negative_emotion_score: float = 0.0
    urgency_score: float = 0.0
    keyword_risk_score: float = 0.0
    template_ratio: float = 0.0


class FeatureExtractor:
    NEGATIVE_WORDS = [
        "不", "没", "无", "没有", "不能", "不会", "不敢", "不想",
        "痛苦", "难过", "伤心", "绝望", "无助", "害怕", "恐惧",
        "焦虑", "抑郁", "压力", "崩溃", "煎熬", "难受"
    ]
    
    URGENCY_WORDS = [
        "现在", "马上", "立刻", "紧急", "急需", "必须", "立即",
        "快要", "即将", "就要", "赶紧", "赶快"
    ]
    
    def __init__(self):
        self._stopwords = self._get_stopwords()
    
    def extract(self, text: str, call_id: str) -> TextFeatures:
        if not text or not text.strip():
            return TextFeatures(call_id=call_id)
        
        sentences = self._split_sentences(text)
        words = list(jieba.cut(text))
        word_counter = Counter(words)
        
        high_risk_matches = self._match_keywords(text, HIGH_RISK_KEYWORDS)
        medium_risk_matches = self._match_keywords(text, MEDIUM_RISK_KEYWORDS)
        template_matches = self._match_keywords(text, TEMPLATE_PHRASES)
        
        word_count = len([w for w in words if w.strip()])
        unique_word_count = len(word_counter)
        
        avg_sentence_length = 0.0
        if sentences:
            total_chars = sum(len(s) for s in sentences)
            avg_sentence_length = total_chars / len(sentences)
        
        negative_score = self._calculate_negative_score(text, words)
        urgency_score = self._calculate_urgency_score(text, words)
        keyword_risk_score = self._calculate_keyword_risk_score(
            high_risk_matches, medium_risk_matches
        )
        
        template_ratio = 0.0
        if word_count > 0:
            template_chars = sum(len(kw) * cnt for kw, cnt in template_matches)
            template_ratio = template_chars / len(text) if text else 0.0
        
        return TextFeatures(
            call_id=call_id,
            high_risk_keywords=high_risk_matches,
            medium_risk_keywords=medium_risk_matches,
            template_phrases=template_matches,
            word_count=word_count,
            unique_word_count=unique_word_count,
            avg_sentence_length=avg_sentence_length,
            negative_emotion_score=negative_score,
            urgency_score=urgency_score,
            keyword_risk_score=keyword_risk_score,
            template_ratio=template_ratio
        )
    
    def _match_keywords(self, text: str, keywords: List[str]) -> List[Tuple[str, int]]:
        matches = []
        text_lower = text.lower()
        
        for keyword in keywords:
            keyword_lower = keyword.lower()
            count = text_lower.count(keyword_lower)
            if count > 0:
                matches.append((keyword, count))
        
        matches.sort(key=lambda x: x[1], reverse=True)
        return matches
    
    def _split_sentences(self, text: str) -> List[str]:
        pattern = r'[。！？\n]+'
        sentences = re.split(pattern, text)
        return [s.strip() for s in sentences if s.strip()]
    
    def _calculate_negative_score(self, text: str, words: List[str]) -> float:
        score = 0.0
        text_lower = text.lower()
        
        for word in self.NEGATIVE_WORDS:
            count = text_lower.count(word)
            if count > 0:
                score += count * 0.5
        
        total_words = len([w for w in words if w.strip()])
        if total_words > 0:
            score = min(score / (total_words * 0.1), 1.0)
        
        return round(score, 3)
    
    def _calculate_urgency_score(self, text: str, words: List[str]) -> float:
        score = 0.0
        text_lower = text.lower()
        
        for word in self.URGENCY_WORDS:
            count = text_lower.count(word)
            if count > 0:
                score += count * 0.3
        
        exclamation_count = text.count('！') + text.count('!')
        score += exclamation_count * 0.2
        
        total_words = len([w for w in words if w.strip()])
        if total_words > 0:
            score = min(score / max(total_words * 0.05, 1), 1.0)
        
        return round(score, 3)
    
    def _calculate_keyword_risk_score(
        self,
        high_risk_matches: List[Tuple[str, int]],
        medium_risk_matches: List[Tuple[str, int]]
    ) -> float:
        score = 0.0
        
        for _, count in high_risk_matches:
            score += count * 1.0
        
        for _, count in medium_risk_matches:
            score += count * 0.3
        
        score = min(score / 5.0, 1.0)
        
        return round(score, 3)
    
    def _get_stopwords(self) -> set:
        default_stopwords = {
            "的", "了", "是", "在", "我", "有", "和", "就",
            "不", "人", "都", "一", "一个", "上", "也", "很",
            "到", "说", "要", "去", "你", "会", "着", "没有",
            "看", "好", "自己", "这", "那", "她", "他", "它",
            "啊", "吧", "呢", "吗", "呀", "哦", "嗯", "哈"
        }
        return default_stopwords
    
    def get_all_keywords(self, text: str) -> Dict[str, List[str]]:
        high_risk = [kw for kw, _ in self._match_keywords(text, HIGH_RISK_KEYWORDS)]
        medium_risk = [kw for kw, _ in self._match_keywords(text, MEDIUM_RISK_KEYWORDS)]
        template = [kw for kw, _ in self._match_keywords(text, TEMPLATE_PHRASES)]
        
        return {
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "template": template
        }
