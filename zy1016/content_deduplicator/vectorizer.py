"""
文本向量化和相似度计算模块
- 使用 jieba 进行中文分词
- 使用 TF-IDF 进行文本向量化
- 使用余弦相似度计算文本相似度
- 关键词提取
"""

import jieba
import re
from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity

from .reader import MaterialItem


@dataclass
class SimilarityResult:
    """
    相似度计算结果
    """
    item1_id: str
    item2_id: str
    similarity: float
    is_duplicate: bool


class TextProcessor:
    """
    文本处理器
    - 中文分词
    - 停用词过滤
    - TF-IDF 向量化
    """
    
    DEFAULT_STOP_WORDS = {
        '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
        '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
        '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么', '为什么',
        '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀', '哦', '嗯',
        '吧', '哈', '哈哈', '哎', '唉', '嗯', '啊', '呀', '嘛', '哟', '哦', '哈',
        '这', '那', '有', '是', '的', '了', '在', '我', '他', '她', '它', '们',
        '这', '那', '什么', '怎么', '为什么', '哪', '哪里', '谁', '多少', '几',
        '个', '只', '条', '件', '本', '篇', '首', '句', '段', '次', '回', '下',
        '上', '中', '下', '里', '外', '前', '后', '左', '右', '东', '西', '南', '北',
        '来', '去', '到', '往', '向', '朝', '从', '自', '由', '把', '被', '让', '给',
        '和', '与', '或', '及', '跟', '同', '跟', '及', '以及',
        '还是', '或者', '以及', '及', '跟', '同',
        '因为', '所以', '如果', '但是', '然而', '不过', '虽然', '但是', '可是', '不过',
        '就', '才', '已', '已经', '正在', '将要', '会', '要', '想', '要',
        '很', '非常', '特别', '比较', '相当', '更加', '最',
        '都', '全', '都', '全部', '所有', '一切',
        '能', '可以', '能够', '会', '可能',
        '该', '应该', '必须', '一定',
        '又', '再', '还', '也',
        '等', '等等', '之类',
        '一些', '有些', '有的',
        '这样', '那样', '这么', '那么',
        '这样', '那样', '如此',
    }
    
    def __init__(self, stop_words: Optional[set] = None, use_jieba: bool = True):
        """
        初始化文本处理器
        
        Args:
            stop_words: 自定义停用词集合
            use_jieba: 是否使用 jieba 分词
        """
        self.stop_words = stop_words if stop_words is not None else self.DEFAULT_STOP_WORDS
        self.use_jieba = use_jieba
        
        self._custom_dict_ = self.DEFAULT_STOP_WORDS.copy()
        if stop_words:
            self._custom_dict_.update(stop_words)
        
        if self.use_jieba:
            jieba.setLogLevel(jieba.logging.WARNING)
    
    def tokenize(self, text: str) -> List[str]:
        """
        对文本进行分词
        
        Args:
            text: 输入文本
            
        Returns:
            List[str]: 分词后的词汇列表
        """
        if not text or not text.strip():
            return []
        
        text = self._preprocess_text(text)
        
        if self.use_jieba:
            tokens = jieba.lcut(text)
        else:
            tokens = list(text)
        
        tokens = [
            token for token in tokens
            if token.strip() and token not in self._custom_dict_ and len(token) > 0
        ]
        
        tokens = self._filter_tokens(tokens)
        
        return tokens
    
    def _preprocess_text(self, text: str) -> str:
        """
        文本预处理
        """
        text = text.lower()
        
        text = re.sub(r'[a-zA-Z0-9]', '', text)
        
        text = re.sub(r'[^\w\s]', ' ', text)
        
        text = re.sub(r'\s+', ' ', text)
        
        return text.strip()
    
    def _filter_tokens(self, tokens: List[str]) -> List[str]:
        """
        过滤无意义的词汇
        """
        filtered = []
        for token in tokens:
            if len(token) < 1:
                continue
            
            if re.match(r'^[\d\s]+$', token):
                continue
                
            filtered.append(token)
        return filtered
    
    def extract_keywords(self, text: str, top_k: int = 5) -> List[str]:
        """
        从文本中提取关键词
        基于词频和位置的简单关键词提取
        
        Args:
            text: 输入文本
            top_k: 返回前 K 个关键词
            
        Returns:
            List[str]: 关键词列表
        """
        tokens = self.tokenize(text)
        
        if not tokens:
            return []
        
        from collections import Counter
        word_counts = Counter(tokens)
        
        keywords = [word for word, count in word_counts.most_common(top_k)]
        
        return keywords
    
    def extract_keywords_from_multiple(self, texts: List[str], top_k: int = 5) -> List[str]:
        """
        从多个文本中提取共同关键词
        
        Args:
            texts: 文本列表
            top_k: 返回前 K 个关键词
            
        Returns:
            List[str]: 关键词列表
        """
        all_tokens = []
        for text in texts:
            tokens = self.tokenize(text)
            all_tokens.extend(tokens)
        
        if not all_tokens:
            return []
        
        from collections import Counter
        word_counts = Counter(all_tokens)
        
        keywords = [word for word, count in word_counts.most_common(top_k)]
        
        return keywords


