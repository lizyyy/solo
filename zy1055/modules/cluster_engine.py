# -*- coding: utf-8 -*-
import numpy as np
from typing import Dict, List, Any, Optional, Tuple
from collections import Counter
import re

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.cluster import KMeans
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.decomposition import PCA
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

try:
    import jieba
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False

STOP_WORDS = set([
    '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
    '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
    '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
    '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀',
    '亲', '哦', '嗯', '哈', '呢', '啊', '吧', '呀', '嘛', '呗', '哈', '嘻',
    '啦', '喽', '哟', '耶', '哇', '呢', '么', '嘛', '谢谢', '感谢', '麻烦',
    '请', '请问', '帮忙', '一下', '可以', '能', '可能', '应该', '需要', '想要'
])

class ClusterEngine:
    def __init__(self):
        self.vectorizer = None
        self.kmeans = None
        self.tfidf_matrix = None
    
    def _tokenize(self, text: str) -> str:
        if JIEBA_AVAILABLE:
            words = jieba.lcut(text)
        else:
            words = list(text)
        
        filtered = []
        for word in words:
            word = word.strip()
            if len(word) < 2:
                continue
            if word in STOP_WORDS:
                continue
            if re.match(r'^[a-zA-Z0-9]+$', word) and len(word) < 3:
                continue
            if re.match(r'^\d+$', word):
                continue
            filtered.append(word)
        
        return ' '.join(filtered)
    
    def cluster_texts(self, texts: List[str], n_clusters: int = 8, 
                      random_state: int = 42) -> Dict[str, Any]:
        if not SKLEARN_AVAILABLE:
            return self._simple_clustering(texts, n_clusters)
        
        if not texts:
            return {
                'labels': [],
                'n_clusters': 0,
                'top_terms': {},
                'representative': {},
                'centroids': None
            }
        
        tokenized_texts = [self._tokenize(t) for t in texts]
        
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            min_df=2,
            max_df=0.8,
            ngram_range=(1, 2)
        )
        
        self.tfidf_matrix = self.vectorizer.fit_transform(tokenized_texts)
        
        actual_clusters = min(n_clusters, len(texts), self.tfidf_matrix.shape[0])
        if actual_clusters < 1:
            actual_clusters = 1
        
        self.kmeans = KMeans(
            n_clusters=actual_clusters,
            random_state=random_state,
            n_init=10
        )
        
        labels = self.kmeans.fit_predict(self.tfidf_matrix)
        
        top_terms = self._extract_top_terms_per_cluster(labels, actual_clusters)
        representative = self._find_representative_texts(texts, labels, actual_clusters)
        
        return {
            'labels': labels.tolist() if hasattr(labels, 'tolist') else list(labels),
            'n_clusters': actual_clusters,
            'top_terms': top_terms,
            'representative': representative,
            'centroids': self.kmeans.cluster_centers_.tolist() if hasattr(self.kmeans.cluster_centers_, 'tolist') else None
        }
    
    def _extract_top_terms_per_cluster(self, labels, n_clusters: int) -> Dict[int, List[str]]:
        if self.vectorizer is None or self.tfidf_matrix is None:
            return {}
        
        feature_names = self.vectorizer.get_feature_names_out()
        top_terms = {}
        
        for cluster_id in range(n_clusters):
            cluster_mask = labels == cluster_id
            if not np.any(cluster_mask):
                top_terms[cluster_id] = []
                continue
            
            cluster_tfidf = self.tfidf_matrix[cluster_mask]
            
            if cluster_tfidf.shape[0] > 0:
                mean_tfidf = np.asarray(cluster_tfidf.mean(axis=0)).flatten()
                top_indices = mean_tfidf.argsort()[::-1][:10]
                top_terms[cluster_id] = [feature_names[i] for i in top_indices if mean_tfidf[i] > 0]
            else:
                top_terms[cluster_id] = []
        
        return top_terms
    
    def _find_representative_texts(self, texts: List[str], labels, n_clusters: int) -> Dict[int, str]:
        representative = {}
        
        for cluster_id in range(n_clusters):
            cluster_indices = np.where(labels == cluster_id)[0] if hasattr(labels, '__iter__') else []
            
            if len(cluster_indices) == 0:
                representative[cluster_id] = ''
                continue
            
            cluster_texts = [texts[i] for i in cluster_indices]
            
            text_lengths = [len(t) for t in cluster_texts]
            median_length = np.median(text_lengths) if text_lengths else 0
            
            best_idx = 0
            min_diff = float('inf')
            for i, text in enumerate(cluster_texts):
                diff = abs(len(text) - median_length)
                if diff < min_diff:
                    min_diff = diff
                    best_idx = i
            
            representative[cluster_id] = cluster_texts[best_idx][:200] if cluster_texts else ''
        
        return representative
    
    def _simple_clustering(self, texts: List[str], n_clusters: int) -> Dict[str, Any]:
        if not texts:
            return {'labels': [], 'n_clusters': 0, 'top_terms': {}, 'representative': {}}
        
        all_keywords = []
        text_keywords = []
        
        for text in texts:
            keywords = self._extract_simple_keywords(text)
            text_keywords.append(keywords)
            all_keywords.extend(keywords)
        
        keyword_freq = Counter(all_keywords)
        top_keywords = [kw for kw, _ in keyword_freq.most_common(50)]
        
        features = []
        for keywords in text_keywords:
            vec = [1 if kw in keywords else 0 for kw in top_keywords]
            features.append(vec)
        
        features = np.array(features)
        
        np.random.seed(42)
        n_samples = len(texts)
        actual_clusters = min(n_clusters, n_samples)
        
        if actual_clusters <= 1:
            labels = [0] * n_samples
        else:
            centroids_idx = np.random.choice(n_samples, actual_clusters, replace=False)
            centroids = features[centroids_idx]
            
            for _ in range(10):
                labels = []
                for i in range(n_samples):
                    dists = [np.sum(np.abs(features[i] - c)) for c in centroids]
                    labels.append(np.argmin(dists))
                
                labels = np.array(labels)
                for c in range(actual_clusters):
                    cluster_points = features[labels == c]
                    if len(cluster_points) > 0:
                        centroids[c] = cluster_points.mean(axis=0).round().astype(int)
        
        top_terms = {}
        representative = {}
        
        for cluster_id in range(actual_clusters):
            cluster_indices = [i for i, l in enumerate(labels) if l == cluster_id]
            if not cluster_indices:
                top_terms[cluster_id] = []
                representative[cluster_id] = ''
                continue
            
            cluster_keywords = []
            for i in cluster_indices:
                cluster_keywords.extend(text_keywords[i])
            
            cluster_freq = Counter(cluster_keywords)
            top_terms[cluster_id] = [kw for kw, _ in cluster_freq.most_common(10)]
            
            if cluster_indices:
                mid_idx = cluster_indices[len(cluster_indices) // 2]
                representative[cluster_id] = texts[mid_idx][:200]
            else:
                representative[cluster_id] = ''
        
        return {
            'labels': list(labels) if hasattr(labels, '__iter__') else [0] * len(texts),
            'n_clusters': actual_clusters,
            'top_terms': top_terms,
            'representative': representative,
            'centroids': None
        }
    
    def _extract_simple_keywords(self, text: str) -> List[str]:
        if not text:
            return []
        
        if JIEBA_AVAILABLE:
            words = jieba.lcut(text)
        else:
            words = re.findall(r'[\u4e00-\u9fa5]{2,}|[a-zA-Z]{3,}', text)
        
        filtered = []
        for word in words:
            word = word.strip()
            if len(word) < 2:
                continue
            if word in STOP_WORDS:
                continue
            filtered.append(word)
        
        return filtered
    
    def calculate_similarity(self, text1: str, text2: str) -> float:
        if not SKLEARN_AVAILABLE or self.vectorizer is None:
            return self._simple_similarity(text1, text2)
        
        vec1 = self.vectorizer.transform([self._tokenize(text1)])
        vec2 = self.vectorizer.transform([self._tokenize(text2)])
        
        return float(cosine_similarity(vec1, vec2)[0][0])
    
    def _simple_similarity(self, text1: str, text2: str) -> float:
        kw1 = set(self._extract_simple_keywords(text1))
        kw2 = set(self._extract_simple_keywords(text2))
        
        if not kw1 and not kw2:
            return 0.0
        
        intersection = kw1 & kw2
        union = kw1 | kw2
        
        return len(intersection) / len(union) if union else 0.0
