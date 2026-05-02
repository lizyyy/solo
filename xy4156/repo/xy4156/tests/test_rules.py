import pytest
from datetime import datetime, timedelta
from app import create_app, db
from app.models import (
    ReagentLedger, Batch, Bottle, Cabinet, WasteBucket,
    HazardClass, WasteStatus
)
from app.rules import (
    InventoryRule, CompatibilityRule, TemperatureRule,
    WasteBucketRule, ReviewRule, ValidationResult
)


@pytest.fixture
def app():
    app = create_app({
        'TESTING': True,
        'SQLALCHEMY_DATABASE_URI': 'sqlite:///:memory:',
        'SQLALCHEMY_TRACK_MODIFICATIONS': False
    })
    
    with app.app_context():
        db.create_all()
        
        cabinet1 = Cabinet(
            cabinet_code='TEST-CAB-001',
            name='测试柜位1',
            hazard_class=HazardClass.FLAMMABLE,
            is_low_temp=False
        )
        cabinet2 = Cabinet(
            cabinet_code='TEST-CAB-002',
            name='测试低温柜',
            is_low_temp=True,
            min_temp=-20.0,
            max_temp=4.0
        )
        cabinet3 = Cabinet(
            cabinet_code='TEST-CAB-003',
            name='测试柜位3',
            hazard_class=HazardClass.OXIDIZING,
            is_low_temp=False
        )
        
        db.session.add_all([cabinet1, cabinet2, cabinet3])
        
        ledger1 = ReagentLedger(
            reagent_name='测试乙醇',
            hazard_class=HazardClass.FLAMMABLE,
            is_low_temp=False
        )
        ledger2 = ReagentLedger(
            reagent_name='测试过氧化氢',
            hazard_class=HazardClass.OXIDIZING,
            is_low_temp=True,
            min_temp=2.0,
            max_temp=8.0
        )
        
        db.session.add_all([ledger1, ledger2])
        db.session.commit()
        
        yield app
        
        db.session.remove()
        db.drop_all()


@pytest.fixture
def client(app):
    return app.test_client()


@pytest.fixture
def runner(app):
    return app.test_cli_runner()


class TestInventoryRule:
    def test_check_batch_volume_valid(self, app):
        with app.app_context():
            ledger = ReagentLedger.query.filter_by(reagent_name='测试乙醇').first()
            batch = Batch(
                batch_number='TEST-BATCH-001',
                ledger_id=ledger.id,
                total_volume=1000.0,
                remaining_volume=1000.0
            )
            db.session.add(batch)
            db.session.commit()
            
            result = InventoryRule.check_batch_volume(batch, 500.0)
            
            assert result.valid is True
            assert '库存充足' in result.message
    
    def test_check_batch_volume_over_limit(self, app):
        with app.app_context():
            ledger = ReagentLedger.query.filter_by(reagent_name='测试乙醇').first()
            batch = Batch(
                batch_number='TEST-BATCH-002',
                ledger_id=ledger.id,
                total_volume=1000.0,
                remaining_volume=500.0
            )
            db.session.add(batch)
            db.session.commit()
            
            result = InventoryRule.check_batch_volume(batch, 600.0)
            
            assert result.valid is False
            assert '超量分装' in result.message
            assert result.details['exceed_volume'] == 100.0
    
    def test_check_batch_volume_negative(self, app):
        with app.app_context():
            ledger = ReagentLedger.query.filter_by(reagent_name='测试乙醇').first()
            batch = Batch(
                batch_number='TEST-BATCH-003',
                ledger_id=ledger.id,
                total_volume=1000.0,
                remaining_volume=1000.0
            )
            db.session.add(batch)
            db.session.commit()
            
            result = InventoryRule.check_batch_volume(batch, -100.0)
            
            assert result.valid is False


class TestCompatibilityRule:
    def test_check_bottle_placement_same_class(self, app):
        with app.app_context():
            cabinet = Cabinet.query.filter_by(cabinet_code='TEST-CAB-001').first()
            ledger = ReagentLedger.query.filter_by(reagent_name='测试乙醇').first()
            batch = Batch(
                batch_number='TEST-BATCH-004',
                ledger_id=ledger.id,
                total_volume=1000.0,
                remaining_volume=1000.0
            )
            db.session.add(batch)
            db.session.commit()
            
            bottle = Bottle(
                bottle_code='TEST-BOT-001',
                ledger_id=ledger.id,
                batch_id=batch.id,
                volume=500.0
            )
            db.session.add(bottle)
            db.session.commit()
            
            result = CompatibilityRule.check_bottle_placement(bottle, cabinet)
            
            assert result.valid is True
    
    def test_check_bottle_placement_incompatible(self, app):
        with app.app_context():
            cabinet = Cabinet.query.filter_by(cabinet_code='TEST-CAB-003').first()
            ledger = ReagentLedger.query.filter_by(reagent_name='测试乙醇').first()
            batch = Batch(
                batch_number='TEST-BATCH-005',
                ledger_id=ledger.id,
                total_volume=1000.0,
                remaining_volume=1000.0
            )
            db.session.add(batch)
            db.session.commit()
            
            bottle = Bottle(
                bottle_code='TEST-BOT-002',
                ledger_id=ledger.id,
                batch_id=batch.id,
                volume=500.0
            )
            db.session.add(bottle)
            db.session.commit()
            
            result = CompatibilityRule.check_bottle_placement(bottle, cabinet)
            
            assert result.valid is False
            assert '互斥' in result.message