class Vectorizer:
    """
    TF-IDF 向量化器
    """
    
    def __init__(self, text_processor: Optional[TextProcessor] = None):
        """
        初始化向量化器
        
        Args:
            text_processor: 文本处理器
        """
        self.text_processor = text_processor or TextProcessor()
        self.tfidf_vectorizer: Optional[TfidfVectorizer] = None
        self.tfidf_matrix: Optional[np.ndarray] = None
        self.item_ids: List[str] = []
    
    def _tokenize_for_sklearn(self, text: str) -> List[str]:
        """
        为 sklearn 的 TfidfVectorizer 提供分词函数
        """
        return self.text_processor.tokenize(text)
    
    def fit_transform(self, items: List[MaterialItem]) -> np.ndarray:
        """
        对素材项列表进行向量化
        
        Args:
            items: 素材项列表
            
        Returns:
            np.ndarray: TF-IDF 矩阵
        """
        if not items:
            raise ValueError("素材项列表为空")
        
        self.item_ids = [item.id for item in items]
        
        texts = [item.clean_text for item in items]
        
        self.tfidf_vectorizer = TfidfVectorizer(
            tokenizer=self._tokenize_for_sklearn,
            token_pattern=None,
            analyzer='word',
            min_df=1,
            max_df=0.95,
            ngram_range=(1, 2)
        )
        
        self.tfidf_matrix = self.tfidf_vectorizer.fit_transform(texts)
        
        return self.tfidf_matrix
    
    def transform(self, items: List[MaterialItem]) -> np.ndarray:
        """
        对新的素材项进行向量化（使用已训练的向量化器）
        
        Args:
            items: 素材项列表
            
        Returns:
            np.ndarray: TF-IDF 矩阵
        """
        if self.tfidf_vectorizer is None:
            return self.fit_transform(items)
        
        texts = [item.clean_text for item in items]
        return self.tfidf_vectorizer.transform(texts)


