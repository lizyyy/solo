from typing import List, Dict, Tuple, Optional
from sqlalchemy.orm import Session
from datetime import datetime
from app.models import WarningZone, BlastPlan, AuditAction, AuditLog
from app.exceptions import ZoneChangedException


class ZoneAuditor:
    def compare_zones(
        self,
        old_zones: List[WarningZone],
        new_zones_data: List[Dict],
    ) -> Tuple[bool, List[str]]:
        changes = []

        old_zone_map = {z.zone_name: z for z in old_zones if z.is_active}
        new_zone_names = {z.get("zone_name") for z in new_zones_data}

        for old_name, old_zone in old_zone_map.items():
            if old_name not in new_zone_names:
                changes.append(f"删除警戒区: {old_name}")

        for new_zone_data in new_zones_data:
            zone_name = new_zone_data.get("zone_name")
            if zone_name in old_zone_map:
                old_zone = old_zone_map[zone_name]
                if old_zone.boundary_description != new_zone_data.get("boundary_description"):
                    changes.append(f"警戒区 [{zone_name}] 边界描述变更")
                if old_zone.radius_meters != new_zone_data.get("radius_meters"):
                    changes.append(
                        f"警戒区 [{zone_name}] 半径变更: {old_zone.radius_meters}m -> {new_zone_data.get('radius_meters')}m"
                    )
            else:
                changes.append(f"新增警戒区: {zone_name}")

        has_changes = len(changes) > 0
        return has_changes, changes

    def check_zone_sync_status(
        self,
        db: Session,
        plan_id: int,
    ) -> Tuple[bool, List[str]]:
        plan = db.query(BlastPlan).filter(BlastPlan.id == plan_id).first()
        if not plan:
            return False, ["计划不存在"]

        active_zones = [z for z in plan.zones if z.is_active]
        latest_zone = max(active_zones, key=lambda z: z.version) if active_zones else None

        if latest_zone and latest_zone.version > 1:
            changes_detail = [
                f"警戒区 [{z.zone_name}] 版本: {z.version}"
                for z in active_zones
            ]
            return False, changes_detail

        return True, []

    def create_zone_audit_log(
        self,
        db: Session,
        plan_id: int,
        operator: Optional[str],
        changes: List[str],
    ) -> AuditLog:
        audit_log = AuditLog(
            plan_id=plan_id,
            action=AuditAction.MODIFY_ZONE,
            operator=operator,
            detail="; ".join(changes),
        )
        db.add(audit_log)
        db.flush()
        return audit_log

    def update_zones_with_version(
        self,
        db: Session,
        plan_id: int,
        new_zones_data: List[Dict],
        operator: Optional[str] = None,
    ) -> Tuple[List[WarningZone], List[str]]:
        old_zones = db.query(WarningZone).filter(
            WarningZone.plan_id == plan_id,
            WarningZone.is_active == True
        ).all()

        has_changes, changes = self.compare_zones(old_zones, new_zones_data)

        if has_changes:
            for old_zone in old_zones:
                old_zone.is_active = False

            max_version = max((z.version for z in old_zones), default=0)
            new_version = max_version + 1

            new_zones = []
            for zone_data in new_zones_data:
                new_zone = WarningZone(
                    plan_id=plan_id,
                    zone_name=zone_data.get("zone_name"),
                    boundary_description=zone_data.get("boundary_description"),
                    radius_meters=zone_data.get("radius_meters"),
                    version=new_version,
                    is_active=True,
                )
                db.add(new_zone)
                new_zones.append(new_zone)

            self.create_zone_audit_log(db, plan_id, operator, changes)

            return new_zones, changes

        return old_zones, []

    def check_and_raise(
        self,
        db: Session,
        plan_id: int,
    ) -> None:
        is_synced, changes_detail = self.check_zone_sync_status(db, plan_id)
        if not is_synced:
            raise ZoneChangedException(
                message="警戒线存在未同步的变更",
                error_details=changes_detail
            )


zone_auditor = ZoneAuditor()
