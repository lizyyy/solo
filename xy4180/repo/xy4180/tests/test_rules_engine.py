import unittest
import tempfile
import shutil
from datetime import datetime, timedelta
from pathlib import Path

from src.rules.rules_engine import RulesEngine, RuleResult, AnomalyType
from src.storage.database import DAOFactory, DatabaseManager
from src.models.models import (
    Team, Material, BorrowRecord, BorrowItem,
    ReturnItem, MaterialStatus, ReturnStatus
)


class TestRulesEngine(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.temp_dir = tempfile.mkdtemp()
        
        cls.original_db_path = Path(__file__).parent.parent / "data" / "test_recycle_station.db"
        
        DatabaseManager._instance = None
        DatabaseManager._engine = None
        DatabaseManager._session_local = None
        
        from src.storage.database import Base
        from sqlalchemy import create_engine
        from sqlalchemy.orm import sessionmaker
        
        test_db_path = Path(cls.temp_dir) / "test.db"
        test_engine = create_engine(f"sqlite:///{test_db_path}")
        
        Base.metadata.create_all(bind=test_engine)
        
        TestSession = sessionmaker(bind=test_engine)
        cls.test_session = TestSession()
        
        cls.dao_factory = DAOFactory
        cls.rules_engine = RulesEngine()
    
    @classmethod
    def tearDownClass(cls):
        cls.test_session.close()
        shutil.rmtree(cls.temp_dir)
    
    def setUp(self):
        team_dao = self.dao_factory.get_team_dao()
        material_dao = self.dao_factory.get_material_dao()
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        
        self.team = team_dao.create(
            team_code="TEST001",
            team_name="测试志愿队",
            booth_number="A01",
            contact_person="测试人",
            contact_phone="13800000000"
        )
        
        self.material = material_dao.create(
            barcode="TEST_MAT001",
            material_type="帐篷",
            material_name="测试帐篷",
            specification="3x3米",
            weight_kg=15.5,
            status=MaterialStatus.BORROWED
        )
        
        self.borrow_record = borrow_dao.create(
            borrow_code="TEST_BR001",
            team_id=self.team.id,
            borrow_date=datetime.now(),
            expected_return_date=datetime.now() + timedelta(hours=12),
            deposit_amount=500.0,
            deposit_slip_code="TEST_DEP001",
            borrower_name="测试借出人",
            status=ReturnStatus.PENDING
        )
        
        self.borrow_item = borrow_item_dao.create(
            borrow_record_id=self.borrow_record.id,
            material_id=self.material.id,
            quantity=1,
            returned_quantity=0,
            is_returned=False
        )
    
    def test_check_duplicate_return_new(self):
        result = self.rules_engine.check_duplicate_return(
            barcode=self.material.barcode,
            borrow_record_id=self.borrow_record.id
        )
        
        self.assertTrue(result.passed)
    
    def test_check_weight_anomaly_normal(self):
        result = self.rules_engine.check_weight_anomaly(
            barcode=self.material.barcode,
            measured_weight_kg=15.5
        )
        
        self.assertTrue(result.passed)
    
    def test_check_weight_anomaly_abnormal(self):
        result = self.rules_engine.check_weight_anomaly(
            barcode=self.material.barcode,
            measured_weight_kg=5.0
        )
        
        self.assertFalse(result.passed)
        self.assertEqual(result.anomaly_type, AnomalyType.WEIGHT_ANOMALY)
    
    def test_check_deposit_mismatch_match(self):
        result = self.rules_engine.check_deposit_mismatch(
            borrow_record_id=self.borrow_record.id,
            deposit_returned=500.0
        )
        
        self.assertTrue(result.passed)
    
    def test_check_deposit_mismatch_mismatch(self):
        result = self.rules_engine.check_deposit_mismatch(
            borrow_record_id=self.borrow_record.id,
            deposit_returned=300.0
        )
        
        self.assertFalse(result.passed)
        self.assertEqual(result.anomaly_type, AnomalyType.DEPOSIT_MISMATCH)
    
    def test_check_overdue_not_overdue(self):
        result = self.rules_engine.check_overdue(
            borrow_record_id=self.borrow_record.id,
            return_date=datetime.now()
        )
        
        self.assertTrue(result.passed)
    
    def test_check_overdue_is_overdue(self):
        past_date = datetime.now() - timedelta(days=1)
        
        borrow_dao = self.dao_factory.get_borrow_record_dao()
        overdue_borrow = borrow_dao.create(
            borrow_code="TEST_BR_OVERDUE",
            team_id=self.team.id,
            borrow_date=datetime.now() - timedelta(days=2),
            expected_return_date=datetime.now() - timedelta(days=1),
            deposit_amount=100.0,
            status=ReturnStatus.PENDING
        )
        
        result = self.rules_engine.check_overdue(
            borrow_record_id=overdue_borrow.id,
            return_date=datetime.now()
        )
        
        self.assertFalse(result.passed)
        self.assertEqual(result.anomaly_type, AnomalyType.OVERDUE_RETURN)
    
    def test_check_missing_items_all_returned(self):
        result = self.rules_engine.check_missing_items(
            borrow_record_id=self.borrow_record.id,
            returned_barcodes=[self.material.barcode]
        )
        
        self.assertTrue(result.passed)
    
    def test_check_missing_items_some_missing(self):
        result = self.rules_engine.check_missing_items(
            borrow_record_id=self.borrow_record.id,
            returned_barcodes=[]
        )
        
        self.assertFalse(result.passed)
        self.assertEqual(result.anomaly_type, AnomalyType.MISSING_ITEMS)
    
    def test_check_all_return_rules_normal(self):
        results = self.rules_engine.check_all_return_rules(
            borrow_record_id=self.borrow_record.id,
            barcodes=[self.material.barcode],
            measured_weights={self.material.barcode: 15.5},
            deposit_returned=500.0,
            return_date=datetime.now()
        )
        
        self.assertEqual(len(results), 0)
    
    def test_unknown_material(self):
        result = self.rules_engine.check_duplicate_return(
            barcode="NONEXISTENT001",
            borrow_record_id=self.borrow_record.id
        )
        
        self.assertTrue(result.passed)
        self.assertEqual(result.anomaly_type, AnomalyType.UNKNOWN_MATERIAL)


if __name__ == "__main__":
    unittest.main()
