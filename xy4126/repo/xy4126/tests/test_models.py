import pytest
from datetime import datetime

from models import (
    CollectionItem,
    Box,
    Seal,
    EnvironmentRecord,
    Photo,
    SignRecord,
    ValidationIssue,
    ReviewNote,
    HandoverChain,
    Session,
    IssueSeverity,
    IssueType,
    ReviewStatus,
)


class TestCollectionItem:
    def test_create_collection_item(self):
        item = CollectionItem(
            item_id="CW001",
            name="清明上河图",
            category="绘画",
            description="北宋张择端作品",
            box_id="B001"
        )
        
        assert item.item_id == "CW001"
        assert item.name == "清明上河图"
        assert item.category == "绘画"
        assert item.box_id == "B001"
    
    def test_collection_item_defaults(self):
        item = CollectionItem(item_id="TEST001", name="测试藏品")
        
        assert item.category == ""
        assert item.description == ""
        assert item.box_id is None
        assert item.metadata == {}


class TestBox:
    def test_create_box(self):
        box = Box(
            box_id="B001",
            description="标准文物箱",
            type="标准",
            item_ids=["CW001", "CW002"],
            seal_ids=["S001", "S002"]
        )
        
        assert box.box_id == "B001"
        assert box.description == "标准文物箱"
        assert len(box.item_ids) == 2
        assert len(box.seal_ids) == 2


class TestSeal:
    def test_create_seal(self):
        applied_time = datetime(2024, 1, 15, 9, 0, 0)
        removed_time = datetime(2024, 1, 16, 14, 30, 0)
        
        seal = Seal(
            seal_id="S001",
            box_id="B001",
            applied_at=applied_time,
            removed_at=removed_time,
            applied_by="张三",
            removed_by="李四",
            next_seal_id="S002",
            is_intact=True
        )
        
        assert seal.seal_id == "S001"
        assert seal.box_id == "B001"
        assert seal.applied_at == applied_time
        assert seal.removed_at == removed_time
        assert seal.is_intact is True


class TestEnvironmentRecord:
    def test_create_env_record_normal(self):
        record = EnvironmentRecord(
            record_id="REC001",
            logger_id="LOG001",
            box_id="B001",
            timestamp=datetime(2024, 1, 15, 9, 0, 0),
            temperature=22.0,
            humidity=52.0
        )
        
        assert record.record_id == "REC001"
        assert record.temperature == 22.0
        assert record.humidity == 52.0
        assert record.is_temperature_exceeded is False
        assert record.is_humidity_exceeded is False
    
    def test_create_env_record_temp_exceeded(self):
        record = EnvironmentRecord(
            record_id="REC002",
            logger_id="LOG001",
            temperature=26.0,
            humidity=50.0,
            temp_max=24.0
        )
        
        assert record.is_temperature_exceeded is True
        assert record.is_humidity_exceeded is False
    
    def test_create_env_record_humidity_exceeded(self):
        record = EnvironmentRecord(
            record_id="REC003",
            logger_id="LOG001",
            temperature=22.0,
            humidity=70.0,
            humidity_max=65.0
        )
        
        assert record.is_temperature_exceeded is False
        assert record.is_humidity_exceeded is True


class TestPhoto:
    def test_create_photo(self):
        photo = Photo(
            photo_id="P001",
            filename="IMG_0001.jpg",
            description="装箱前检查",
            category="packing",
            box_id="B001",
            item_id="CW001",
            timestamp=datetime(2024, 1, 15, 8, 30, 0),
            photographer="张三"
        )
        
        assert photo.photo_id == "P001"
        assert photo.filename == "IMG_0001.jpg"
        assert photo.category == "packing"


class TestSignRecord:
    def test_create_sign_record(self):
        sign = SignRecord(
            sign_id="SIGN001",
            person_name="张三",
            role="博物馆馆员",
            action="装箱确认",
            box_id="B001",
            item_id="CW001",
            seal_id="S001",
            timestamp=datetime(2024, 1, 15, 8, 30, 0),
            location="故宫博物院文物库",
            notes="检查无误",
            order=0
        )
        
        assert sign.person_name == "张三"
        assert sign.action == "装箱确认"
        assert sign.order == 0


