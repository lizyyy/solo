from datetime import datetime
from typing import List, Dict, Any, Tuple
from collections import defaultdict

from models import (
    Device, Schedule, Detour, Template, Release, ReleaseItem,
    ValidationIssue, ValidationIssueType, ValidationSeverity,
    generate_id
)


class DeviceOfflineValidator:
    @staticmethod
    def validate(devices: List[Device]) -> List[ValidationIssue]:
        issues = []
        offline_devices = [d for d in devices if not d.is_online]
        
        if offline_devices:
            issue = ValidationIssue(
                issue_id=generate_id(),
                issue_type=ValidationIssueType.DEVICE_OFFLINE,
                severity=ValidationSeverity.WARNING,
                message=f"发现 {len(offline_devices)} 台设备离线",
                affected_devices=[d.device_id for d in offline_devices],
                affected_stations=[d.station_name for d in offline_devices],
                details={
                    "offline_devices": [
                        {
                            "device_id": d.device_id,
                            "station_name": d.station_name,
                            "last_seen": d.last_seen.isoformat() if d.last_seen else None
                        }
                        for d in offline_devices
                    ]
                }
            )
            issues.append(issue)
        
        return issues


class TemplateFieldValidator:
    @staticmethod
    def validate(
        release_items: List[ReleaseItem],
        templates: List[Template],
        schedules: List[Schedule]
    ) -> List[ValidationIssue]:
        issues = []
        
        template_map = {t.template_id: t for t in templates}
        
        for item in release_items:
            template = template_map.get(item.template_id)
            if not template:
                continue
            
            schedule = next(
                (s for s in schedules if s.device_id == item.device_id and 
                 s.route_name == item.route_name),
                None
            )
            
            if not schedule:
                continue
            
            schedule_dict = schedule.to_dict()
            missing_fields = []
            
            for field in template.required_fields:
                if field not in schedule_dict or not schedule_dict[field]:
                    missing_fields.append(field)
            
            if missing_fields:
                issue = ValidationIssue(
                    issue_id=generate_id(),
                    issue_type=ValidationIssueType.TEMPLATE_MISSING_FIELD,
                    severity=ValidationSeverity.ERROR,
                    message=f"设备 {item.device_id} 使用模板 {template.template_name} 缺少必填字段",
                    affected_devices=[item.device_id],
                    affected_stations=[item.station_name],
                    affected_routes=[item.route_name],
                    details={
                        "template_id": item.template_id,
                        "template_name": template.template_name,
                        "required_fields": template.required_fields,
                        "missing_fields": missing_fields
                    }
                )
                issues.append(issue)
        
        return issues


class DetourCoverageValidator:
    @staticmethod
    def validate(
        detours: List[Detour],
        schedules: List[Schedule],
        devices: List[Device]
    ) -> List[ValidationIssue]:
        issues = []
        
        station_device_map = defaultdict(list)
        for device in devices:
            station_device_map[device.station_id].append(device)
            station_device_map[device.station_name].append(device)
        
        for detour in detours:
            affected_schedules = [
                s for s in schedules 
                if s.route_id == detour.route_id or s.route_name == detour.route_name
            ]
            
            affected_stations_in_schedules = set()
            for schedule in affected_schedules:
                affected_stations_in_schedules.add(schedule.station_id)
                affected_stations_in_schedules.add(schedule.station_name)
            
            detour_covered = set(detour.affected_stations + detour.detour_stations)
            uncovered = affected_stations_in_schedules - detour_covered
            
            if uncovered:
                affected_devices = []
                for station in uncovered:
                    affected_devices.extend(station_device_map.get(station, []))
                
                issue = ValidationIssue(
                    issue_id=generate_id(),
                    issue_type=ValidationIssueType.DETOUR_MISSING_STOP,
                    severity=ValidationSeverity.ERROR,
                    message=f"线路 {detour.route_name} 的临时绕行未覆盖所有受影响站点",
                    affected_devices=[d.device_id for d in affected_devices],
                    affected_stations=list(uncovered),
                    affected_routes=[detour.route_name],
                    details={
                        "detour_id": detour.detour_id,
                        "route_id": detour.route_id,
                        "affected_schedules_count": len(affected_schedules),
                        "detour_covered_stations": list(detour_covered),
                        "uncovered_stations": list(uncovered),
                        "reason": detour.reason
                    }
                )
                issues.append(issue)
        
        return issues


