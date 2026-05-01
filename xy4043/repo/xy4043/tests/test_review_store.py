import os
import tempfile
import unittest
from datetime import datetime
from ferment_calibrator.review_store import (
    ReviewStatus,
    ReviewRecord,
    ReviewStore
)


class TestReviewStatus(unittest.TestCase):
    
    def test_status_values(self):
        self.assertEqual(ReviewStatus.PENDING.value, 'pending')
        self.assertEqual(ReviewStatus.CONFIRMED.value, 'confirmed')
        self.assertEqual(ReviewStatus.REJECTED.value, 'rejected')
        self.assertEqual(ReviewStatus.NOTE.value, 'note')
    
    def test_status_description(self):
        self.assertEqual(ReviewStatus.PENDING.description, '待复核')
        self.assertEqual(ReviewStatus.CONFIRMED.description, '确认风险')
        self.assertEqual(ReviewStatus.REJECTED.description, '驳回风险')
        self.assertEqual(ReviewStatus.NOTE.description, '添加备注')


class TestReviewRecord(unittest.TestCase):
    
    def test_create_review_record(self):
        record = ReviewRecord(
            risk_id='risk_001',
            risk_type='contamination',
            risk_description='检测到pH快速下降',
            status=ReviewStatus.PENDING,
            reviewer_notes=None,
            reviewed_by=None,
            reviewed_at=None,
            created_at=datetime(2024, 5, 1, 14, 0, 0)
        )
        
        self.assertEqual(record.risk_id, 'risk_001')
        self.assertEqual(record.risk_type, 'contamination')
        self.assertEqual(record.status, ReviewStatus.PENDING)
        self.assertIsNone(record.reviewer_notes)
    
    def test_to_dict(self):
        record = ReviewRecord(
            risk_id='risk_002',
            risk_type='sensor_misalignment',
            risk_description='溶氧读数恒定',
            status=ReviewStatus.CONFIRMED,
            reviewer_notes='确实是传感器问题，已经校准',
            reviewed_by='研究员A',
            reviewed_at=datetime(2024, 5, 2, 9, 0, 0),
            created_at=datetime(2024, 5, 1, 14, 0, 0)
        )
        
        data = record.to_dict()
        
        self.assertEqual(data['risk_id'], 'risk_002')
        self.assertEqual(data['risk_type'], 'sensor_misalignment')
        self.assertEqual(data['status'], 'confirmed')
        self.assertEqual(data['status_name'], '确认风险')
        self.assertEqual(data['reviewer_notes'], '确实是传感器问题，已经校准')
        self.assertEqual(data['reviewed_by'], '研究员A')


