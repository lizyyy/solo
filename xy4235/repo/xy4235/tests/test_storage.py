"""
存储模块测试
"""
import sys
import os
import tempfile
import shutil
from datetime import datetime, timedelta
from unittest.mock import patch

import pytest

# 添加项目根目录到路径
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from models.case import Case
from models.vital_signs import VitalSigns, VitalSignsRecord
from models.risk import Risk, RiskType, RiskStatus, RiskSeverity
from storage.case_storage import CaseStorage
from storage.review_manager import ReviewManager
from models.review import ReviewAction


class TestCaseStorage:
    """
    病例存储测试
    """
    
    def setup_method(self):
        """
        每个测试前的准备
        """
        # 创建临时目录
        self.temp_dir = tempfile.mkdtemp()
        
        # 创建存储实例
        self.storage = CaseStorage(storage_dir=self.temp_dir)
    
    def teardown_method(self):
        """
        每个测试后的清理
        """
        # 清理临时目录
        shutil.rmtree(self.temp_dir, ignore_errors=True)
    
    def test_create_storage(self):
        """
        测试创建存储
        """
        # 确保目录已创建
        assert os.path.exists(self.temp_dir)
    
    def test_save_and_load_case(self):
        """
        测试保存和加载病例
        """
        # 创建测试病例
        case = Case(
            patient_name="测试患者",
            species="犬",
            breed="拉布拉多",
            age=3,
            weight=25.5,
            surgery_type="绝育手术"
        )
        
        # 添加生命体征数据
        vs = VitalSigns()
        base_time = datetime(2024, 1, 15, 9, 0, 0)
        
        for i in range(10):
            vs.add_record(VitalSignsRecord(
                timestamp=base_time + timedelta(minutes=i),
                temperature=37.8 - i * 0.1,
                heart_rate=100,
                spo2=98
            ))
        
        case.add_vital_signs(vs)
        
        # 保存病例
        success = self.storage.save_case(case)
        assert success
        
        # 检查文件是否存在
        case_file = os.path.join(self.temp_dir, f"{case.case_id}.json")
        assert os.path.exists(case_file)
        
        # 加载病例
        loaded_case = self.storage.load_case(case.case_id)
        
        assert loaded_case is not None
        assert loaded_case.case_id == case.case_id
        assert loaded_case.patient_name == "测试患者"
        assert loaded_case.species == "犬"
        assert loaded_case.vital_signs is not None
        assert len(loaded_case.vital_signs.records) == 10
    
    def test_list_cases(self):
        """
        测试列出病例
        """
        # 初始应该为空
        cases = self.storage.list_cases()
        assert len(cases) == 0
        
        # 创建并保存两个病例
        case1 = Case(patient_name="患者1")
        case2 = Case(patient_name="患者2")
        
        self.storage.save_case(case1)
        self.storage.save_case(case2)
        
        # 列出病例
        cases = self.storage.list_cases()
        assert len(cases) == 2
        
        # 检查病例信息
        case_ids = [c['case_id'] for c in cases]
        assert case1.case_id in case_ids
        assert case2.case_id in case_ids
    
    def test_delete_case(self):
        """
        测试删除病例
        """
        # 创建并保存病例
        case = Case(patient_name="测试患者")
        self.storage.save_case(case)
        
        # 确认存在
        cases = self.storage.list_cases()
        assert len(cases) == 1
        
        # 删除病例
        success = self.storage.delete_case(case.case_id)
        assert success
        
        # 确认已删除
        cases = self.storage.list_cases()
        assert len(cases) == 0
        
        # 再次删除应该失败
        success = self.storage.delete_case(case.case_id)
        assert not success
    
    def test_load_nonexistent_case(self):
        """
        测试加载不存在的病例
        """
        loaded_case = self.storage.load_case("nonexistent_case_id")
        assert loaded_case is None
    
    def test_get_storage_path(self):
        """
        测试获取存储路径
        """
        path = self.storage.get_storage_path()
        assert path == self.temp_dir


