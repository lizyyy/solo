"""相似检索与聚类模块"""

import re
import math
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict, Counter

try:
    import jieba
    JIEBA_AVAILABLE = True
except ImportError:
    JIEBA_AVAILABLE = False

try:
    from sklearn.feature_extraction.text import TfidfVectorizer
    from sklearn.metrics.pairwise import cosine_similarity
    from sklearn.cluster import AgglomerativeClustering
    SKLEARN_AVAILABLE = True
except ImportError:
    SKLEARN_AVAILABLE = False

from .data_import import QAEntry, ProductParam, CustomerQuestion


@dataclass
class SimilarMatch:
    """相似匹配结果"""
    target_question: str
    matched_qa: QAEntry
    similarity_score: float
    match_type: str
    matched_keywords: List[str] = field(default_factory=list)


@dataclass
class ClusterResult:
    """聚类结果"""
    cluster_id: int
    questions: List[str]
    representative_question: str
    size: int


@dataclass
class ParamMatch:
    """参数匹配结果"""
    target_question: str
    matched_param: ProductParam
    match_score: float
    matched_keywords: List[str] = field(default_factory=list)


class SynonymHandler:
    """同义词处理器"""
    
    DEFAULT_SYNONYMS = {
        '支持': ['支持', '兼容', '能够', '可以', '允许'],
        '功能': ['功能', '特性', '能力', '模块'],
        '价格': ['价格', '费用', '成本', '报价'],
        '版本': ['版本', '版', '型号', '类型'],
        '用户': ['用户', '使用者', '客户', '账号'],
        '并发': ['并发', '同时', '并行'],
        '存储': ['存储', '保存', '容量', '空间'],
        '性能': ['性能', '效率', '速度', '处理能力'],
        '安全': ['安全', '加密', '权限', '认证'],
        '部署': ['部署', '安装', '上线', '实施'],
        '维护': ['维护', '运维', '售后'],
        '数据': ['数据', '信息', '内容', '记录'],
        '接口': ['接口', 'API', '对接', '集成'],
        '报表': ['报表', '报告', '统计', '分析'],
        '最大': ['最大', '最高', '上限', '峰值'],
        '最小': ['最小', '最低', '下限'],
        '支持多少': ['支持多少', '支持几', '最多', '最少'],
    }
    
    def __init__(self, custom_synonyms: Dict[str, List[str]] = None):
        self.synonyms = self.DEFAULT_SYNONYMS.copy()
        if custom_synonyms:
            self.synonyms.update(custom_synonyms)
        
        self._build_reverse_map()
    
    def _build_reverse_map(self):
        """构建反向映射表"""
        self.reverse_map = {}
        for main_word, synonyms in self.synonyms.items():
            for syn in synonyms:
                self.reverse_map[syn] = main_word
    
    def normalize_word(self, word: str) -> str:
        """标准化词语为其主词"""
        return self.reverse_map.get(word, word)
    
    def get_all_synonyms(self, word: str) -> List[str]:
        """获取词语的所有同义词"""
        main_word = self.normalize_word(word)
        return self.synonyms.get(main_word, [word])
    
    def expand_keywords(self, keywords: List[str]) -> List[str]:
        """扩展关键词列表，包含所有同义词"""
        expanded = set()
        for keyword in keywords:
            expanded.update(self.get_all_synonyms(keyword))
        return list(expanded)
    
    def add_synonyms(self, main_word: str, synonyms: List[str]):
        """添加同义词"""
        if main_word not in self.synonyms:
            self.synonyms[main_word] = [main_word]
        self.synonyms[main_word].extend(synonyms)
        self._build_reverse_map()


