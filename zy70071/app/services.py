import uuid
from datetime import datetime
from typing import Optional, List, Tuple
from app.models import (
    VisitorCreate, VisitorUpdate, VisitorResponse, VisitorStatus,
    Permission, PermissionStatus, ParkingSpot, ParkingStatus,
    AnomalyRecord, AnomalyType, AuditLog
)
from app.storage import storage


class VisitorService:
    
    @staticmethod
    def create_visitor(data: VisitorCreate, actor: str) -> VisitorResponse:
        visitor_id = f"V{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"
        now = datetime.now()
        
        visitor = VisitorResponse(
            id=visitor_id,
            status=VisitorStatus.PENDING,
            visitor_name=data.visitor_name,
            visitor_phone=data.visitor_phone,
            visitor_company=data.visitor_company,
            host_name=data.host_name,
            host_department=data.host_department,
            scheduled_start_time=data.scheduled_start_time,
            scheduled_end_time=data.scheduled_end_time,
            purpose=data.purpose,
            needs_parking=data.needs_parking,
            car_plate=data.car_plate,
            access_areas=data.access_areas,
            created_at=now,
            updated_at=now
        )
        
        storage.save_visitor(visitor)
        AuditService.log_create(visitor_id, actor, visitor.model_dump())
        
        return visitor
    
    @staticmethod
    def approve_visitor(visitor_id: str, actor: str) -> VisitorResponse:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise ValueError(f"访客单不存在: {visitor_id}")
        
        if visitor.status != VisitorStatus.PENDING:
            raise ValueError(f"只能审批待审批状态的访客，当前状态: {visitor.status}")
        
        old_state = visitor.model_dump()
        visitor.status = VisitorStatus.APPROVED
        visitor.updated_at = datetime.now()
        storage.save_visitor(visitor)
        
        AuditService.log_update(visitor_id, actor, "审批通过", old_state, visitor.model_dump())
        
        try:
            PermissionService.issue_permission(visitor_id, visitor.access_areas, actor)
        except Exception as e:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                description="访客审批通过但权限下发失败",
                details={"error": str(e)}
            )
        
        if visitor.needs_parking:
            try:
                ParkingService.assign_parking(visitor_id, visitor.car_plate, actor)
            except Exception as e:
                AnomalyService.record_anomaly(
                    visitor_id=visitor_id,
                    anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                    description="访客审批通过但车位分配失败",
                    details={"error": str(e)}
                )
        
        return visitor
    
    @staticmethod
    def reschedule_visitor(visitor_id: str, data: VisitorUpdate, actor: str) -> VisitorResponse:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise ValueError(f"访客单不存在: {visitor_id}")
        
        allowed_statuses = [VisitorStatus.PENDING, VisitorStatus.APPROVED]
        if visitor.status not in allowed_statuses:
            raise ValueError(f"当前状态({visitor.status})不支持改约")
        
        old_state = visitor.model_dump()
        
        changes = {}
        if data.scheduled_start_time:
            changes["scheduled_start_time"] = data.scheduled_start_time
        if data.scheduled_end_time:
            changes["scheduled_end_time"] = data.scheduled_end_time
        if data.access_areas:
            changes["access_areas"] = data.access_areas
        if data.needs_parking is not None:
            changes["needs_parking"] = data.needs_parking
        if data.car_plate:
            changes["car_plate"] = data.car_plate
        
        if not changes:
            raise ValueError("未提供任何修改字段")
        
        if "scheduled_start_time" in changes and "scheduled_end_time" in changes:
            if changes["scheduled_end_time"] <= changes["scheduled_start_time"]:
                raise ValueError("结束时间必须晚于开始时间")
        
        need_permission_reissue = False
        need_parking_reassign = False
        
        old_access_areas = visitor.access_areas
        new_access_areas = changes.get("access_areas", old_access_areas)
        need_permission_reissue = (
            "access_areas" in changes or 
            "scheduled_start_time" in changes or 
            "scheduled_end_time" in changes
        )
        
        old_needs_parking = visitor.needs_parking
        new_needs_parking = changes.get("needs_parking", old_needs_parking)
        old_car_plate = visitor.car_plate
        new_car_plate = changes.get("car_plate", old_car_plate)
        
        need_parking_reassign = (
            "needs_parking" in changes or 
            "car_plate" in changes or
            "scheduled_start_time" in changes or
            "scheduled_end_time" in changes
        )
        
        for key, value in changes.items():
            setattr(visitor, key, value)
        
        visitor.status = VisitorStatus.RESCHEDULED
        visitor.updated_at = datetime.now()
        storage.save_visitor(visitor)
        
        AuditService.log_update(
            visitor_id=visitor_id,
            actor=actor,
            action="改约",
            previous_state=old_state,
            new_state=visitor.model_dump(),
            comment=f"修改字段: {list(changes.keys())}"
        )
        
        if need_permission_reissue:
            try:
                PermissionService.revoke_permission(visitor_id, actor)
            except Exception as e:
                AnomalyService.record_anomaly(
                    visitor_id=visitor_id,
                    anomaly_type=AnomalyType.PERMISSION_REVOKE_FAILED,
                    description="改约时旧权限回收失败",
                    details={"error": str(e), "old_access_areas": old_access_areas}
                )
            
            try:
                PermissionService.issue_permission(visitor_id, new_access_areas, actor)
            except Exception as e:
                AnomalyService.record_anomaly(
                    visitor_id=visitor_id,
                    anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                    description="改约后新权限下发失败",
                    details={"error": str(e), "new_access_areas": new_access_areas}
                )
        
        if need_parking_reassign:
            if old_needs_parking:
                try:
                    ParkingService.release_parking(visitor_id, actor)
                except Exception as e:
                    AnomalyService.record_anomaly(
                        visitor_id=visitor_id,
                        anomaly_type=AnomalyType.PARKING_RELEASE_FAILED,
                        description="改约时旧车位释放失败",
                        details={"error": str(e)}
                    )
            
            if new_needs_parking:
                try:
                    ParkingService.assign_parking(visitor_id, new_car_plate, actor)
                except Exception as e:
                    AnomalyService.record_anomaly(
                        visitor_id=visitor_id,
                        anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                        description="改约后新车位分配失败",
                        details={"error": str(e), "car_plate": new_car_plate}
                    )
        
        return visitor
    
    @staticmethod
    def cancel_visitor(visitor_id: str, actor: str) -> VisitorResponse:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise ValueError(f"访客单不存在: {visitor_id}")
        
        if visitor.status in [VisitorStatus.CHECKED_IN, VisitorStatus.CHECKED_OUT, VisitorStatus.CANCELLED]:
            raise ValueError(f"当前状态({visitor.status})不支持取消")
        
        old_state = visitor.model_dump()
        visitor.status = VisitorStatus.CANCELLED
        visitor.updated_at = datetime.now()
        storage.save_visitor(visitor)
        
        AuditService.log_update(
            visitor_id=visitor_id,
            actor=actor,
            action="取消预约",
            previous_state=old_state,
            new_state=visitor.model_dump()
        )
        
        try:
            PermissionService.revoke_permission(visitor_id, actor)
        except Exception as e:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.PERMISSION_REVOKE_FAILED,
                description="取消预约时权限回收失败",
                details={"error": str(e)}
            )
        
        try:
            ParkingService.release_parking(visitor_id, actor)
        except Exception as e:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.PARKING_RELEASE_FAILED,
                description="取消预约时车位释放失败",
                details={"error": str(e)}
            )
        
        return visitor
    
    @staticmethod
    def checkin(visitor_id: str, actor: str) -> VisitorResponse:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise ValueError(f"访客单不存在: {visitor_id}")
        
        if visitor.status not in [VisitorStatus.APPROVED, VisitorStatus.RESCHEDULED]:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.INVALID_CHECKIN,
                description="无效的签到状态",
                details={"current_status": visitor.status}
            )
            raise ValueError(f"当前状态({visitor.status})不支持签到")
        
        permission = storage.get_permission_by_visitor(visitor_id)
        if not permission or permission.status != PermissionStatus.ISSUED:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                description="签到时权限未下发",
                details={"permission_status": permission.status if permission else None}
            )
            raise ValueError("门禁权限未下发，无法签到")
        
        if visitor.needs_parking:
            parking = storage.get_parking_by_visitor(visitor_id)
            if not parking or parking.status != ParkingStatus.ASSIGNED:
                AnomalyService.record_anomaly(
                    visitor_id=visitor_id,
                    anomaly_type=AnomalyType.STATUS_INCONSISTENCY,
                    description="签到时车位未分配",
                    details={"parking_status": parking.status if parking else None}
                )
        
        old_state = visitor.model_dump()
        visitor.status = VisitorStatus.CHECKED_IN
        visitor.actual_checkin_time = datetime.now()
        visitor.updated_at = datetime.now()
        storage.save_visitor(visitor)
        
        AuditService.log_update(
            visitor_id=visitor_id,
            actor=actor,
            action="签到",
            previous_state=old_state,
            new_state=visitor.model_dump()
        )
        
        return visitor
    
    @staticmethod
    def checkout(visitor_id: str, actor: str) -> VisitorResponse:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            raise ValueError(f"访客单不存在: {visitor_id}")
        
        if visitor.status != VisitorStatus.CHECKED_IN:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.INVALID_CHECKOUT,
                description="无效的签退状态",
                details={"current_status": visitor.status}
            )
            raise ValueError(f"当前状态({visitor.status})不支持签退")
        
        old_state = visitor.model_dump()
        visitor.status = VisitorStatus.CHECKED_OUT
        visitor.actual_checkout_time = datetime.now()
        visitor.updated_at = datetime.now()
        storage.save_visitor(visitor)
        
        AuditService.log_update(
            visitor_id=visitor_id,
            actor=actor,
            action="签退",
            previous_state=old_state,
            new_state=visitor.model_dump()
        )
        
        try:
            PermissionService.revoke_permission(visitor_id, actor)
        except Exception as e:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.PERMISSION_REVOKE_FAILED,
                description="签退后权限回收失败",
                details={"error": str(e)}
            )
        
        try:
            ParkingService.release_parking(visitor_id, actor)
        except Exception as e:
            AnomalyService.record_anomaly(
                visitor_id=visitor_id,
                anomaly_type=AnomalyType.PARKING_RELEASE_FAILED,
                description="签退后车位释放失败",
                details={"error": str(e)}
            )
        
        return visitor


