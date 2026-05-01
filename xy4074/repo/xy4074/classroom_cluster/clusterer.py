import re
from dataclasses import dataclass, field
from typing import List, Dict, Any, Optional, Tuple
from collections import Counter

import jieba
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.metrics.pairwise import cosine_similarity
from sklearn.cluster import AgglomerativeClustering, DBSCAN

from classroom_cluster.models import QuestionItem, QuestionCluster, Chapter, generate_id


STOP_WORDS = set([
    "的", "了", "是", "在", "我", "有", "和", "就", "不", "人", "都", "一", "一个",
    "上", "也", "很", "到", "说", "要", "去", "你", "会", "着", "没有", "看", "好",
    "自己", "这", "那", "他", "她", "它", "们", "这个", "那个", "什么", "怎么",
    "为什么", "哪", "谁", "多少", "几", "吗", "呢", "吧", "啊", "呀", "哦", "嗯",
    "请问", "麻烦", "请教", "咨询", "一下", "啊", "哦", "嗯", "哈", "呀", "呢",
    "吗", "吧", "啦", "喽", "呀", "哦", "嗯", "哈", "哎", "唉", "噢", "喔",
    "可以", "能否", "能够", "会", "要", "想", "需要", "应该", "必须", "一定",
    "请问", "我想", "想问", "想请教", "想咨询", "有个问题", "问题是",
    "不知道", "不明白", "不懂", "不清楚", "没理解", "没搞懂", "没明白",
    "这个地方", "这里", "这块", "这部分", "那个地方", "那里", "那块", "那部分",
    "老师", "讲师", "教授", "导师", "助教", "同学", "大家", "各位",
])


@dataclass
class ClusteringResult:
    clusters: List[QuestionCluster]
    unclustered: List[str]
    metrics: Dict[str, Any] = field(default_factory=dict)


class TextPreprocessor:
    def __init__(self, language: str = "zh"):
        self.language = language
        self.stop_words = STOP_WORDS.copy()
    
    def preprocess(self, text: str) -> str:
        text = self._clean_text(text)
        if self.language == "zh":
            words = self._tokenize_chinese(text)
            return " ".join(words)
        else:
            return text.lower()
    
    def _clean_text(self, text: str) -> str:
        text = re.sub(r"[^\w\s\u4e00-\u9fa5?？]", " ", text)
        text = re.sub(r"\s+", " ", text)
        return text.strip()
    
    def _tokenize_chinese(self, text: str) -> List[str]:
        words = jieba.lcut(text)
        words = [w.strip() for w in words if w.strip()]
        words = [w for w in words if w not in self.stop_words and len(w) > 1]
        return words
    
    def add_stop_words(self, words: List[str]) -> None:
        self.stop_words.update(words)


