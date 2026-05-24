from sqlalchemy.orm import Session
from sqlalchemy import or_, and_
from datetime import datetime
import uuid
import hashlib
from typing import List, Optional, Tuple
from database import (
    InspectionPoint, RawMaterial, WorkOrder, WorkOrderMaterial,
    JudgmentRecord, RetestRecord, StatusTransition, AuditLog,
    WorkOrderStatusEnum, LeakLevelEnum
)
import schemas


VALID_STATUS_TRANSITIONS = {
    None: {WorkOrderStatusEnum.PENDING},
    WorkOrderStatusEnum.PENDING: {
        WorkOrderStatusEnum.CONFIRMED,
        WorkOrderStatusEnum.REJECTED,
        WorkOrderStatusEnum.CLOSED
    },
    WorkOrderStatusEnum.CONFIRMED: {
        WorkOrderStatusEnum.IN_PROGRESS,
        WorkOrderStatusEnum.REJECTED,
        WorkOrderStatusEnum.CLOSED
    },
    WorkOrderStatusEnum.IN_PROGRESS: {
        WorkOrderStatusEnum.PENDING_RETEST,
        WorkOrderStatusEnum.REJECTED,
        WorkOrderStatusEnum.CLOSED
    },
    WorkOrderStatusEnum.PENDING_RETEST: {
        WorkOrderStatusEnum.PASSED,
        WorkOrderStatusEnum.IN_PROGRESS,
        WorkOrderStatusEnum.REJECTED,
        WorkOrderStatusEnum.CLOSED
    },
    WorkOrderStatusEnum.PASSED: {
        WorkOrderStatusEnum.CLOSED,
        WorkOrderStatusEnum.IN_PROGRESS
    },
    WorkOrderStatusEnum.REJECTED: {
        WorkOrderStatusEnum.PENDING,
        WorkOrderStatusEnum.CONFIRMED,
        WorkOrderStatusEnum.CLOSED
    },
    WorkOrderStatusEnum.CLOSED: set()
}


def is_valid_status_transition(from_status: Optional[WorkOrderStatusEnum], 
                                to_status: WorkOrderStatusEnum) -> bool:
    allowed = VALID_STATUS_TRANSITIONS.get(from_status, set())
    return to_status in allowed


def generate_code(prefix: str) -> str:
    return f"{prefix}{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4].upper()}"


def calculate_cluster_key(lat: Optional[float], lng: Optional[float], 
                          position_desc: Optional[str], roof_area_id: Optional[int]) -> str:
    if lat and lng:
        lat_rounded = round(lat, 4)
        lng_rounded = round(lng, 4)
        return f"GEO_{roof_area_id or 'UNK'}_{lat_rounded}_{lng_rounded}"
    elif position_desc:
        desc_clean = position_desc.strip().upper()
        desc_hash = hashlib.md5(desc_clean.encode('utf-8')).hexdigest()[:8]
        return f"DESC_{roof_area_id or 'UNK'}_{desc_hash}"
    else:
        return f"TEMP_{uuid.uuid4().hex[:8]}"


def find_duplicate_points(db: Session, lat: Optional[float], lng: Optional[float],
                         position_desc: Optional[str], roof_area_id: Optional[int],
                         threshold_meters: float = 5.0) -> Optional[InspectionPoint]:
    cluster_key = calculate_cluster_key(lat, lng, position_desc, roof_area_id)
    
    existing = db.query(InspectionPoint).filter(
        InspectionPoint.cluster_key == cluster_key
    ).first()
    
    if existing:
        return existing
    
    if lat and lng:
        import math
        all_points = db.query(InspectionPoint).filter(
            InspectionPoint.roof_area_id == roof_area_id
        ).all()
        
        for point in all_points:
            if point.latitude and point.longitude:
                distance = haversine_distance(lat, lng, point.latitude, point.longitude)
                if distance <= threshold_meters:
                    return point
    
    return None


