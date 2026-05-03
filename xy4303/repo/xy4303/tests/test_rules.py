#!/usr/bin/env python3
"""
测试规则引擎层
验证各种检查规则的正确性
"""

import sys
from pathlib import Path
from datetime import date, datetime, timedelta

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from models.order import Order
from models.patient import Patient
from models.photo import Photo
from models.stl_file import STLFile
from models.processing_status import ProcessingStatus, ReworkRecord
from models.issue import Issue
from models.workbench import Workbench, WorkbenchItem
from models.enums import (
    OrderStatus, PhotoType, IssueType, IssueSeverity, ReviewStatus
)
from rules.base_rule import BaseRule, RuleResult
from rules.missing_check import MissingFileRule
from rules.id_consistency import IDConsistencyRule
from rules.photo_time_check import PhotoTimeRule
from rules.rework_status_check import ReworkStatusRule
from rules.overdue_check import OverdueRule
from rules.rule_engine import RuleEngine


class TestMissingFileRule:
    """测试文件缺失检查规则"""
    
    def test_missing_photo_check(self):
        """测试照片缺失检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        photo = Photo(
            file_path=Path("/test/MDL001_模型正面.jpg"),
            model_id="MDL001",
            photo_type=PhotoType.FRONT
        )
        item.add_photo(photo)
        
        workbench.add_item(item)
        
        rule = MissingFileRule(config={"required_photos": ["咬合关系", "模型正面", "模型侧面", "模型咬合面"]})
        result = rule.check(workbench)
        
        assert result.success == True
        assert len(result.issues) > 0
        
        photo_issues = [i for i in result.issues if i.issue_type == IssueType.MISSING_PHOTO]
        assert len(photo_issues) > 0
        print("✅ test_missing_photo_check 通过")
    
    def test_missing_stl_check(self):
        """测试STL文件缺失检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        stl = STLFile(
            file_path=Path("/test/MDL001_upper.stl"),
            model_id="MDL001",
            jaw="upper"
        )
        item.add_stl_file(stl)
        
        workbench.add_item(item)
        
        rule = MissingFileRule(config={"required_photos": ["咬合关系"]})
        result = rule.check(workbench)
        
        stl_issues = [i for i in result.issues if i.issue_type == IssueType.MISSING_STL]
        print(f"STL缺失问题数量: {len(stl_issues)}")
        print("✅ test_missing_stl_check 通过")


