from datetime import datetime, timedelta
from typing import List, Dict, Optional, Set, Tuple
from pydantic import BaseModel, Field
from enum import Enum
from collections import defaultdict

from .models import CardSwipeEvent, PermissionRecord, ZoneDefinition, Direction, EventType
from .timeline import MergedEvent


class ViolationType(str, Enum):
    UNAUTHORIZED_PERSON = "unauthorized_person"
    REVOKED_CARD = "revoked_card"
    ZONE_MISMATCH = "zone_mismatch"
    EXPIRED_PERMISSION = "expired_permission"
    ANTI_PASSBACK_VIOLATION = "anti_passback_violation"
    DUPLICATE_SWIPE = "duplicate_swipe"
    DIRECTION_BROKEN = "direction_broken"
    TIME_OUTSIDE_VALID = "time_outside_valid"


class ViolationSeverity(str, Enum):
    CRITICAL = "critical"
    HIGH = "high"
    MEDIUM = "medium"
    LOW = "low"


class RuleViolation(BaseModel):
    violation_type: ViolationType
    severity: ViolationSeverity
    message: str
    event_index: int
    card_id: str
    timestamp: datetime
    zone_id: str
    device_id: str
    suggested_resolution: Optional[str] = None
    related_events: List[int] = Field(default_factory=list)


class RuleCheckResult(BaseModel):
    total_checked: int = 0
    violations: List[RuleViolation] = Field(default_factory=list)
    warnings: List[str] = Field(default_factory=list)
    stats: Dict[str, int] = Field(default_factory=dict)
    
    def count_by_severity(self) -> Dict[ViolationSeverity, int]:
        counts: Dict[ViolationSeverity, int] = defaultdict(int)
        for v in self.violations:
            counts[v.severity] += 1
        return dict(counts)
    
    def count_by_type(self) -> Dict[ViolationType, int]:
        counts: Dict[ViolationType, int] = defaultdict(int)
        for v in self.violations:
            counts[v.violation_type] += 1
        return dict(counts)


class CardState(BaseModel):
    card_id: str
    last_zone: Optional[str] = None
    last_direction: Direction = Direction.UNKNOWN
    last_timestamp: Optional[datetime] = None
    is_inside: bool = False
    zone_history: List[Tuple[str, Direction, datetime]] = Field(default_factory=list)


