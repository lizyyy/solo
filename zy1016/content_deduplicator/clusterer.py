"""
重复检测和主题分组模块
- 使用 K-Means 进行主题聚类
- 使用 DBSCAN 进行密度聚类（可选）
- 主题关键词提取
- 重复簇识别
"""

from typing import List, Dict, Tuple, Optional
from dataclasses import dataclass, field
from collections import defaultdict
import numpy as np

from sklearn.cluster import KMeans, DBSCAN
from sklearn.metrics import silhouette_score
from sklearn.preprocessing import normalize

from .reader import MaterialItem
from .vectorizer import (
    Vectorizer, 
    SimilarityCalculator, 
    TextProcessor,
    extract_cluster_keywords,
    get_cluster_representative
)


@dataclass
class DuplicateCluster:
    """
    重复簇（高度相似的素材组）
    """
    cluster_id: str
    item_ids: List[str]
    keywords: List[str]
    representative_id: str
    size: int = field(default=0)
    
    def __post_init__(self):
        if self.size == 0:
            self.size = len(self.item_ids)


@dataclass
class TopicGroup:
    """
    主题组
    """
    topic_id: str
    topic_name: str
    item_ids: List[str]
    keywords: List[str]
    representative_id: str
    size: int = field(default=0)
    duplicate_clusters: List[DuplicateCluster] = field(default_factory=list)
    
    def __post_init__(self):
        if self.size == 0:
            self.size = len(self.item_ids)


@dataclass
class ProcessingResult:
    """
    完整处理结果
    """
    all_items: Dict[str, MaterialItem] = field(default_factory=dict)
    duplicate_clusters: List[DuplicateCluster] = field(default_factory=list)
    topic_groups: List[TopicGroup] = field(default_factory=list)
    ungrouped_item_ids: List[str] = field(default_factory=list)
    item_to_topic: Dict[str, str] = field(default_factory=dict)
    item_to_duplicate: Dict[str, str] = field(default_factory=dict)
    
    def get_item(self, item_id: str) -> Optional[MaterialItem]:
        return self.all_items.get(item_id)
    
    def get_topic_for_item(self, item_id: str) -> Optional[TopicGroup]:
        topic_id = self.item_to_topic.get(item_id)
        if topic_id is None:
            return None
        for topic in self.topic_groups:
            if topic.topic_id == topic_id:
                return topic
        return None
    
    def get_duplicate_cluster_for_item(self, item_id: str) -> Optional[DuplicateCluster]:
        cluster_id = self.item_to_duplicate.get(item_id)
        if cluster_id is None:
            return None
        for cluster in self.duplicate_clusters:
            if cluster.cluster_id == cluster_id:
                return cluster
        return None