class TestTemperatureRule:
    def test_check_temperature_range_normal(self, app):
        with app.app_context():
            cabinet = Cabinet.query.filter_by(cabinet_code='TEST-CAB-002').first()
            
            result = TemperatureRule.check_temperature_range(
                cabinet, 0.0, datetime.utcnow()
            )
            
            assert result.valid is True
    
    def test_check_temperature_range_too_high(self, app):
        with app.app_context():
            cabinet = Cabinet.query.filter_by(cabinet_code='TEST-CAB-002').first()
            
            result = TemperatureRule.check_temperature_range(
                cabinet, 10.0, datetime.utcnow()
            )
            
            assert result.valid is False
            assert '高温越界' in result.details['alerts'][0]['type']
    
    def test_check_temperature_range_too_low(self, app):
        with app.app_context():
            cabinet = Cabinet.query.filter_by(cabinet_code='TEST-CAB-002').first()
            
            result = TemperatureRule.check_temperature_range(
                cabinet, -30.0, datetime.utcnow()
            )
            
            assert result.valid is False
            assert '低温越界' in result.details['alerts'][0]['type']


class TestWasteBucketRule:
    def test_check_volume_valid(self, app):
        with app.app_context():
            bucket = WasteBucket(
                bucket_code='TEST-WB-001',
                waste_type='测试废液',
                max_volume=20.0,
                current_volume=5.0,
                start_date=datetime.utcnow().date(),
                expiry_days=90,
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
            db.session.commit()
            
            result = WasteBucketRule.check_volume(bucket, 5000.0, 'mL')
            
            assert result.valid is True
            assert result.details['new_volume'] == 10.0
    
    def test_check_volume_warning(self, app):
        with app.app_context():
            bucket = WasteBucket(
                bucket_code='TEST-WB-002',
                waste_type='测试废液',
                max_volume=20.0,
                current_volume=15.0,
                start_date=datetime.utcnow().date(),
                expiry_days=90,
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
            db.session.commit()
            
            result = WasteBucketRule.check_volume(bucket, 3000.0, 'mL')
            
            assert result.valid is True
            assert '即将满' in result.details['warnings'][0]
    
    def test_check_volume_exceed(self, app):
        with app.app_context():
            bucket = WasteBucket(
                bucket_code='TEST-WB-003',
                waste_type='测试废液',
                max_volume=20.0,
                current_volume=18.0,
                start_date=datetime.utcnow().date(),
                expiry_days=90,
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
            db.session.commit()
            
            result = WasteBucketRule.check_volume(bucket, 5000.0, 'mL')
            
            assert result.valid is False
            assert '容量不足' in result.message
    
    def test_check_expiry_valid(self, app):
        with app.app_context():
            bucket = WasteBucket(
                bucket_code='TEST-WB-004',
                waste_type='测试废液',
                max_volume=20.0,
                current_volume=5.0,
                start_date=datetime.utcnow().date(),
                expiry_days=90,
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
            db.session.commit()
            
            result = WasteBucketRule.check_expiry(bucket)
            
            assert result.valid is True
    
    def test_check_expiry_expired(self, app):
        with app.app_context():
            bucket = WasteBucket(
                bucket_code='TEST-WB-005',
                waste_type='测试废液',
                max_volume=20.0,
                current_volume=5.0,
                start_date=(datetime.utcnow() - timedelta(days=100)).date(),
                expiry_days=90,
                status=WasteStatus.ACTIVE
            )
            db.session.add(bucket)
            db.session.commit()
            
            result = WasteBucketRule.check_expiry(bucket)
            
            assert result.valid is False
            assert '逾期' in result.message


class TestReviewRule:
    def test_check_signature_valid(self):
        result = ReviewRule.check_signature('张安全员', '记录核对无误')
        
        assert result.valid is True
        assert result.details['reviewed_by'] == '张安全员'
        assert result.details['has_comment'] is True
    
    def test_check_signature_missing(self):
        result = ReviewRule.check_signature('', '记录核对无误')
        
        assert result.valid is False
        assert '复核签名缺失' in result.message
    
    def test_check_signature_whitespace(self):
        result = ReviewRule.check_signature('   ', '记录核对无误')
        
        assert result.valid is False
