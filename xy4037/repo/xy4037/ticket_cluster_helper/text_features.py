"""
文本特征模块
负责文本清洗、中文分词、TF-IDF向量化和关键词提取
"""

import re
import string
from collections import Counter
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from pathlib import Path

import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer

from .config import Config
from .csv_parser import ParsedTicket


@dataclass
class TextFeatures:
    ticket_id: str
    original_text: str
    cleaned_text: str
    tokens: List[str]
    tfidf_vector: Optional[np.ndarray] = None
    keywords: List[Tuple[str, float]] = None


class TextProcessor:
    def __init__(self, config: Config):
        self.config = config
        self.stopwords = set(config.stopwords)
        self.cleaning_rules = config.text_cleaning_rules
        self.vectorizer = None
        self._init_jieba()

    def _init_jieba(self):
        try:
            import jieba
            self.jieba = jieba
        except ImportError:
            self.jieba = None
            import warnings
            warnings.warn("jieba not installed. Using simple tokenization.")

    def clean_text(self, text: str) -> str:
        if not text:
            return ""
        
        text = str(text)
        
        if self.cleaning_rules.get("remove_urls", True):
            text = re.sub(r'https?://\S+|www\.\S+', '', text)
        
        if self.cleaning_rules.get("remove_emails", True):
            text = re.sub(r'\S+@\S+', '', text)
        
        if self.cleaning_rules.get("remove_phone_numbers", True):
            text = re.sub(r'1[3-9]\d{9}', '', text)
        
        if self.cleaning_rules.get("remove_special_chars", True):
            text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        
        if self.cleaning_rules.get("lowercase", True):
            text = text.lower()
        
        if self.cleaning_rules.get("remove_extra_spaces", True):
            text = re.sub(r'\s+', ' ', text).strip()
        
        return text

    def tokenize(self, text: str) -> List[str]:
        if not text:
            return []
        
        if self.jieba:
            tokens = list(self.jieba.cut(text))
        else:
            tokens = list(text)
        
        tokens = [
            token for token in tokens
            if token.strip()
            and token not in self.stopwords
            and token not in string.punctuation
            and len(token) > 1
        ]
        
        return tokens

    def process_ticket(self, ticket: ParsedTicket) -> TextFeatures:
        original_text = ticket.sanitized_data.get("用户描述", "")
        cleaned_text = self.clean_text(original_text)
        tokens = self.tokenize(cleaned_text)
        
        return TextFeatures(
            ticket_id=ticket.ticket_id,
            original_text=original_text,
            cleaned_text=cleaned_text,
            tokens=tokens,
            keywords=None
        )

    def process_tickets(self, tickets: List[ParsedTicket]) -> List[TextFeatures]:
        return [self.process_ticket(ticket) for ticket in tickets]

    def fit_tfidf(self, features_list: List[TextFeatures]) -> np.ndarray:
        texts = [' '.join(f.tokens) for f in features_list]
        
        self.vectorizer = TfidfVectorizer(
            max_features=10000,
            min_df=2,
            max_df=0.8,
            ngram_range=(1, 2)
        )
        
        tfidf_matrix = self.vectorizer.fit_transform(texts)
        
        feature_array = np.array(self.vectorizer.get_feature_names_out())
        for i, features in enumerate(features_list):
            row = tfidf_matrix[i].toarray().flatten()
            top_indices = row.argsort()[-10:][::-1]
            keywords = [
                (feature_array[idx], float(row[idx]))
                for idx in top_indices
                if row[idx] > 0
            ]
            features.keywords = keywords
            features.tfidf_vector = row
        
        return tfidf_matrix

    def transform_tfidf(self, features_list: List[TextFeatures]) -> np.ndarray:
        if self.vectorizer is None:
            raise ValueError("TF-IDF vectorizer not fitted. Call fit_tfidf first.")
        
        texts = [' '.join(f.tokens) for f in features_list]
        tfidf_matrix = self.vectorizer.transform(texts)
        
        feature_array = np.array(self.vectorizer.get_feature_names_out())
        for i, features in enumerate(features_list):
            row = tfidf_matrix[i].toarray().flatten()
            top_indices = row.argsort()[-10:][::-1]
            keywords = [
                (feature_array[idx], float(row[idx]))
                for idx in top_indices
                if row[idx] > 0
            ]
            features.keywords = keywords
            features.tfidf_vector = row
        
        return tfidf_matrix

    def extract_keywords(self, features_list: List[TextFeatures], top_n: int = 10) -> List[Tuple[str, int]]:
        all_tokens = []
        for features in features_list:
            all_tokens.extend(features.tokens)
        
        counter = Counter(all_tokens)
        return counter.most_common(top_n)

    def get_cluster_keywords(self, features_list: List[TextFeatures], top_n: int = 5) -> List[str]:
        all_keywords = []
        for features in features_list:
            if features.keywords:
                all_keywords.extend([kw[0] for kw in features.keywords[:3]])
        
        counter = Counter(all_keywords)
        return [kw for kw, _ in counter.most_common(top_n)]


def compute_cosine_similarity(v1: np.ndarray, v2: np.ndarray) -> float:
    if v1 is None or v2 is None:
        return 0.0
    
    norm1 = np.linalg.norm(v1)
    norm2 = np.linalg.norm(v2)
    
    if norm1 == 0 or norm2 == 0:
        return 0.0
    
    return float(np.dot(v1, v2) / (norm1 * norm2))


def compute_similarity_matrix(vectors: List[np.ndarray]) -> np.ndarray:
    n = len(vectors)
    matrix = np.zeros((n, n))
    
    for i in range(n):
        for j in range(i, n):
            if i == j:
                matrix[i, j] = 1.0
            else:
                sim = compute_cosine_similarity(vectors[i], vectors[j])
                matrix[i, j] = sim
                matrix[j, i] = sim
    
    return matrix