class TFIDFClusterer:
    def __init__(
        self,
        similarity_threshold: float = 0.6,
        min_cluster_size: int = 2,
        max_features: int = 10000,
        ngram_range: Tuple[int, int] = (1, 2),
        language: str = "zh",
    ):
        self.similarity_threshold = similarity_threshold
        self.min_cluster_size = min_cluster_size
        self.max_features = max_features
        self.ngram_range = ngram_range
        self.language = language
        
        self.preprocessor = TextPreprocessor(language=language)
        self.vectorizer: Optional[TfidfVectorizer] = None
        self._last_questions: List[QuestionItem] = []
        self._last_features: Optional[np.ndarray] = None
    
    def cluster(
        self, 
        questions: List[QuestionItem],
        chapters: Optional[List[Chapter]] = None,
    ) -> ClusteringResult:
        if not questions:
            return ClusteringResult(clusters=[], unclustered=[])
        
        self._last_questions = questions
        
        processed_texts = [self.preprocessor.preprocess(q.content) for q in questions]
        
        self.vectorizer = TfidfVectorizer(
            max_features=self.max_features,
            ngram_range=self.ngram_range,
            token_pattern=r"(?u)\b\w+\b" if self.language != "zh" else r"(?u)\b\w+\b",
        )
        
        try:
            tfidf_matrix = self.vectorizer.fit_transform(processed_texts)
        except ValueError:
            return ClusteringResult(clusters=[], unclustered=[q.id for q in questions])
        
        self._last_features = tfidf_matrix
        
        if len(questions) == 1:
            return ClusteringResult(
                clusters=[],
                unclustered=[questions[0].id],
                metrics={"total_questions": 1},
            )
        
        clusters = self._cluster_hierarchical(tfidf_matrix, questions)
        
        if chapters:
            self._match_clusters_to_chapters(clusters, questions, chapters)
        
        for cluster in clusters:
            self._select_representative(cluster, questions, tfidf_matrix)
            self._calculate_confidence(cluster, questions, tfidf_matrix)
            self._calculate_avg_time(cluster, questions)
        
        clustered_ids = set()
        for cluster in clusters:
            clustered_ids.update(cluster.questions)
        
        unclustered = [q.id for q in questions if q.id not in clustered_ids]
        
        metrics = {
            "total_questions": len(questions),
            "clustered_questions": len(clustered_ids),
            "unclustered_questions": len(unclustered),
            "num_clusters": len(clusters),
            "avg_cluster_size": np.mean([len(c.questions) for c in clusters]) if clusters else 0,
        }
        
        return ClusteringResult(
            clusters=clusters,
            unclustered=unclustered,
            metrics=metrics,
        )
    
    def _cluster_hierarchical(
        self, 
        tfidf_matrix: np.ndarray, 
        questions: List[QuestionItem]
    ) -> List[QuestionCluster]:
        if tfidf_matrix.shape[0] < 2:
            return []
        
        distance_threshold = 1 - self.similarity_threshold
        
        clustering = AgglomerativeClustering(
            n_clusters=None,
            distance_threshold=distance_threshold,
            metric="cosine",
            linkage="average",
        )
        
        try:
            labels = clustering.fit_predict(tfidf_matrix.toarray())
        except Exception:
            dbscan = DBSCAN(
                eps=distance_threshold,
                min_samples=self.min_cluster_size,
                metric="cosine",
            )
            labels = dbscan.fit_predict(tfidf_matrix.toarray())
        
        cluster_map: Dict[int, List[str]] = {}
        for i, label in enumerate(labels):
            if label != -1:
                if label not in cluster_map:
                    cluster_map[label] = []
                cluster_map[label].append(questions[i].id)
        
        clusters = []
        for label, question_ids in cluster_map.items():
            if len(question_ids) >= self.min_cluster_size:
                cluster = QuestionCluster(
                    representative_question="",
                    questions=question_ids,
                    confidence=0.0,
                    metadata={"cluster_label": int(label)},
                )
                clusters.append(cluster)
        
        return clusters
    
    def _match_clusters_to_chapters(
        self,
        clusters: List[QuestionCluster],
        questions: List[QuestionItem],
        chapters: List[Chapter],
    ) -> None:
        question_map = {q.id: q for q in questions}
        
        for cluster in clusters:
            chapter_counts: Dict[str, int] = Counter()
            chapter_times: Dict[str, List[float]] = {}
            
            for qid in cluster.questions:
                q = question_map.get(qid)
                if q and q.chapter_id:
                    chapter_counts[q.chapter_id] += 1
                    if q.time_range:
                        if q.chapter_id not in chapter_times:
                            chapter_times[q.chapter_id] = []
                        chapter_times[q.chapter_id].append(q.time_range.start_seconds)
            
            if chapter_counts:
                most_common_chapter = chapter_counts.most_common(1)[0][0]
                chapter = next((c for c in chapters if c.id == most_common_chapter), None)
                
                if chapter:
                    cluster.chapter_id = chapter.id
                    cluster.chapter_title = chapter.title
    
    def _select_representative(
        self,
        cluster: QuestionCluster,
        questions: List[QuestionItem],
        tfidf_matrix: np.ndarray,
    ) -> None:
        question_map = {q.id: q for q in questions}
        
        cluster_indices = [
            i for i, q in enumerate(questions) if q.id in cluster.questions
        ]
        
        if not cluster_indices:
            return
        
        cluster_matrix = tfidf_matrix[cluster_indices]
        
        if cluster_matrix.shape[0] == 1:
            idx = cluster_indices[0]
            cluster.representative_question = questions[idx].content
            return
        
        similarities = cosine_similarity(cluster_matrix)
        avg_similarities = np.mean(similarities, axis=1)
        
        best_idx = cluster_indices[np.argmax(avg_similarities)]
        cluster.representative_question = questions[best_idx].content
    
    def _calculate_confidence(
        self,
        cluster: QuestionCluster,
        questions: List[QuestionItem],
        tfidf_matrix: np.ndarray,
    ) -> None:
        cluster_indices = [
            i for i, q in enumerate(questions) if q.id in cluster.questions
        ]
        
        if len(cluster_indices) < 2:
            cluster.confidence = 1.0
            return
        
        cluster_matrix = tfidf_matrix[cluster_indices]
        similarities = cosine_similarity(cluster_matrix)
        
        upper_triangle = similarities[np.triu_indices_from(similarities, k=1)]
        
        if len(upper_triangle) > 0:
            avg_similarity = float(np.mean(upper_triangle))
            cluster.confidence = max(0.0, min(1.0, avg_similarity))
        else:
            cluster.confidence = 0.5
    
    def _calculate_avg_time(
        self,
        cluster: QuestionCluster,
        questions: List[QuestionItem],
    ) -> None:
        question_map = {q.id: q for q in questions}
        
        times = []
        for qid in cluster.questions:
            q = question_map.get(qid)
            if q and q.time_range:
                times.append(q.time_range.start_seconds)
        
        if times:
            cluster.avg_time_start = float(np.mean(times))
            cluster.metadata["time_stds"] = float(np.std(times)) if len(times) > 1 else 0.0
    
    def get_similarity_matrix(self) -> Optional[np.ndarray]:
        if self._last_features is None:
            return None
        return cosine_similarity(self._last_features)