class PermissionService:
    _available_spots = [f"A-{i:03d}" for i in range(1, 101)]
    _spot_counter = 0
    
    @staticmethod
    def issue_permission(visitor_id: str, access_areas: List[str], actor: str) -> Permission:
        existing = storage.get_permission_by_visitor(visitor_id)
        if existing and existing.status == PermissionStatus.ISSUED:
            raise ValueError(f"访客 {visitor_id} 已有有效权限")
        
        permission_id = f"P{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"
        now = datetime.now()
        
        permission = Permission(
            id=permission_id,
            visitor_id=visitor_id,
            status=PermissionStatus.PENDING,
            access_areas=access_areas,
            issued_at=None
        )
        storage.save_permission(permission)
        
        try:
            permission.status = PermissionStatus.ISSUED
            permission.issued_at = now
            storage.save_permission(permission)
            
            visitor = storage.get_visitor(visitor_id)
            if visitor:
                visitor.permission_id = permission_id
                storage.save_visitor(visitor)
            
            AuditService.log_permission(visitor_id, actor, "下发权限", access_areas)
        except Exception as e:
            permission.status = PermissionStatus.FAILED
            permission.error_message = str(e)
            storage.save_permission(permission)
            raise
        
        return permission
    
    @staticmethod
    def revoke_permission(visitor_id: str, actor: str) -> Optional[Permission]:
        permission = storage.get_permission_by_visitor(visitor_id)
        if not permission:
            return None
        
        if permission.status == PermissionStatus.REVOKED:
            return permission
        
        if permission.status not in [PermissionStatus.ISSUED, PermissionStatus.FAILED]:
            raise ValueError(f"权限状态({permission.status})不可回收")
        
        try:
            permission.status = PermissionStatus.REVOKED
            permission.revoked_at = datetime.now()
            storage.save_permission(permission)
            
            AuditService.log_permission(visitor_id, actor, "回收权限", permission.access_areas)
        except Exception as e:
            permission.status = PermissionStatus.FAILED
            permission.error_message = f"回收失败: {str(e)}"
            storage.save_permission(permission)
            raise
        
        return permission
    
    @staticmethod
    def get_permission(visitor_id: str) -> Optional[Permission]:
        return storage.get_permission_by_visitor(visitor_id)


