"""文本关键词分析模块"""

import re
import jieba
import jieba.analyse
from dataclasses import dataclass, field
from typing import List, Dict, Tuple, Set, Optional
from collections import Counter, defaultdict

GLASS_DEFECT_KEYWORDS = {
    "气泡": ["气泡", "汽泡", "气泡多", "大气泡", "小气泡", "密集气泡"],
    "色差": ["色差", "颜色", "偏色", "变色", "发黄", "发灰", "发蓝", "发黑", "颜色不均"],
    "裂纹": ["裂纹", "裂缝", "裂痕", "开裂", "炸纹"],
    "划痕": ["划痕", "刮痕", "划伤", "刮伤"],
    "杂质": ["杂质", "黑点", "白点", "污点", "脏点", "异物"],
    "变形": ["变形", "歪", "不圆", "厚薄", "厚度"],
    "透明度": ["透明度", "不透明", "浑浊", "雾状", "蒙"],
    "温度": ["温度", "窑温", "高", "低", "波动"],
    "时间": ["时间", "时长", "快", "慢", "久"],
    "配方": ["配方", "料", "比例", "成分"],
}

GLASS_DEFECT_CATEGORIES = list(GLASS_DEFECT_KEYWORDS.keys())


@dataclass
class TextFeatures:
    original_text: str
    cleaned_text: str
    words: List[str]
    keywords: List[Tuple[str, float]]
    defect_categories: Dict[str, float]
    defect_keywords: List[str]
    has_defect: bool
    sentiment_score: float
    feature_vector: List[float]

    def to_dict(self) -> Dict:
        return {
            "original_text": self.original_text,
            "cleaned_text": self.cleaned_text,
            "words": self.words,
            "keywords": [(k, float(w)) for k, w in self.keywords],
            "defect_categories": {k: float(v) for k, v in self.defect_categories.items()},
            "defect_keywords": self.defect_keywords,
            "has_defect": self.has_defect,
            "sentiment_score": float(self.sentiment_score),
            "feature_vector": [float(f) for f in self.feature_vector],
        }

    def similarity(self, other: "TextFeatures") -> float:
        if not self.words or not other.words:
            return 0.0

        words1 = set(self.words)
        words2 = set(other.words)

        intersection = words1 & words2
        union = words1 | words2

        if not union:
            return 0.0

        jaccard_sim = len(intersection) / len(union)

        defect_sim = 0.0
        if self.defect_categories and other.defect_categories:
            cats1 = set(k for k, v in self.defect_categories.items() if v > 0)
            cats2 = set(k for k, v in other.defect_categories.items() if v > 0)
            if cats1 or cats2:
                defect_inter = cats1 & cats2
                defect_union = cats1 | cats2
                defect_sim = len(defect_inter) / len(defect_union) if defect_union else 0.0

        return (jaccard_sim * 0.4 + defect_sim * 0.6)


class TextFeatureExtractor:
    def __init__(self):
        self._init_jieba()
        self.defect_patterns = self._compile_defect_patterns()

    def _init_jieba(self):
        for category, keywords in GLASS_DEFECT_KEYWORDS.items():
            for kw in keywords:
                jieba.add_word(kw)

    def _compile_defect_patterns(self) -> Dict[str, List[re.Pattern]]:
        patterns = defaultdict(list)
        for category, keywords in GLASS_DEFECT_KEYWORDS.items():
            for kw in keywords:
                patterns[category].append(re.compile(re.escape(kw), re.IGNORECASE))
        return dict(patterns)

    def clean_text(self, text: str) -> str:
        text = text.strip()
        text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s，。；：？！、,.?!;:]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def tokenize(self, text: str) -> List[str]:
        words = jieba.lcut(text)
        words = [w for w in words if w.strip() and len(w.strip()) > 0]
        return words

    def extract_keywords(self, text: str, top_k: int = 10) -> List[Tuple[str, float]]:
        keywords = jieba.analyse.extract_tags(text, topK=top_k, withWeight=True)
        return keywords

    def extract_defect_categories(self, text: str, words: List[str]) -> Dict[str, float]:
        categories = {cat: 0.0 for cat in GLASS_DEFECT_CATEGORIES}
        word_set = set(words)

        for category, patterns in self.defect_patterns.items():
            matches = 0
            for pattern in patterns:
                if pattern.search(text):
                    matches += 1
            categories[category] = min(1.0, matches * 0.3)

        return categories

    def extract_defect_keywords(self, text: str) -> List[str]:
        found = []
        for category, keywords in GLASS_DEFECT_KEYWORDS.items():
            for kw in keywords:
                if kw in text:
                    found.append(kw)
        return list(set(found))

    def analyze_sentiment(self, text: str, defect_cats: Dict[str, float]) -> float:
        negative_words = ["问题", "缺陷", "不合格", "差", "不好", "异常", "失败"]
        positive_words = ["好", "合格", "正常", "优秀", "完美", "成功"]

        score = 0.5

        for word in negative_words:
            if word in text:
                score -= 0.15

        for word in positive_words:
            if word in text:
                score += 0.15

        defect_count = sum(1 for v in defect_cats.values() if v > 0)
        score -= defect_count * 0.1

        return max(0.0, min(1.0, score))

    def build_feature_vector(self, categories: Dict[str, float], sentiment: float) -> List[float]:
        vector = []
        for cat in GLASS_DEFECT_CATEGORIES:
            vector.append(categories.get(cat, 0.0))
        vector.append(sentiment)
        return vector

    def extract(self, text: str) -> TextFeatures:
        if not text or not text.strip():
            empty_vector = [0.0] * (len(GLASS_DEFECT_CATEGORIES) + 1)
            return TextFeatures(
                original_text="",
                cleaned_text="",
                words=[],
                keywords=[],
                defect_categories={cat: 0.0 for cat in GLASS_DEFECT_CATEGORIES},
                defect_keywords=[],
                has_defect=False,
                sentiment_score=0.5,
                feature_vector=empty_vector,
            )

        cleaned = self.clean_text(text)
        words = self.tokenize(cleaned)
        keywords = self.extract_keywords(cleaned)
        defect_cats = self.extract_defect_categories(cleaned, words)
        defect_kws = self.extract_defect_keywords(cleaned)
        has_defect = any(v > 0 for v in defect_cats.values())
        sentiment = self.analyze_sentiment(cleaned, defect_cats)
        feature_vector = self.build_feature_vector(defect_cats, sentiment)

        return TextFeatures(
            original_text=text,
            cleaned_text=cleaned,
            words=words,
            keywords=keywords,
            defect_categories=defect_cats,
            defect_keywords=defect_kws,
            has_defect=has_defect,
            sentiment_score=sentiment,
            feature_vector=feature_vector,
        )


def extract_text_features(text: str) -> TextFeatures:
    extractor = TextFeatureExtractor()
    return extractor.extract(text)


def build_text_similarity_matrix(text_features_list: List[TextFeatures]) -> List[List[float]]:
    n = len(text_features_list)
    matrix = [[0.0] * n for _ in range(n)]

    for i in range(n):
        matrix[i][i] = 1.0
        for j in range(i + 1, n):
            sim = text_features_list[i].similarity(text_features_list[j])
            matrix[i][j] = sim
            matrix[j][i] = sim

    return matrix
