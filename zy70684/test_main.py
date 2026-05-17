import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from datetime import datetime, timedelta

from main import app
from database import get_db, Base
from models import Room, Course, Student, DeviceRequirement, RoomSwap, DeviceType, SwapStatus, RoomDevice


SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


app.dependency_overrides[get_db] = override_get_db
client = TestClient(app)


@pytest.fixture(scope="function")
def db_session():
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()
        Base.metadata.drop_all(bind=engine)


def setup_test_data(db):
    room1 = Room(name="测试教室A", location="A栋", capacity=50)
    room2 = Room(name="测试教室B", location="B栋", capacity=30)
    db.add_all([room1, room2])
    db.commit()
    
    db.add(RoomDevice(room_id=room1.id, device_type=DeviceType.PROJECTOR, quantity=1))
    db.add(RoomDevice(room_id=room1.id, device_type=DeviceType.WHITEBOARD, quantity=2))
    db.add(RoomDevice(room_id=room2.id, device_type=DeviceType.PROJECTOR, quantity=1))
    db.commit()
    
    course = Course(
        name="测试课程",
        code="TEST001",
        instructor="测试老师",
        student_count=25,
        original_room_id=room1.id,
        scheduled_time=datetime.now() + timedelta(days=1),
        duration_minutes=120
    )
    db.add(course)
    db.commit()
    
    db.add(DeviceRequirement(
        course_id=course.id,
        device_type=DeviceType.PROJECTOR,
        min_quantity=1
    ))
    db.add(DeviceRequirement(
        course_id=course.id,
        device_type=DeviceType.WHITEBOARD,
        min_quantity=1
    ))
    
    for i in range(5):
        db.add(Student(
            course_id=course.id,
            name=f"测试学生{i+1}",
            phone=f"1380000000{i}",
            email=f"student{i+1}@test.com"
        ))
    
    db.commit()
    return room1, room2, course


class TestRoomAPI:
    def test_create_room(self, db_session):
        response = client.post(
            "/api/rooms/",
            json={"name": "新教室", "location": "C栋", "capacity": 40}
        )
        assert response.status_code == 200
        data = response.json()
        assert data["name"] == "新教室"
        assert data["capacity"] == 40
    
    def test_get_rooms(self, db_session):
        db_session.add(Room(name="教室1", capacity=30))
        db_session.add(Room(name="教室2", capacity=50))
        db_session.commit()
        
        response = client.get("/api/rooms/")
        assert response.status_code == 200
        assert len(response.json()) >= 2


class TestCourseAPI:
    def test_create_course(self, db_session):
        room = Room(name="课程教室", capacity=50)
        db_session.add(room)
        db_session.commit()
        
        response = client.post(
            "/api/courses/",
            json={
                "name": "新课程",
                "code": "NEW001",
                "instructor": "李老师",
                "student_count": 30,
                "original_room_id": room.id,
                "scheduled_time": (datetime.now() + timedelta(days=1)).isoformat(),
                "duration_minutes": 120,
                "device_requirements": [],
                "students": []
            }
        )
        assert response.status_code == 200
        assert response.json()["name"] == "新课程"