class RuleEngine:
    def __init__(
        self,
        permissions: List[PermissionRecord],
        zones: List[ZoneDefinition],
        duplicate_swipe_window_seconds: int = 30,
        anti_passback_enabled: bool = True
    ):
        self.permissions: Dict[str, PermissionRecord] = {
            p.card_id: p for p in permissions
        }
        self.zones: Dict[str, ZoneDefinition] = {
            z.zone_id: z for z in zones
        }
        self.duplicate_window = duplicate_swipe_window_seconds
        self.anti_passback_enabled = anti_passback_enabled
        
        self.card_states: Dict[str, CardState] = defaultdict(
            lambda: CardState(card_id="")
        )
        
        for card_id in self.permissions.keys():
            self.card_states[card_id] = CardState(card_id=card_id)

    def check_all(
        self,
        merged_events: List[MergedEvent]
    ) -> RuleCheckResult:
        result = RuleCheckResult()
        result.total_checked = len(merged_events)
        
        card_last_swipe_times: Dict[str, List[Tuple[datetime, int]]] = defaultdict(list)
        
        for idx, event in enumerate(merged_events):
            violations = self._check_single_event(event, idx, card_last_swipe_times)
            result.violations.extend(violations)
            
            card_last_swipe_times[event.original_event.card_id].append(
                (event.corrected_timestamp, idx)
            )
        
        for v in result.violations:
            key = str(v.violation_type)
            result.stats[key] = result.stats.get(key, 0) + 1
        
        return result

    def _check_single_event(
        self,
        event: MergedEvent,
        event_index: int,
        card_last_swipes: Dict[str, List[Tuple[datetime, int]]]
    ) -> List[RuleViolation]:
        violations: List[RuleViolation] = []
        original = event.original_event
        card_id = original.card_id
        timestamp = event.corrected_timestamp
        zone_id = original.zone_id
        device_id = original.device_id
        
        permission = self.permissions.get(card_id)
        
        if not permission:
            violations.append(RuleViolation(
                violation_type=ViolationType.UNAUTHORIZED_PERSON,
                severity=ViolationSeverity.CRITICAL,
                message=f"未授权人员刷卡: 卡号 {card_id} 无有效权限记录",
                event_index=event_index,
                card_id=card_id,
                timestamp=timestamp,
                zone_id=zone_id,
                device_id=device_id,
                suggested_resolution="核实人员信息或补录权限"
            ))
            return violations
        
        if not permission.is_active:
            violations.append(RuleViolation(
                violation_type=ViolationType.REVOKED_CARD,
                severity=ViolationSeverity.CRITICAL,
                message=f"撤权人员刷卡: {permission.person_name} ({card_id} 权限已被撤销",
                event_index=event_index,
                card_id=card_id,
                timestamp=timestamp,
                zone_id=zone_id,
                device_id=device_id,
                suggested_resolution="核实是否为误授权或权限恢复申请"
            ))
        
        if permission.valid_until and timestamp > permission.valid_until:
            violations.append(RuleViolation(
                violation_type=ViolationType.EXPIRED_PERMISSION,
                severity=ViolationSeverity.HIGH,
                message=f"权限已过期: {permission.person_name} 的权限有效期至 {permission.valid_until}",
                event_index=event_index,
                card_id=card_id,
                timestamp=timestamp,
                zone_id=zone_id,
                device_id=device_id,
                suggested_resolution="检查是否需要续期"
            ))
        
        if permission.valid_from and timestamp < permission.valid_from:
            violations.append(RuleViolation(
                violation_type=ViolationType.TIME_OUTSIDE_VALID,
                severity=ViolationSeverity.MEDIUM,
                message=f"权限尚未生效: {permission.person_name} 的权限从 {permission.valid_from} 开始",
                event_index=event_index,
                card_id=card_id,
                timestamp=timestamp,
                zone_id=zone_id,
                device_id=device_id,
                suggested_resolution="确认权限生效时间"
            ))
        
        if zone_id and permission.allowed_zones:
            if zone_id not in permission.allowed_zones and "*" not in permission.allowed_zones:
                violations.append(RuleViolation(
                    violation_type=ViolationType.ZONE_MISMATCH,
                    severity=ViolationSeverity.HIGH,
                    message=f"门区不匹配: {permission.person_name} 无权访问 {zone_id} 门区, 仅允许: {', '.join(permission.allowed_zones)}",
                    event_index=event_index,
                    card_id=card_id,
                    timestamp=timestamp,
                    zone_id=zone_id,
                    device_id=device_id,
                    suggested_resolution="核实门区权限配置或调整权限范围"
                ))
        
        last_swipes = card_last_swipes.get(card_id, [])
        for last_ts, last_idx in reversed(last_swipes):
            delta_seconds = (timestamp - last_ts).total_seconds()
            
            if delta_seconds < self.duplicate_window:
                violations.append(RuleViolation(
                    violation_type=ViolationType.DUPLICATE_SWIPE,
                    severity=ViolationSeverity.MEDIUM,
                    message=f"重复刷卡: {permission.person_name} 在 {int(delta_seconds)} 秒内重复刷卡",
                    event_index=event_index,
                    card_id=card_id,
                    timestamp=timestamp,
                    zone_id=zone_id,
                    device_id=device_id,
                    related_events=[last_idx],
                    suggested_resolution="检查是否为设备误读或人工重复操作"
                ))
        
        if self.anti_passback_enabled and original.direction != Direction.UNKNOWN:
            card_state = self.card_states[card_id]
            
            if card_state.last_direction != Direction.UNKNOWN:
                expected_direction = self._get_expected_next_direction(card_state)
                
                if expected_direction and original.direction != expected_direction:
                    zone = self.zones.get(zone_id)
                    if zone and zone.anti_passback_enabled:
                        violations.append(RuleViolation(
                            violation_type=ViolationType.ANTI_PASSBACK_VIOLATION,
                            severity=ViolationSeverity.HIGH,
                            message=f"反潜回违规: {permission.person_name} 进出方向断链。上一次在 {card_state.last_zone} 是 {card_state.last_direction.value}, 本次应为 {expected_direction.value}",
                            event_index=event_index,
                            card_id=card_id,
                            timestamp=timestamp,
                            zone_id=zone_id,
                            device_id=device_id,
                            suggested_resolution="核实是否有尾随、代刷或设备方向识别错误"
                        ))
            
            self._update_card_state(card_state, original, timestamp)
        
        return violations

    def _get_expected_next_direction(self, state: CardState) -> Optional[Direction]:
        if state.last_direction == Direction.IN:
            return Direction.OUT
        elif state.last_direction == Direction.OUT:
            return Direction.IN
        return None

    def _update_card_state(
        self,
        state: CardState,
        event: CardSwipeEvent,
        timestamp: datetime
    ):
        state.last_zone = event.zone_id
        state.last_direction = event.direction
        state.last_timestamp = timestamp
        
        if event.direction == Direction.IN:
            state.is_inside = True
        elif event.direction == Direction.OUT:
            state.is_inside = False
        
        state.zone_history.append((event.zone_id, event.direction, timestamp))