class TestValidationIssue:
    def test_create_issue(self):
        issue = ValidationIssue(
            issue_id="ISSUE001",
            issue_type=IssueType.DUPLICATE_PACKING,
            severity=IssueSeverity.CRITICAL,
            message="藏品被重复装箱",
            affected_items=["CW001"],
            affected_boxes=["B001", "B002"],
            review_status=ReviewStatus.PENDING
        )
        
        assert issue.issue_id == "ISSUE001"
        assert issue.issue_type == IssueType.DUPLICATE_PACKING
        assert issue.severity == IssueSeverity.CRITICAL
        assert issue.review_status == ReviewStatus.PENDING


class TestReviewNote:
    def test_create_review_note(self):
        note = ReviewNote(
            note_id="NOTE001",
            issue_id="ISSUE001",
            author="管理员",
            content="已核实，确认是数据录入错误",
            status_change=ReviewStatus.RESOLVED
        )
        
        assert note.note_id == "NOTE001"
        assert note.author == "管理员"
        assert note.status_change == ReviewStatus.RESOLVED


class TestSession:
    def test_create_session(self):
        session = Session(
            session_id="SESSION001",
            name="测试借展",
            description="这是一个测试会话"
        )
        
        assert session.session_id == "SESSION001"
        assert session.name == "测试借展"
        assert session.items == {}
        assert session.boxes == {}
        assert session.issues == {}
    
    def test_add_items_to_session(self):
        session = Session(session_id="TEST001", name="测试会话")
        
        item1 = CollectionItem(item_id="CW001", name="清明上河图", box_id="B001")
        item2 = CollectionItem(item_id="CW002", name="千里江山图", box_id="B001")
        
        session.items[item1.item_id] = item1
        session.items[item2.item_id] = item2
        
        assert len(session.items) == 2
        assert "CW001" in session.items
        assert "CW002" in session.items
    
    def test_session_to_dict(self):
        session = Session(
            session_id="TEST001",
            name="测试会话",
            description="测试描述"
        )
        
        data = session.to_dict()
        
        assert data["session_id"] == "TEST001"
        assert data["name"] == "测试会话"
        assert data["description"] == "测试描述"
    
    def test_session_from_dict(self):
        data = {
            "session_id": "TEST002",
            "name": "从字典创建的会话",
            "description": "测试",
            "created_at": "2024-01-15T09:00:00",
            "updated_at": "2024-01-15T10:00:00",
            "metadata": {}
        }
        
        session = Session.from_dict(data)
        
        assert session.session_id == "TEST002"
        assert session.name == "从字典创建的会话"
        assert session.created_at == datetime(2024, 1, 15, 9, 0, 0)


class TestEnums:
    def test_issue_severity_values(self):
        assert IssueSeverity.CRITICAL.value == "critical"
        assert IssueSeverity.WARNING.value == "warning"
        assert IssueSeverity.INFO.value == "info"
    
    def test_issue_type_values(self):
        assert IssueType.DUPLICATE_PACKING.value == "duplicate_packing"
        assert IssueType.SEAL_BROKEN_CHAIN.value == "seal_broken_chain"
        assert IssueType.TIME_GAP.value == "time_gap"
        assert IssueType.PHOTO_MISSING.value == "photo_missing"
        assert IssueType.SIGN_ORDER_ERROR.value == "sign_order_error"
        assert IssueType.TEMP_HUMIDITY_EXCEEDED.value == "temp_humidity_exceeded"
    
    def test_review_status_values(self):
        assert ReviewStatus.PENDING.value == "pending"
        assert ReviewStatus.REVIEWED.value == "reviewed"
        assert ReviewStatus.RESOLVED.value == "resolved"
        assert ReviewStatus.DISMISSED.value == "dismissed"