class ParkingService:
    _available_spots = [f"A-{i:03d}" for i in range(1, 101)]
    _assigned_spots = set()
    
    @staticmethod
    def assign_parking(visitor_id: str, car_plate: Optional[str], actor: str) -> ParkingSpot:
        existing = storage.get_parking_by_visitor(visitor_id)
        if existing and existing.status == ParkingStatus.ASSIGNED:
            raise ValueError(f"访客 {visitor_id} 已有分配的车位")
        
        available = [s for s in ParkingService._available_spots if s not in ParkingService._assigned_spots]
        if not available:
            raise ValueError("没有可用车位")
        
        spot_number = available[0]
        
        parking_id = f"PK{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"
        now = datetime.now()
        
        parking = ParkingSpot(
            id=parking_id,
            visitor_id=visitor_id,
            spot_number=spot_number,
            status=ParkingStatus.PENDING,
            car_plate=car_plate
        )
        storage.save_parking(parking)
        
        try:
            ParkingService._assigned_spots.add(spot_number)
            parking.status = ParkingStatus.ASSIGNED
            parking.assigned_at = now
            storage.save_parking(parking)
            
            visitor = storage.get_visitor(visitor_id)
            if visitor:
                visitor.parking_id = parking_id
                storage.save_visitor(visitor)
            
            AuditService.log_parking(visitor_id, actor, "分配车位", {"spot": spot_number, "car_plate": car_plate})
        except Exception as e:
            parking.status = ParkingStatus.FAILED
            parking.error_message = str(e)
            storage.save_parking(parking)
            raise
        
        return parking
    
    @staticmethod
    def release_parking(visitor_id: str, actor: str) -> Optional[ParkingSpot]:
        parking = storage.get_parking_by_visitor(visitor_id)
        if not parking:
            return None
        
        if parking.status == ParkingStatus.RELEASED:
            return parking
        
        if parking.status not in [ParkingStatus.ASSIGNED, ParkingStatus.FAILED]:
            raise ValueError(f"车位状态({parking.status})不可释放")
        
        try:
            if parking.spot_number in ParkingService._assigned_spots:
                ParkingService._assigned_spots.remove(parking.spot_number)
            
            parking.status = ParkingStatus.RELEASED
            parking.released_at = datetime.now()
            storage.save_parking(parking)
            
            AuditService.log_parking(visitor_id, actor, "释放车位", {"spot": parking.spot_number})
        except Exception as e:
            parking.status = ParkingStatus.FAILED
            parking.error_message = f"释放失败: {str(e)}"
            storage.save_parking(parking)
            raise
        
        return parking
    
    @staticmethod
    def get_parking(visitor_id: str) -> Optional[ParkingSpot]:
        return storage.get_parking_by_visitor(visitor_id)
    
    @staticmethod
    def reset_parking_pool():
        ParkingService._assigned_spots = set()


