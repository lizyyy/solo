#!/usr/bin/env python3
"""
测试数据模型层
验证订单、患者、STL文件等数据结构的正确性
"""

import sys
from pathlib import Path
from datetime import datetime, date
from typing import Optional

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


class TestOrderModel:
    """测试订单数据模型"""
    
    def test_order_creation(self):
        """测试订单创建"""
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15),
            notes="左上切牙",
            is_urgent=False
        )
        
        assert order.order_id == "ORD2024001"
        assert order.model_id == "MDL001"
        assert order.doctor_name == "张医生"
        assert order.patient_name == "张三"
        assert order.tooth_position == "#11-#12"
        assert order.restoration_type == "烤瓷冠"
        assert order.notes == "左上切牙"
        assert order.is_urgent == False
        print("✅ test_order_creation 通过")
    
    def test_order_to_dict(self):
        """测试订单序列化为字典"""
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15),
            notes="左上切牙",
            is_urgent=True
        )
        
        data = order.to_dict()
        
        assert data["order_id"] == "ORD2024001"
        assert data["model_id"] == "MDL001"
        assert data["is_urgent"] == True
        print("✅ test_order_to_dict 通过")
    
    def test_order_from_dict(self):
        """测试从字典反序列化订单"""
        data = {
            "order_id": "ORD2024002",
            "model_id": "MDL002",
            "doctor_name": "李医生",
            "patient_name": "李四",
            "patient_gender": "女",
            "patient_age": 38,
            "tooth_position": "#14-#15",
            "restoration_type": "全瓷冠",
            "order_date": "2024-01-14",
            "notes": "右上后牙",
            "is_urgent": False
        }
        
        order = Order.from_dict(data)
        
        assert order.order_id == "ORD2024002"
        assert order.model_id == "MDL002"
        assert order.doctor_name == "李医生"
        assert order.patient_name == "李四"
        assert order.patient_gender == "女"
        assert order.patient_age == 38
        assert order.is_urgent == False
        print("✅ test_order_from_dict 通过")


class TestPatientModel:
    """测试患者数据模型"""
    
    def test_patient_creation(self):
        """测试患者创建"""
        patient = Patient(
            name="张三",
            gender="男",
            age=45,
            contact="13800138000",
            address="北京市朝阳区"
        )
        
        assert patient.name == "张三"
        assert patient.gender == "男"
        assert patient.age == 45
        assert patient.contact == "13800138000"
        assert patient.address == "北京市朝阳区"
        print("✅ test_patient_creation 通过")


class TestPhotoModel:
    """测试照片数据模型"""
    
    def test_photo_creation(self):
        """测试照片创建"""
        photo = Photo(
            file_path=Path("/test/MDL001_咬合关系.jpg"),
            model_id="MDL001",
            photo_type=PhotoType.OCCLUSION,
            taken_time=datetime(2024, 1, 15, 10, 30, 0)
        )
        
        assert photo.model_id == "MDL001"
        assert photo.photo_type == PhotoType.OCCLUSION
        assert photo.taken_time == datetime(2024, 1, 15, 10, 30, 0)
        print("✅ test_photo_creation 通过")
    
    def test_photo_type_enum(self):
        """测试照片类型枚举"""
        assert PhotoType.OCCLUSION.value == "咬合关系"
        assert PhotoType.FRONT.value == "模型正面"
        assert PhotoType.SIDE.value == "模型侧面"
        assert PhotoType.OCCLUSAL_SURFACE.value == "模型咬合面"
        assert PhotoType.OTHER.value == "其他"
        print("✅ test_photo_type_enum 通过")


class TestSTLFileModel:
    """测试STL文件数据模型"""
    
    def test_stl_file_creation(self):
        """测试STL文件创建"""
        stl_file = STLFile(
            file_path=Path("/test/MDL001_upper.stl"),
            model_id="MDL001",
            jaw="upper",
            triangle_count=1000,
            vertex_count=3000
        )
        
        assert stl_file.model_id == "MDL001"
        assert stl_file.jaw == "upper"
        assert stl_file.triangle_count == 1000
        assert stl_file.vertex_count == 3000
        print("✅ test_stl_file_creation 通过")


