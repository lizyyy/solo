from fastapi import FastAPI, APIRouter, HTTPException, Body
from typing import List, Dict, Any, Optional
from datetime import date
from pydantic import BaseModel

from main import create_services
from models import UserRole

router = APIRouter(prefix="/api/v1", tags=["社区充电桩容量排队"])


def get_services():
    if not hasattr(router, "_services"):
        router._services = create_services()
    return router._services


class NoticeImportItem(BaseModel):
    notice_no: str
    project_name: str
    construction_location: str
    start_date: date
    end_date: date
    construction_type: str
    temporary_detour: bool = False
    detour_description: Optional[str] = None
    map_updated: bool = True
    impact_scope: str
    remark: Optional[str] = None
    source_file: Optional[str] = None


class BatchImportRequest(BaseModel):
    notices: List[NoticeImportItem]
    import_batch_no: str
    operator: str = "小姜"
    operator_role: UserRole = UserRole.PLANNER


class RampSupplementRequest(BaseModel):
    ramp_location: str
    ramp_type: str
    has_ramp: bool
    ramp_condition: Optional[str] = None
    accessible: bool
    survey_date: date
    surveyor: str
    construction_notice_id: Optional[str] = None
    remark: Optional[str] = None
    operator: str = "小姜"
    operator_role: UserRole = UserRole.PLANNER


class ConflictResolveRequest(BaseModel):
    conflict_id: str
    confirmed: bool
    planner_note: str
    operator: str = "小姜"


class ResidentReviewRequest(BaseModel):
    notice_id: str
    approved: bool
    review_note: str
    operator: str
    operator_role: UserRole = UserRole.RESIDENT_REP


@router.get("/", summary="系统模块清单")
async def get_modules():
    return {
        "system": "社区充电桩容量排队系统",
        "version": "1.0.0",
        "modules": [
            {
                "name": "施工告示导入",
                "endpoint": "/api/v1/notices/import",
                "method": "POST",
                "description": "施工告示第一次导入，自动检测重复和改道未同步问题"
            },
            {
                "name": "施工告示列表",
                "endpoint": "/api/v1/notices",
                "method": "GET",
                "description": "查询所有施工告示"
            },
            {
                "name": "施工告示详情（含变更历史）",
                "endpoint": "/api/v1/notices/{notice_id}",
                "method": "GET",
                "description": "查询单条施工告示，含改前改后内容和状态变化"
            },
            {
                "name": "无障碍坡道补录",
                "endpoint": "/api/v1/ramps/supplement",
                "method": "POST",
                "description": "街道规划员补看无障碍坡道记录"
            },
            {
                "name": "坡道记录详情（含变更历史）",
                "endpoint": "/api/v1/ramps/{ramp_id}",
                "method": "GET",
                "description": "查询单条坡道记录，含改前改后内容和状态变化"
            },
            {
                "name": "冲突检测",
                "endpoint": "/api/v1/notices/{notice_id}/detect-conflicts",
                "method": "POST",
                "description": "检测施工告示与坡道记录的矛盾"
            },
            {
                "name": "冲突处理（小姜确认/驳回）",
                "endpoint": "/api/v1/conflicts/resolve",
                "method": "POST",
                "description": "街道规划员对冲突进行确认或驳回，不自动拍板"
            },
            {
                "name": "待处理冲突列表",
                "endpoint": "/api/v1/conflicts/pending",
                "method": "GET",
                "description": "列出所有待处理的冲突"
            },
            {
                "name": "居民代表复核改道未同步",
                "endpoint": "/api/v1/notices/{notice_id}/resident-review",
                "method": "POST",
                "description": "施工临时改道没有同步到地图时，留给居民代表复核"
            },
            {
                "name": "点位清单生成",
                "endpoint": "/api/v1/point-list/generate",
                "method": "POST",
                "description": "点位清单更新（第三步）"
            },
            {
                "name": "点位清单（页面展示用）",
                "endpoint": "/api/v1/point-list/display",
                "method": "GET",
                "description": "页面展示用数据，与导出、接口共用同一份数据源"
            },
            {
                "name": "点位清单导出",
                "endpoint": "/api/v1/point-list/export",
                "method": "GET",
                "description": "导出明细，与页面展示共用同一份数据源，每条记录带唯一标识"
            },
            {
                "name": "页面/导出一致性校验",
                "endpoint": "/api/v1/point-list/verify-consistency",
                "method": "GET",
                "description": "验证页面展示与导出是否使用同一份数据"
            },
            {
                "name": "补录后重算",
                "endpoint": "/api/v1/point-list/recalculate",
                "method": "POST",
                "description": "补录后重算点位清单"
            },
            {
                "name": "系统自检",
                "endpoint": "/api/v1/self-check",
                "method": "GET",
                "description": "覆盖重复导入、改道未同步、补录重算、导出一致四个检查点"
            },
            {
                "name": "改道未同步列表",
                "endpoint": "/api/v1/notices/detour-unsynced",
                "method": "GET",
                "description": "列出所有施工临时改道没有同步到地图的记录"
            },
            {
                "name": "实体变更历史",
                "endpoint": "/api/v1/audit/{entity_type}/{entity_id}",
                "method": "GET",
                "description": "谁改了什么、为什么改、改完影响哪些结果"
            },
        ]
    }


