"""规则校验引擎测试"""

from datetime import datetime, timedelta

from specimen_tracker.models import Specimen, SpecimenStatus, AnomalyType
from specimen_tracker.rules import (
    RulesEngine, MissingPhotoRule, TimeoutRule,
    MissingReviewRule, MissingSpecimenBagRule,
    MissingCsvRule, MultiPartConfusionRule, InconsistentInfoRule
)


class TestMissingPhotoRule:
    """缺照片规则测试"""
    
    def setup_method(self):
        self.rule = MissingPhotoRule()
    
    def test_detects_missing_photo(self):
        """测试检测缺照片"""
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            photo_count=0,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 1
        assert anomalies[0].anomaly_type == AnomalyType.MISSING_PHOTO
        assert anomalies[0].specimen_id == 1
    
    def test_ignores_released_specimen(self):
        """测试忽略已放行标本"""
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.RELEASED,
            photo_count=0,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 0
    
    def test_no_anomaly_if_has_photos(self):
        """测试有照片时不触发异常"""
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            photo_count=3,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 0


class TestTimeoutRule:
    """超时规则测试"""
    
    def setup_method(self):
        self.rule = TimeoutRule()
    
    def test_detects_overdue_specimen(self):
        """测试检测超时标本"""
        registered_time = datetime.now() - timedelta(minutes=45)
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            registered_at=registered_time,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 1
        assert anomalies[0].anomaly_type == AnomalyType.TIMEOUT
    
    def test_no_timeout_if_released(self):
        """测试已放行标本不触发超时"""
        registered_time = datetime.now() - timedelta(hours=2)
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.RELEASED,
            registered_at=registered_time,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 0
    
    def test_no_timeout_if_within_limit(self):
        """测试在时限内不触发超时"""
        registered_time = datetime.now() - timedelta(minutes=15)
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            registered_at=registered_time,
        )
        
        anomalies = self.rule.check([specimen])
        
        assert len(anomalies) == 0


class TestMultiPartConfusionRule:
    """多部位混淆规则测试"""
    
    def setup_method(self):
        self.rule = MultiPartConfusionRule()
    
    def test_detects_multi_patient_different_locations(self):
        """测试检测同一患者不同部位标本"""
        specimen1 = Specimen(
            id=1,
            specimen_no="BD001",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        specimen2 = Specimen(
            id=2,
            specimen_no="BD002",
            patient_id="P001",
            patient_name="张三",
            location="右侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        anomalies = self.rule.check([specimen1, specimen2])
        
        assert len(anomalies) == 2
        assert anomalies[0].anomaly_type == AnomalyType.MULTI_PART_CONFUSION
    
    def test_no_confusion_same_location(self):
        """测试同一部位不触发混淆"""
        specimen1 = Specimen(
            id=1,
            specimen_no="BD001",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        specimen2 = Specimen(
            id=2,
            specimen_no="BD002",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        anomalies = self.rule.check([specimen1, specimen2])
        
        assert len(anomalies) == 0
    
    def test_no_confusion_different_patients(self):
        """测试不同患者不触发混淆"""
        specimen1 = Specimen(
            id=1,
            specimen_no="BD001",
            patient_id="P001",
            patient_name="张三",
            location="左侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        specimen2 = Specimen(
            id=2,
            specimen_no="BD002",
            patient_id="P002",
            patient_name="李四",
            location="右侧甲状腺",
            status=SpecimenStatus.IN_PROCESS,
        )
        
        anomalies = self.rule.check([specimen1, specimen2])
        
        assert len(anomalies) == 0


class TestRulesEngine:
    """规则引擎测试"""
    
    def setup_method(self):
        self.engine = RulesEngine()
    
    def test_validate_all_runs_all_rules(self):
        """测试执行所有规则"""
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            photo_count=0,
            has_csv=False,
            has_specimen_bag=False,
            registered_at=datetime.now() - timedelta(minutes=60),
        )
        
        anomalies = self.engine.validate_all([specimen])
        
        assert len(anomalies) > 0
    
    def test_get_anomalies_by_type(self):
        """测试按类型获取异常"""
        specimen = Specimen(
            id=1,
            specimen_no="BD001",
            patient_name="张三",
            status=SpecimenStatus.IN_PROCESS,
            photo_count=0,
        )
        
        self.engine.validate_all([specimen])
        photo_anomalies = self.engine.get_anomalies_by_type(AnomalyType.MISSING_PHOTO)
        
        assert len(photo_anomalies) == 1
    
    def test_add_and_remove_rule(self):
        """测试添加和移除规则"""
        initial_count = len(self.engine.rules)
        
        class TestRule:
            rule_name = "测试规则"
            anomaly_type = AnomalyType.TIMEOUT
            severity = "low"
            
            def check(self, specimens, current_time=None):
                return []
        
        self.engine.add_rule(TestRule())
        assert len(self.engine.rules) == initial_count + 1
        
        self.engine.remove_rule("测试规则")
        assert len(self.engine.rules) == initial_count