class ChapterMatcher:
    def __init__(
        self,
        time_tolerance_seconds: float = 300,
        language: str = "zh",
    ):
        self.time_tolerance = time_tolerance_seconds
        self.language = language
        self.preprocessor = TextPreprocessor(language=language)
    
    def match_questions_to_chapters(
        self,
        questions: List[QuestionItem],
        chapters: List[Chapter],
    ) -> List[QuestionItem]:
        if not chapters:
            return questions
        
        chapters_with_time = [c for c in chapters if c.time_range is not None]
        chapters_with_time.sort(key=lambda c: c.order)
        
        for question in questions:
            matched = False
            
            if question.time_range and chapters_with_time:
                chapter = self._find_chapter_by_time(
                    question.time_range.start_seconds,
                    chapters_with_time,
                )
                if chapter:
                    question.chapter_id = chapter.id
                    question.chapter_title = chapter.title
                    matched = True
            
            if not matched and chapters:
                chapter = self._find_chapter_by_similarity(question, chapters)
                if chapter:
                    question.chapter_id = chapter.id
                    question.chapter_title = chapter.title
        
        return questions
    
    def _find_chapter_by_time(
        self,
        seconds: float,
        chapters: List[Chapter],
    ) -> Optional[Chapter]:
        for chapter in chapters:
            if chapter.time_range is None:
                continue
            
            start = chapter.time_range.start_seconds - self.time_tolerance
            end = (chapter.time_range.end_seconds or float("inf")) + self.time_tolerance
            
            if start <= seconds <= end:
                return chapter
        
        best_chapter = None
        min_distance = float("inf")
        
        for chapter in chapters:
            if chapter.time_range is None:
                continue
            
            chapter_mid = chapter.time_range.start_seconds
            if chapter.time_range.end_seconds:
                chapter_mid = (chapter.time_range.start_seconds + chapter.time_range.end_seconds) / 2
            
            distance = abs(seconds - chapter_mid)
            if distance < min_distance:
                min_distance = distance
                best_chapter = chapter
        
        if best_chapter and min_distance <= self.time_tolerance * 2:
            return best_chapter
        
        return None
    
    def _find_chapter_by_similarity(
        self,
        question: QuestionItem,
        chapters: List[Chapter],
    ) -> Optional[Chapter]:
        if not chapters:
            return None
        
        question_text = self.preprocessor.preprocess(question.content)
        
        best_match = None
        best_score = 0.0
        
        for chapter in chapters:
            score = 0.0
            
            chapter_texts = [chapter.title]
            if chapter.description:
                chapter_texts.append(chapter.description)
            chapter_texts.extend(chapter.keywords)
            
            chapter_text = " ".join(chapter_texts)
            chapter_processed = self.preprocessor.preprocess(chapter_text)
            
            question_words = set(question_text.split())
            chapter_words = set(chapter_processed.split())
            
            if question_words and chapter_words:
                intersection = question_words & chapter_words
                union = question_words | chapter_words
                score = len(intersection) / len(union) if union else 0.0
            
            if score > best_score and score > 0.1:
                best_score = score
                best_match = chapter
        
        return best_match