class KeywordExtractor:
    """关键词提取器"""
    
    STOP_WORDS = {
        '的', '了', '是', '在', '有', '和', '与', '或', '及',
        '这', '那', '什么', '怎么', '如何', '为什么', '哪', '谁',
        '请', '请问', '能否', '是否', '可以', '能够', '会',
        '吗', '呢', '啊', '吧', '哦', '呀', '哈',
        '一个', '一些', '很多', '多少', '几',
        '我们', '你们', '他们', '它们', '它', '我', '你', '他',
        '这个', '那个', '这些', '那些',
        '对于', '关于', '根据', '按照', '由于', '因为', '所以',
        '但是', '然而', '不过', '而且', '并且', '或者',
    }
    
    def __init__(self, synonym_handler: SynonymHandler = None):
        self.synonym_handler = synonym_handler or SynonymHandler()
    
    def extract_keywords(self, text: str, use_synonyms: bool = True) -> List[str]:
        """提取关键词"""
        if not text:
            return []
        
        if JIEBA_AVAILABLE:
            words = list(jieba.cut(text))
        else:
            words = self._simple_tokenize(text)
        
        keywords = []
        for word in words:
            word = word.strip()
            if len(word) < 2:
                continue
            if word in self.STOP_WORDS:
                continue
            
            if use_synonyms:
                word = self.synonym_handler.normalize_word(word)
            
            if word not in keywords:
                keywords.append(word)
        
        return keywords
    
    def _simple_tokenize(self, text: str) -> List[str]:
        """简单分词（当jieba不可用时）"""
        words = []
        current = ''
        
        for char in text:
            if '\u4e00' <= char <= '\u9fff':
                if current:
                    words.append(current)
                    current = ''
                words.append(char)
            elif char.isalnum():
                current += char
            else:
                if current:
                    words.append(current)
                    current = ''
        
        if current:
            words.append(current)
        
        return words


class SimilarityCalculator:
    """相似度计算器"""
    
    def __init__(self, synonym_handler: SynonymHandler = None):
        self.synonym_handler = synonym_handler or SynonymHandler()
        self.keyword_extractor = KeywordExtractor(self.synonym_handler)
        self.tfidf_vectorizer = None
        self.qa_vectors = None
        self.qa_entries: List[QAEntry] = []
    
    def jaccard_similarity(self, set1: set, set2: set) -> float:
        """计算Jaccard相似度"""
        if not set1 or not set2:
            return 0.0
        intersection = len(set1 & set2)
        union = len(set1 | set2)
        return intersection / union if union > 0 else 0.0
    
    def cosine_similarity_keywords(self, keywords1: List[str], keywords2: List[str]) -> float:
        """基于关键词的余弦相似度"""
        if not keywords1 or not keywords2:
            return 0.0
        
        expanded1 = set(self.synonym_handler.expand_keywords(keywords1))
        expanded2 = set(self.synonym_handler.expand_keywords(keywords2))
        
        count1 = Counter(keywords1)
        count2 = Counter(keywords2)
        
        all_words = set(count1.keys()) | set(count2.keys())
        
        vec1 = [count1.get(word, 0) for word in all_words]
        vec2 = [count2.get(word, 0) for word in all_words]
        
        dot_product = sum(a * b for a, b in zip(vec1, vec2))
        norm1 = math.sqrt(sum(a * a for a in vec1))
        norm2 = math.sqrt(sum(a * a for a in vec2))
        
        if norm1 == 0 or norm2 == 0:
            return 0.0
        
        return dot_product / (norm1 * norm2)
    
    def build_tfidf_index(self, qa_entries: List[QAEntry]):
        """构建TF-IDF索引"""
        if not SKLEARN_AVAILABLE:
            return
        
        self.qa_entries = qa_entries
        
        if JIEBA_AVAILABLE:
            documents = []
            for entry in qa_entries:
                words = list(jieba.cut(entry.question + ' ' + entry.answer))
                documents.append(' '.join(words))
        else:
            documents = [entry.question + ' ' + entry.answer for entry in qa_entries]
        
        self.tfidf_vectorizer = TfidfVectorizer(
            max_features=5000,
            stop_words='english'
        )
        self.qa_vectors = self.tfidf_vectorizer.fit_transform(documents)
    
    def tfidf_similarity(self, query: str, top_k: int = 5) -> List[Tuple[int, float]]:
        """使用TF-IDF计算相似度"""
        if not SKLEARN_AVAILABLE or self.tfidf_vectorizer is None:
            return []
        
        if JIEBA_AVAILABLE:
            query_words = list(jieba.cut(query))
            query_doc = ' '.join(query_words)
        else:
            query_doc = query
        
        query_vector = self.tfidf_vectorizer.transform([query_doc])
        similarities = cosine_similarity(query_vector, self.qa_vectors)[0]
        
        top_indices = similarities.argsort()[::-1][:top_k]
        return [(idx, similarities[idx]) for idx in top_indices if similarities[idx] > 0]
    
    def cluster_questions(self, questions: List[str], threshold: float = 0.7) -> List[ClusterResult]:
        """聚类相似问题"""
        if not SKLEARN_AVAILABLE or not questions:
            return []
        
        if JIEBA_AVAILABLE:
            documents = []
            for q in questions:
                words = list(jieba.cut(q))
                documents.append(' '.join(words))
        else:
            documents = questions
        
        vectorizer = TfidfVectorizer(max_features=1000)
        vectors = vectorizer.fit_transform(documents)
        
        distance_threshold = 1 - threshold
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=distance_threshold,
            metric='cosine',
            linkage='average'
        )
        labels = clustering.fit_predict(vectors.toarray())
        
        clusters = defaultdict(list)
        for idx, label in enumerate(labels):
            clusters[label].append(questions[idx])
        
        results = []
        for cluster_id, cluster_questions in clusters.items():
            result = ClusterResult(
                cluster_id=cluster_id,
                questions=cluster_questions,
                representative_question=cluster_questions[0] if cluster_questions else '',
                size=len(cluster_questions)
            )
            results.append(result)
        
        return results


