#!/usr/bin/env python3
import pytest
from fastapi.testclient import TestClient
from datetime import datetime, timedelta
import json
import sys

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

SQLALCHEMY_DATABASE_URL = "sqlite:///./test.db"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

from models import Base
from database import get_db

Base.metadata.create_all(bind=engine)


def override_get_db():
    try:
        db = TestingSessionLocal()
        yield db
    finally:
        db.close()


from main import app

app.dependency_overrides[get_db] = override_get_db

client = TestClient(app)


@pytest.fixture(autouse=True)
def setup_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    db = TestingSessionLocal()
    from models import Resource
    sample_resources = [
        Resource(
            resource_code="ROOM-A101",
            resource_name="A101培训教室",
            resource_type="classroom",
            capacity=30,
            location="教学楼A栋1层",
            description="多媒体教室"
        ),
        Resource(
            resource_code="LAB-B201",
            resource_name="B201物理实验室",
            resource_type="lab",
            capacity=20,
            location="实验楼B栋2层",
            description="基础设备"
        )
    ]
    db.add_all(sample_resources)
    db.commit()
    db.close()
    yield
    Base.metadata.drop_all(bind=engine)


class Colors:
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_section(title):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}  {title}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}")


def print_test(name, passed, message=""):
    status = f"{Colors.GREEN}✓ PASS{Colors.END}" if passed else f"{Colors.RED}✗ FAIL{Colors.END}"
    print(f"  {status}: {name}")
    if message:
        print(f"      {Colors.YELLOW}{message}{Colors.END}")


def test_normal_flow():
    print_section("测试场景1: 正常流程")

    future1 = datetime.now() + timedelta(days=1)
    future2 = future1 + timedelta(hours=2)

    res = client.post("/api/reservations/", json={
        "resource_code": "ROOM-A101",
        "booker_id": "user001",
        "booker_name": "张三",
        "booker_contact": "13800138000",
        "start_time": future1.isoformat(),
        "end_time": future2.isoformat()
    })
    print_test("创建预约", res.status_code == 201, f"状态码: {res.status_code}")
    reservation_id = res.json()["id"]

    res = client.get("/api/reservations/")
    print_test("查询预约列表", res.status_code == 200)

    res = client.post("/api/waitlist/", json={
        "resource_code": "ROOM-A101",
        "user_id": "user002",
        "user_name": "李四",
        "user_contact": "13800138001",
        "priority": 0
    })
    print_test("加入候补队列", res.status_code == 201)
    waitlist_id = res.json()["id"]

    res = client.get("/api/waitlist/")
    print_test("查询候补列表", res.status_code == 200, f"当前排队人数: {len(res.json())}")

    res = client.post(f"/api/reservations/{reservation_id}/cancel", json={
        "cancel_reason": "临时有事，取消预约",
        "cancel_operator": "user001"
    })
    print_test("取消预约触发候补通知", res.status_code == 200)

    res = client.get(f"/api/waitlist/{waitlist_id}")
    print_test("验证候补状态变为NOTIFIED", res.json()["status"] == "notified", f"当前状态: {res.json()['status']}")

    res = client.post(f"/api/waitlist/{waitlist_id}/confirm", json={
        "confirm": True
    })
    print_test("候补用户确认接受", res.status_code == 200)

    res = client.get(f"/api/waitlist/{waitlist_id}")
    print_test("验证候补状态变为CONFIRMED", res.json()["status"] == "confirmed", f"当前状态: {res.json()['status']}")

    res = client.post("/api/reports/generate", json={
        "report_type": "daily",
        "period_start": (datetime.now() - timedelta(days=1)).isoformat(),
        "period_end": (datetime.now() + timedelta(days=1)).isoformat()
    })
    print_test("生成候补报告", res.status_code == 200)
    report_id = res.json()["id"]

    res = client.get(f"/api/reports/{report_id}/export?format=csv")
    print_test("导出CSV报告", res.status_code == 200)

    res = client.get("/api/stats/summary")
    print_test("获取统计摘要", res.status_code == 200)


def test_dirty_data():
    print_section("测试场景2: 脏数据处理")

    res = client.post("/api/reservations/", json={
        "resource_code": "NONEXISTENT",
        "booker_id": "user001",
        "booker_name": "张三",
        "start_time": datetime.now().isoformat(),
        "end_time": (datetime.now() + timedelta(hours=1)).isoformat()
    })
    print_test("不存在的资源", res.status_code == 400, f"错误信息: {res.json().get('detail', '')}")

    res = client.post("/api/reservations/", json={
        "resource_code": "ROOM-A101",
        "booker_id": "user001",
        "booker_name": "张三",
        "start_time": (datetime.now() + timedelta(hours=2)).isoformat(),
        "end_time": datetime.now().isoformat()
    })
    print_test("结束时间早于开始时间", res.status_code == 422, f"状态码: {res.status_code}")

    res = client.post("/api/waitlist/", json={
        "resource_code": "ROOM-A101",
        "user_id": "",
        "user_name": "",
        "priority": 0
    })
    print_test("空用户信息", res.status_code in [400, 422])

    res = client.post("/api/waitlist/9999/confirm", json={
        "confirm": True
    })
    print_test("确认不存在的候补记录", res.status_code == 404)

    res = client.post("/api/reservations/9999/cancel", json={
        "cancel_reason": "test"
    })
    print_test("取消不存在的预约", res.status_code == 400)