@router.post("/notices/import", summary="批量导入施工告示")
async def batch_import_notices(request: BatchImportRequest):
    svcs = get_services()
    import_svc = svcs["import_service"]

    notices_dict = [n.model_dump() for n in request.notices]
    result = import_svc.batch_import_construction_notices(
        notices_dict,
        request.operator,
        request.import_batch_no,
        request.operator_role
    )
    return result


@router.get("/notices", summary="获取所有施工告示")
async def list_notices():
    svcs = get_services()
    repo = svcs["repository"]
    notices = repo.list_construction_notices()
    return {
        "total": len(notices),
        "items": [
            {
                "id": n.id,
                "record_key": f"NOTICE-{n.id}",
                "notice_no": n.notice_no,
                "project_name": n.project_name,
                "construction_location": n.construction_location,
                "temporary_detour": n.temporary_detour,
                "map_updated": n.map_updated,
                "status": n.status,
                "review_status": n.review_status,
                "ramp_records_verified": n.ramp_records_verified,
                "point_list_updated": n.point_list_updated,
                "import_batch_no": n.import_batch_no,
            }
            for n in notices
        ]
    }


@router.get("/notices/detour-unsynced", summary="改道未同步地图的施工告示列表")
async def list_detour_unsynced():
    svcs = get_services()
    import_svc = svcs["import_service"]
    notices = import_svc.get_detour_unsynced_notices()
    return {
        "total": len(notices),
        "action_required": "这些记录待居民代表复核，暂不纳入正常排队",
        "items": [
            {
                "id": n.id,
                "record_key": f"NOTICE-{n.id}",
                "notice_no": n.notice_no,
                "project_name": n.project_name,
                "construction_location": n.construction_location,
                "detour_description": n.detour_description,
                "review_status": n.review_status,
                "resident_review_note": n.resident_review_note,
            }
            for n in notices
        ]
    }


@router.get("/notices/{notice_id}", summary="施工告示详情+变更历史")
async def get_notice_detail(notice_id: str):
    svcs = get_services()
    repo = svcs["repository"]
    audit_svc = svcs["audit"]

    notice = repo.get_construction_notice(notice_id)
    if not notice:
        raise HTTPException(status_code=404, detail=f"施工告示 {notice_id} 不存在")

    change_details = audit_svc.get_notice_change_details(notice_id)
    status_transitions = audit_svc.get_status_transitions("ConstructionNotice", notice_id)
    ramp_records = repo.get_ramps_by_notice_id(notice_id)
    conflicts = repo.get_conflicts_by_notice_id(notice_id)

    return {
        "id": notice.id,
        "record_key": f"NOTICE-{notice.id}",
        "current": notice.model_dump(),
        "ramp_records": [
            {"id": r.id, "record_key": f"RAMP-{r.id}", "location": r.ramp_location,
             "accessible": r.accessible, "status": r.status}
            for r in ramp_records
        ],
        "conflicts": [
            {"id": c.id, "status": c.status, "evidences": [e.model_dump() for e in c.evidences]}
            for c in conflicts
        ],
        "change_history": change_details,
        "status_transitions": status_transitions,
    }


@router.post("/notices/{notice_id}/detect-conflicts", summary="检测施工告示与坡道记录的冲突")
async def detect_conflicts(notice_id: str, body: Dict[str, Any] = Body(default_factory=lambda: {"operator": "小姜"})):
    svcs = get_services()
    conflict_svc = svcs["conflict_service"]
    operator = body.get("operator", "小姜")

    try:
        conflicts = conflict_svc.detect_conflicts(notice_id, operator)
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "notice_id": notice_id,
        "pending_conflicts": len(conflicts),
        "items": [
            {
                "id": c.id,
                "record_key": f"CONFLICT-{c.id}",
                "ramp_record_id": c.ramp_record_id,
                "status": c.status,
                "evidences": [e.model_dump() for e in c.evidences],
            }
            for c in conflicts
        ]
    }


