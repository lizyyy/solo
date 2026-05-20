import sys
from datetime import datetime
from database import SessionLocal, Developer, Lesson, Progress, PracticeRequest
import json

def init_demo_data():
    db = SessionLocal()
    
    print("=== 初始化演示数据 ===\n")
    
    lessons = db.query(Lesson).order_by(Lesson.order).all()
    if not lessons:
        print("错误：请先启动 main.py 初始化基础数据")
        return
    
    dev3 = db.query(Developer).filter(Developer.email == "dev3@example.com").first()
    if not dev3:
        dev3 = Developer(
            name="演示开发者-重复提交",
            email="dev3@example.com",
            api_key="ak_test_003",
            api_secret="sk_test_003_secret"
        )
        db.add(dev3)
        db.commit()
        print(f"✅ 创建演示开发者: {dev3.name}")
    
    dev4 = db.query(Developer).filter(Developer.email == "dev4@example.com").first()
    if not dev4:
        dev4 = Developer(
            name="演示开发者-卡第二关",
            email="dev4@example.com",
            api_key="ak_test_004",
            api_secret="sk_test_004_secret"
        )
        db.add(dev4)
        db.commit()
        print(f"✅ 创建演示开发者: {dev4.name}")
    
    lesson1 = lessons[0]
    lesson2 = lessons[1]
    lesson3 = lessons[2]
    
    print("\n=== 添加演示数据：重复提交 ===")
    for i in range(5):
        req = PracticeRequest(
            developer_id=dev3.id,
            lesson_id=lesson1.id,
            request_method="POST",
            request_url="/oauth/token",
            request_headers=json.dumps({}),
            request_body=json.dumps({
                "client_id": "wrong_key",
                "grant_type": "client_credentials"
            }),
            response_status=400,
            response_body=json.dumps({"error": "missing_params"}),
            is_success=False,
            error_message="缺少必要参数: client_secret"
        )
        db.add(req)
    
    success_req = PracticeRequest(
        developer_id=dev3.id,
        lesson_id=lesson1.id,
        request_method="POST",
        request_url="/oauth/token",
        request_headers=json.dumps({}),
        request_body=json.dumps({
            "client_id": "ak_test_003",
            "client_secret": "sk_test_003_secret",
            "grant_type": "client_credentials"
        }),
        response_status=200,
        response_body=json.dumps({"access_token": "mock_token_ak_test_003", "expires_in": 3600}),
        is_success=True,
        error_message=None
    )
    db.add(success_req)
    
    progress1 = Progress(
        developer_id=dev3.id,
        lesson_id=lesson1.id,
        status="completed",
        attempts=6,
        completed_at=datetime.utcnow()
    )
    db.add(progress1)
    print(f"✅ dev3 第一关：5次失败 + 1次成功，共 6 次尝试")
    
    print("\n=== 添加演示数据：凭证过期 ===")
    dev_disabled = db.query(Developer).filter(Developer.api_key == "ak_test_002").first()
    if dev_disabled:
        expired_req = PracticeRequest(
            developer_id=dev_disabled.id,
            lesson_id=lesson1.id,
            request_method="POST",
            request_url="/oauth/token",
            request_headers=json.dumps({}),
            request_body=json.dumps({
                "client_id": "ak_test_002",
                "client_secret": "sk_test_002_secret",
                "grant_type": "client_credentials"
            }),
            response_status=401,
            response_body=json.dumps({"detail": "API Key is expired or disabled"}),
            is_success=False,
            error_message="API Key is expired or disabled"
        )
        db.add(expired_req)
        print(f"✅ dev2 (已禁用)：凭证过期调用失败")
    
    print("\n=== 添加演示数据：参数错误 ===")
    for i in range(3):
        error_req = PracticeRequest(
            developer_id=dev4.id,
            lesson_id=lesson2.id,
            request_method="GET",
            request_url="/user/info",
            request_headers=json.dumps({"Authorization": "Bearer invalid_token"}),
            request_body=json.dumps({}),
            response_status=400,
            response_body=json.dumps({"error": "invalid_token"}),
            is_success=False,
            error_message="access_token 无效，请先完成第一步获取有效令牌"
        )
        db.add(error_req)
    
    progress2 = Progress(
        developer_id=dev4.id,
        lesson_id=lesson1.id,
        status="completed",
        attempts=2,
        completed_at=datetime.utcnow()
    )
    progress3 = Progress(
        developer_id=dev4.id,
        lesson_id=lesson2.id,
        status="in_progress",
        attempts=3
    )
    db.add(progress2)
    db.add(progress3)
    print(f"✅ dev4 第二关：3次 token 错误，卡住中")
    
    print("\n=== 添加演示数据：完整通关 ===")
    dev1 = db.query(Developer).filter(Developer.api_key == "ak_test_001").first()
    if dev1:
        for lesson in lessons:
            p = Progress(
                developer_id=dev1.id,
                lesson_id=lesson.id,
                status="completed",
                attempts=1,
                completed_at=datetime.utcnow()
            )
            db.add(p)
            
            success_req = PracticeRequest(
                developer_id=dev1.id,
                lesson_id=lesson.id,
                request_method=lesson.method,
                request_url=lesson.endpoint,
                request_headers=json.dumps({"Authorization": "Bearer mock_token_ak_test_001"} if lesson.order > 1 else {}),
                request_body=json.dumps({}),
                response_status=200,
                response_body=json.dumps({"status": "success"}),
                is_success=True,
                error_message=None
            )
            db.add(success_req)
        print(f"✅ dev1：全部 3 关完成")
    
    db.commit()
    db.close()
    
    print("\n=== 演示数据初始化完成 ===")
    print("\n数据概览：")
    print("  ✅ dev1 (ak_test_001): 全部通关")
    print("  ✅ dev2 (ak_test_002): 凭证已禁用，演示过期场景")
    print("  ✅ dev3 (ak_test_003): 第一关重复提交6次后通过")
    print("  ✅ dev4 (ak_test_004): 卡在第二关，3次参数错误")

if __name__ == "__main__":
    init_demo_data()
