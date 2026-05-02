"""
聚类与相似度匹配模块
负责使用TF-IDF或轻量文本向量进行聚类，并生成簇的关键词、代表工单和置信度
"""

import json
from datetime import datetime
from pathlib import Path
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass, field
import warnings

import numpy as np
from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score, pairwise_distances

from .config import Config
from .csv_parser import ParsedTicket
from .text_features import TextProcessor, TextFeatures, compute_cosine_similarity


@dataclass
class Cluster:
    cluster_id: int
    ticket_ids: List[str] = field(default_factory=list)
    keywords: List[str] = field(default_factory=list)
    representative_ticket_id: Optional[str] = None
    confidence: float = 0.0
    size: int = 0
    tags: List[str] = field(default_factory=list)
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "cluster_id": self.cluster_id,
            "ticket_ids": self.ticket_ids,
            "keywords": self.keywords,
            "representative_ticket_id": self.representative_ticket_id,
            "confidence": self.confidence,
            "size": self.size,
            "tags": self.tags,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Cluster':
        return cls(
            cluster_id=data["cluster_id"],
            ticket_ids=data.get("ticket_ids", []),
            keywords=data.get("keywords", []),
            representative_ticket_id=data.get("representative_ticket_id"),
            confidence=data.get("confidence", 0.0),
            size=data.get("size", 0),
            tags=data.get("tags", []),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None
        )