class TestRoomSwapAPI:
    def test_create_swap(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        response = client.post(
            "/api/swaps/",
            json={
                "course_id": course.id,
                "original_room_id": room1.id,
                "target_room_id": room2.id,
                "reason": "设备维护",
                "scheduled_time": course.scheduled_time.isoformat(),
                "created_by": "管理员"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["status"] == SwapStatus.DRAFT
        assert data["check_capacity_pass"] == True
    
    def test_get_swaps(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-TEST001",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.DRAFT
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.get("/api/swaps/")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestStatusFlow:
    def test_complete_status_flow(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap_response = client.post(
            "/api/swaps/",
            json={
                "course_id": course.id,
                "original_room_id": room1.id,
                "target_room_id": room2.id,
                "reason": "测试流程",
                "scheduled_time": course.scheduled_time.isoformat(),
                "created_by": "流程测试"
            }
        )
        swap_id = swap_response.json()["id"]
        
        response = client.patch(
            f"/api/swaps/{swap_id}/status",
            json={"new_status": SwapStatus.PENDING_APPROVAL, "operator": "审批人"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == SwapStatus.PENDING_APPROVAL
        
        response = client.patch(
            f"/api/swaps/{swap_id}/status",
            json={"new_status": SwapStatus.APPROVED, "operator": "审批人"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == SwapStatus.APPROVED
    
    def test_invalid_status_transition(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-INVALID",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.CLOSED
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.patch(
            f"/api/swaps/{swap.id}/status",
            json={"new_status": SwapStatus.DRAFT, "operator": "测试"}
        )
        assert response.status_code == 400


class TestNotificationAPI:
    def test_create_notifications(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-NOTIFY",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.APPROVED,
            check_capacity_pass=True,
            check_devices_pass=True
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.post(f"/api/swaps/{swap.id}/notifications")
        assert response.status_code == 200
        assert response.json()["count"] == 5
    
    def test_confirm_notification(self, db_session):
        from models import Notification, NotificationStatus
        
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-CONFIRM",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.APPROVED
        )
        db_session.add(swap)
        db_session.commit()
        
        student = db_session.query(Student).filter(Student.course_id == course.id).first()
        notification = Notification(
            swap_id=swap.id,
            student_id=student.id,
            content="测试通知",
            status=NotificationStatus.PENDING
        )
        db_session.add(notification)
        db_session.commit()
        
        response = client.patch(
            f"/api/notifications/{notification.id}/confirm?confirmed_by=测试用户"
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == NotificationStatus.CONFIRMED


class TestSignInCodeAPI:
    def test_refresh_sign_in_code(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-CODE",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试"
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.post(
            f"/api/swaps/{swap.id}/sign-in-code",
            json={"new_code": "SIGN-123456", "operator": "管理员"}
        )
        assert response.status_code == 200
        assert response.json()["data"]["code"] == "SIGN-123456"
        
        response = client.get(f"/api/swaps/{swap.id}/sign-in-code")
        assert response.status_code == 200
        assert response.json()["code"] == "SIGN-123456"


class TestAuditLog:
    def test_audit_log_created(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap_response = client.post(
            "/api/swaps/",
            json={
                "course_id": course.id,
                "original_room_id": room1.id,
                "target_room_id": room2.id,
                "reason": "审计测试",
                "scheduled_time": course.scheduled_time.isoformat(),
                "created_by": "审计测试"
            }
        )
        swap_id = swap_response.json()["id"]
        
        response = client.get(f"/api/swaps/{swap_id}/audit-logs")
        assert response.status_code == 200
        assert len(response.json()) >= 1


class TestCancelAndClose:
    def test_cancel_swap(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-CANCEL",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.DRAFT
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.post(
            f"/api/swaps/{swap.id}/cancel?operator=管理员&reason=不需要调换了"
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == SwapStatus.CANCELLED
    
    def test_close_swap(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-CLOSE",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.COMPLETED
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.post(
            f"/api/swaps/{swap.id}/close?operator=管理员&conclusion=调换完成，一切正常"
        )
        assert response.status_code == 200
        assert response.json()["data"]["status"] == SwapStatus.CLOSED


class TestReport:
    def test_get_report(self, db_session):
        room1, room2, course = setup_test_data(db_session)
        
        swap = RoomSwap(
            swap_code="SWAP-REPORT",
            course_id=course.id,
            original_room_id=room1.id,
            target_room_id=room2.id,
            scheduled_time=course.scheduled_time,
            created_by="测试",
            status=SwapStatus.APPROVED,
            check_capacity_pass=True,
            check_devices_pass=True
        )
        db_session.add(swap)
        db_session.commit()
        
        response = client.get(f"/api/swaps/{swap.id}/report")
        assert response.status_code == 200
        data = response.json()
        assert data["swap_code"] == "SWAP-REPORT"
        assert data["capacity_check"] == "通过"


class TestConflictCases:
    def test_capacity_conflict(self, db_session):
        room_small = Room(name="小教室", capacity=10)
        room_large = Room(name="大教室", capacity=50)
        db_session.add_all([room_small, room_large])
        db_session.commit()
        
        course = Course(
            name="大班课",
            code="BIG001",
            instructor="老师",
            student_count=30,
            original_room_id=room_large.id,
            scheduled_time=datetime.now() + timedelta(days=1),
            duration_minutes=120
        )
        db_session.add(course)
        db_session.commit()
        
        response = client.post(
            "/api/swaps/",
            json={
                "course_id": course.id,
                "original_room_id": room_large.id,
                "target_room_id": room_small.id,
                "reason": "测试容量冲突",
                "scheduled_time": course.scheduled_time.isoformat(),
                "created_by": "测试"
            }
        )
        assert response.status_code == 200
        data = response.json()
        assert data["check_capacity_pass"] == False


def test_health_check():
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json()["status"] == "healthy"