def haversine_distance(lat1: float, lng1: float, lat2: float, lng2: float) -> float:
    from math import radians, sin, cos, sqrt, atan2
    R = 6371000
    
    lat1_rad, lng1_rad = radians(lat1), radians(lng1)
    lat2_rad, lng2_rad = radians(lat2), radians(lng2)
    
    dlat = lat2_rad - lat1_rad
    dlng = lng2_rad - lng1_rad
    
    a = sin(dlat/2)**2 + cos(lat1_rad) * cos(lat2_rad) * sin(dlng/2)**2
    c = 2 * atan2(sqrt(a), sqrt(1-a))
    
    return R * c


def create_or_get_inspection_point(db: Session, lat: Optional[float], lng: Optional[float],
                                   position_desc: Optional[str], roof_area_id: Optional[int],
                                   point_code: Optional[str] = None) -> Tuple[InspectionPoint, bool]:
    if point_code:
        existing = db.query(InspectionPoint).filter(
            InspectionPoint.point_code == point_code
        ).first()
        if existing:
            return existing, False
    
    duplicate = find_duplicate_points(db, lat, lng, position_desc, roof_area_id)
    if duplicate:
        duplicate.merge_count += 1
        duplicate.last_detected_at = datetime.now()
        db.commit()
        db.refresh(duplicate)
        return duplicate, False
    
    cluster_key = calculate_cluster_key(lat, lng, position_desc, roof_area_id)
    new_point = InspectionPoint(
        point_code=generate_code("P"),
        roof_area_id=roof_area_id,
        latitude=lat,
        longitude=lng,
        position_desc=position_desc,
        cluster_key=cluster_key
    )
    db.add(new_point)
    db.commit()
    db.refresh(new_point)
    return new_point, True


def merge_points(db: Session, source_point_ids: List[int], target_point_id: int,
                 operator: str, reason: Optional[str] = None) -> dict:
    target = db.query(InspectionPoint).filter(InspectionPoint.id == target_point_id).first()
    if not target:
        return {"success": False, "message": "目标点位不存在"}
    
    merged_count = 0
    for source_id in source_point_ids:
        if source_id == target_point_id:
            continue
            
        source = db.query(InspectionPoint).filter(InspectionPoint.id == source_id).first()
        if not source:
            continue
        
        db.query(RawMaterial).filter(
            RawMaterial.inspection_point_id == source_id
        ).update({
            "inspection_point_id": target_point_id,
            "is_merged": True,
            "merged_into_point_id": target_point_id
        })
        
        db.query(WorkOrder).filter(
            WorkOrder.inspection_point_id == source_id
        ).update({"inspection_point_id": target_point_id})
        
        db.query(AuditLog).filter(
            AuditLog.inspection_point_id == source_id
        ).update({"inspection_point_id": target_point_id})
        
        audit_log = AuditLog(
            inspection_point_id=target_point_id,
            action_type="POINT_MERGE",
            field_name="merge_source",
            old_value=f"点位ID:{source_id}",
            new_value=f"合并到点位ID:{target_point_id}",
            operator=operator,
            reason=reason or "系统自动归并"
        )
        db.add(audit_log)
        
        merged_count += 1
    
    target.merge_count = (target.merge_count or 1) + merged_count
    db.commit()
    
    return {
        "success": True,
        "target_point_id": target_point_id,
        "merged_count": merged_count,
        "message": f"成功合并{merged_count}个点位"
    }