class AnomalyService:
    
    @staticmethod
    def record_anomaly(visitor_id: str, anomaly_type: AnomalyType, description: str, details: dict) -> AnomalyRecord:
        anomaly_id = f"AN{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"
        
        anomaly = AnomalyRecord(
            id=anomaly_id,
            visitor_id=visitor_id,
            anomaly_type=anomaly_type,
            description=description,
            details=details,
            created_at=datetime.now(),
            resolved=False
        )
        
        storage.save_anomaly(anomaly)
        return anomaly
    
    @staticmethod
    def resolve_anomaly(anomaly_id: str, actor: str) -> AnomalyRecord:
        anomaly = storage.get_anomaly(anomaly_id)
        if not anomaly:
            raise ValueError(f"异常记录不存在: {anomaly_id}")
        
        anomaly.resolved = True
        anomaly.resolved_at = datetime.now()
        storage.save_anomaly(anomaly)
        
        return anomaly
    
    @staticmethod
    def get_anomalies(visitor_id: Optional[str] = None, unresolved_only: bool = False) -> List[AnomalyRecord]:
        if visitor_id:
            anomalies = storage.get_anomalies_by_visitor(visitor_id)
        else:
            anomalies = list(storage.anomalies.values())
        
        if unresolved_only:
            anomalies = [a for a in anomalies if not a.resolved]
        
        return sorted(anomalies, key=lambda x: x.created_at, reverse=True)


class AuditService:
    
    @staticmethod
    def _log(visitor_id: str, action: str, actor: str, previous_state: Optional[dict] = None, 
             new_state: Optional[dict] = None, comment: Optional[str] = None) -> AuditLog:
        log_id = f"AL{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:6]}"
        
        log = AuditLog(
            id=log_id,
            visitor_id=visitor_id,
            action=action,
            actor=actor,
            previous_state=previous_state,
            new_state=new_state,
            timestamp=datetime.now(),
            comment=comment
        )
        
        storage.add_audit_log(log)
        return log
    
    @staticmethod
    def log_create(visitor_id: str, actor: str, new_state: dict) -> AuditLog:
        return AuditService._log(visitor_id, "创建访客单", actor, new_state=new_state)
    
    @staticmethod
    def log_update(visitor_id: str, actor: str, action: str, previous_state: dict, new_state: dict, 
                   comment: Optional[str] = None) -> AuditLog:
        return AuditService._log(visitor_id, action, actor, previous_state=previous_state, 
                                 new_state=new_state, comment=comment)
    
    @staticmethod
    def log_permission(visitor_id: str, actor: str, action: str, access_areas: List[str]) -> AuditLog:
        return AuditService._log(visitor_id, f"权限-{action}", actor, comment=f"访问区域: {access_areas}")
    
    @staticmethod
    def log_parking(visitor_id: str, actor: str, action: str, details: dict) -> AuditLog:
        return AuditService._log(visitor_id, f"车位-{action}", actor, comment=str(details))
    
    @staticmethod
    def get_logs(visitor_id: str) -> List[AuditLog]:
        return storage.get_audit_logs_by_visitor(visitor_id)