class TestProcessingStatusModel:
    """测试加工状态数据模型"""
    
    def test_processing_status_creation(self):
        """测试加工状态创建"""
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date(2024, 1, 15),
            expected_delivery_date=date(2024, 1, 20),
            responsible_person="张工"
        )
        
        assert status.current_status == OrderStatus.PROCESSING
        assert status.received_date == date(2024, 1, 15)
        assert status.expected_delivery_date == date(2024, 1, 20)
        assert status.responsible_person == "张工"
        assert status.rework_count == 0
        print("✅ test_processing_status_creation 通过")
    
    def test_rework_record(self):
        """测试返工记录"""
        rework = ReworkRecord(
            count=1,
            reason="咬合过高",
            date=date(2024, 1, 16),
            responsible_person="李工",
            solution="调磨咬合"
        )
        
        assert rework.count == 1
        assert rework.reason == "咬合过高"
        assert rework.date == date(2024, 1, 16)
        assert rework.responsible_person == "李工"
        assert rework.solution == "调磨咬合"
        print("✅ test_rework_record 通过")
    
    def test_processing_status_with_rework(self):
        """测试带返工记录的加工状态"""
        rework1 = ReworkRecord(
            count=1,
            reason="边缘不密合",
            date=date(2024, 1, 13),
            responsible_person="张工",
            solution="重新制作"
        )
        rework2 = ReworkRecord(
            count=2,
            reason="颜色偏差",
            date=date(2024, 1, 15),
            responsible_person="张工",
            solution="重新比色"
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.REWORKING,
            received_date=date(2024, 1, 12),
            expected_delivery_date=date(2024, 1, 17),
            responsible_person="张工",
            rework_records=[rework1, rework2]
        )
        
        assert status.rework_count == 2
        assert len(status.rework_records) == 2
        assert status.rework_records[0].reason == "边缘不密合"
        assert status.rework_records[1].reason == "颜色偏差"
        print("✅ test_processing_status_with_rework 通过")


class TestIssueModel:
    """测试问题数据模型"""
    
    def test_issue_creation(self):
        """测试问题创建"""
        issue = Issue(
            issue_type=IssueType.MISSING_PHOTO,
            severity=IssueSeverity.CRITICAL,
            title="缺少咬合关系照片",
            description="模型MDL002缺少必需的咬合关系照片",
            model_id="MDL002"
        )
        
        assert issue.issue_type == IssueType.MISSING_PHOTO
        assert issue.severity == IssueSeverity.CRITICAL
        assert issue.title == "缺少咬合关系照片"
        assert issue.model_id == "MDL002"
        assert issue.review_status == ReviewStatus.PENDING
        print("✅ test_issue_creation 通过")
    
    def test_issue_type_enum(self):
        """测试问题类型枚举"""
        assert IssueType.MISSING_FILE.value == "文件缺失"
        assert IssueType.ID_INCONSISTENCY.value == "编号不一致"
        assert IssueType.PHOTO_TIME_ANOMALY.value == "照片时间异常"
        assert IssueType.REWORK_STATUS_ISSUE.value == "返工状态问题"
        assert IssueType.OVERDUE_RISK.value == "超期风险"
        print("✅ test_issue_type_enum 通过")
    
    def test_issue_severity_enum(self):
        """测试问题严重程度枚举"""
        assert IssueSeverity.CRITICAL.value == "严重"
        assert IssueSeverity.HIGH.value == "高"
        assert IssueSeverity.MEDIUM.value == "中"
        assert IssueSeverity.LOW.value == "低"
        print("✅ test_issue_severity_enum 通过")