@router.post("/notices/{notice_id}/resident-review", summary="居民代表复核改道未同步")
async def resident_review(notice_id: str, request: ResidentReviewRequest):
    svcs = get_services()
    import_svc = svcs["import_service"]

    try:
        notice = import_svc.resident_review_detour(
            notice_id=notice_id,
            approved=request.approved,
            review_note=request.review_note,
            operator=request.operator,
            operator_role=request.operator_role
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "id": notice.id,
        "record_key": f"NOTICE-{notice.id}",
        "notice_no": notice.notice_no,
        "approved": request.approved,
        "new_status": notice.status,
        "new_review_status": notice.review_status,
        "resident_review_note": notice.resident_review_note,
    }


@router.post("/ramps/supplement", summary="补录无障碍坡道记录")
async def supplement_ramp(request: RampSupplementRequest):
    svcs = get_services()
    import_svc = svcs["import_service"]

    ramp_data = request.model_dump(exclude={"operator", "operator_role"})
    ramp = import_svc.supplement_ramp_record(
        ramp_data, request.operator, request.operator_role
    )

    return {
        "id": ramp.id,
        "record_key": f"RAMP-{ramp.id}",
        "ramp_location": ramp.ramp_location,
        "accessible": ramp.accessible,
        "has_ramp": ramp.has_ramp,
        "matched_notice": ramp.matched_notice,
        "construction_notice_id": ramp.construction_notice_id,
        "status": ramp.status,
    }


@router.get("/ramps/{ramp_id}", summary="坡道记录详情+变更历史")
async def get_ramp_detail(ramp_id: str):
    svcs = get_services()
    repo = svcs["repository"]
    audit_svc = svcs["audit"]

    ramp = repo.get_ramp_record(ramp_id)
    if not ramp:
        raise HTTPException(status_code=404, detail=f"坡道记录 {ramp_id} 不存在")

    change_details = audit_svc.get_ramp_change_details(ramp_id)
    status_transitions = audit_svc.get_status_transitions("RampRecord", ramp_id)
    conflicts = repo.get_conflicts_by_ramp_id(ramp_id)

    return {
        "id": ramp.id,
        "record_key": f"RAMP-{ramp.id}",
        "current": ramp.model_dump(),
        "conflicts": [
            {"id": c.id, "status": c.status, "notice_id": c.construction_notice_id}
            for c in conflicts
        ],
        "change_history": change_details,
        "status_transitions": status_transitions,
    }


@router.get("/conflicts/pending", summary="待处理冲突列表")
async def list_pending_conflicts():
    svcs = get_services()
    conflict_svc = svcs["conflict_service"]
    repo = svcs["repository"]

    conflicts = conflict_svc.get_pending_conflicts()
    items = []
    for c in conflicts:
        notice = repo.get_construction_notice(c.construction_notice_id)
        ramp = repo.get_ramp_record(c.ramp_record_id)
        items.append({
            "id": c.id,
            "record_key": f"CONFLICT-{c.id}",
            "construction_notice": {
                "id": c.construction_notice_id,
                "notice_no": notice.notice_no if notice else None,
                "project_name": notice.project_name if notice else None,
            },
            "ramp_record": {
                "id": c.ramp_record_id,
                "location": ramp.ramp_location if ramp else None,
            },
            "status": c.status,
            "evidences": [e.model_dump() for e in c.evidences],
            "action_required": "请街道规划员小姜确认或驳回，不自动拍板",
        })

    return {
        "total": len(items),
        "items": items
    }


@router.post("/conflicts/resolve", summary="冲突处理（确认/驳回）")
async def resolve_conflict(request: ConflictResolveRequest):
    svcs = get_services()
    conflict_svc = svcs["conflict_service"]

    try:
        conflict = conflict_svc.planner_resolve_conflict(
            conflict_id=request.conflict_id,
            confirmed=request.confirmed,
            planner_note=request.planner_note,
            operator=request.operator
        )
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

    return {
        "id": conflict.id,
        "record_key": f"CONFLICT-{conflict.id}",
        "status": conflict.status,
        "planner_decision": conflict.planner_decision,
        "planner_note": conflict.planner_note,
        "resolved_by": conflict.resolved_by,
        "resolved_at": conflict.resolved_at,
    }