class SummaryService:
    
    @staticmethod
    def get_visitor_summary(visitor_id: str) -> dict:
        visitor = storage.get_visitor(visitor_id)
        if not visitor:
            return {"error": "访客单不存在"}
        
        permission = storage.get_permission_by_visitor(visitor_id)
        parking = storage.get_parking_by_visitor(visitor_id)
        anomalies = storage.get_anomalies_by_visitor(visitor_id)
        history = storage.get_visitor_history(visitor_id)
        logs = storage.get_audit_logs_by_visitor(visitor_id)
        
        return {
            "visitor": visitor.model_dump(),
            "permission": permission.model_dump() if permission else None,
            "parking": parking.model_dump() if parking else None,
            "anomalies": [a.model_dump() for a in anomalies],
            "has_unresolved_anomalies": any(not a.resolved for a in anomalies),
            "history": [h.model_dump() for h in history],
            "audit_logs": [log.model_dump() for log in logs],
            "consistency_check": {
                "status_matches_permission": SummaryService._check_status_permission_consistency(visitor, permission),
                "status_matches_parking": SummaryService._check_status_parking_consistency(visitor, parking),
                "permission_parking_aligned": SummaryService._check_permission_parking_alignment(visitor, permission, parking)
            }
        }
    
    @staticmethod
    def _check_status_permission_consistency(visitor: VisitorResponse, permission: Optional[Permission]) -> dict:
        if visitor.status in [VisitorStatus.PENDING, VisitorStatus.CANCELLED]:
            expected = [PermissionStatus.REVOKED, PermissionStatus.FAILED, None]
            actual = permission.status if permission else None
            return {
                "is_consistent": actual in expected,
                "expected": str(expected),
                "actual": str(actual)
            }
        elif visitor.status in [VisitorStatus.APPROVED, VisitorStatus.RESCHEDULED, VisitorStatus.CHECKED_IN]:
            expected = PermissionStatus.ISSUED
            actual = permission.status if permission else None
            return {
                "is_consistent": actual == expected,
                "expected": str(expected),
                "actual": str(actual)
            }
        elif visitor.status == VisitorStatus.CHECKED_OUT:
            expected = PermissionStatus.REVOKED
            actual = permission.status if permission else None
            return {
                "is_consistent": actual == expected,
                "expected": str(expected),
                "actual": str(actual)
            }
        return {"is_consistent": True, "expected": "N/A", "actual": "N/A"}
    
    @staticmethod
    def _check_status_parking_consistency(visitor: VisitorResponse, parking: Optional[ParkingSpot]) -> dict:
        if not visitor.needs_parking:
            expected = [ParkingStatus.RELEASED, ParkingStatus.FAILED, None]
            actual = parking.status if parking else None
            return {
                "is_consistent": actual in expected,
                "expected": f"无需求: {expected}",
                "actual": str(actual)
            }
        
        if visitor.status in [VisitorStatus.PENDING, VisitorStatus.CANCELLED, VisitorStatus.CHECKED_OUT]:
            expected = [ParkingStatus.RELEASED, ParkingStatus.FAILED, None]
            actual = parking.status if parking else None
            return {
                "is_consistent": actual in expected,
                "expected": str(expected),
                "actual": str(actual)
            }
        elif visitor.status in [VisitorStatus.APPROVED, VisitorStatus.RESCHEDULED, VisitorStatus.CHECKED_IN]:
            expected = ParkingStatus.ASSIGNED
            actual = parking.status if parking else None
            return {
                "is_consistent": actual == expected,
                "expected": str(expected),
                "actual": str(actual)
            }
        return {"is_consistent": True, "expected": "N/A", "actual": "N/A"}
    
    @staticmethod
    def _check_permission_parking_alignment(visitor: VisitorResponse, permission: Optional[Permission], 
                                            parking: Optional[ParkingSpot]) -> bool:
        if visitor.needs_parking:
            if permission and parking:
                return (permission.status == PermissionStatus.ISSUED and parking.status == ParkingStatus.ASSIGNED) or \
                       (permission.status == PermissionStatus.REVOKED and parking.status == ParkingStatus.RELEASED)
            return False
        return True