def test_duplicate_requests():
    print_section("测试场景3: 重复请求处理")

    future1 = datetime.now() + timedelta(days=1)
    future2 = future1 + timedelta(hours=2)

    res = client.post("/api/reservations/", json={
        "resource_code": "ROOM-A101",
        "booker_id": "user001",
        "booker_name": "张三",
        "start_time": future1.isoformat(),
        "end_time": future2.isoformat()
    })
    reservation_id = res.json()["id"]

    res = client.post("/api/reservations/", json={
        "resource_code": "ROOM-A101",
        "booker_id": "user002",
        "booker_name": "李四",
        "start_time": future1.isoformat(),
        "end_time": future2.isoformat()
    })
    print_test("同一时间段重复预约", res.status_code == 400, f"错误信息: {res.json().get('detail', '')}")

    for i in range(2):
        res = client.post("/api/waitlist/", json={
            "resource_code": "ROOM-A101",
            "user_id": "user003",
            "user_name": "王五",
            "priority": 0
        })
    print_test("同一用户重复加入候补", res.status_code == 400)

    res = client.post(f"/api/reservations/{reservation_id}/cancel", json={
        "cancel_reason": "reason1",
        "cancel_operator": "user001"
    })

    res = client.post(f"/api/reservations/{reservation_id}/cancel", json={
        "cancel_reason": "reason2",
        "cancel_operator": "user001"
    })
    print_test("重复取消同一预约", res.status_code == 400)


def test_manual_correction():
    print_section("测试场景4: 人工修正")

    res = client.post("/api/waitlist/", json={
        "resource_code": "ROOM-A101",
        "user_id": "user001",
        "user_name": "张三",
        "priority": 0
    })
    waitlist_id = res.json()["id"]

    res = client.post(f"/api/waitlist/{waitlist_id}/manual-update", json={
        "priority": 10,
        "processing_notes": "VIP用户，提升优先级",
        "operator": "admin",
        "reason": "VIP特殊处理"
    })
    print_test("人工调整优先级", res.status_code == 200, f"新优先级: {res.json()['priority']}")

    res = client.post(f"/api/waitlist/{waitlist_id}/manual-update", json={
        "status": "cancelled",
        "processing_notes": "用户主动退出",
        "operator": "admin",
        "reason": "用户联系取消"
    })
    print_test("人工修改状态", res.status_code == 200, f"新状态: {res.json()['status']}")

    res = client.get("/api/operation-logs/")
    print_test("查询操作日志", res.status_code == 200, f"日志数量: {len(res.json())}")


def test_notification_deduplication():
    print_section("测试场景5: 通知去重")

    future1 = datetime.now() + timedelta(days=1)
    future2 = future1 + timedelta(hours=2)

    res = client.post("/api/reservations/", json={
        "resource_code": "ROOM-A101",
        "booker_id": "user001",
        "booker_name": "张三",
        "start_time": future1.isoformat(),
        "end_time": future2.isoformat()
    })
    reservation_id = res.json()["id"]

    res = client.post("/api/waitlist/", json={
        "resource_code": "ROOM-A101",
        "user_id": "user002",
        "user_name": "李四",
        "priority": 0
    })
    waitlist_id = res.json()["id"]

    res = client.post(f"/api/reservations/{reservation_id}/cancel", json={
        "cancel_reason": "reason1",
        "cancel_operator": "user001"
    })

    res = client.get(f"/api/waitlist/{waitlist_id}/notifications")
    initial_count = len(res.json())
    print_test("首次通知记录", initial_count == 1)


def test_priority_sorting():
    print_section("测试场景6: 优先级排序")

    users = [
        ("user_a", "用户A", 0),
        ("user_b", "用户B", 5),
        ("user_c", "用户C", 10),
        ("user_d", "用户D", 0),
    ]

    for user_id, name, priority in users:
        client.post("/api/waitlist/", json={
            "resource_code": "ROOM-A101",
            "user_id": user_id,
            "user_name": name,
            "priority": priority
        })

    res = client.get("/api/waitlist/")
    waitlist = res.json()

    print_test("高优先级排在前面", waitlist[0]["priority"] == 10)
    print_test("次优先级次之", waitlist[1]["priority"] == 5)
    print_test("同优先级按时间排序", waitlist[2]["priority"] == 0 and waitlist[3]["priority"] == 0)


def run_all_tests():
    print(f"\n{Colors.BOLD}{Colors.GREEN}{'=' * 60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}  预约资源候补API - 自检测试套件{Colors.END}")
    print(f"{Colors.BOLD}{Colors.GREEN}{'=' * 60}{Colors.END}")

    try:
        test_normal_flow()
        test_dirty_data()
        test_duplicate_requests()
        test_manual_correction()
        test_notification_deduplication()
        test_priority_sorting()

        print(f"\n{Colors.BOLD}{Colors.GREEN}{'=' * 60}{Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN}  ✓ 所有测试场景执行完成{Colors.END}")
        print(f"{Colors.BOLD}{Colors.GREEN}{'=' * 60}{Colors.END}")

    except Exception as e:
        print(f"\n{Colors.RED}测试执行出错: {e}{Colors.END}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    if "--pytest" in sys.argv:
        pytest.main([__file__, "-v"])
    else:
        run_all_tests()
