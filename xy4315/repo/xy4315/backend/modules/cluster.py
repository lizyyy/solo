import numpy as np
from typing import List, Dict, Any, Tuple, Optional
from datetime import datetime
from collections import defaultdict

from .feature_extractor import EnhancedSimilarityCalculator, ChineseTextProcessor


class ClusterEngine:
    def __init__(self, similarity_threshold: float = 0.65,
                 street_keywords: Optional[Dict[str, List[str]]] = None):
        self.similarity_threshold = similarity_threshold
        self.street_keywords = street_keywords or {}
        self.text_processor = ChineseTextProcessor()
        self.similarity_calculator: Optional[EnhancedSimilarityCalculator] = None

    def cluster(self, complaints: List[Dict[str, Any]],
                work_orders: Optional[List[Dict[str, Any]]] = None) -> List[Dict[str, Any]]:
        if not complaints:
            return []

        self.similarity_calculator = EnhancedSimilarityCalculator(
            text_processor=self.text_processor,
            street_keywords=self.street_keywords
        )

        grouped_by_street = self._group_by_street(complaints)

        all_clusters = []
        cluster_id_counter = 0

        for street, street_complaints in grouped_by_street.items():
            if len(street_complaints) == 1:
                cluster = self._create_single_cluster(
                    street_complaints[0], cluster_id_counter
                )
                all_clusters.append(cluster)
                cluster_id_counter += 1
            else:
                street_clusters = self._cluster_within_street(
                    street_complaints, cluster_id_counter
                )
                all_clusters.extend(street_clusters)
                cluster_id_counter += len(street_clusters)

        all_clusters = self._merge_work_orders(all_clusters, work_orders or [])

        all_clusters = self._calculate_cluster_statistics(all_clusters)

        all_clusters.sort(key=lambda x: (
            -x.get('urgency_score', 0),
            -len(x.get('complaint_ids', []))
        ))

        return all_clusters

    def _group_by_street(self, complaints: List[Dict[str, Any]]) -> Dict[str, List[Dict[str, Any]]]:
        grouped = defaultdict(list)
        for complaint in complaints:
            district = complaint.get('district', '未知街道')
            grouped[district].append(complaint)
        return dict(grouped)

    def _cluster_within_street(self, complaints: List[Dict[str, Any]],
                                start_id: int) -> List[Dict[str, Any]]:
        n = len(complaints)
        if n == 0:
            return []

        similarity_matrix = self._build_similarity_matrix(complaints)

        clusters = self._dbscan_like_clustering(similarity_matrix, complaints)

        result_clusters = []
        for i, cluster_indices in enumerate(clusters):
            cluster = self._create_cluster(
                complaints, cluster_indices, start_id + i
            )
            result_clusters.append(cluster)

        return result_clusters

    def _build_similarity_matrix(self, complaints: List[Dict[str, Any]]) -> np.ndarray:
        n = len(complaints)
        similarity_matrix = np.zeros((n, n))

        for i in range(n):
            for j in range(i, n):
                if i == j:
                    similarity_matrix[i][j] = 1.0
                else:
                    result = self.similarity_calculator.calculate_enhanced_similarity(
                        complaints[i], complaints[j]
                    )
                    similarity_matrix[i][j] = result['similarity']
                    similarity_matrix[j][i] = result['similarity']

        return similarity_matrix

    def _dbscan_like_clustering(self, similarity_matrix: np.ndarray,
                                  complaints: List[Dict[str, Any]]) -> List[List[int]]:
        n = len(similarity_matrix)
        visited = [False] * n
        clusters = []

        for i in range(n):
            if not visited[i]:
                cluster = self._expand_cluster(i, similarity_matrix, visited, complaints)
                if cluster:
                    clusters.append(cluster)

        for i in range(n):
            if not visited[i]:
                clusters.append([i])
                visited[i] = True

        return clusters

    def _expand_cluster(self, start_idx: int, similarity_matrix: np.ndarray,
                        visited: List[bool], complaints: List[Dict[str, Any]]) -> List[int]:
        cluster = [start_idx]
        visited[start_idx] = True

        queue = [start_idx]
        while queue:
            current = queue.pop(0)

            neighbors = self._find_neighbors(current, similarity_matrix, complaints)

            for neighbor_idx in neighbors:
                if not visited[neighbor_idx]:
                    visited[neighbor_idx] = True
                    cluster.append(neighbor_idx)
                    queue.append(neighbor_idx)

        return cluster

    def _find_neighbors(self, idx: int, similarity_matrix: np.ndarray,
                         complaints: List[Dict[str, Any]]) -> List[int]:
        neighbors = []
        current_complaint = complaints[idx]

        for j in range(len(similarity_matrix)):
            if j == idx:
                continue

            similarity = similarity_matrix[idx][j]
            other_complaint = complaints[j]

            if similarity >= self.similarity_threshold:
                neighbors.append(j)
            elif self._time_proximity_check(current_complaint, other_complaint):
                if similarity >= self.similarity_threshold * 0.8:
                    neighbors.append(j)

        return neighbors

    def _time_proximity_check(self, c1: Dict[str, Any], c2: Dict[str, Any]) -> bool:
        time1 = c1.get('call_time')
        time2 = c2.get('call_time')

        if not time1 or not time2:
            return False

        if not isinstance(time1, datetime) or not isinstance(time2, datetime):
            return False

        delta = abs((time1 - time2).total_seconds())

        return delta <= 7 * 24 * 3600

    def _create_cluster(self, complaints: List[Dict[str, Any]],
                        indices: List[int], cluster_id: int) -> Dict[str, Any]:
        cluster_complaints = [complaints[i] for i in indices]

        representative, keywords = self._select_representative(cluster_complaints)

        avg_similarity = self._calculate_avg_similarity(cluster_complaints)

        similar_reasons = self._extract_similar_reasons(cluster_complaints)

        urgency_level = self._calculate_urgency(cluster_complaints)

        cluster = {
            'cluster_id': f'CL{cluster_id:04d}',
            'complaint_ids': [c.get('id', '') for c in cluster_complaints],
            'complaints': cluster_complaints,
            'representative_summary': representative,
            'keywords': keywords,
            'similarity_score': round(avg_similarity, 4),
            'similar_reasons': similar_reasons,
            'urgency_level': urgency_level,
            'count': len(cluster_complaints),
            'district': cluster_complaints[0].get('district', '') if cluster_complaints else '',
            'status': 'pending_review',
            'assigned_department': None,
            'review_notes': '',
            'work_orders': [],
            'created_at': datetime.now().isoformat()
        }

        return cluster

    def _create_single_cluster(self, complaint: Dict[str, Any], 
                                cluster_id: int) -> Dict[str, Any]:
        keywords = self.text_processor.extract_keywords(
            complaint.get('summary', ''), top_k=10
        )
        keyword_list = [kw[0] for kw in keywords]

        cluster = {
            'cluster_id': f'CL{cluster_id:04d}',
            'complaint_ids': [complaint.get('id', '')],
            'complaints': [complaint],
            'representative_summary': complaint.get('summary', ''),
            'keywords': keyword_list,
            'similarity_score': 1.0,
            'similar_reasons': ['独立投诉事件'],
            'urgency_level': complaint.get('urgency', '普通'),
            'count': 1,
            'district': complaint.get('district', ''),
            'status': 'pending_review',
            'assigned_department': None,
            'review_notes': '',
            'work_orders': [],
            'created_at': datetime.now().isoformat()
        }

        return cluster

    def _select_representative(self, complaints: List[Dict[str, Any]]) -> Tuple[str, List[str]]:
        if not complaints:
            return "", []

        summaries = [c.get('summary', '') for c in complaints]
        combined_text = " ".join(summaries)

        keywords = self.text_processor.extract_keywords(combined_text, top_k=15)
        keyword_list = [kw[0] for kw in keywords]

        best_summary = ""
        best_score = 0

        for summary in summaries:
            score = sum(1 for kw in keyword_list if kw in summary)
            if score > best_score:
                best_score = score
                best_summary = summary
            elif score == best_score and len(summary) > len(best_summary):
                best_summary = summary

        if not best_summary and summaries:
            best_summary = max(summaries, key=len)

        return best_summary, keyword_list

    def _calculate_avg_similarity(self, complaints: List[Dict[str, Any]]) -> float:
        if len(complaints) <= 1:
            return 1.0

        n = len(complaints)
        total_similarity = 0.0
        count = 0

        for i in range(n):
            for j in range(i + 1, n):
                if self.similarity_calculator:
                    result = self.similarity_calculator.calculate_enhanced_similarity(
                        complaints[i], complaints[j]
                    )
                    total_similarity += result['similarity']
                    count += 1

        return total_similarity / count if count > 0 else 0.0

    def _extract_similar_reasons(self, complaints: List[Dict[str, Any]]) -> List[str]:
        if len(complaints) <= 1:
            return ['独立投诉事件']

        reasons = set()

        first_district = complaints[0].get('district', '')
        all_same_district = all(c.get('district', '') == first_district for c in complaints)
        if all_same_district:
            reasons.add(f"来自同一街道：{first_district}")

        summaries = [c.get('summary', '') for c in complaints]
        keywords = self.text_processor.extract_keywords(" ".join(summaries), top_k=5)
        common_keywords = [kw[0] for kw in keywords if kw[1] > 0.1]
        if common_keywords:
            reasons.add(f"涉及共同关键词：{'、'.join(common_keywords[:3])}")

        urgencies = [c.get('urgency', '普通') for c in complaints]
        if all(u == '紧急' for u in urgencies):
            reasons.add("均为紧急投诉")

        if not reasons:
            reasons.add("文本内容相似")

        return list(reasons)

    def _calculate_urgency(self, complaints: List[Dict[str, Any]]) -> str:
        urgencies = [c.get('urgency', '普通') for c in complaints]
        if '紧急' in urgencies:
            return '紧急'
        elif '高' in urgencies:
            return '高'
        else:
            return '普通'

    def _merge_work_orders(self, clusters: List[Dict[str, Any]],
                            work_orders: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        if not work_orders:
            return clusters

        complaint_to_wo = defaultdict(list)
        for wo in work_orders:
            complaint_id = wo.get('complaint_id', '')
            if complaint_id:
                complaint_to_wo[complaint_id].append(wo)

        for cluster in clusters:
            cluster_work_orders = []
            for cid in cluster.get('complaint_ids', []):
                cluster_work_orders.extend(complaint_to_wo.get(cid, []))
            cluster['work_orders'] = cluster_work_orders

        return clusters

    def _calculate_cluster_statistics(self, clusters: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        total_complaints = sum(c.get('count', 0) for c in clusters)

        for cluster in clusters:
            count = cluster.get('count', 0)
            urgency = cluster.get('urgency_level', '普通')

            urgency_score = 0
            if urgency == '紧急':
                urgency_score = 3
            elif urgency == '高':
                urgency_score = 2
            else:
                urgency_score = 1

            cluster['urgency_score'] = urgency_score * count
            cluster['percentage'] = round(count / total_complaints * 100, 2) if total_complaints > 0 else 0

        return clusters

    def split_cluster(self, cluster: Dict[str, Any], 
                      split_indices: List[List[int]]) -> List[Dict[str, Any]]:
        complaints = cluster.get('complaints', [])
        if not complaints:
            return []

        new_clusters = []
        base_id = int(cluster['cluster_id'].replace('CL', ''))

        for i, indices in enumerate(split_indices):
            selected_complaints = [complaints[j] for j in indices]
            new_cluster = self._create_single_cluster(
                selected_complaints[0], base_id + i + 1000
            )
            new_cluster['complaints'] = selected_complaints
            new_cluster['complaint_ids'] = [c.get('id', '') for c in selected_complaints]
            new_cluster['count'] = len(selected_complaints)
            
            if len(selected_complaints) > 1:
                representative, keywords = self._select_representative(selected_complaints)
                new_cluster['representative_summary'] = representative
                new_cluster['keywords'] = keywords
                new_cluster['similarity_score'] = self._calculate_avg_similarity(selected_complaints)
                new_cluster['similar_reasons'] = self._extract_similar_reasons(selected_complaints)

            new_cluster['status'] = 'pending_review'
            new_cluster['assigned_department'] = cluster.get('assigned_department')
            new_cluster['review_notes'] = cluster.get('review_notes', '')
            
            new_clusters.append(new_cluster)

        return new_clusters

    def merge_clusters(self, clusters: List[Dict[str, Any]], 
                        new_cluster_id: Optional[int] = None) -> Dict[str, Any]:
        if not clusters:
            return {}

        all_complaints = []
        all_work_orders = []
        all_keywords = set()

        for cluster in clusters:
            all_complaints.extend(cluster.get('complaints', []))
            all_work_orders.extend(cluster.get('work_orders', []))
            all_keywords.update(cluster.get('keywords', []))

        if new_cluster_id is None:
            new_cluster_id = max(
                int(c['cluster_id'].replace('CL', '')) for c in clusters
            ) + 1

        merged_cluster = self._create_cluster(
            all_complaints, list(range(len(all_complaints))), new_cluster_id
        )
        merged_cluster['work_orders'] = all_work_orders
        merged_cluster['keywords'] = list(all_keywords)[:15]

        return merged_cluster