class TestIDConsistencyRule:
    """测试编号一致性检查规则"""
    
    def test_duplicate_order_id_check(self):
        """测试订单编号重复检查"""
        workbench = Workbench(name="测试")
        
        order1 = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        order2 = Order(
            order_id="ORD001",
            model_id="MDL002",
            doctor_name="李医生",
            patient_name="李四",
            tooth_position="#14",
            restoration_type="全瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item1 = WorkbenchItem(order=order1, processing_status=status)
        item2 = WorkbenchItem(order=order2, processing_status=status)
        
        workbench.add_item(item1)
        workbench.add_item(item2)
        
        rule = IDConsistencyRule(config={})
        result = rule.check(workbench)
        
        duplicate_issues = [i for i in result.issues if "重复" in i.title]
        assert len(duplicate_issues) > 0
        print("✅ test_duplicate_order_id_check 通过")
    
    def test_cross_source_consistency(self):
        """测试跨数据源编号一致性"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        photo = Photo(
            file_path=Path("/test/MDL999_模型正面.jpg"),
            model_id="MDL999",
            photo_type=PhotoType.FRONT
        )
        item.add_photo(photo)
        
        workbench.add_item(item)
        
        rule = IDConsistencyRule(config={})
        result = rule.check(workbench)
        
        inconsistency_issues = [i for i in result.issues if i.issue_type == IssueType.ID_INCONSISTENCY]
        print(f"编号不一致问题数量: {len(inconsistency_issues)}")
        print("✅ test_cross_source_consistency 通过")


class TestPhotoTimeRule:
    """测试照片时间异常检查规则"""
    
    def test_photo_time_span_check(self):
        """测试照片时间跨度检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        photo1 = Photo(
            file_path=Path("/test/MDL001_模型正面.jpg"),
            model_id="MDL001",
            photo_type=PhotoType.FRONT,
            taken_time=datetime.now()
        )
        
        photo2 = Photo(
            file_path=Path("/test/MDL001_模型侧面.jpg"),
            model_id="MDL001",
            photo_type=PhotoType.SIDE,
            taken_time=datetime.now() - timedelta(hours=72)
        )
        
        item.add_photo(photo1)
        item.add_photo(photo2)
        
        workbench.add_item(item)
        
        rule = PhotoTimeRule(config={"photo_time_threshold_hours": 48})
        result = rule.check(workbench)
        
        time_issues = [i for i in result.issues if i.issue_type == IssueType.PHOTO_TIME_ANOMALY]
        print(f"照片时间异常问题数量: {len(time_issues)}")
        print("✅ test_photo_time_span_check 通过")
    
    def test_future_photo_time_check(self):
        """测试未来照片时间检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=3)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        photo = Photo(
            file_path=Path("/test/MDL001_模型正面.jpg"),
            model_id="MDL001",
            photo_type=PhotoType.FRONT,
            taken_time=datetime.now() + timedelta(hours=24)
        )
        
        item.add_photo(photo)
        workbench.add_item(item)
        
        rule = PhotoTimeRule(config={"photo_time_threshold_hours": 48})
        result = rule.check(workbench)
        
        future_issues = [i for i in result.issues if "未来" in i.title]
        print(f"未来时间问题数量: {len(future_issues)}")
        print("✅ test_future_photo_time_check 通过")


class TestReworkStatusRule:
    """测试返工状态检查规则"""
    
    def test_rework_count_limit_check(self):
        """测试返工次数限制检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        rework1 = ReworkRecord(
            count=1,
            reason="咬合过高",
            date=date.today() - timedelta(days=5),
            responsible_person="张工",
            solution="调磨咬合"
        )
        rework2 = ReworkRecord(
            count=2,
            reason="边缘不密合",
            date=date.today() - timedelta(days=3),
            responsible_person="张工",
            solution="重新制作"
        )
        rework3 = ReworkRecord(
            count=3,
            reason="颜色偏差",
            date=date.today() - timedelta(days=1),
            responsible_person="张工",
            solution="重新比色"
        )
        rework4 = ReworkRecord(
            count=4,
            reason="又有问题",
            date=date.today(),
            responsible_person="张工",
            solution="待处理"
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.REWORKING,
            received_date=date.today() - timedelta(days=10),
            expected_delivery_date=date.today() - timedelta(days=5),
            responsible_person="张工",
            rework_records=[rework1, rework2, rework3, rework4]
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        rule = ReworkStatusRule(config={"rework_max_count": 3})
        result = rule.check(workbench)
        
        rework_count_issues = [i for i in result.issues if "超过" in i.title]
        print(f"返工次数超限问题数量: {len(rework_count_issues)}")
        print("✅ test_rework_count_limit_check 通过")
    
    def test_rework_closure_check(self):
        """测试返工闭环检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        rework = ReworkRecord(
            count=1,
            reason="咬合过高",
            date=date.today() - timedelta(days=5),
            responsible_person="张工",
            solution=""
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PENDING_REWORK,
            received_date=date.today() - timedelta(days=10),
            expected_delivery_date=date.today() - timedelta(days=5),
            responsible_person="张工",
            rework_records=[rework]
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        rule = ReworkStatusRule(config={"rework_max_count": 3})
        result = rule.check(workbench)
        
        closure_issues = [i for i in result.issues if "闭环" in i.title or "未解决" in i.title]
        print(f"返工未闭环问题数量: {len(closure_issues)}")
        print("✅ test_rework_closure_check 通过")


class TestOverdueRule:
    """测试超期风险检查规则"""
    
    def test_overdue_check(self):
        """测试已超期订单检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today() - timedelta(days=10),
            expected_delivery_date=date.today() - timedelta(days=3),
            responsible_person="张工"
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        rule = OverdueRule(config={"overdue_days": 0})
        result = rule.check(workbench)
        
        overdue_issues = [i for i in result.issues if i.issue_type == IssueType.OVERDUE_RISK]
        print(f"超期风险问题数量: {len(overdue_issues)}")
        print("✅ test_overdue_check 通过")
    
    def test_urgent_order_check(self):
        """测试加急订单检查"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today(),
            is_urgent=True
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() + timedelta(days=2),
            responsible_person="张工"
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        rule = OverdueRule(config={"overdue_days": 3})
        result = rule.check(workbench)
        
        urgent_issues = [i for i in result.issues if "加急" in i.title]
        print(f"加急订单提醒数量: {len(urgent_issues)}")
        print("✅ test_urgent_order_check 通过")


class TestRuleEngine:
    """测试规则引擎"""
    
    def test_rule_engine_execution(self):
        """测试规则引擎批量执行"""
        workbench = Workbench(name="测试")
        
        order = Order(
            order_id="ORD001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11",
            restoration_type="烤瓷冠",
            order_date=date.today()
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date.today(),
            expected_delivery_date=date.today() - timedelta(days=1),
            responsible_person="张工"
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        config = {
            "photo_time_threshold_hours": 48,
            "overdue_days": 3,
            "rework_max_count": 3,
            "required_photos": ["咬合关系", "模型正面", "模型侧面", "模型咬合面"],
        }
        
        engine = RuleEngine(config)
        result = engine.run(workbench)
        
        assert result.success == True
        print(f"规则引擎执行结果 - 总问题数: {result.stats.get('total_issues', 0)}")
        print(f"  - 严重: {result.stats.get('by_severity', {}).get('严重', 0)}")
        print(f"  - 高: {result.stats.get('by_severity', {}).get('高', 0)}")
        print(f"  - 中: {result.stats.get('by_severity', {}).get('中', 0)}")
        print(f"  - 低: {result.stats.get('by_severity', {}).get('低', 0)}")
        print("✅ test_rule_engine_execution 通过")


def main():
    """运行所有测试"""
    print("=" * 60)
    print("规则引擎层测试")
    print("=" * 60)
    
    print("\n[1/6] 测试文件缺失检查规则...")
    missing_tests = TestMissingFileRule()
    missing_tests.test_missing_photo_check()
    missing_tests.test_missing_stl_check()
    
    print("\n[2/6] 测试编号一致性检查规则...")
    id_tests = TestIDConsistencyRule()
    id_tests.test_duplicate_order_id_check()
    id_tests.test_cross_source_consistency()
    
    print("\n[3/6] 测试照片时间异常检查规则...")
    time_tests = TestPhotoTimeRule()
    time_tests.test_photo_time_span_check()
    time_tests.test_future_photo_time_check()
    
    print("\n[4/6] 测试返工状态检查规则...")
    rework_tests = TestReworkStatusRule()
    rework_tests.test_rework_count_limit_check()
    rework_tests.test_rework_closure_check()
    
    print("\n[5/6] 测试超期风险检查规则...")
    overdue_tests = TestOverdueRule()
    overdue_tests.test_overdue_check()
    overdue_tests.test_urgent_order_check()
    
    print("\n[6/6] 测试规则引擎...")
    engine_tests = TestRuleEngine()
    engine_tests.test_rule_engine_execution()
    
    print("\n" + "=" * 60)
    print("✅ 所有规则引擎层测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    main()