class SimilarityCalculator:
    """
    相似度计算器
    """
    
    def __init__(self, vectorizer: Optional[Vectorizer] = None):
        """
        初始化相似度计算器
        
        Args:
            vectorizer: 向量化器
        """
        self.vectorizer = vectorizer or Vectorizer()
    
    def calculate_similarity_matrix(self, items: List[MaterialItem]) -> np.ndarray:
        """
        计算所有素材项之间的相似度矩阵
        
        Args:
            items: 素材项列表
            
        Returns:
            np.ndarray: 相似度矩阵 (n x n)
        """
        tfidf_matrix = self.vectorizer.fit_transform(items)
        
        similarity_matrix = cosine_similarity(tfidf_matrix)
        
        return similarity_matrix
    
    def find_duplicates(
        self, 
        items: List[MaterialItem], 
        threshold: float = 0.7,
        min_cluster_size: int = 2
    ) -> List[List[str]]:
        """
        查找重复簇（相似文本组）
        
        Args:
            items: 素材项列表
            threshold: 相似度阈值，高于此值认为是相似
            min_cluster_size: 最小簇大小
            
        Returns:
            List[List[str]]: 重复簇列表，每个簇是 item_id 的列表
        """
        if not items:
            return []
        
        similarity_matrix = self.calculate_similarity_matrix(items)
        
        clusters = self._cluster_by_similarity(similarity_matrix, threshold)
        
        clusters = [
            [items[idx].id for idx in cluster]
            for cluster in clusters
            if len(cluster) >= min_cluster_size
        ]
        
        return clusters
    
    def _cluster_by_similarity(
        self, 
        similarity_matrix: np.ndarray, 
        threshold: float
    ) -> List[List[int]]:
        """
        基于相似度矩阵进行聚类
        使用简单的连通分量算法
        
        Args:
            similarity_matrix: 相似度矩阵
            threshold: 相似度阈值
            
        Returns:
            List[List[int]]: 簇列表，每个簇是索引的列表
        """
        n = similarity_matrix.shape[0]
        visited = [False] * n
        clusters = []
        
        for i in range(n):
            if not visited[i]:
                cluster = []
                stack = [i]
                
                while stack:
                    idx = stack.pop()
                    if visited[idx]:
                        continue
                    visited[idx] = True
                    cluster.append(idx)
                    
                    for j in range(n):
                        if not visited[j] and similarity_matrix[idx, j] >= threshold:
                            stack.append(j)
                
                clusters.append(cluster)
        
        clusters = [sorted(cluster) for cluster in clusters]
        
        return clusters
    
    def get_pairwise_similarity(
        self, 
        items: List[MaterialItem],
        threshold: float = 0.7
    ) -> List[SimilarityResult]:
        """
        计算所有两两相似度
        
        Args:
            items: 素材项列表
            threshold: 相似度阈值
            
        Returns:
            List[SimilarityResult]: 相似度结果列表
        """
        if len(items) < 2:
            return []
        
        similarity_matrix = self.calculate_similarity_matrix(items)
        
        results = []
        n = len(items)
        
        for i in range(n):
            for j in range(i + 1, n):
                sim = similarity_matrix[i, j]
                results.append(SimilarityResult(
                    item1_id=items[i].id,
                    item2_id=items[j].id,
                    similarity=float(sim),
                    is_duplicate=sim >= threshold
                ))
        
        results.sort(key=lambda x: x.similarity, reverse=True)
        
        return results
    
    def find_similar_to(
        self,
        target_item: MaterialItem,
        items: List[MaterialItem],
        threshold: float = 0.7,
        top_k: int = 10
    ) -> List[Tuple[MaterialItem, float]]:
        """
        查找与目标素材相似的其他素材
        
        Args:
            target_item: 目标素材
            items: 待查找的素材列表
            threshold: 相似度阈值
            top_k: 返回前 K 个
            
        Returns:
            List[Tuple[MaterialItem, float]]: 相似素材及其相似度
        """
        all_items = [target_item] + items
        
        tfidf_matrix = self.vectorizer.fit_transform(all_items)
        
        target_vector = tfidf_matrix[0]
        other_vectors = tfidf_matrix[1:]
        
        similarities = cosine_similarity(target_vector, other_vectors)[0]
        
        results = []
        for i, item in enumerate(items):
            if item.id == target_item.id:
                continue
            sim = similarities[i]
            if sim >= threshold:
                results.append((item, sim))
        
        results.sort(key=lambda x: x[1], reverse=True)
        
        return results[:top_k]


def extract_cluster_keywords(
    cluster_items: List[MaterialItem], top_k: int = 5) -> List[str]:
    """
    提取一个簇的关键词
    
    Args:
        cluster_items: 簇中的素材项
        top_k: 关键词数量
        
    Returns:
        List[str]: 关键词列表
    """
    processor = TextProcessor()
    texts = [item.clean_text for item in cluster_items]
    return processor.extract_keywords_from_multiple(texts, top_k)


def get_cluster_representative(
    cluster_items: List[MaterialItem]
) -> MaterialItem:
    """
    获取簇的代表素材
    选择最长的文本作为代表（通常包含最多信息）
    
    Args:
        cluster_items: 簇中的素材项
        
    Returns:
        MaterialItem: 代表素材
    """
    if not cluster_items:
        raise ValueError("簇为空")
    
    sorted_items = sorted(
        cluster_items,
        key=lambda x: len(x.clean_text),
        reverse=True
    )
    
    return sorted_items[0]
