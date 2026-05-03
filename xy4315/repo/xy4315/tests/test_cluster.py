import unittest
import os
import tempfile
from datetime import datetime

from backend.modules.cluster import ClusterEngine


class TestClusterEngine(unittest.TestCase):
    def setUp(self):
        self.cluster_engine = ClusterEngine(similarity_threshold=0.65)
        
        self.test_complaints = [
            {
                'id': 'CP001',
                'call_time': datetime(2024, 5, 1, 9, 30),
                'resident_name': '张三',
                'phone': '13800138001',
                'district': '朝阳区',
                'summary': '阳光花园小区夜间施工噪音严重，影响居民休息',
                'urgency': '紧急',
                'source_type': 'complaint',
                'status': 'pending'
            },
            {
                'id': 'CP002',
                'call_time': datetime(2024, 5, 1, 10, 15),
                'resident_name': '李四',
                'phone': '13800138002',
                'district': '朝阳区',
                'summary': '阳光花园旁边的工地晚上还在施工，噪音太大无法入睡',
                'urgency': '紧急',
                'source_type': 'complaint',
                'status': 'pending'
            },
            {
                'id': 'CP003',
                'call_time': datetime(2024, 5, 2, 8, 45),
                'resident_name': '王五',
                'phone': '13800138003',
                'district': '海淀区',
                'summary': '幸福小区停车位不足，车辆乱停乱放',
                'urgency': '高',
                'source_type': 'complaint',
                'status': 'pending'
            },
            {
                'id': 'CP004',
                'call_time': datetime(2024, 5, 2, 11, 30),
                'resident_name': '赵六',
                'phone': '13800138004',
                'district': '海淀区',
                'summary': '幸福小区停车难，很多车停在消防通道上',
                'urgency': '高',
                'source_type': 'complaint',
                'status': 'pending'
            }
        ]

    def test_cluster_similar_complaints(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        self.assertGreater(len(clusters), 0)
        
        complaint_ids = []
        for cluster in clusters:
            complaint_ids.extend(cluster.get('complaint_ids', []))
        
        self.assertEqual(len(complaint_ids), 4)

    def test_cluster_by_district(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        districts = set()
        for cluster in clusters:
            districts.add(cluster.get('district'))
        
        self.assertIn('朝阳区', districts)
        self.assertIn('海淀区', districts)

    def test_cluster_representative_summary(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        for cluster in clusters:
            self.assertIsNotNone(cluster.get('representative_summary'))
            self.assertGreater(len(cluster.get('representative_summary', '')), 0)

    def test_cluster_keywords(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        for cluster in clusters:
            keywords = cluster.get('keywords', [])
            self.assertIsInstance(keywords, list)

    def test_cluster_similarity_score(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        for cluster in clusters:
            score = cluster.get('similarity_score', 0)
            self.assertGreaterEqual(score, 0)
            self.assertLessEqual(score, 1)

    def test_cluster_urgency_level(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        for cluster in clusters:
            urgency = cluster.get('urgency_level')
            self.assertIn(urgency, ['紧急', '高', '普通'])

    def test_cluster_similar_reasons(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        for cluster in clusters:
            reasons = cluster.get('similar_reasons', [])
            self.assertIsInstance(reasons, list)
            if cluster.get('count', 0) > 1:
                self.assertGreater(len(reasons), 0)

    def test_single_cluster(self):
        single_complaint = [self.test_complaints[0]]
        clusters = self.cluster_engine.cluster(single_complaint)
        
        self.assertEqual(len(clusters), 1)
        self.assertEqual(clusters[0].get('count'), 1)
        self.assertIn('独立投诉事件', clusters[0].get('similar_reasons', []))

    def test_merge_clusters(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        if len(clusters) >= 2:
            merged = self.cluster_engine.merge_clusters(clusters[:2])
            
            self.assertIsNotNone(merged)
            self.assertIn('cluster_id', merged)
            self.assertGreater(merged.get('count', 0), 0)

    def test_split_cluster(self):
        clusters = self.cluster_engine.cluster(self.test_complaints)
        
        multi_complaint_cluster = None
        for cluster in clusters:
            if cluster.get('count', 0) >= 2:
                multi_complaint_cluster = cluster
                break
        
        if multi_complaint_cluster:
            split_indices = [[0], [1]]
            new_clusters = self.cluster_engine.split_cluster(
                multi_complaint_cluster, split_indices
            )
            
            self.assertEqual(len(new_clusters), 2)

    def test_time_proximity_check(self):
        c1 = {
            'id': 'CP001',
            'call_time': datetime(2024, 5, 1, 9, 30),
            'district': '朝阳区',
            'summary': '测试投诉',
            'urgency': '普通'
        }
        c2 = {
            'id': 'CP002',
            'call_time': datetime(2024, 5, 3, 10, 0),
            'district': '朝阳区',
            'summary': '测试投诉',
            'urgency': '普通'
        }
        c3 = {
            'id': 'CP003',
            'call_time': datetime(2024, 5, 15, 10, 0),
            'district': '朝阳区',
            'summary': '测试投诉',
            'urgency': '普通'
        }

        self.assertTrue(self.cluster_engine._time_proximity_check(c1, c2))
        self.assertFalse(self.cluster_engine._time_proximity_check(c1, c3))


if __name__ == '__main__':
    unittest.main()