class TestReviewStore(unittest.TestCase):
    
    def setUp(self):
        self.temp_dir = tempfile.mkdtemp()
        self.review_path = os.path.join(self.temp_dir, 'reviews.json')
        self.store = ReviewStore(self.review_path)
    
    def tearDown(self):
        import shutil
        shutil.rmtree(self.temp_dir)
    
    def test_add_risk_for_review(self):
        risk_data = {
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '检测到pH快速下降',
            'evidence': {'ph_drop': 0.5}
        }
        
        record = self.store.add_risk_for_review(risk_data)
        
        self.assertIsInstance(record, ReviewRecord)
        self.assertEqual(record.risk_id, 'risk_001')
        self.assertEqual(record.status, ReviewStatus.PENDING)
        
        stats = self.store.get_statistics()
        self.assertEqual(stats['total_risks'], 1)
        self.assertEqual(stats['by_status']['pending'], 1)
    
    def test_confirm_risk(self):
        risk_data = {
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '检测到pH快速下降',
            'evidence': {'ph_drop': 0.5}
        }
        
        self.store.add_risk_for_review(risk_data)
        
        record = self.store.confirm_risk(
            'risk_001',
            notes='确认存在污染，需要重新接种',
            reviewer='研究员A'
        )
        
        self.assertEqual(record.status, ReviewStatus.CONFIRMED)
        self.assertEqual(record.reviewer_notes, '确认存在污染，需要重新接种')
        self.assertEqual(record.reviewed_by, '研究员A')
        
        stats = self.store.get_statistics()
        self.assertEqual(stats['by_status']['confirmed'], 1)
    
    def test_reject_risk(self):
        risk_data = {
            'risk_id': 'risk_002',
            'risk_type': 'sensor_misalignment',
            'severity': 'medium',
            'description': '溶氧读数恒定',
            'evidence': {'constant_duration': 2.5}
        }
        
        self.store.add_risk_for_review(risk_data)
        
        record = self.store.reject_risk(
            'risk_002',
            notes='这是正常的溶氧稳定状态，不是传感器问题',
            reviewer='研究员B'
        )
        
        self.assertEqual(record.status, ReviewStatus.REJECTED)
        self.assertEqual(record.reviewer_notes, '这是正常的溶氧稳定状态，不是传感器问题')
        
        stats = self.store.get_statistics()
        self.assertEqual(stats['by_status']['rejected'], 1)
    
    def test_add_note(self):
        risk_data = {
            'risk_id': 'risk_003',
            'risk_type': 'rapid_ph_change',
            'severity': 'low',
            'description': 'pH轻微变化',
            'evidence': {'ph_change': 0.1}
        }
        
        self.store.add_risk_for_review(risk_data)
        
        record = self.store.add_note(
            'risk_003',
            notes='需要继续观察',
            reviewer='研究员C'
        )
        
        self.assertEqual(record.status, ReviewStatus.NOTE)
        self.assertEqual(record.reviewer_notes, '需要继续观察')
    
    def test_get_pending_risks(self):
        self.store.add_risk_for_review({
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '风险1',
            'evidence': {}
        })
        self.store.add_risk_for_review({
            'risk_id': 'risk_002',
            'risk_type': 'sensor_misalignment',
            'severity': 'medium',
            'description': '风险2',
            'evidence': {}
        })
        
        pending = self.store.get_pending_risks()
        self.assertEqual(len(pending), 2)
        
        self.store.confirm_risk('risk_001', '确认', '研究员A')
        
        pending_after = self.store.get_pending_risks()
        self.assertEqual(len(pending_after), 1)
        self.assertEqual(pending_after[0].risk_id, 'risk_002')
    
    def test_get_reviewed_risks(self):
        self.store.add_risk_for_review({
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '风险1',
            'evidence': {}
        })
        self.store.add_risk_for_review({
            'risk_id': 'risk_002',
            'risk_type': 'sensor_misalignment',
            'severity': 'medium',
            'description': '风险2',
            'evidence': {}
        })
        
        self.store.confirm_risk('risk_001', '确认', '研究员A')
        self.store.reject_risk('risk_002', '驳回', '研究员B')
        
        reviewed = self.store.get_reviewed_risks()
        self.assertEqual(len(reviewed), 2)
    
    def test_get_risk_by_id(self):
        self.store.add_risk_for_review({
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '测试风险',
            'evidence': {'test': 'data'}
        })
        
        record = self.store.get_risk_by_id('risk_001')
        self.assertIsNotNone(record)
        self.assertEqual(record.risk_id, 'risk_001')
        
        none_record = self.store.get_risk_by_id('nonexistent')
        self.assertIsNone(none_record)
    
    def test_get_risks_by_type(self):
        self.store.add_risk_for_review({
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '污染风险',
            'evidence': {}
        })
        self.store.add_risk_for_review({
            'risk_id': 'risk_002',
            'risk_type': 'contamination',
            'severity': 'medium',
            'description': '另一个污染风险',
            'evidence': {}
        })
        self.store.add_risk_for_review({
            'risk_id': 'risk_003',
            'risk_type': 'sensor_misalignment',
            'severity': 'low',
            'description': '传感器风险',
            'evidence': {}
        })
        
        contamination_risks = self.store.get_risks_by_type('contamination')
        self.assertEqual(len(contamination_risks), 2)
        
        sensor_risks = self.store.get_risks_by_type('sensor_misalignment')
        self.assertEqual(len(sensor_risks), 1)
    
    def test_save_and_load(self):
        self.store.add_risk_for_review({
            'risk_id': 'risk_001',
            'risk_type': 'contamination',
            'severity': 'high',
            'description': '测试风险',
            'evidence': {'test': 'data'}
        })
        self.store.confirm_risk('risk_001', '测试备注', '测试人员')
        
        self.store.save()
        
        store2 = ReviewStore(self.review_path)
        
        stats = store2.get_statistics()
        self.assertEqual(stats['total_risks'], 1)
        self.assertEqual(stats['by_status']['confirmed'], 1)
        
        record = store2.get_risk_by_id('risk_001')
        self.assertEqual(record.reviewer_notes, '测试备注')
        self.assertEqual(record.reviewed_by, '测试人员')


if __name__ == '__main__':
    unittest.main()