@dataclass
class ClusteringResult:
    clusters: List[Cluster] = field(default_factory=list)
    n_clusters: int = 0
    total_tickets: int = 0
    silhouette_score: Optional[float] = None
    algorithm: str = "kmeans"
    created_at: Optional[datetime] = None
    
    def get_cluster_by_id(self, cluster_id: int) -> Optional[Cluster]:
        for cluster in self.clusters:
            if cluster.cluster_id == cluster_id:
                return cluster
        return None
    
    def get_cluster_for_ticket(self, ticket_id: str) -> Optional[Cluster]:
        for cluster in self.clusters:
            if ticket_id in cluster.ticket_ids:
                return cluster
        return None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            "clusters": [c.to_dict() for c in self.clusters],
            "n_clusters": self.n_clusters,
            "total_tickets": self.total_tickets,
            "silhouette_score": self.silhouette_score,
            "algorithm": self.algorithm,
            "created_at": self.created_at.isoformat() if self.created_at else None
        }
    
    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'ClusteringResult':
        return cls(
            clusters=[Cluster.from_dict(c) for c in data.get("clusters", [])],
            n_clusters=data.get("n_clusters", 0),
            total_tickets=data.get("total_tickets", 0),
            silhouette_score=data.get("silhouette_score"),
            algorithm=data.get("algorithm", "kmeans"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None
        )


class TicketClusterer:
    def __init__(self, config: Config):
        self.config = config
        self.clustering_params = config.clustering_params
        self.similarity_threshold = config.similarity_threshold
        self.last_result: Optional[ClusteringResult] = None
    
    def fit(
        self,
        features_list: List[TextFeatures],
        tickets: List[ParsedTicket],
        algorithm: Optional[str] = None
    ) -> ClusteringResult:
        if not features_list or not tickets:
            raise ValueError("No features or tickets provided")
        
        if algorithm is None:
            algorithm = self.clustering_params.get("algorithm", "kmeans")
        
        vectors = [f.tfidf_vector for f in features_list]
        if any(v is None for v in vectors):
            raise ValueError("Some features do not have TF-IDF vectors")
        
        X = np.array(vectors)
        
        n_clusters = self.clustering_params.get("n_clusters", 20)
        n_clusters = min(n_clusters, len(features_list) // 2)
        if n_clusters < 2:
            n_clusters = 1
        
        if algorithm == "kmeans":
            if n_clusters > 1:
                model = KMeans(
                    n_clusters=n_clusters,
                    random_state=self.clustering_params.get("random_state", 42),
                    max_iter=self.clustering_params.get("max_iter", 300),
                    n_init=10
                )
                labels = model.fit_predict(X)
            else:
                labels = np.zeros(len(features_list), dtype=int)
        elif algorithm == "dbscan":
            model = DBSCAN(
                eps=1 - self.similarity_threshold,
                min_samples=2,
                metric='cosine'
            )
            labels = model.fit_predict(X)
            unique_labels = set(labels)
            if -1 in unique_labels:
                unique_labels.remove(-1)
            n_clusters = len(unique_labels)
        else:
            raise ValueError(f"Unknown algorithm: {algorithm}")
        
        ticket_id_map = {f.ticket_id: (i, f, t) for i, (f, t) in enumerate(zip(features_list, tickets))}
        
        clusters: Dict[int, Cluster] = {}
        label_counts: Dict[int, List[int]] = {}
        
        for i, label in enumerate(labels):
            if algorithm == "dbscan" and label == -1:
                continue
            
            if label not in clusters:
                clusters[label] = Cluster(
                    cluster_id=int(label),
                    created_at=datetime.now(),
                    updated_at=datetime.now()
                )
                label_counts[label] = []
            
            features = features_list[i]
            clusters[label].ticket_ids.append(features.ticket_id)
            clusters[label].size += 1
            label_counts[label].append(i)
        
        for label, cluster in clusters.items():
            indices = label_counts[label]
            cluster_features = [features_list[i] for i in indices]
            cluster_vectors = [features_list[i].tfidf_vector for i in indices]
            
            if len(cluster_vectors) > 1:
                try:
                    with warnings.catch_warnings():
                        warnings.simplefilter("ignore")
                        distances = pairwise_distances(cluster_vectors, metric='cosine')
                    centroid_idx = int(np.argmin(distances.sum(axis=0)))
                except Exception:
                    centroid_idx = 0
            else:
                centroid_idx = 0
            
            cluster.representative_ticket_id = cluster_features[centroid_idx].ticket_id
            
            cluster.keywords = self._extract_cluster_keywords(cluster_features)
            
            if len(cluster_vectors) > 1:
                try:
                    similarities = [
                        compute_cosine_similarity(cluster_vectors[centroid_idx], v)
                        for v in cluster_vectors
                    ]
                    cluster.confidence = float(np.mean(similarities))
                except Exception:
                    cluster.confidence = 0.5
            else:
                cluster.confidence = 0.5
        
        sorted_clusters = sorted(clusters.values(), key=lambda c: c.size, reverse=True)
        for new_id, cluster in enumerate(sorted_clusters):
            cluster.cluster_id = new_id
        
        result = ClusteringResult(
            clusters=sorted_clusters,
            n_clusters=len(sorted_clusters),
            total_tickets=len(features_list),
            algorithm=algorithm,
            created_at=datetime.now()
        )
        
        if len(sorted_clusters) > 1 and len(features_list) > len(sorted_clusters):
            try:
                with warnings.catch_warnings():
                    warnings.simplefilter("ignore")
                    result.silhouette_score = float(silhouette_score(X, labels, metric='cosine'))
            except Exception:
                result.silhouette_score = None
        
        self.last_result = result
        return result
    
    def _extract_cluster_keywords(self, features_list: List[TextFeatures], top_n: int = 5) -> List[str]:
        all_keywords = []
        for features in features_list:
            if features.keywords:
                all_keywords.extend([kw[0] for kw in features.keywords[:3]])
        
        if not all_keywords:
            all_tokens = []
            for features in features_list:
                all_tokens.extend(features.tokens)
            all_keywords = all_tokens
        
        from collections import Counter
        counter = Counter(all_keywords)
        return [kw for kw, _ in counter.most_common(top_n)]
    
    def find_most_similar_cluster(
        self,
        features: TextFeatures,
        result: ClusteringResult,
        all_features: Dict[str, TextFeatures]
    ) -> Tuple[Optional[Cluster], float]:
        if features.tfidf_vector is None:
            return None, 0.0
        
        best_cluster = None
        best_similarity = 0.0
        
        for cluster in result.clusters:
            if not cluster.ticket_ids:
                continue
            
            rep_ticket_id = cluster.representative_ticket_id
            if rep_ticket_id is None:
                rep_ticket_id = cluster.ticket_ids[0]
            
            if rep_ticket_id not in all_features:
                continue
            
            rep_features = all_features[rep_ticket_id]
            if rep_features.tfidf_vector is None:
                continue
            
            similarity = compute_cosine_similarity(features.tfidf_vector, rep_features.tfidf_vector)
            
            if similarity > best_similarity:
                best_similarity = similarity
                best_cluster = cluster
        
        return best_cluster, best_similarity
    
    def save_result(self, result: ClusteringResult, path: Optional[Path] = None) -> Path:
        if path is None:
            path = self.config.get_clusters_path()
        
        path.parent.mkdir(exist_ok=True)
        
        with open(path, 'w', encoding='utf-8') as f:
            json.dump(result.to_dict(), f, ensure_ascii=False, indent=2)
        
        return path
    
    def load_result(self, path: Optional[Path] = None) -> ClusteringResult:
        if path is None:
            path = self.config.get_clusters_path()
        
        if not path.exists():
            raise FileNotFoundError(f"Clusters file not found: {path}")
        
        with open(path, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        result = ClusteringResult.from_dict(data)
        self.last_result = result
        return result


def build_ticket_map(tickets: List[ParsedTicket]) -> Dict[str, ParsedTicket]:
    return {t.ticket_id: t for t in tickets}


def build_features_map(features_list: List[TextFeatures]) -> Dict[str, TextFeatures]:
    return {f.ticket_id: f for f in features_list}