@router.post("/point-list/generate", summary="生成点位清单（第三步）")
async def generate_point_list(body: Dict[str, Any] = Body(default_factory=lambda: {"operator": "小姜"})):
    svcs = get_services()
    point_svc = svcs["point_service"]
    operator = body.get("operator", "小姜")

    point_list = point_svc.generate_point_list(operator)
    return {
        "id": point_list.id,
        "record_key": f"POINT-LIST-{point_list.id}",
        "version": point_list.version,
        "effective_date": point_list.effective_date,
        "status": point_list.status,
        "item_count": len(point_list.items),
        "generated_from_notices": len(point_list.generated_from_notices),
        "generated_from_ramps": len(point_list.generated_from_ramps),
        "recalculation_note": point_list.recalculation_note,
    }


@router.get("/point-list/display", summary="点位清单（页面展示用）")
async def get_point_list_display(point_list_id: Optional[str] = None):
    svcs = get_services()
    point_svc = svcs["point_service"]
    return point_svc.get_point_list_for_display(point_list_id)


@router.get("/point-list/export", summary="点位清单导出")
async def export_point_list(point_list_id: Optional[str] = None):
    svcs = get_services()
    point_svc = svcs["point_service"]
    return point_svc.export_point_list(point_list_id)


@router.get("/point-list/verify-consistency", summary="页面/导出一致性校验")
async def verify_consistency(point_list_id: Optional[str] = None):
    svcs = get_services()
    point_svc = svcs["point_service"]
    return point_svc.verify_display_export_consistency(point_list_id)


@router.post("/point-list/recalculate", summary="补录后重算点位清单")
async def recalculate_point_list(body: Dict[str, Any]):
    svcs = get_services()
    point_svc = svcs["point_service"]
    operator = body.get("operator", "小姜")
    reason = body.get("reason", "补录后重算")

    point_list = point_svc.recalculate_after_supplement(operator, reason)
    return {
        "id": point_list.id,
        "record_key": f"POINT-LIST-{point_list.id}",
        "version": point_list.version,
        "effective_date": point_list.effective_date,
        "status": point_list.status,
        "item_count": len(point_list.items),
        "recalculation_note": point_list.recalculation_note,
    }


@router.get("/self-check", summary="系统自检")
async def run_self_check():
    svcs = get_services()
    self_check_svc = svcs["self_check_service"]
    return self_check_svc.run_all_checks()


@router.get("/audit/{entity_type}/{entity_id}", summary="实体变更历史审计")
async def get_audit_history(entity_type: str, entity_id: str):
    svcs = get_services()
    audit_svc = svcs["audit"]

    if entity_type == "ConstructionNotice":
        change_details = audit_svc.get_notice_change_details(entity_id)
    elif entity_type == "RampRecord":
        change_details = audit_svc.get_ramp_change_details(entity_id)
    else:
        change_details = audit_svc.get_change_summary(entity_type, entity_id)

    status_transitions = audit_svc.get_status_transitions(entity_type, entity_id)

    return {
        "entity_type": entity_type,
        "entity_id": entity_id,
        "record_key": f"{entity_type.upper()}-{entity_id}",
        "who_changed_what": change_details,
        "status_transitions": status_transitions,
        "summary": f"共 {len(change_details)} 次变更，{len(status_transitions)} 次状态变化",
    }


def create_app():
    app = FastAPI(
        title="社区充电桩容量排队 API",
        description="""
## 核心业务规则

1. **施工临时改道没有同步到地图**：不是罕见边角料，当作正常流程处理
2. **施工告示与坡道记录矛盾**：先列出冲突证据，让小姜选确认或驳回，不自动拍板
3. **系统自检**：覆盖重复导入、改道未同步、补录后重算、导出一致
4. **统一数据源**：导出明细、页面展示、接口返回读同一份结果
5. **真实复核**：谁改了什么、为什么改、改完影响哪些结果，都要说清楚
6. **三步流程**：导入→补看坡道→点位更新，改道未同步留给居民复核

## 三步核心流程
1. POST `/api/v1/notices/import` - 施工告示第一次导入
2. POST `/api/v1/ramps/supplement` - 街道规划员小姜补看无障碍坡道记录
3. POST `/api/v1/point-list/generate` - 点位清单更新

## 特殊流程
- 碰到施工临时改道没有同步到地图时，别急着归正常，留给居民代表复核
- POST `/api/v1/notices/{notice_id}/resident-review`
        """,
        version="1.0.0"
    )
    app.include_router(router)
    return app
