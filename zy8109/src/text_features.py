import re
import jieba
import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from dataclasses import dataclass, field
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import KMeans, DBSCAN
from sklearn.preprocessing import normalize
from collections import defaultdict


@dataclass
class TextCluster:
    cluster_id: int
    intent_label: str = ""
    session_ids: List[str] = field(default_factory=list)
    representative_texts: List[str] = field(default_factory=list)
    centroid: Optional[np.ndarray] = None
    size: int = 0
    keywords: List[str] = field(default_factory=list)


@dataclass
class ShortTextInfo:
    session_id: str
    text: str
    word_count: int
    char_count: int
    reason: str = "文本过短"
    suggested_action: str = "人工复核"


class TextFeatures:
    def __init__(self, min_word_count: int = 5, use_jieba: bool = True):
        self.min_word_count = min_word_count
        self.use_jieba = use_jieba
        self.vectorizer: Optional[TfidfVectorizer] = None
        self.feature_names: List[str] = []
        self.stop_words = self._get_default_stop_words()

    def _get_default_stop_words(self) -> set:
        return {
            '的', '了', '是', '在', '我', '有', '和', '就', '不', '人', '都', '一', '一个',
            '上', '也', '很', '到', '说', '要', '去', '你', '会', '着', '没有', '看', '好',
            '自己', '这', '那', '他', '她', '它', '们', '这个', '那个', '什么', '怎么',
            '为什么', '哪', '哪里', '谁', '多少', '几', '啊', '吧', '呢', '吗', '呀',
            '请', '您好', '你好', '谢谢', '不客气', '对不起', '没关系', '请问',
            '嗯', '哦', '呃', '那个', '这个', '然后', '还有', '就是', '其实',
        }

    def preprocess(self, text: str) -> str:
        if not text or not isinstance(text, str):
            return ""
        text = text.lower()
        text = re.sub(r'[^\u4e00-\u9fa5a-zA-Z0-9\s]', ' ', text)
        text = re.sub(r'\s+', ' ', text).strip()

        if self.use_jieba:
            words = jieba.lcut(text)
            words = [w for w in words if w.strip() and w not in self.stop_words]
            return ' '.join(words)
        else:
            return text

    def is_short_text(self, text: str) -> Tuple[bool, int, int]:
        if not text:
            return True, 0, 0

        processed = self.preprocess(text)
        words = processed.split() if self.use_jieba else list(processed)
        word_count = len([w for w in words if w.strip()])
        char_count = len(text)

        return word_count < self.min_word_count, word_count, char_count

    def extract_tfidf_features(self, texts: List[str], fit: bool = True) -> np.ndarray:
        processed_texts = [self.preprocess(t) for t in texts]

        if fit or self.vectorizer is None:
            self.vectorizer = TfidfVectorizer(
                max_features=5000,
                ngram_range=(1, 2),
                min_df=2,
                max_df=0.9
            )
            tfidf_matrix = self.vectorizer.fit_transform(processed_texts)
            self.feature_names = self.vectorizer.get_feature_names_out().tolist()
        else:
            tfidf_matrix = self.vectorizer.transform(processed_texts)

        return normalize(tfidf_matrix)

    def compute_similarity(self, text1: str, text2: str) -> float:
        if self.vectorizer is None:
            return 0.0

        vec1 = self.vectorizer.transform([self.preprocess(text1)])
        vec2 = self.vectorizer.transform([self.preprocess(text2)])

        return float(cosine_similarity(vec1, vec2)[0][0])

    def compute_similarity_matrix(self, texts: List[str]) -> np.ndarray:
        tfidf_matrix = self.extract_tfidf_features(texts, fit=True)
        return cosine_similarity(tfidf_matrix)

    def get_top_keywords(self, text: str, top_n: int = 10) -> List[Tuple[str, float]]:
        if self.vectorizer is None:
            processed = self.preprocess(text)
            words = processed.split()
            word_counts = defaultdict(int)
            for w in words:
                if len(w) > 1:
                    word_counts[w] += 1
            sorted_words = sorted(word_counts.items(), key=lambda x: x[1], reverse=True)[:top_n]
            return [(w, float(c)) for w, c in sorted_words]

        vec = self.vectorizer.transform([self.preprocess(text)])
        indices = vec.indices
        values = vec.data

        if len(indices) == 0:
            return []

        pairs = list(zip(indices, values))
        pairs.sort(key=lambda x: x[1], reverse=True)

        return [(self.feature_names[i], float(v)) for i, v in pairs[:top_n]]


