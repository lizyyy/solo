from fastapi import APIRouter, Depends, Request
from sqlalchemy.orm import Session
import asyncio
from database import get_db
from models import Scenario, MockLog
from schemas import MockResponse

router = APIRouter()

async def apply_delay(delay_ms: int):
    if delay_ms > 0:
        await asyncio.sleep(delay_ms / 1000)

def determine_response_status(scenario: Scenario):
    status_mapping = {
        "active": "success",
        "pending_review": "pending_review",
        "blocked": "blocked",
        "rejected": "blocked",
        "compensated": "compensated",
    }
    return status_mapping.get(scenario.status, "success")

@router.api_route("/{path:path}", methods=["GET", "POST", "PUT", "DELETE", "PATCH"])
async def mock_endpoint(path: str, request: Request, db: Session = Depends(get_db)):
    method = request.method
    
    scenario = db.query(Scenario).filter(
        Scenario.path == path,
        Scenario.method == method,
        Scenario.status.in_(["active", "pending_review", "blocked", "compensated"])
    ).first()
    
    if not scenario:
        return MockResponse(
            status="not_found",
            message=f"No mock scenario found for {method} {path}",
            delay_ms=0
        )
    
    await apply_delay(scenario.delay_ms)
    
    response_status = determine_response_status(scenario)
    
    try:
        body = await request.json()
    except:
        body = None
    
    headers = dict(request.headers)
    
    mock_log = MockLog(
        scenario_id=scenario.id,
        path=path,
        method=method,
        request_headers=headers,
        request_body=body,
        response_status=response_status,
        response_data=scenario.response_template,
        delay_ms=scenario.delay_ms
    )
    db.add(mock_log)
    db.commit()
    
    if response_status == "blocked":
        return MockResponse(
            status="blocked",
            message="This scenario has been blocked",
            delay_ms=scenario.delay_ms
        )
    elif response_status == "pending_review":
        return MockResponse(
            status="pending_review",
            message="This scenario is pending review",
            data=scenario.response_template,
            delay_ms=scenario.delay_ms
        )
    elif response_status == "compensated":
        return MockResponse(
            status="compensated",
            message="This scenario has been compensated",
            data=scenario.response_template,
            delay_ms=scenario.delay_ms
        )
    
    return MockResponse(
        status="success",
        data=scenario.response_template,
        delay_ms=scenario.delay_ms
    )

@router.get("/{scenario_id}/logs")
def get_mock_logs(scenario_id: int, skip: int = 0, limit: int = 50, db: Session = Depends(get_db)):
    logs = db.query(MockLog).filter(MockLog.scenario_id == scenario_id).offset(skip).limit(limit).all()
    return logs