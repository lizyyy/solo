from fastapi import FastAPI, Depends, HTTPException, Header, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import HTMLResponse, JSONResponse
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional, List
from datetime import datetime
import json
from database import get_db, init_db, Developer, Lesson, Progress, PracticeRequest

app = FastAPI(title="API Tutorial Progress Service")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


class PracticeRequestModel(BaseModel):
    lesson_id: int
    method: str
    url: str
    headers: dict = {}
    body: dict = {}


def verify_api_key(x_api_key: str = Header(None), db: Session = Depends(get_db)):
    if not x_api_key:
        raise HTTPException(status_code=401, detail="API Key is required")
    
    developer = db.query(Developer).filter(Developer.api_key == x_api_key).first()
    if not developer:
        raise HTTPException(status_code=401, detail="Invalid API Key")
    if not developer.is_active:
        raise HTTPException(status_code=401, detail="API Key is expired or disabled")
    return developer


@app.on_event("startup")
async def startup_event():
    init_db()
    db = next(get_db())
    
    if db.query(Lesson).count() == 0:
        lessons = [
            Lesson(
                order=1,
                title="获取访问令牌",
                description="使用客户端凭证获取访问令牌，这是所有API调用的第一步",
                endpoint="/oauth/token",
                method="POST",
                required_params=json.dumps(["client_id", "client_secret", "grant_type"]),
                success_criteria=json.dumps({"status_code": 200, "has_access_token": True}),
                hint="grant_type 必须是 client_credentials"
            ),
            Lesson(
                order=2,
                title="获取用户信息",
                description="使用有效的访问令牌获取当前用户信息",
                endpoint="/user/info",
                method="GET",
                required_params=json.dumps(["access_token"]),
                success_criteria=json.dumps({"status_code": 200, "has_user_id": True}),
                hint="access_token 需要放在 Authorization header 中，格式：Bearer {token}"
            ),
            Lesson(
                order=3,
                title="创建订单",
                description="创建一个新的订单，需要用户ID和商品信息",
                endpoint="/orders/create",
                method="POST",
                required_params=json.dumps(["user_id", "product_id", "quantity"]),
                success_criteria=json.dumps({"status_code": 201, "has_order_id": True}),
                hint="quantity 必须是大于0的整数"
            )
        ]
        db.add_all(lessons)
        db.commit()
    
    if db.query(Developer).count() == 0:
        developers = [
            Developer(
                name="测试开发者1",
                email="dev1@example.com",
                api_key="ak_test_001",
                api_secret="sk_test_001_secret"
            ),
            Developer(
                name="测试开发者2",
                email="dev2@example.com",
                api_key="ak_test_002",
                api_secret="sk_test_002_secret",
                is_active=False
            )
        ]
        db.add_all(developers)
        db.commit()


@app.get("/")
async def root():
    return {"message": "API Tutorial Progress Service", "version": "1.0.0"}


@app.get("/api/lessons")
async def get_lessons(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).order_by(Lesson.order).all()
    return {
        "code": 0,
        "data": [
            {
                "id": l.id,
                "order": l.order,
                "title": l.title,
                "description": l.description,
                "endpoint": l.endpoint,
                "method": l.method
            }
            for l in lessons
        ]
    }