class SimilaritySearch:
    """相似检索器"""
    
    DEFAULT_SIMILARITY_THRESHOLD = 0.6
    DEFAULT_KEYWORD_MATCH_SCORE = 0.8
    DEFAULT_TFIDF_WEIGHT = 0.6
    DEFAULT_KEYWORD_WEIGHT = 0.4
    
    def __init__(
        self,
        similarity_threshold: float = None,
        synonym_handler: SynonymHandler = None
    ):
        self.similarity_threshold = similarity_threshold or self.DEFAULT_SIMILARITY_THRESHOLD
        self.synonym_handler = synonym_handler or SynonymHandler()
        self.keyword_extractor = KeywordExtractor(self.synonym_handler)
        self.similarity_calculator = SimilarityCalculator(self.synonym_handler)
        
        self.qa_entries: List[QAEntry] = []
        self.product_params: List[ProductParam] = []
        self.qa_keywords_index: Dict[str, List[int]] = defaultdict(list)
    
    def index_qa_entries(self, entries: List[QAEntry]):
        """索引Q&A条目"""
        self.qa_entries = entries
        
        self.qa_keywords_index.clear()
        for idx, entry in enumerate(entries):
            keywords = self.keyword_extractor.extract_keywords(
                entry.question + ' ' + entry.answer
            )
            for keyword in keywords:
                self.qa_keywords_index[keyword].append(idx)
        
        if SKLEARN_AVAILABLE:
            self.similarity_calculator.build_tfidf_index(entries)
    
    def index_product_params(self, params: List[ProductParam]):
        """索引产品参数"""
        self.product_params = params
    
    def search_similar_qa(
        self,
        query: str,
        top_k: int = 5,
        threshold: float = None
    ) -> List[SimilarMatch]:
        """搜索相似的Q&A
        
        结合TF-IDF相似度和关键词匹配
        """
        threshold = threshold or self.similarity_threshold
        
        query_keywords = self.keyword_extractor.extract_keywords(query)
        
        matches: List[SimilarMatch] = []
        seen_indices = set()
        
        if SKLEARN_AVAILABLE and self.similarity_calculator.tfidf_vectorizer is not None:
            tfidf_matches = self.similarity_calculator.tfidf_similarity(query, top_k * 2)
            
            for idx, score in tfidf_matches:
                if idx in seen_indices:
                    continue
                
                entry = self.qa_entries[idx]
                entry_keywords = self.keyword_extractor.extract_keywords(entry.question)
                keyword_score = self.similarity_calculator.cosine_similarity_keywords(
                    query_keywords, entry_keywords
                )
                
                combined_score = (
                    score * self.DEFAULT_TFIDF_WEIGHT + 
                    keyword_score * self.DEFAULT_KEYWORD_WEIGHT
                )
                
                matched_keywords = list(
                    set(self.synonym_handler.expand_keywords(query_keywords)) &
                    set(self.synonym_handler.expand_keywords(entry_keywords))
                )
                
                matches.append(SimilarMatch(
                    target_question=query,
                    matched_qa=entry,
                    similarity_score=combined_score,
                    match_type='tfidf_keyword',
                    matched_keywords=matched_keywords
                ))
                seen_indices.add(idx)
        
        keyword_matched_indices = set()
        expanded_query_keywords = self.synonym_handler.expand_keywords(query_keywords)
        
        for keyword in expanded_query_keywords:
            if keyword in self.qa_keywords_index:
                for idx in self.qa_keywords_index[keyword]:
                    keyword_matched_indices.add(idx)
        
        for idx in keyword_matched_indices:
            if idx in seen_indices:
                continue
            
            entry = self.qa_entries[idx]
            entry_keywords = self.keyword_extractor.extract_keywords(entry.question)
            
            matched_keywords = list(
                set(self.synonym_handler.expand_keywords(query_keywords)) &
                set(self.synonym_handler.expand_keywords(entry_keywords))
            )
            
            keyword_score = self.similarity_calculator.cosine_similarity_keywords(
                query_keywords, entry_keywords
            )
            
            if keyword_score >= threshold * 0.8:
                matches.append(SimilarMatch(
                    target_question=query,
                    matched_qa=entry,
                    similarity_score=keyword_score,
                    match_type='keyword',
                    matched_keywords=matched_keywords
                ))
                seen_indices.add(idx)
        
        matches.sort(key=lambda x: x.similarity_score, reverse=True)
        
        return [m for m in matches[:top_k] if m.similarity_score >= threshold]
    
    def search_product_params(
        self,
        query: str,
        top_k: int = 3,
        threshold: float = None
    ) -> List[ParamMatch]:
        """搜索相关的产品参数"""
        threshold = threshold or self.similarity_threshold * 0.7
        
        query_keywords = self.keyword_extractor.extract_keywords(query)
        expanded_query_keywords = self.synonym_handler.expand_keywords(query_keywords)
        
        matches: List[ParamMatch] = []
        
        for param in self.product_params:
            param_text = f"{param.product_name} {param.param_name} {param.param_value}"
            param_keywords = self.keyword_extractor.extract_keywords(param_text)
            expanded_param_keywords = self.synonym_handler.expand_keywords(param_keywords)
            
            matched_keywords = list(
                set(expanded_query_keywords) & set(expanded_param_keywords)
            )
            
            if matched_keywords:
                score = self.similarity_calculator.cosine_similarity_keywords(
                    query_keywords, param_keywords
                )
                
                if score >= threshold:
                    matches.append(ParamMatch(
                        target_question=query,
                        matched_param=param,
                        match_score=score,
                        matched_keywords=matched_keywords
                    ))
        
        matches.sort(key=lambda x: x.match_score, reverse=True)
        return matches[:top_k]
    
    def cluster_similar_questions(
        self,
        questions: List[str],
        threshold: float = None
    ) -> List[ClusterResult]:
        """聚类相似问题"""
        threshold = threshold or self.similarity_threshold
        return self.similarity_calculator.cluster_questions(questions, threshold)
    
    def find_duplicate_questions(
        self,
        questions: List[str],
        threshold: float = 0.9
    ) -> List[Tuple[str, List[str]]]:
        """查找重复/高度相似的问题组"""
        if not SKLEARN_AVAILABLE or len(questions) < 2:
            return []
        
        clusters = self.similarity_calculator.cluster_questions(questions, threshold)
        
        duplicates = []
        for cluster in clusters:
            if cluster.size > 1:
                duplicates.append((
                    cluster.representative_question,
                    cluster.questions[1:]
                ))
        
        return duplicates
