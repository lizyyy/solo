from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.models.models import User, UserRole
from app.schemas.schemas import PumpRoomCreate, PumpRoomResponse, ApiResponse, PaginatedResponse
from app.services.pump_room_service import PumpRoomService
from app.api.deps import get_current_user, require_role

router = APIRouter()


@router.get("", response_model=PaginatedResponse)
def list_pump_rooms(
    skip: int = Query(0, ge=0),
    limit: int = Query(100, ge=1, le=1000),
    status: Optional[str] = None,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    rooms = PumpRoomService.get_pump_rooms(db, skip=skip, limit=limit, status=status)
    total = len(rooms) if skip == 0 and limit >= len(rooms) else 100
    return PaginatedResponse(
        code=200,
        message="success",
        data=[PumpRoomResponse.model_validate(r) for r in rooms],
        total=total,
        page=skip // limit + 1,
        page_size=limit
    )


@router.get("/{pump_room_id}", response_model=ApiResponse)
def get_pump_room(
    pump_room_id: int,
    db: Session = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    room = PumpRoomService.get_pump_room(db, pump_room_id)
    if not room:
        raise HTTPException(status_code=404, detail="泵房不存在")
    return ApiResponse(code=200, message="success", data=PumpRoomResponse.model_validate(room))


@router.post("", response_model=ApiResponse)
def create_pump_room(
    room_in: PumpRoomCreate,
    db: Session = Depends(get_db),
    current_user: User = Depends(require_role(UserRole.ADMIN))
):
    try:
        room = PumpRoomService.create_pump_room(db, room_in)
        return ApiResponse(code=201, message="创建成功", data=PumpRoomResponse.model_validate(room))
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