def create_work_order(db: Session, work_order_data: schemas.WorkOrderCreate) -> WorkOrder:
    point = db.query(InspectionPoint).filter(
        InspectionPoint.id == work_order_data.inspection_point_id
    ).first()
    
    if not point:
        raise ValueError("巡检点位不存在")
    
    materials = db.query(RawMaterial).filter(
        RawMaterial.inspection_point_id == work_order_data.inspection_point_id
    ).order_by(RawMaterial.created_at.desc()).all()
    
    if materials:
        initial_level = materials[0].leak_level
    else:
        initial_level = LeakLevelEnum.MINOR
    
    work_order = WorkOrder(
        order_no=generate_code("WO"),
        inspection_point_id=work_order_data.inspection_point_id,
        current_level=initial_level,
        status=WorkOrderStatusEnum.PENDING,
        description=work_order_data.description,
        priority=work_order_data.priority,
        deadline=work_order_data.deadline,
        assigned_to=work_order_data.assigned_to
    )
    db.add(work_order)
    db.flush()
    
    if work_order_data.material_ids:
        for idx, mat_id in enumerate(work_order_data.material_ids):
            wo_material = WorkOrderMaterial(
                work_order_id=work_order.id,
                raw_material_id=mat_id,
                is_primary=(idx == 0),
                added_by="system"
            )
            db.add(wo_material)
    else:
        for idx, mat in enumerate(materials[:3]):
            wo_material = WorkOrderMaterial(
                work_order_id=work_order.id,
                raw_material_id=mat.id,
                is_primary=(idx == 0),
                added_by="system"
            )
            db.add(wo_material)
    
    initial_transition = StatusTransition(
        work_order_id=work_order.id,
        from_status=None,
        to_status=WorkOrderStatusEnum.PENDING,
        operator="system",
        reason="工单创建"
    )
    db.add(initial_transition)
    
    db.commit()
    db.refresh(work_order)
    return work_order


def update_work_order_status(db: Session, work_order_id: int, new_status: WorkOrderStatusEnum,
                             operator: str, reason: Optional[str] = None) -> Optional[WorkOrder]:
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        return None
    
    old_status = work_order.status
    
    if not is_valid_status_transition(old_status, new_status):
        raise ValueError(
            f"非法状态流转: {old_status.value if old_status else '初始'} -> {new_status.value}。"
            f"允许的流转: {[s.value for s in VALID_STATUS_TRANSITIONS.get(old_status, [])]}"
        )
    
    transition = StatusTransition(
        work_order_id=work_order_id,
        from_status=old_status,
        to_status=new_status,
        operator=operator,
        reason=reason
    )
    db.add(transition)
    
    work_order.status = new_status
    
    if new_status == WorkOrderStatusEnum.CLOSED:
        work_order.closed_at = datetime.now()
    
    db.commit()
    db.refresh(work_order)
    return work_order


def add_judgment(db: Session, judgment_data: schemas.JudgmentRecordCreate) -> JudgmentRecord:
    work_order = db.query(WorkOrder).filter(
        WorkOrder.id == judgment_data.work_order_id
    ).first()
    
    if not work_order:
        raise ValueError("工单不存在")
    
    previous_level = work_order.current_level
    
    judgment = JudgmentRecord(
        work_order_id=judgment_data.work_order_id,
        judgment_type=judgment_data.judgment_type,
        judged_level=judgment_data.judged_level,
        previous_level=previous_level,
        judge=judgment_data.judge,
        reason=judgment_data.reason,
        evidence=judgment_data.evidence
    )
    db.add(judgment)
    
    if previous_level != judgment_data.judged_level:
        audit_log = AuditLog(
            work_order_id=judgment_data.work_order_id,
            inspection_point_id=work_order.inspection_point_id,
            action_type="LEVEL_CHANGE",
            field_name="current_level",
            old_value=previous_level.value if previous_level else None,
            new_value=judgment_data.judged_level.value,
            operator=judgment_data.judge,
            reason=judgment_data.reason or "等级判定变更"
        )
        db.add(audit_log)
    
    work_order.current_level = judgment_data.judged_level
    
    db.commit()
    db.refresh(judgment)
    return judgment


