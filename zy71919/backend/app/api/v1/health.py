from datetime import datetime
from fastapi import APIRouter, Request

from ...schemas.common import ApiResponse, HealthResponse

router = APIRouter()


def _make_response(request: Request, data=None, message: str = "success", code: int = 200):
    return ApiResponse(
        code=code,
        message=message,
        data=data,
        request_id=getattr(request.state, "request_id", ""),
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/health", response_model=ApiResponse[HealthResponse])
def health_check(request: Request):
    return _make_response(
        request,
        HealthResponse(
            status="healthy",
            version="1.0.0",
            timestamp=datetime.utcnow().isoformat(),
        ),
    )
