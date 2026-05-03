import jieba
import re
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.preprocessing import normalize


class ChineseTextProcessor:
    def __init__(self, stopwords: Optional[List[str]] = None):
        self.stopwords = stopwords or self._default_stopwords()
        jieba.initialize()

    def _default_stopwords(self) -> List[str]:
        return [
            '的', '了', '是', '在', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看',
            '好', '自己', '这', '那', '她', '他', '它', '们', '这个', '那个', '什么',
            '怎么', '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗',
            '呀', '哦', '嗯', '哈', '哎', '唉', '喂', '嗯', '的话', '吧', '呢', '啊',
            '投诉', '问题', '反映', '来电', '居民', '街道', '社区', '小区', '我们',
            '他们', '你们', '请', '希望', '要求', '需要', '想要', '可以', '能够',
            '已经', '正在', '将要', '还是', '或者', '以及', '而且', '但是', '然而',
            '因为', '所以', '如果', '虽然', '即使', '不管', '只要', '除非', '关于',
            '对于', '由于', '根据', '按照', '通过', '为了', '以便', '以免', '以及'
        ]

    def segment(self, text: str) -> List[str]:
        if not text or not isinstance(text, str):
            return []
        
        text = self._clean_text(text)
        words = jieba.lcut(text)
        
        words = [w for w in words if w.strip() and w not in self.stopwords and len(w) > 1]
        
        return words

    def _clean_text(self, text: str) -> str:
        text = re.sub(r'[^\w\s\u4e00-\u9fff]', ' ', text)
        text = re.sub(r'\s+', ' ', text)
        return text.strip()

    def extract_keywords(self, text: str, top_k: int = 10) -> List[Tuple[str, float]]:
        words = self.segment(text)
        if not words:
            return []
        
        word_count = {}
        for word in words:
            word_count[word] = word_count.get(word, 0) + 1
        
        total = sum(word_count.values())
        keywords = [(word, count / total) for word, count in word_count.items()]
        keywords.sort(key=lambda x: x[1], reverse=True)
        
        return keywords[:top_k]


class SimilarityCalculator:
    def __init__(self, text_processor: Optional[ChineseTextProcessor] = None, 
                 max_features: int = 1000):
        self.text_processor = text_processor or ChineseTextProcessor()
        self.max_features = max_features
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.documents: List[str] = []
        self.document_ids: List[str] = []

    def _tokenize(self, text: str) -> List[str]:
        return self.text_processor.segment(text)

    def fit(self, documents: List[Dict[str, Any]]) -> None:
        self.documents = []
        self.document_ids = []
        
        for doc in documents:
            summary = doc.get('summary', '')
            district = doc.get('district', '')
            full_text = f"{district} {summary}"
            self.documents.append(full_text)
            self.document_ids.append(doc.get('id', ''))

        self.vectorizer = TfidfVectorizer(
            tokenizer=self._tokenize,
            token_pattern=None,
            max_features=self.max_features,
            ngram_range=(1, 2)
        )
        self.vectorizer.fit(self.documents)

    def transform(self, documents: List[Dict[str, Any]]) -> np.ndarray:
        if not self.vectorizer:
            raise ValueError("Vectorizer not fitted. Call fit() first.")
        
        texts = []
        for doc in documents:
            summary = doc.get('summary', '')
            district = doc.get('district', '')
            full_text = f"{district} {summary}"
            texts.append(full_text)
        
        return self.vectorizer.transform(texts)

    def get_similarity_matrix(self) -> np.ndarray:
        if not self.vectorizer or not self.documents:
            raise ValueError("Vectorizer not fitted or no documents.")
        
        tfidf_matrix = self.vectorizer.transform(self.documents)
        similarity_matrix = cosine_similarity(tfidf_matrix)
        
        return similarity_matrix

    def calculate_similarity(self, text1: str, text2: str) -> float:
        if not self.vectorizer:
            self.vectorizer = TfidfVectorizer(
                tokenizer=self._tokenize,
                token_pattern=None,
                max_features=self.max_features,
                ngram_range=(1, 2)
            )
            self.vectorizer.fit([text1, text2])
        
        vec1 = self.vectorizer.transform([text1])
        vec2 = self.vectorizer.transform([text2])
        
        similarity = cosine_similarity(vec1, vec2)[0][0]
        return float(similarity)

    def find_similar(self, query: str, top_k: int = 5) -> List[Tuple[int, float]]:
        if not self.vectorizer or not self.documents:
            return []
        
        query_vec = self.vectorizer.transform([query])
        doc_vectors = self.vectorizer.transform(self.documents)
        
        similarities = cosine_similarity(query_vec, doc_vectors)[0]
        
        similar_indices = np.argsort(similarities)[::-1][:top_k]
        results = [(int(idx), float(similarities[idx])) for idx in similar_indices if similarities[idx] > 0]
        
        return results

    def get_representative_text(self, cluster_indices: List[int]) -> Tuple[str, List[str]]:
        if not cluster_indices or not self.documents:
            return "", []
        
        cluster_texts = [self.documents[idx] for idx in cluster_indices]
        
        combined_text = " ".join(cluster_texts)
        
        keywords = self.text_processor.extract_keywords(combined_text, top_k=15)
        keyword_list = [kw[0] for kw in keywords]
        
        if cluster_texts:
            representative = cluster_texts[0]
            for text in cluster_texts[1:]:
                if len(text) > len(representative):
                    representative = text
        else:
            representative = ""
        
        return representative, keyword_list