class ClusterManager:
    def __init__(self, text_features: Optional[TextFeatures] = None):
        self.text_features = text_features or TextFeatures()
        self.clusters: List[TextCluster] = []
        self.short_texts: List[ShortTextInfo] = []
        self.session_to_cluster: Dict[str, int] = {}

    def cluster_conversations(
        self,
        session_texts: List[Tuple[str, str]],
        n_clusters: Optional[int] = None,
        use_dbscan: bool = False,
        dbscan_eps: float = 0.3
    ) -> Tuple[List[TextCluster], List[ShortTextInfo]]:

        valid_sessions: List[Tuple[str, str]] = []
        short_texts: List[ShortTextInfo] = []

        for session_id, text in session_texts:
            is_short, word_count, char_count = self.text_features.is_short_text(text)
            if is_short:
                short_texts.append(ShortTextInfo(
                    session_id=session_id,
                    text=text[:100] if len(text) > 100 else text,
                    word_count=word_count,
                    char_count=char_count,
                    reason=f"词数不足({word_count} < {self.text_features.min_word_count})",
                    suggested_action="建议人工复核或补充上下文"
                ))
            else:
                valid_sessions.append((session_id, text))

        self.short_texts = short_texts

        if not valid_sessions:
            return [], short_texts

        session_ids = [s[0] for s in valid_sessions]
        texts = [s[1] for s in valid_sessions]

        tfidf_matrix = self.text_features.extract_tfidf_features(texts, fit=True)

        if use_dbscan:
            labels = DBSCAN(eps=dbscan_eps, min_samples=2, metric='cosine').fit_predict(tfidf_matrix)
            unique_labels = set(labels)
            actual_clusters = len([l for l in unique_labels if l != -1])
        else:
            if n_clusters is None:
                n_clusters = min(max(2, len(valid_sessions) // 5), 15)
            kmeans = KMeans(n_clusters=n_clusters, random_state=42, n_init=10)
            labels = kmeans.fit_predict(tfidf_matrix)
            actual_clusters = n_clusters

        clusters: Dict[int, TextCluster] = {}
        cluster_texts: Dict[int, List[str]] = defaultdict(list)
        cluster_session_ids: Dict[int, List[str]] = defaultdict(list)

        for idx, (session_id, label) in enumerate(zip(session_ids, labels)):
            if label == -1:
                short_texts.append(ShortTextInfo(
                    session_id=session_id,
                    text=texts[idx][:100] if len(texts[idx]) > 100 else texts[idx],
                    word_count=len(texts[idx].split()),
                    char_count=len(texts[idx]),
                    reason="DBSCAN噪声点（无法聚类）",
                    suggested_action="人工复核"
                ))
                continue

            if label not in clusters:
                clusters[label] = TextCluster(
                    cluster_id=int(label),
                    intent_label=f"意图_{label + 1}"
                )

            cluster_session_ids[label].append(session_id)
            cluster_texts[label].append(texts[idx])
            self.session_to_cluster[session_id] = int(label)

        for label, cluster in clusters.items():
            cluster.session_ids = cluster_session_ids[label]
            cluster.size = len(cluster.session_ids)

            all_text = ' '.join(cluster_texts[label])
            keywords = self.text_features.get_top_keywords(all_text, top_n=8)
            cluster.keywords = [k[0] for k in keywords]

            sample_texts = cluster_texts[label][:3]
            cluster.representative_texts = [t[:200] + '...' if len(t) > 200 else t for t in sample_texts]

            if not use_dbscan:
                cluster.centroid = kmeans.cluster_centers_[label]

        self.clusters = list(clusters.values())
        self.clusters.sort(key=lambda c: c.size, reverse=True)

        for idx, cluster in enumerate(self.clusters):
            if cluster.keywords:
                cluster.intent_label = f"{'_'.join(cluster.keywords[:2])}_{cluster.cluster_id + 1}"

        return self.clusters, short_texts

    def get_cluster_for_session(self, session_id: str) -> Optional[TextCluster]:
        cluster_id = self.session_to_cluster.get(session_id)
        if cluster_id is None:
            return None
        for cluster in self.clusters:
            if cluster.cluster_id == cluster_id:
                return cluster
        return None

    def find_similar_sessions(self, text: str, session_texts: List[Tuple[str, str]], top_n: int = 5) -> List[Tuple[str, float]]:
        if not session_texts:
            return []

        session_ids = [s[0] for s in session_texts]
        texts = [s[1] for s in session_texts]

        tfidf_matrix = self.text_features.extract_tfidf_features(texts, fit=False)
        query_vec = self.text_features.vectorizer.transform([self.text_features.preprocess(text)])

        similarities = cosine_similarity(query_vec, tfidf_matrix)[0]

        scored = list(zip(session_ids, similarities))
        scored.sort(key=lambda x: x[1], reverse=True)

        return scored[:top_n]

    def get_cluster_statistics(self) -> Dict[str, Any]:
        total_valid = sum(c.size for c in self.clusters)
        total_short = len(self.short_texts)
        total = total_valid + total_short

        return {
            'total_conversations': total,
            'valid_clustered': total_valid,
            'short_texts': total_short,
            'number_of_clusters': len(self.clusters),
            'cluster_sizes': [c.size for c in self.clusters],
            'avg_cluster_size': total_valid / len(self.clusters) if self.clusters else 0,
            'largest_cluster': max(c.size for c in self.clusters) if self.clusters else 0,
            'smallest_cluster': min(c.size for c in self.clusters) if self.clusters else 0,
        }