class TestWorkbenchModel:
    """测试工作台数据模型"""
    
    def test_workbench_creation(self):
        """测试工作台创建"""
        workbench = Workbench(name="今日复核台")
        
        assert workbench.name == "今日复核台"
        assert workbench.item_count == 0
        assert workbench.total_issues == 0
        print("✅ test_workbench_creation 通过")
    
    def test_workbench_item_creation(self):
        """测试工作台项创建"""
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15)
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date(2024, 1, 15),
            expected_delivery_date=date(2024, 1, 20)
        )
        
        item = WorkbenchItem(
            order=order,
            processing_status=status
        )
        
        assert item.order.order_id == "ORD2024001"
        assert item.processing_status.current_status == OrderStatus.PROCESSING
        assert len(item.photos) == 0
        assert len(item.stl_files) == 0
        assert len(item.issues) == 0
        print("✅ test_workbench_item_creation 通过")
    
    def test_workbench_add_item(self):
        """测试工作台添加项"""
        workbench = Workbench(name="测试复核台")
        
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15)
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date(2024, 1, 15),
            expected_delivery_date=date(2024, 1, 20)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        assert workbench.item_count == 1
        assert workbench.get_item_by_model_id("MDL001") is not None
        assert workbench.get_item_by_order_id("ORD2024001") is not None
        print("✅ test_workbench_add_item 通过")
    
    def test_workbench_issue_statistics(self):
        """测试工作台问题统计"""
        workbench = Workbench(name="测试复核台")
        
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15)
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date(2024, 1, 15),
            expected_delivery_date=date(2024, 1, 20)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        
        issue1 = Issue(
            issue_type=IssueType.MISSING_PHOTO,
            severity=IssueSeverity.CRITICAL,
            title="缺少照片",
            model_id="MDL001"
        )
        issue2 = Issue(
            issue_type=IssueType.OVERDUE_RISK,
            severity=IssueSeverity.HIGH,
            title="即将超期",
            model_id="MDL001"
        )
        
        item.add_issue(issue1)
        item.add_issue(issue2)
        workbench.add_item(item)
        
        assert workbench.total_issues == 2
        assert workbench.total_unresolved_issues == 2
        assert workbench.critical_issue_count == 1
        assert workbench.high_issue_count == 1
        print("✅ test_workbench_issue_statistics 通过")
    
    def test_workbench_serialization(self):
        """测试工作台序列化和反序列化"""
        workbench = Workbench(name="测试复核台")
        
        order = Order(
            order_id="ORD2024001",
            model_id="MDL001",
            doctor_name="张医生",
            patient_name="张三",
            tooth_position="#11-#12",
            restoration_type="烤瓷冠",
            order_date=date(2024, 1, 15)
        )
        
        status = ProcessingStatus(
            current_status=OrderStatus.PROCESSING,
            received_date=date(2024, 1, 15),
            expected_delivery_date=date(2024, 1, 20)
        )
        
        item = WorkbenchItem(order=order, processing_status=status)
        workbench.add_item(item)
        
        data = workbench.to_dict()
        restored = Workbench.from_dict(data)
        
        assert restored.name == "测试复核台"
        assert restored.item_count == 1
        assert restored.get_item_by_model_id("MDL001").order.order_id == "ORD2024001"
        print("✅ test_workbench_serialization 通过")


def main():
    """运行所有测试"""
    print("=" * 60)
    print("数据模型层测试")
    print("=" * 60)
    
    print("\n[1/7] 测试订单模型...")
    order_tests = TestOrderModel()
    order_tests.test_order_creation()
    order_tests.test_order_to_dict()
    order_tests.test_order_from_dict()
    
    print("\n[2/7] 测试患者模型...")
    patient_tests = TestPatientModel()
    patient_tests.test_patient_creation()
    
    print("\n[3/7] 测试照片模型...")
    photo_tests = TestPhotoModel()
    photo_tests.test_photo_creation()
    photo_tests.test_photo_type_enum()
    
    print("\n[4/7] 测试STL文件模型...")
    stl_tests = TestSTLFileModel()
    stl_tests.test_stl_file_creation()
    
    print("\n[5/7] 测试加工状态模型...")
    status_tests = TestProcessingStatusModel()
    status_tests.test_processing_status_creation()
    status_tests.test_rework_record()
    status_tests.test_processing_status_with_rework()
    
    print("\n[6/7] 测试问题模型...")
    issue_tests = TestIssueModel()
    issue_tests.test_issue_creation()
    issue_tests.test_issue_type_enum()
    issue_tests.test_issue_severity_enum()
    
    print("\n[7/7] 测试工作台模型...")
    workbench_tests = TestWorkbenchModel()
    workbench_tests.test_workbench_creation()
    workbench_tests.test_workbench_item_creation()
    workbench_tests.test_workbench_add_item()
    workbench_tests.test_workbench_issue_statistics()
    workbench_tests.test_workbench_serialization()
    
    print("\n" + "=" * 60)
    print("✅ 所有数据模型层测试通过！")
    print("=" * 60)


if __name__ == "__main__":
    main()
