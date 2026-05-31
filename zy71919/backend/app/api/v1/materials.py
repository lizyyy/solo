from typing import Optional
from datetime import datetime
from fastapi import APIRouter, Depends, Query, Request
from sqlalchemy.orm import Session

from ...core.database import get_db
from ...schemas.common import (
    ApiResponse,
    PaginatedResponse,
    MaterialFilterParams,
    PaginationParams,
)
from ...schemas.materials import (
    SoundMaterialResponse,
    AudioTrackResponse,
    AdScriptResponse,
    MatchRelationResponse,
    MatchRelationUpdate,
    AutoMatchRequest,
    AutoMatchResponse,
    BatchOperationRequest,
    BatchOperationResponse,
    TraceChainResponse,
)
from ...services.material_service import MaterialService
from ...services.trace_service import TraceService

router = APIRouter()


def _make_response(request: Request, data=None, message: str = "success", code: int = 200):
    return ApiResponse(
        code=code,
        message=message,
        data=data,
        request_id=getattr(request.state, "request_id", ""),
        timestamp=datetime.utcnow().isoformat(),
    )


@router.get("/audio-tracks", response_model=ApiResponse[PaginatedResponse[AudioTrackResponse]])
def get_audio_tracks(
    request: Request,
    track_no: Optional[str] = Query(None, description="音轨编号"),
    search_keyword: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_audio_track_list(track_no, search_keyword, pagination)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/audio-tracks/{track_id}", response_model=ApiResponse[AudioTrackResponse])
def get_audio_track(
    request: Request,
    track_id: int,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    track = service.get_audio_track(track_id)
    if not track:
        return _make_response(request, None, "音轨不存在", 404)
    return _make_response(request, track)


@router.get("/ad-scripts", response_model=ApiResponse[PaginatedResponse[AdScriptResponse]])
def get_ad_scripts(
    request: Request,
    batch_no: Optional[str] = Query(None, description="批次号"),
    track_no: Optional[str] = Query(None, description="音轨编号"),
    search_keyword: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_ad_script_list(batch_no, track_no, search_keyword, pagination)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/ad-scripts/{script_id}", response_model=ApiResponse[AdScriptResponse])
def get_ad_script(
    request: Request,
    script_id: int,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    script = service.get_ad_script(script_id)
    if not script:
        return _make_response(request, None, "口播不存在", 404)
    return _make_response(request, script)


@router.get("/sound-materials", response_model=ApiResponse[PaginatedResponse[SoundMaterialResponse]])
def get_sound_materials(
    request: Request,
    track_no: Optional[str] = Query(None, description="音轨编号"),
    batch_no: Optional[str] = Query(None, description="广告批次"),
    material_type: Optional[str] = Query(None, description="素材类型"),
    status: Optional[str] = Query(None, description="状态"),
    start_date: Optional[str] = Query(None, description="开始日期"),
    end_date: Optional[str] = Query(None, description="结束日期"),
    search_keyword: Optional[str] = Query(None, description="搜索关键词"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    filters = MaterialFilterParams(
        track_no=track_no,
        batch_no=batch_no,
        material_type=material_type,
        status=status,
        start_date=start_date,
        end_date=end_date,
        search_keyword=search_keyword,
        page=page,
        page_size=page_size,
        sort_by=sort_by,
        sort_order=sort_order,
    )
    items, total = service.get_sound_material_list(filters)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.get("/sound-materials/{material_id}", response_model=ApiResponse[SoundMaterialResponse])
def get_sound_material(
    request: Request,
    material_id: int,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    material = service.get_sound_material(material_id)
    if not material:
        return _make_response(request, None, "素材不存在", 404)
    return _make_response(request, material)


@router.get("/sound-materials/{material_id}/trace", response_model=ApiResponse[TraceChainResponse])
def get_material_trace(
    request: Request,
    material_id: int,
    db: Session = Depends(get_db),
):
    service = TraceService(db)
    trace_chain = service.get_trace_chain(material_id)
    if not trace_chain:
        return _make_response(request, None, "素材不存在", 404)
    return _make_response(request, trace_chain)


@router.get("/matches", response_model=ApiResponse[PaginatedResponse[MatchRelationResponse]])
def get_matches(
    request: Request,
    status: Optional[str] = Query(None, description="状态"),
    match_type: Optional[str] = Query(None, description="匹配类型"),
    material_id: Optional[int] = Query(None, description="素材ID"),
    page: int = Query(1, ge=1, description="页码"),
    page_size: int = Query(20, ge=1, le=100, description="每页数量"),
    sort_by: Optional[str] = Query("created_at", description="排序字段"),
    sort_order: Optional[str] = Query("desc", description="排序方向"),
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    pagination = PaginationParams(
        page=page, page_size=page_size, sort_by=sort_by, sort_order=sort_order
    )
    items, total = service.get_match_list(status, match_type, material_id, pagination)
    total_pages = (total + page_size - 1) // page_size

    return _make_response(
        request,
        PaginatedResponse(
            items=items, total=total, page=page, page_size=page_size, total_pages=total_pages
        ),
    )


@router.post("/matches/auto-match", response_model=ApiResponse[AutoMatchResponse])
def auto_match(
    request: Request,
    data: AutoMatchRequest,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    result = service.auto_match(data)
    db.commit()
    return _make_response(request, result)


@router.put("/matches/{match_id}", response_model=ApiResponse[MatchRelationResponse])
def update_match(
    request: Request,
    match_id: int,
    data: MatchRelationUpdate,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    result = service.update_match_relation(match_id, data, operator="admin")
    if not result:
        return _make_response(request, None, "匹配关系不存在", 404)
    db.commit()
    return _make_response(request, result)


@router.post("/matches/batch-confirm", response_model=ApiResponse[BatchOperationResponse])
def batch_confirm_matches(
    request: Request,
    data: BatchOperationRequest,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    result = service.batch_confirm_matches(data)
    db.commit()
    return _make_response(request, result)


@router.post("/matches/batch-reject", response_model=ApiResponse[BatchOperationResponse])
def batch_reject_matches(
    request: Request,
    data: BatchOperationRequest,
    db: Session = Depends(get_db),
):
    service = MaterialService(db)
    result = service.batch_reject_matches(data)
    db.commit()
    return _make_response(request, result)