@app.get("/api/progress")
async def get_progress(
    developer: Developer = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    lessons = db.query(Lesson).order_by(Lesson.order).all()
    progress_list = db.query(Progress).filter(Progress.developer_id == developer.id).all()
    progress_map = {p.lesson_id: p for p in progress_list}
    
    result = []
    for lesson in lessons:
        p = progress_map.get(lesson.id)
        result.append({
            "lesson_id": lesson.id,
            "lesson_order": lesson.order,
            "lesson_title": lesson.title,
            "status": p.status if p else "not_started",
            "attempts": p.attempts if p else 0,
            "completed_at": p.completed_at.isoformat() if p and p.completed_at else None
        })
    
    current_lesson = None
    for item in result:
        if item["status"] != "completed":
            current_lesson = item
            break
    
    return {
        "code": 0,
        "data": {
            "developer": {
                "id": developer.id,
                "name": developer.name,
                "email": developer.email
            },
            "progress": result,
            "current_lesson": current_lesson
        }
    }


@app.post("/api/practice")
async def practice(
    request: PracticeRequestModel,
    developer: Developer = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    lesson = db.query(Lesson).filter(Lesson.id == request.lesson_id).first()
    if not lesson:
        raise HTTPException(status_code=404, detail="Lesson not found")
    
    progress = db.query(Progress).filter(
        Progress.developer_id == developer.id,
        Progress.lesson_id == request.lesson_id
    ).first()
    
    if not progress:
        progress = Progress(
            developer_id=developer.id,
            lesson_id=request.lesson_id,
            status="in_progress",
            attempts=0
        )
        db.add(progress)
    
    is_success, error_message, response_data = validate_request(request, lesson, developer)
    
    practice_req = PracticeRequest(
        developer_id=developer.id,
        lesson_id=request.lesson_id,
        request_method=request.method,
        request_url=request.url,
        request_headers=json.dumps(request.headers),
        request_body=json.dumps(request.body),
        response_status=200 if is_success else 400,
        response_body=json.dumps(response_data),
        is_success=is_success,
        error_message=error_message
    )
    db.add(practice_req)
    
    progress.attempts += 1
    progress.last_attempt_at = datetime.utcnow()
    if is_success:
        progress.status = "completed"
        progress.completed_at = datetime.utcnow()
    
    db.commit()
    
    next_suggestion = None
    if not is_success:
        next_suggestion = get_next_suggestion(error_message, lesson)
    
    return {
        "code": 0,
        "data": {
            "is_success": is_success,
            "error_message": error_message,
            "next_suggestion": next_suggestion,
            "attempts": progress.attempts,
            "response": response_data
        }
    }


def validate_request(request, lesson, developer):
    required_params = json.loads(lesson.required_params)
    success_criteria = json.loads(lesson.success_criteria)
    
    all_params = {**request.headers, **request.body}
    
    if lesson.order == 2:
        auth_header = request.headers.get("Authorization", "")
        if auth_header.startswith("Bearer "):
            all_params["access_token"] = auth_header.replace("Bearer ", "")
    
    missing_params = [p for p in required_params if p not in all_params]
    
    if missing_params:
        return False, f"缺少必要参数: {', '.join(missing_params)}", {"error": "missing_params"}
    
    if lesson.order == 1:
        if request.body.get("grant_type") != "client_credentials":
            return False, "grant_type 必须是 client_credentials", {"error": "invalid_grant_type"}
        if request.body.get("client_id") != developer.api_key:
            return False, "client_id 不正确，请使用你的 API Key", {"error": "invalid_client_id"}
        if request.body.get("client_secret") != developer.api_secret:
            return False, "client_secret 不正确，请使用你的 API Secret", {"error": "invalid_client_secret"}
        return True, None, {"access_token": "mock_token_" + developer.api_key, "expires_in": 3600}
    
    elif lesson.order == 2:
        auth_header = request.headers.get("Authorization", "")
        if not auth_header.startswith("Bearer "):
            return False, "Authorization header 格式错误，应为: Bearer {token}", {"error": "invalid_auth_format"}
        token = auth_header.replace("Bearer ", "")
        if not token.startswith("mock_token_"):
            return False, "access_token 无效，请先完成第一步获取有效令牌", {"error": "invalid_token"}
        return True, None, {"user_id": "user_" + developer.api_key, "name": developer.name, "email": developer.email}
    
    elif lesson.order == 3:
        try:
            quantity = int(request.body.get("quantity", 0))
            if quantity <= 0:
                return False, "quantity 必须是大于0的整数", {"error": "invalid_quantity"}
        except ValueError:
            return False, "quantity 必须是有效的整数", {"error": "invalid_quantity_type"}
        
        if not request.body.get("user_id"):
            return False, "user_id 不能为空，请使用第二步获取的 user_id", {"error": "missing_user_id"}
        if not request.body.get("product_id"):
            return False, "product_id 不能为空", {"error": "missing_product_id"}
        
        return True, None, {"order_id": "order_" + str(datetime.now().timestamp()), "status": "created"}
    
    return False, "未知的关卡类型", {"error": "unknown_lesson"}


def get_next_suggestion(error_message, lesson):
    if "缺少必要参数" in error_message:
        return f"请检查 API 文档，确保你包含了所有必需的参数。提示：{lesson.hint}"
    if "grant_type" in error_message:
        return "grant_type 字段是固定值，必须设置为 'client_credentials'"
    if "client_id" in error_message or "client_secret" in error_message:
        return "请使用控制台显示的正确凭证，不要使用硬编码的测试值"
    if "Authorization" in error_message:
        return "记住标准的 Authorization header 格式：Bearer 后面跟一个空格，然后是你的 token"
    if "token" in error_message:
        return "你需要先完成第一步获取有效的 access_token，不能随便填写"
    if "quantity" in error_message:
        return "购买数量必须是正整数，想想为什么 API 要做这个校验？"
    return "仔细阅读错误信息，对照 API 文档检查你的请求参数"


@app.get("/api/requests")
async def get_requests(
    limit: int = 10,
    developer: Developer = Depends(verify_api_key),
    db: Session = Depends(get_db)
):
    requests = db.query(PracticeRequest).filter(
        PracticeRequest.developer_id == developer.id
    ).order_by(PracticeRequest.created_at.desc()).limit(limit).all()
    
    return {
        "code": 0,
        "data": [
            {
                "id": r.id,
                "lesson_id": r.lesson_id,
                "is_success": r.is_success,
                "error_message": r.error_message,
                "created_at": r.created_at.isoformat()
            }
            for r in requests
        ]
    }


@app.get("/api/admin/stuck-points")
async def get_stuck_points(db: Session = Depends(get_db)):
    lessons = db.query(Lesson).order_by(Lesson.order).all()
    result = []
    
    for lesson in lessons:
        total = db.query(Progress).filter(Progress.lesson_id == lesson.id).count()
        completed = db.query(Progress).filter(
            Progress.lesson_id == lesson.id,
            Progress.status == "completed"
        ).count()
        stuck = total - completed
        
        result.append({
            "lesson_id": lesson.id,
            "lesson_title": lesson.title,
            "total_attempts": total,
            "completed": completed,
            "stuck": stuck,
            "completion_rate": round(completed / total * 100, 2) if total > 0 else 0
        })
    
    return {"code": 0, "data": result}


@app.get("/api/admin/certificate/{developer_id}")
async def get_certificate(developer_id: int, db: Session = Depends(get_db)):
    developer = db.query(Developer).filter(Developer.id == developer_id).first()
    if not developer:
        raise HTTPException(status_code=404, detail="Developer not found")
    
    total_lessons = db.query(Lesson).count()
    completed_lessons = db.query(Progress).filter(
        Progress.developer_id == developer_id,
        Progress.status == "completed"
    ).count()
    
    is_completed = completed_lessons >= total_lessons and total_lessons > 0
    
    return {
        "code": 0,
        "data": {
            "developer_name": developer.name,
            "developer_email": developer.email,
            "completed_lessons": completed_lessons,
            "total_lessons": total_lessons,
            "is_completed": is_completed,
            "certificate_id": f"CERT-{developer.id}-{datetime.now().strftime('%Y%m%d')}" if is_completed else None,
            "issued_at": datetime.now().isoformat() if is_completed else None
        }
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
