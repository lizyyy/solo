"""特征提取与聚类模块 - TF-IDF 向量化与理由聚类"""

import re
from collections import defaultdict
from typing import Any, Optional

import numpy as np
from sklearn.cluster import AgglomerativeClustering
from sklearn.feature_extraction.text import TfidfVectorizer


class CompetencyExtractor:
    def __init__(self, competency_dict: dict[str, list[str]]):
        self.competency_dict = competency_dict
        self.competency_patterns = {}
        for competency, keywords in competency_dict.items():
            pattern = "|".join([re.escape(kw) for kw in keywords])
            self.competency_patterns[competency] = re.compile(pattern, re.IGNORECASE)

    def extract(self, text: str) -> dict[str, list[str]]:
        evidence = defaultdict(list)
        if not text:
            return evidence
        for competency, pattern in self.competency_patterns.items():
            matches = pattern.findall(text)
            evidence[competency] = matches
        return evidence

    def has_evidence(self, text: str) -> bool:
        if not text:
            return False
        return any(pattern.search(text) for pattern in self.competency_patterns.values())


class ReasonClusterer:
    def __init__(self, min_cluster_size: int = 3, similarity_threshold: float = 0.3):
        self.min_cluster_size = min_cluster_size
        self.similarity_threshold = similarity_threshold
        self.vectorizer = TfidfVectorizer(
            max_features=1000,
            ngram_range=(1, 2),
            stop_words="english" if self._is_english_text("test") else None,
        )
        self.clusters: dict[int, list[str]] = {}

    def _is_english_text(self, text: str) -> bool:
        return bool(re.match(r"^[a-zA-Z\s]+$", text))

    def fit_cluster(self, reasons: list[str]) -> dict[str, Any]:
        if len(reasons) < self.min_cluster_size:
            return {0: reasons}

        try:
            tfidf_matrix = self.vectorizer.fit_transform(reasons)
        except ValueError:
            return {0: reasons}

        if tfidf_matrix.shape[0] < 2:
            return {0: reasons}

        n_clusters = min(5, max(1, len(reasons) // self.min_cluster_size))
        clustering = AgglomerativeClustering(
            n_clusters=n_clusters,
            metric="cosine",
            linkage="average",
        )
        labels = clustering.fit_predict(tfidf_matrix.toarray())

        clusters = defaultdict(list)
        for idx, label in enumerate(labels):
            clusters[label].append(reasons[idx])
        self.clusters = dict(clusters)
        return self.clusters

    def get_cluster_summary(self) -> dict[str, Any]:
        summaries = {}
        for cluster_id, reasons in self.clusters.items():
            if reasons:
                words = " ".join(reasons).split()
                top_words = sorted(set(words), key=lambda w: words.count(w), reverse=True)[:5]
                summaries[f"cluster_{cluster_id}"] = {
                    "count": len(reasons),
                    "sample_reasons": reasons[:3],
                    "top_keywords": top_words,
                }
        return summaries