def add_retest(db: Session, retest_data: schemas.RetestRecordCreate) -> RetestRecord:
    work_order = db.query(WorkOrder).filter(
        WorkOrder.id == retest_data.work_order_id
    ).first()
    
    if not work_order:
        raise ValueError("工单不存在")
    
    retest = RetestRecord(
        work_order_id=retest_data.work_order_id,
        retest_no=generate_code("RT"),
        retest_time=retest_data.retest_time or datetime.now(),
        retester=retest_data.retester,
        thermal_image_path=retest_data.thermal_image_path,
        result=retest_data.result,
        temperature=retest_data.temperature,
        humidity=retest_data.humidity,
        description=retest_data.description,
        is_passed=retest_data.is_passed
    )
    db.add(retest)
    
    if retest_data.is_passed and work_order.status == WorkOrderStatusEnum.PENDING_RETEST:
        transition = StatusTransition(
            work_order_id=retest_data.work_order_id,
            from_status=WorkOrderStatusEnum.PENDING_RETEST,
            to_status=WorkOrderStatusEnum.PASSED,
            operator=retest_data.retester,
            reason="复测通过"
        )
        db.add(transition)
        work_order.status = WorkOrderStatusEnum.PASSED
    
    db.commit()
    db.refresh(retest)
    return retest


def supplement_material(db: Session, work_order_id: int, material_id: int,
                        operator: str, is_primary: bool = False) -> bool:
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    material = db.query(RawMaterial).filter(RawMaterial.id == material_id).first()
    
    if not work_order or not material:
        return False
    
    existing = db.query(WorkOrderMaterial).filter(
        WorkOrderMaterial.work_order_id == work_order_id,
        WorkOrderMaterial.raw_material_id == material_id
    ).first()
    
    if existing:
        return False
    
    if is_primary:
        db.query(WorkOrderMaterial).filter(
            WorkOrderMaterial.work_order_id == work_order_id
        ).update({"is_primary": False})
    
    wo_material = WorkOrderMaterial(
        work_order_id=work_order_id,
        raw_material_id=material_id,
        is_primary=is_primary,
        added_by=operator
    )
    db.add(wo_material)
    
    if material.inspection_point_id != work_order.inspection_point_id:
        material.inspection_point_id = work_order.inspection_point_id
    
    db.commit()
    return True


def get_work_order_full_detail(db: Session, work_order_id: int) -> Optional[dict]:
    work_order = db.query(WorkOrder).filter(WorkOrder.id == work_order_id).first()
    if not work_order:
        return None
    
    point = db.query(InspectionPoint).filter(
        InspectionPoint.id == work_order.inspection_point_id
    ).first()
    
    materials = db.query(WorkOrderMaterial).filter(
        WorkOrderMaterial.work_order_id == work_order_id
    ).all()
    
    material_details = []
    for wm in materials:
        mat = db.query(RawMaterial).filter(RawMaterial.id == wm.raw_material_id).first()
        if mat:
            material_details.append({
                "material": mat,
                "is_primary": wm.is_primary,
                "added_at": wm.added_at,
                "added_by": wm.added_by
            })
    
    judgments = db.query(JudgmentRecord).filter(
        JudgmentRecord.work_order_id == work_order_id
    ).order_by(JudgmentRecord.judgment_time.desc()).all()
    
    retests = db.query(RetestRecord).filter(
        RetestRecord.work_order_id == work_order_id
    ).order_by(RetestRecord.retest_time.desc()).all()
    
    transitions = db.query(StatusTransition).filter(
        StatusTransition.work_order_id == work_order_id
    ).order_by(StatusTransition.transition_time.asc()).all()
    
    audits = db.query(AuditLog).filter(
        AuditLog.work_order_id == work_order_id
    ).order_by(AuditLog.operation_time.desc()).all()
    
    return {
        "work_order": work_order,
        "inspection_point": point,
        "materials": material_details,
        "judgments": judgments,
        "retests": retests,
        "status_transitions": transitions,
        "audit_logs": audits
    }