class EnhancedSimilarityCalculator(SimilarityCalculator):
    def __init__(self, text_processor: Optional[ChineseTextProcessor] = None,
                 max_features: int = 1000,
                 street_keywords: Optional[Dict[str, List[str]]] = None):
        super().__init__(text_processor, max_features)
        self.street_keywords = street_keywords or {}

    def calculate_enhanced_similarity(self, doc1: Dict[str, Any], 
                                       doc2: Dict[str, Any]) -> Dict[str, Any]:
        text1 = f"{doc1.get('district', '')} {doc1.get('summary', '')}"
        text2 = f"{doc2.get('district', '')} {doc2.get('summary', '')}"
        
        text_similarity = self.calculate_similarity(text1, text2)
        
        district_similarity = 1.0 if doc1.get('district') == doc2.get('district') else 0.3
        
        keyword_similarity = self._calculate_keyword_similarity(doc1, doc2)
        
        urgency_bonus = 1.0
        if doc1.get('urgency') == '紧急' and doc2.get('urgency') == '紧急':
            urgency_bonus = 1.1
        
        final_similarity = (
            text_similarity * 0.6 +
            district_similarity * 0.25 +
            keyword_similarity * 0.15
        ) * urgency_bonus
        
        final_similarity = min(1.0, final_similarity)
        
        reasons = []
        if text_similarity > 0.7:
            reasons.append("文本内容高度相似")
        elif text_similarity > 0.5:
            reasons.append("文本内容较为相似")
        
        if district_similarity == 1.0:
            reasons.append("来自同一街道")
        
        if keyword_similarity > 0.5:
            reasons.append("涉及相同关键词")
        
        if urgency_bonus > 1.0:
            reasons.append("均为紧急投诉")
        
        return {
            'similarity': round(final_similarity, 4),
            'text_similarity': round(text_similarity, 4),
            'district_similarity': district_similarity,
            'keyword_similarity': round(keyword_similarity, 4),
            'reasons': reasons
        }

    def _calculate_keyword_similarity(self, doc1: Dict[str, Any], 
                                       doc2: Dict[str, Any]) -> float:
        district = doc1.get('district', '')
        if district != doc2.get('district', ''):
            return 0.0
        
        if district not in self.street_keywords:
            return 0.0
        
        keywords = self.street_keywords[district]
        text1 = f"{doc1.get('summary', '')}"
        text2 = f"{doc2.get('summary', '')}"
        
        matches1 = [kw for kw in keywords if kw in text1]
        matches2 = [kw for kw in keywords if kw in text2]
        
        if not matches1 and not matches2:
            return 0.0
        
        common_matches = set(matches1) & set(matches2)
        all_matches = set(matches1) | set(matches2)
        
        if not all_matches:
            return 0.0
        
        return len(common_matches) / len(all_matches)