class DuplicateScheduleValidator:
    @staticmethod
    def validate(
        release_items: List[ReleaseItem],
        schedules: List[Schedule]
    ) -> List[ValidationIssue]:
        issues = []
        
        device_schedule_map = defaultdict(list)
        for item in release_items:
            key = (item.device_id, item.route_name, item.schedule_time)
            device_schedule_map[key].append(item)
        
        for key, items in device_schedule_map.items():
            if len(items) > 1:
                device_id, route_name, schedule_time = key
                
                issue = ValidationIssue(
                    issue_id=generate_id(),
                    issue_type=ValidationIssueType.DUPLICATE_SCHEDULE,
                    severity=ValidationSeverity.ERROR,
                    message=f"设备 {device_id} 存在重复排程: 线路 {route_name} 时间 {schedule_time}",
                    affected_devices=[device_id],
                    affected_routes=[route_name],
                    affected_stations=[items[0].station_name],
                    details={
                        "device_id": device_id,
                        "route_name": route_name,
                        "schedule_time": schedule_time,
                        "duplicate_count": len(items),
                        "item_ids": [item.item_id for item in items]
                    }
                )
                issues.append(issue)
        
        return issues


class ReleaseValidator:
    @staticmethod
    def generate_release_items(
        devices: List[Device],
        schedules: List[Schedule],
        detours: List[Detour]
    ) -> List[ReleaseItem]:
        items = []
        
        device_map = {d.device_id: d for d in devices}
        
        route_detour_map = defaultdict(list)
        for detour in detours:
            now = datetime.now()
            if detour.effective_from <= now <= detour.effective_to:
                route_detour_map[detour.route_id].append(detour)
                route_detour_map[detour.route_name].append(detour)
        
        for schedule in schedules:
            device_id = schedule.device_id
            
            if not device_id:
                station_devices = [
                    d for d in devices 
                    if d.station_id == schedule.station_id or d.station_name == schedule.station_name
                ]
                for device in station_devices:
                    item = ReleaseValidator._create_release_item(
                        device, schedule, route_detour_map
                    )
                    items.append(item)
            else:
                device = device_map.get(device_id)
                if device:
                    item = ReleaseValidator._create_release_item(
                        device, schedule, route_detour_map
                    )
                    items.append(item)
        
        return items
    
    @staticmethod
    def _create_release_item(
        device: Device,
        schedule: Schedule,
        route_detour_map: Dict[str, List[Detour]]
    ) -> ReleaseItem:
        has_detour = False
        detour_info = None
        
        route_detours = route_detour_map.get(schedule.route_id, []) + \
                        route_detour_map.get(schedule.route_name, [])
        
        for detour in route_detours:
            if schedule.station_id in detour.affected_stations or \
               schedule.station_name in detour.affected_stations:
                has_detour = True
                detour_info = {
                    "detour_id": detour.detour_id,
                    "reason": detour.reason,
                    "detour_stations": detour.detour_stations
                }
                break
        
        return ReleaseItem(
            item_id=generate_id(),
            device_id=device.device_id,
            station_name=device.station_name,
            route_name=schedule.route_name,
            schedule_time=schedule.departure_time,
            template_id=device.template_id or "default",
            has_detour=has_detour,
            detour_info=detour_info
        )
    
    @staticmethod
    def validate_all(release: Release) -> List[ValidationIssue]:
        all_issues = []
        
        all_issues.extend(DeviceOfflineValidator.validate(release.devices))
        
        if not release.release_items:
            release.release_items = ReleaseValidator.generate_release_items(
                release.devices,
                release.schedules,
                release.detours
            )
        
        all_issues.extend(TemplateFieldValidator.validate(
            release.release_items,
            release.templates,
            release.schedules
        ))
        
        all_issues.extend(DetourCoverageValidator.validate(
            release.detours,
            release.schedules,
            release.devices
        ))
        
        all_issues.extend(DuplicateScheduleValidator.validate(
            release.release_items,
            release.schedules
        ))
        
        return all_issues
    
    @staticmethod
    def get_issue_summary(issues: List[ValidationIssue]) -> Dict[str, Any]:
        error_count = sum(1 for i in issues if i.severity == ValidationSeverity.ERROR)
        warning_count = sum(1 for i in issues if i.severity == ValidationSeverity.WARNING)
        info_count = sum(1 for i in issues if i.severity == ValidationSeverity.INFO)
        
        type_counts = defaultdict(int)
        for issue in issues:
            type_counts[issue.issue_type.value] += 1
        
        return {
            "total": len(issues),
            "errors": error_count,
            "warnings": warning_count,
            "infos": info_count,
            "by_type": dict(type_counts),
            "can_approve": error_count == 0
        }