class TopicClusterer:
    """
    主题聚类器
    """
    
    def __init__(
        self,
        vectorizer: Optional[Vectorizer] = None,
        similarity_calculator: Optional[SimilarityCalculator] = None,
        text_processor: Optional[TextProcessor] = None
    ):
        """
        初始化主题聚类器
        
        Args:
            vectorizer: 向量化器
            similarity_calculator: 相似度计算器
            text_processor: 文本处理器
        """
        self.vectorizer = vectorizer or Vectorizer()
        self.similarity_calculator = similarity_calculator or SimilarityCalculator(self.vectorizer)
        self.text_processor = text_processor or TextProcessor()
    
    def estimate_optimal_clusters(
        self,
        tfidf_matrix,
        min_clusters: int = 2,
        max_clusters: int = 10
    ) -> int:
        """
        使用轮廓系数估计最佳聚类数量
        
        Args:
            tfidf_matrix: TF-IDF 矩阵
            min_clusters: 最小聚类数
            max_clusters: 最大聚类数
            
        Returns:
            int: 最佳聚类数
        """
        n_samples = tfidf_matrix.shape[0]
        
        if n_samples < min_clusters:
            return max(1, n_samples)
        
        max_clusters = min(max_clusters, n_samples - 1)
        
        if max_clusters < min_clusters:
            return min_clusters
        
        best_score = -1
        best_k = min_clusters
        
        for k in range(min_clusters, max_clusters + 1):
            try:
                kmeans = KMeans(n_clusters=k, random_state=42, n_init=10)
                labels = kmeans.fit_predict(tfidf_matrix)
                
                if len(set(labels)) > 1:
                    score = silhouette_score(tfidf_matrix, labels)
                    if score > best_score:
                        best_score = score
                        best_k = k
            except Exception:
                continue
        
        return best_k
    
    def cluster_by_topics(
        self,
        items: List[MaterialItem],
        n_topics: Optional[int] = None,
        min_topic_size: int = 1
    ) -> Tuple[List[TopicGroup], Dict[str, str], np.ndarray]:
        """
        按主题对素材进行聚类
        
        Args:
            items: 素材项列表
            n_topics: 主题数量，如果为 None 则自动估计
            min_topic_size: 最小主题大小
            
        Returns:
            Tuple[List[TopicGroup], Dict[str, str], np.ndarray]: 
                - 主题组列表
                - item_id 到 topic_id 的映射
                - TF-IDF 矩阵
        """
        if not items:
            return [], {}, np.array([])
        
        item_id_map = {item.id: item for item in items}
        
        tfidf_matrix = self.vectorizer.fit_transform(items)
        
        if n_topics is None:
            n_topics = self.estimate_optimal_clusters(tfidf_matrix)
        
        n_topics = min(n_topics, len(items))
        
        if n_topics <= 1 or len(items) <= 1:
            single_topic = TopicGroup(
                topic_id="topic_0",
                topic_name="综合主题",
                item_ids=[item.id for item in items],
                keywords=self._generate_topic_keywords(items),
                representative_id=get_cluster_representative(items).id,
                size=len(items)
            )
            item_to_topic = {item.id: "topic_0" for item in items}
            return [single_topic], item_to_topic, tfidf_matrix
        
        kmeans = KMeans(n_clusters=n_topics, random_state=42, n_init=10)
        labels = kmeans.fit_predict(tfidf_matrix)
        
        cluster_items: Dict[int, List[MaterialItem]] = defaultdict(list)
        item_to_topic: Dict[str, str] = {}
        
        for idx, item in enumerate(items):
            cluster_label = labels[idx]
            cluster_items[cluster_label].append(item)
            item_to_topic[item.id] = f"topic_{cluster_label}"
        
        topic_groups: List[TopicGroup] = []
        centroids = kmeans.cluster_centers_
        
        for cluster_label in sorted(cluster_items.keys()):
            cluster_item_list = cluster_items[cluster_label]
            
            if len(cluster_item_list) < min_topic_size:
                continue
            
            keywords = self._generate_topic_keywords(cluster_item_list)
            
            topic_name = self._generate_topic_name(keywords, cluster_label)
            
            representative = get_cluster_representative(cluster_item_list)
            
            topic_group = TopicGroup(
                topic_id=f"topic_{cluster_label}",
                topic_name=topic_name,
                item_ids=[item.id for item in cluster_item_list],
                keywords=keywords,
                representative_id=representative.id,
                size=len(cluster_item_list)
            )
            
            topic_groups.append(topic_group)
        
        topic_groups.sort(key=lambda x: x.size, reverse=True)
        
        for idx, topic in enumerate(topic_groups):
            new_topic_id = f"topic_{idx}"
            old_topic_id = topic.topic_id
            
            for item_id in topic.item_ids:
                item_to_topic[item_id] = new_topic_id
            
            topic.topic_id = new_topic_id
            topic.topic_name = self._generate_topic_name(topic.keywords, idx)
        
        return topic_groups, item_to_topic, tfidf_matrix
    
    def _generate_topic_keywords(self, items: List[MaterialItem], top_k: int = 5) -> List[str]:
        """
        生成主题关键词
        """
        texts = [item.clean_text for item in items]
        return self.text_processor.extract_keywords_from_multiple(texts, top_k)
    
    def _generate_topic_name(self, keywords: List[str], index: int) -> str:
        """
        基于关键词生成主题名称
        """
        if keywords:
            return "-".join(keywords[:3])
        return f"主题_{index + 1}"
    
    def find_duplicate_clusters(
        self,
        items: List[MaterialItem],
        similarity_threshold: float = 0.7,
        min_cluster_size: int = 2
    ) -> Tuple[List[DuplicateCluster], Dict[str, str]]:
        """
        查找重复簇
        
        Args:
            items: 素材项列表
            similarity_threshold: 相似度阈值
            min_cluster_size: 最小簇大小
            
        Returns:
            Tuple[List[DuplicateCluster], Dict[str, str]]:
                - 重复簇列表
                - item_id 到 cluster_id 的映射
        """
        if not items or len(items) < min_cluster_size:
            return [], {}
        
        item_id_map = {item.id: item for item in items}
        
        cluster_id_lists = self.similarity_calculator.find_duplicates(
            items,
            threshold=similarity_threshold,
            min_cluster_size=min_cluster_size
        )
        
        duplicate_clusters: List[DuplicateCluster] = []
        item_to_duplicate: Dict[str, str] = {}
        
        for cluster_idx, item_ids in enumerate(cluster_id_lists):
            cluster_items = [item_id_map[item_id] for item_id in item_ids]
            
            keywords = extract_cluster_keywords(cluster_items)
            
            representative = get_cluster_representative(cluster_items)
            
            cluster_id = f"dup_{cluster_idx}"
            
            duplicate_cluster = DuplicateCluster(
                cluster_id=cluster_id,
                item_ids=item_ids,
                keywords=keywords,
                representative_id=representative.id,
                size=len(item_ids)
            )
            
            duplicate_clusters.append(duplicate_cluster)
            
            for item_id in item_ids:
                item_to_duplicate[item_id] = cluster_id
        
        duplicate_clusters.sort(key=lambda x: x.size, reverse=True)
        
        return duplicate_clusters, item_to_duplicate
    
    def process(
        self,
        items: List[MaterialItem],
        n_topics: Optional[int] = None,
        similarity_threshold: float = 0.7,
        min_duplicate_size: int = 2,
        min_topic_size: int = 1
    ) -> ProcessingResult:
        """
        完整处理流程：主题分组 + 重复检测
        
        Args:
            items: 素材项列表
            n_topics: 主题数量，None 则自动估计
            similarity_threshold: 相似度阈值
            min_duplicate_size: 最小重复簇大小
            min_topic_size: 最小主题大小
            
        Returns:
            ProcessingResult: 完整处理结果
        """
        result = ProcessingResult()
        
        result.all_items = {item.id: item for item in items}
        
        if not items:
            return result
        
        topic_groups, item_to_topic, tfidf_matrix = self.cluster_by_topics(
            items, n_topics, min_topic_size
        )
        result.topic_groups = topic_groups
        result.item_to_topic = item_to_topic
        
        duplicate_clusters, item_to_duplicate = self.find_duplicate_clusters(
            items, similarity_threshold, min_duplicate_size
        )
        result.duplicate_clusters = duplicate_clusters
        result.item_to_duplicate = item_to_duplicate
        
        for topic in topic_groups:
            topic_item_map = {item_id: result.all_items[item_id] for item_id in topic.item_ids}
            topic_items = list(topic_item_map.values())
            
            topic_dup_clusters: List[DuplicateCluster] = []
            topic_item_to_dup: Dict[str, str] = {}
            
            for item_id in topic.item_ids:
                if item_id in item_to_duplicate:
                    cluster_id = item_to_duplicate[item_id]
                    for dup_cluster in duplicate_clusters:
                        if dup_cluster.cluster_id == cluster_id:
                            topic_item_ids_in_cluster = [
                                iid for iid in dup_cluster.item_ids 
                                if iid in topic_item_map
                            ]
                            if len(topic_item_ids_in_cluster) >= min_duplicate_size:
                                if cluster_id not in [c.cluster_id for c in topic_dup_clusters]:
                                    topic_dup_cluster = DuplicateCluster(
                                        cluster_id=f"{topic.topic_id}_{cluster_id}",
                                        item_ids=topic_item_ids_in_cluster,
                                        keywords=dup_cluster.keywords,
                                        representative_id=dup_cluster.representative_id,
                                        size=len(topic_item_ids_in_cluster)
                                    )
                                    topic_dup_clusters.append(topic_dup_cluster)
                                    for iid in topic_item_ids_in_cluster:
                                        topic_item_to_dup[iid] = topic_dup_cluster.cluster_id
                            break
            
            topic.duplicate_clusters = topic_dup_clusters
        
        all_assigned_item_ids = set()
        for topic in topic_groups:
            all_assigned_item_ids.update(topic.item_ids)
        
        result.ungrouped_item_ids = [
            item.id for item in items 
            if item.id not in all_assigned_item_ids
        ]
        
        return result


def process_materials(
    items: List[MaterialItem],
    n_topics: Optional[int] = None,
    similarity_threshold: float = 0.7,
    min_duplicate_size: int = 2
) -> ProcessingResult:
    """
    便捷函数：处理素材列表
    
    Args:
        items: 素材项列表
        n_topics: 主题数量
        similarity_threshold: 相似度阈值
        min_duplicate_size: 最小重复簇大小
        
    Returns:
        ProcessingResult: 处理结果
    """
    clusterer = TopicClusterer()
    return clusterer.process(
        items,
        n_topics=n_topics,
        similarity_threshold=similarity_threshold,
        min_duplicate_size=min_duplicate_size
    )
