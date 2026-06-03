from datetime import datetime
from typing import List, Dict, Any, Tuple
from src.models.base import (
    ObstacleRemark, RangefinderRecord, ConflictEvidence,
    ConflictType, OperationLog, ConfirmStatus
)
from src.utils.geo import haversine_distance
from config.settings import DISTANCE_THRESHOLD_METERS


class RemarkManager:
    def __init__(self):
        self.remarks: Dict[str, ObstacleRemark] = {}

    def add_remark(
        self,
        remark_data: Dict[str, Any],
        submitted_by: str
    ) -> ObstacleRemark:
        remark = ObstacleRemark(
            obstacle_name=remark_data["obstacle_name"],
            obstacle_type=remark_data["obstacle_type"],
            latitude=remark_data["latitude"],
            longitude=remark_data["longitude"],
            altitude=remark_data.get("altitude"),
            field_remark=remark_data["field_remark"],
            conclusion=remark_data["conclusion"],
            submitted_by=submitted_by,
            source=remark_data.get("source", "group_chat_supplement")
        )
        self.remarks[remark.remark_id] = remark
        return remark

    def detect_conflicts(
        self,
        remark: ObstacleRemark,
        rangefinder_records: List[RangefinderRecord]
    ) -> Tuple[List[ConflictEvidence], List[OperationLog]]:
        conflicts: List[ConflictEvidence] = []
        logs: List[OperationLog] = []

        for record in rangefinder_records:
            if record.is_duplicate:
                continue

            distance = haversine_distance(
                record.latitude, record.longitude,
                remark.latitude, remark.longitude
            )

            if distance > DISTANCE_THRESHOLD_METERS:
                continue

            if record.obstacle_name != remark.obstacle_name:
                conflict = ConflictEvidence(
                    conflict_type=ConflictType.NAME_CONFLICT,
                    rangefinder_record_id=record.record_id,
                    remark_id=remark.remark_id,
                    rangefinder_value=record.obstacle_name,
                    remark_value=remark.obstacle_name,
                    description=f"测距仪记录名称为「{record.obstacle_name}」，现场备注为「{remark.obstacle_name}」，距离{distance:.2f}米，可能是同一物体的不同称呼"
                )
                conflicts.append(conflict)
                logs.append(OperationLog(
                    operator="system",
                    action="name_conflict_detected",
                    detail=f"测距仪{record.record_id[:8]}({record.obstacle_name})与备注{remark.remark_id[:8]}({remark.obstacle_name})名称冲突"
                ))

            if record.obstacle_type != remark.obstacle_type:
                conflict = ConflictEvidence(
                    conflict_type=ConflictType.TYPE_CONFLICT,
                    rangefinder_record_id=record.record_id,
                    remark_id=remark.remark_id,
                    rangefinder_value=record.obstacle_type,
                    remark_value=remark.obstacle_type,
                    description=f"测距仪识别类型为「{record.obstacle_type}」，现场标注为「{remark.obstacle_type}」"
                )
                conflicts.append(conflict)
                logs.append(OperationLog(
                    operator="system",
                    action="type_conflict_detected",
                    detail=f"测距仪{record.record_id[:8]}({record.obstacle_type})与备注{remark.remark_id[:8]}({remark.obstacle_type})类型冲突"
                ))

            if record.raw_conclusion != remark.conclusion:
                conflict = ConflictEvidence(
                    conflict_type=ConflictType.CONCLUSION_CONFLICT,
                    rangefinder_record_id=record.record_id,
                    remark_id=remark.remark_id,
                    rangefinder_value=record.raw_conclusion,
                    remark_value=remark.conclusion,
                    description=f"测距仪结论「{record.raw_conclusion}」，现场结论「{remark.conclusion}」"
                )
                conflicts.append(conflict)
                logs.append(OperationLog(
                    operator="system",
                    action="conclusion_conflict_detected",
                    detail=f"测距仪{record.record_id[:8]}与备注{remark.remark_id[:8]}结论冲突"
                ))

        return conflicts, logs

    def decide_conflict(
        self,
        conflict_id: str,
        all_conflicts: List[ConflictEvidence],
        operator: str,
        confirm: bool
    ) -> Tuple[List[ConflictEvidence], List[OperationLog]]:
        logs: List[OperationLog] = []

        for conflict in all_conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.confirm_status = ConfirmStatus.CONFIRMED if confirm else ConfirmStatus.REJECTED
                conflict.decided_by = operator
                conflict.decided_at = datetime.now()

                action = "conflict_confirmed" if confirm else "conflict_rejected"
                decision = "确认" if confirm else "驳回"
                logs.append(OperationLog(
                    operator=operator,
                    action=action,
                    detail=f"{decision}冲突{conflict_id[:8]}: {conflict.description}"
                ))
                break

        return all_conflicts, logs
