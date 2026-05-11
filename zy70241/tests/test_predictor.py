"""
测试滤芯寿命预测器的核心功能
"""

import pytest
from datetime import datetime, timedelta
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from app.database import Base
from app.models import Filter, WaterQualityRecord, WaterVolumeRecord, Complaint
from app.predictor import FilterLifePredictor
from app.data_processor import DataCleaner

SQLALCHEMY_DATABASE_URL = "sqlite:///:memory:"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
    poolclass=StaticPool
)

TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

@pytest.fixture
def db():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)

class TestDataCleaner:
    """测试数据清洗模块"""
    
    def test_clean_water_quality_valid_data(self):
        """测试清洗有效的水质数据"""
        import pandas as pd
        
        cleaner = DataCleaner()
        df = pd.DataFrame({
            'filter_id': ['F001', 'F002'],
            'record_date': ['2024-01-01', '2024-01-02'],
            'turbidity': [2.5, 3.0],
            'ph': [7.2, 7.0],
            'residual_chlorine': [0.5, 0.4]
        })
        
        cleaned_df, warnings, errors = cleaner.clean_water_quality_data(df)
        
        assert len(cleaned_df) == 2
        assert len(errors) == 0
        assert cleaned_df['is_valid'].all()
    
    def test_clean_water_quality_invalid_ph(self):
        """测试清洗含有无效pH值的数据"""
        import pandas as pd
        
        cleaner = DataCleaner()
        df = pd.DataFrame({
            'filter_id': ['F001', 'F002'],
            'record_date': ['2024-01-01', '2024-01-02'],
            'ph': [7.2, 15.0]
        })
        
        cleaned_df, warnings, errors = cleaner.clean_water_quality_data(df)
        
        assert any('pH值' in error for error in errors)
    
    def test_clean_water_volume_negative(self):
        """测试清洗负水量数据"""
        import pandas as pd
        
        cleaner = DataCleaner()
        df = pd.DataFrame({
            'filter_id': ['F001'],
            'record_date': ['2024-01-01'],
            'daily_volume_liters': [-100],
            'cumulative_volume_liters': [0]
        })
        
        cleaned_df, warnings, errors = cleaner.clean_water_volume_data(df)
        
        assert any('负水量' in error for error in errors)
    
    def test_clean_complaints_valid_severity(self):
        """测试清洗投诉数据的严重程度验证"""
        import pandas as pd
        
        cleaner = DataCleaner()
        df = pd.DataFrame({
            'filter_id': ['F001'],
            'complaint_date': ['2024-01-01'],
            'complaint_type': ['水质问题'],
            'description': ['测试'],
            'severity': ['invalid']
        })
        
        cleaned_df, warnings, errors = cleaner.clean_complaint_data(df)
        
        assert any('严重程度' in warning for warning in warnings)

class TestFilterLifePredictor:
    """测试滤芯寿命预测器"""
    
    def test_predict_new_filter(self, db):
        """测试新安装滤芯的预测"""
        test_filter = Filter(
            filter_id='TEST-001',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=1),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-001')
        
        assert 'error' not in result
        assert result['health_score'] > 80
        assert result['risk_level'] in ['normal', 'low']
        assert result['predicted_remaining_days'] > 0
    
    def test_predict_old_filter(self, db):
        """测试接近寿命终点的滤芯预测"""
        test_filter = Filter(
            filter_id='TEST-002',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=85),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-002')
        
        assert 'error' not in result
        assert result['health_score'] < 60
        assert result['predicted_remaining_days'] < 10
    
    def test_predict_with_high_volume(self, db):
        """测试高用水量滤芯的预测"""
        test_filter = Filter(
            filter_id='TEST-003',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=30),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        volume_record = WaterVolumeRecord(
            filter_id='TEST-003',
            record_date=datetime.utcnow(),
            daily_volume_liters=2000,
            cumulative_volume_liters=48000,
            is_valid=True
        )
        db.add(volume_record)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-003')
        
        assert result['factors']['volume']['usage_percentage'] > 90
        assert result['predicted_remaining_liters'] < 5000
    
    def test_predict_with_poor_quality(self, db):
        """测试水质差的滤芯预测"""
        test_filter = Filter(
            filter_id='TEST-004',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=30),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        for i in range(5):
            quality_record = WaterQualityRecord(
                filter_id='TEST-004',
                record_date=datetime.utcnow() - timedelta(days=i),
                turbidity=15.0,
                ph=5.0,
                residual_chlorine=0.05,
                is_valid=True
            )
            db.add(quality_record)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-004')
        
        assert result['factors']['quality']['score'] < 0.5
    
    def test_predict_with_complaints(self, db):
        """测试有投诉记录的滤芯预测"""
        test_filter = Filter(
            filter_id='TEST-005',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=30),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        complaint1 = Complaint(
            filter_id='TEST-005',
            complaint_date=datetime.utcnow() - timedelta(days=5),
            complaint_type='水质异味',
            description='水中有氯气味',
            severity='high',
            status='open'
        )
        complaint2 = Complaint(
            filter_id='TEST-005',
            complaint_date=datetime.utcnow() - timedelta(days=2),
            complaint_type='水质浑浊',
            description='出水浑浊',
            severity='critical',
            status='open'
        )
        db.add_all([complaint1, complaint2])
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-005')
        
        assert result['factors']['complaints']['factors']['count'] == 2
        assert result['factors']['complaints']['score'] < 0.7
        assert '投诉' in result['explanation']
    
    def test_predict_nonexistent_filter(self, db):
        """测试预测不存在的滤芯"""
        predictor = FilterLifePredictor(db)
        result = predictor.predict('NONEXISTENT')
        
        assert 'error' in result
        assert result['error'] == '滤芯不存在'
    
    def test_risk_level_determination(self, db):
        """测试风险等级判断"""
        test_filter = Filter(
            filter_id='TEST-006',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=88),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        complaint = Complaint(
            filter_id='TEST-006',
            complaint_date=datetime.utcnow(),
            complaint_type='紧急',
            description='严重问题',
            severity='critical',
            status='open'
        )
        db.add(complaint)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-006')
        
        assert result['risk_level'] == 'critical'
        assert '立即更换' in result['recommendation']

class TestPredictionExplanation:
    """测试预测解释功能"""
    
    def test_explanation_includes_all_factors(self, db):
        """测试解释包含所有影响因素"""
        test_filter = Filter(
            filter_id='TEST-EXP-001',
            station_name='测试净水站',
            filter_type='RO膜',
            install_date=datetime.utcnow() - timedelta(days=45),
            max_lifespan_days=90,
            max_lifespan_liters=50000,
            status='active'
        )
        db.add(test_filter)
        db.commit()
        
        volume_record = WaterVolumeRecord(
            filter_id='TEST-EXP-001',
            record_date=datetime.utcnow(),
            daily_volume_liters=1000,
            cumulative_volume_liters=25000,
            is_valid=True
        )
        db.add(volume_record)
        
        quality_record = WaterQualityRecord(
            filter_id='TEST-EXP-001',
            record_date=datetime.utcnow(),
            turbidity=3.0,
            ph=7.2,
            residual_chlorine=0.5,
            is_valid=True
        )
        db.add(quality_record)
        db.commit()
        
        predictor = FilterLifePredictor(db)
        result = predictor.predict('TEST-EXP-001')
        
        explanation = result['explanation']
        
        assert '已使用' in explanation
        assert '健康评分' in explanation
        assert '剩余寿命' in explanation
        assert '水质指标' in explanation or '无水质数据' in explanation

if __name__ == '__main__':
    pytest.main([__file__, '-v'])