class TestReviewManager:
    """
    复核管理器测试
    """
    
    def setup_method(self):
        """
        每个测试前的准备
        """
        self.manager = ReviewManager()
    
    def test_confirm_risk(self):
        """
        测试确认风险
        """
        # 创建病例和风险
        case = Case(patient_name="测试")
        
        risk = Risk(
            risk_type=RiskType.HYPOTHERMIA,
            severity=RiskSeverity.MODERATE,
            start_time=datetime(2024, 1, 15, 9, 0, 0),
            end_time=datetime(2024, 1, 15, 9, 30, 0)
        )
        
        risk_id = risk.risk_id
        case.add_risk(risk)
        
        # 确认风险
        success = self.manager.confirm_risk(
            case, risk_id, reviewer="测试护士", notes="确认存在低体温情况"
        )
        
        assert success
        
        # 检查风险状态
        updated_risk = case.get_risk_by_id(risk_id)
        assert updated_risk.status == RiskStatus.CONFIRMED
        assert len(updated_risk.review_history) == 1
        
        review = updated_risk.review_history[0]
        assert review.action == ReviewAction.CONFIRM
        assert review.reviewer == "测试护士"
        assert review.notes == "确认存在低体温情况"
    
    def test_dismiss_risk(self):
        """
        测试驳回风险
        """
        # 创建病例和风险
        case = Case(patient_name="测试")
        
        risk = Risk(
            risk_type=RiskType.HYPOTHERMIA,
            severity=RiskSeverity.MODERATE,
            start_time=datetime(2024, 1, 15, 9, 0, 0),
            end_time=datetime(2024, 1, 15, 9, 30, 0)
        )
        
        risk_id = risk.risk_id
        case.add_risk(risk)
        
        # 驳回风险
        success = self.manager.dismiss_risk(
            case, risk_id, reviewer="测试医生", notes="误报，体温在正常范围内"
        )
        
        assert success
        
        # 检查风险状态
        updated_risk = case.get_risk_by_id(risk_id)
        assert updated_risk.status == RiskStatus.DISMISSED
        assert len(updated_risk.review_history) == 1
        
        review = updated_risk.review_history[0]
        assert review.action == ReviewAction.DISMISS
        assert review.reviewer == "测试医生"
        assert review.notes == "误报，体温在正常范围内"
    
    def test_confirm_nonexistent_risk(self):
        """
        测试确认不存在的风险
        """
        case = Case(patient_name="测试")
        
        success = self.manager.confirm_risk(
            case, "nonexistent_id", reviewer="测试护士"
        )
        
        assert not success
    
    def test_dismiss_nonexistent_risk(self):
        """
        测试驳回不存在的风险
        """
        case = Case(patient_name="测试")
        
        success = self.manager.dismiss_risk(
            case, "nonexistent_id", reviewer="测试医生"
        )
        
        assert not success
    
    def test_review_already_reviewed_risk(self):
        """
        测试复核已复核的风险
        """
        # 创建病例和风险
        case = Case(patient_name="测试")
        
        risk = Risk(
            risk_type=RiskType.HYPOTHERMIA,
            severity=RiskSeverity.MODERATE
        )
        
        risk_id = risk.risk_id
        case.add_risk(risk)
        
        # 第一次确认
        success1 = self.manager.confirm_risk(
            case, risk_id, reviewer="护士A"
        )
        assert success1
        
        # 第二次确认应该失败（已复核）
        success2 = self.manager.confirm_risk(
            case, risk_id, reviewer="护士B"
        )
        assert not success2  # 应该失败或创建多个复核记录？
        
        # 检查复核历史
        updated_risk = case.get_risk_by_id(risk_id)
        # 注意：根据实现，可能允许多次复核或不允许
        # 这里我们检查是否至少有一次复核
        assert len(updated_risk.review_history) >= 1
    
    def test_batch_confirm_risks(self):
        """
        测试批量确认风险
        """
        case = Case(patient_name="测试")
        
        # 创建多个风险
        risk1 = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        risk2 = Risk(risk_type=RiskType.SPO2_DROP, severity=RiskSeverity.SEVERE)
        risk3 = Risk(risk_type=RiskType.HYPOTENSION, severity=RiskSeverity.MILD)
        
        risk_ids = [risk1.risk_id, risk2.risk_id, risk3.risk_id]
        
        case.add_risk(risk1)
        case.add_risk(risk2)
        case.add_risk(risk3)
        
        # 批量确认
        count = self.manager.batch_confirm_risks(
            case, risk_ids, reviewer="批量测试"
        )
        
        assert count == 3
        
        # 检查所有风险都已确认
        for risk_id in risk_ids:
            risk = case.get_risk_by_id(risk_id)
            assert risk.status == RiskStatus.CONFIRMED
    
    def test_batch_dismiss_risks(self):
        """
        测试批量驳回风险
        """
        case = Case(patient_name="测试")
        
        # 创建多个风险
        risk1 = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        risk2 = Risk(risk_type=RiskType.SPO2_DROP, severity=RiskSeverity.SEVERE)
        
        risk_ids = [risk1.risk_id, risk2.risk_id]
        
        case.add_risk(risk1)
        case.add_risk(risk2)
        
        # 批量驳回
        count = self.manager.batch_dismiss_risks(
            case, risk_ids, reviewer="批量测试"
        )
        
        assert count == 2
        
        # 检查所有风险都已驳回
        for risk_id in risk_ids:
            risk = case.get_risk_by_id(risk_id)
            assert risk.status == RiskStatus.DISMISSED
    
    def test_get_review_statistics(self):
        """
        测试获取复核统计
        """
        case = Case(patient_name="测试")
        
        # 创建不同状态的风险
        risk1 = Risk(risk_type=RiskType.HYPOTHERMIA, severity=RiskSeverity.MODERATE)
        risk2 = Risk(risk_type=RiskType.SPO2_DROP, severity=RiskSeverity.SEVERE)
        risk3 = Risk(risk_type=RiskType.HYPOTENSION, severity=RiskSeverity.MILD)
        
        case.add_risk(risk1)
        case.add_risk(risk2)
        case.add_risk(risk3)
        
        # 复核部分风险
        self.manager.confirm_risk(case, risk1.risk_id, reviewer="测试")
        self.manager.dismiss_risk(case, risk2.risk_id, reviewer="测试")
        
        # 获取统计
        stats = self.manager.get_review_statistics(case)
        
        assert stats is not None
        assert 'total_risks' in stats
        assert 'by_status' in stats
        assert 'by_severity' in stats
        assert 'by_type' in stats
        
        # 检查计数
        assert stats['total_risks'] == 3
        assert stats['by_status']['PENDING'] == 1
        assert stats['by_status']['CONFIRMED'] == 1
        assert stats['by_status']['DISMISSED'] == 1
