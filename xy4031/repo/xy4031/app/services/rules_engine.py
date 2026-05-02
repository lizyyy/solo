from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass
from enum import Enum
from sqlalchemy.orm import Session
from sqlalchemy import and_, or_

from app.models import BatteryPack, ChargeRecord, FlightRecord, CellVoltageReading, MaintenanceNote, SystemConfig
from app.schemas import ReleaseStatus, RuleHit, ReleaseCheckResult


class RuleSeverity(str, Enum):
    CRITICAL = "critical"
    WARNING = "warning"
    INFO = "info"


@dataclass
class RuleDefinition:
    name: str
    code: str
    severity: RuleSeverity
    description: str
    default_enabled: bool = True


class ReleaseRulesEngine:
    RULES = [
        RuleDefinition(
            name="低压告警后未复检",
            code="LOW_VOLTAGE_ALERT_NO_REVIEW",
            severity=RuleSeverity.CRITICAL,
            description="电池经历低压告警后，未进行复检充电，禁止使用"
        ),
        RuleDefinition(
            name="存放超时",
            code="STORAGE_TIMEOUT",
            severity=RuleSeverity.WARNING,
            description="电池存放超过指定天数，需复检"
        ),
        RuleDefinition(
            name="循环次数跳变",
            code="CYCLE_JUMP_DETECTED",
            severity=RuleSeverity.CRITICAL,
            description="循环次数记录不连续，存在跳变，需检查"
        ),
        RuleDefinition(
            name="单体压差过大",
            code="CELL_VOLTAGE_DIFF_LARGE",
            severity=RuleSeverity.WARNING,
            description="最近一次单体电压读数压差过大，需复检"
        ),
        RuleDefinition(
            name="电池已封存",
            code="BATTERY_SEALED",
            severity=RuleSeverity.CRITICAL,
            description="电池已标记为封存状态，禁止使用"
        ),
        RuleDefinition(
            name="温度过低",
            code="TEMPERATURE_TOO_LOW",
            severity=RuleSeverity.WARNING,
            description="任务环境温度低于推荐值，需注意"
        ),
        RuleDefinition(
            name="循环次数过高",
            code="CYCLE_COUNT_TOO_HIGH",
            severity=RuleSeverity.WARNING,
            description="电池循环次数较高，建议减少使用频率"
        ),
    ]
    
    def __init__(self, db: Session):
        self.db = db
        self._config_cache = {}
    
    def _get_config(self, key: str, default: Any = None) -> Any:
        if key in self._config_cache:
            return self._config_cache[key]
        
        config = self.db.query(SystemConfig).filter(SystemConfig.config_key == key).first()
        if config:
            value = config.config_value
            if config.config_type == "int":
                value = int(value)
            elif config.config_type == "float":
                value = float(value)
            elif config.config_type == "bool":
                value = value.lower() in ["true", "1", "yes"]
            self._config_cache[key] = value
            return value
        
        return default
    
    def get_battery_info(self, battery_id: str) -> Optional[Dict[str, Any]]:
        battery = self.db.query(BatteryPack).filter(BatteryPack.battery_id == battery_id).first()
        if not battery:
            return None
        
        last_flight = self.db.query(FlightRecord).filter(
            FlightRecord.battery_id == battery_id
        ).order_by(FlightRecord.flight_date.desc()).first()
        
        last_charge = self.db.query(ChargeRecord).filter(
            ChargeRecord.battery_id == battery_id
        ).order_by(ChargeRecord.charge_end_time.desc()).first()
        
        last_voltage = self.db.query(CellVoltageReading).filter(
            CellVoltageReading.battery_id == battery_id
        ).order_by(CellVoltageReading.reading_time.desc()).first()
        
        maintenance_notes = self.db.query(MaintenanceNote).filter(
            MaintenanceNote.battery_id == battery_id
        ).order_by(MaintenanceNote.note_date.desc()).all()
        
        all_cycles = []
        if last_flight and last_flight.cycle_count:
            all_cycles.append(last_flight.cycle_count)
        if last_charge and last_charge.cycle_count:
            all_cycles.append(last_charge.cycle_count)
        
        current_cycles = max(all_cycles) if all_cycles else battery.initial_cycles
        
        last_activity_date = None
        if last_flight and last_flight.flight_date:
            last_activity_date = last_flight.flight_date
        if last_charge and last_charge.charge_end_time:
            if not last_activity_date or last_charge.charge_end_time > last_activity_date:
                last_activity_date = last_charge.charge_end_time
        
        now = datetime.utcnow()
        storage_days = None
        if last_activity_date:
            storage_days = (now - last_activity_date).days
        
        return {
            "battery": battery,
            "last_flight": last_flight,
            "last_charge": last_charge,
            "last_voltage": last_voltage,
            "maintenance_notes": maintenance_notes,
            "current_cycles": current_cycles,
            "last_activity_date": last_activity_date,
            "storage_days": storage_days,
        }
    
    def check_low_voltage_alert(self, battery_info: Dict[str, Any]) -> Optional[RuleHit]:
        last_flight = battery_info.get('last_flight')
        last_charge = battery_info.get('last_charge')
        
        if not last_flight:
            return None
        
        if last_flight.has_low_voltage_alert:
            alert_time = last_flight.low_voltage_alert_time or last_flight.flight_date
            
            if last_charge:
                charge_time = last_charge.charge_end_time or last_charge.charge_start_time
                if charge_time and alert_time and charge_time > alert_time:
                    end_voltage = last_charge.end_voltage
                    if end_voltage and end_voltage >= 3.8:
                        return None
            
            return RuleHit(
                rule_name="低压告警后未复检",
                rule_code="LOW_VOLTAGE_ALERT_NO_REVIEW",
                severity="critical",
                message=f"电池于 {alert_time.strftime('%Y-%m-%d %H:%M')} 发生低压告警，告警电压 {last_flight.low_voltage_alert_value or last_flight.min_voltage}V，之后未进行完整充电复检",
                evidence={
                    "alert_time": alert_time.isoformat() if alert_time else None,
                    "alert_voltage": last_flight.low_voltage_alert_value or last_flight.min_voltage,
                    "last_charge_time": last_charge.charge_end_time.isoformat() if last_charge and last_charge.charge_end_time else None,
                    "last_charge_voltage": last_charge.end_voltage if last_charge else None,
                }
            )
        
        return None
    
    def check_storage_timeout(self, battery_info: Dict[str, Any], mission_date: datetime) -> Optional[RuleHit]:
        storage_days = battery_info.get('storage_days')
        last_activity_date = battery_info.get('last_activity_date')
        
        if storage_days is None:
            return None
        
        max_storage_days = self._get_config("max_storage_days", 30)
        
        if storage_days > max_storage_days:
            return RuleHit(
                rule_name="存放超时",
                rule_code="STORAGE_TIMEOUT",
                severity="warning",
                message=f"电池已存放 {storage_days} 天，超过阈值 {max_storage_days} 天，建议复检后使用",
                evidence={
                    "storage_days": storage_days,
                    "max_storage_days": max_storage_days,
                    "last_activity_date": last_activity_date.isoformat() if last_activity_date else None,
                    "mission_date": mission_date.isoformat(),
                }
            )
        
        return None
    
    def check_cell_voltage_diff(self, battery_info: Dict[str, Any]) -> Optional[RuleHit]:
        last_voltage = battery_info.get('last_voltage')
        
        if not last_voltage:
            return None
        
        voltage_diff = last_voltage.voltage_diff
        if voltage_diff is None:
            return None
        
        max_diff = self._get_config("max_cell_voltage_diff", 0.05)
        
        if voltage_diff > max_diff:
            return RuleHit(
                rule_name="单体压差过大",
                rule_code="CELL_VOLTAGE_DIFF_LARGE",
                severity="warning",
                message=f"最近一次单体电压读数压差为 {voltage_diff:.3f}V，超过阈值 {max_diff}V（最高:{last_voltage.max_cell_voltage}V, 最低:{last_voltage.min_cell_voltage}V）",
                evidence={
                    "voltage_diff": voltage_diff,
                    "max_allowed_diff": max_diff,
                    "max_cell_voltage": last_voltage.max_cell_voltage,
                    "min_cell_voltage": last_voltage.min_cell_voltage,
                    "reading_time": last_voltage.reading_time.isoformat() if last_voltage.reading_time else None,
                }
            )
        
        return None
    
    def check_battery_sealed(self, battery_info: Dict[str, Any]) -> Optional[RuleHit]:
        battery = battery_info.get('battery')
        maintenance_notes = battery_info.get('maintenance_notes', [])
        
        if battery.status == "sealed":
            return RuleHit(
                rule_name="电池已封存",
                rule_code="BATTERY_SEALED",
                severity="critical",
                message=f"电池状态为 'sealed'（已封存），禁止使用",
                evidence={
                    "status": battery.status,
                    "battery_id": battery.battery_id,
                }
            )
        
        for note in maintenance_notes:
            if note.is_sealed:
                return RuleHit(
                    rule_name="电池已封存",
                    rule_code="BATTERY_SEALED",
                    severity="critical",
                    message=f"电池有封存备注（{note.note_date.strftime('%Y-%m-%d') if note.note_date else '未知日期'}: {note.title}），禁止使用",
                    evidence={
                        "seal_note_date": note.note_date.isoformat() if note.note_date else None,
                        "seal_note_title": note.title,
                        "seal_note_content": note.content,
                    }
                )
        
        return None
    
    def check_temperature(self, min_temperature: float) -> Optional[RuleHit]:
        min_allowed_temp = self._get_config("min_temperature_threshold", -10.0)
        
        if min_temperature < min_allowed_temp:
            return RuleHit(
                rule_name="温度过低",
                rule_code="TEMPERATURE_TOO_LOW",
                severity="warning",
                message=f"任务环境最低温度 {min_temperature}°C 低于推荐值 {min_allowed_temp}°C，锂电池低温性能会下降，请注意",
                evidence={
                    "min_temperature": min_temperature,
                    "min_allowed_temp": min_allowed_temp,
                }
            )
        
        return None
    
    def check_cycle_count(self, battery_info: Dict[str, Any]) -> Optional[RuleHit]:
        current_cycles = battery_info.get('current_cycles', 0)
        max_cycles = self._get_config("max_recommended_cycles", 200)
        
        if current_cycles >= max_cycles:
            return RuleHit(
                rule_name="循环次数过高",
                rule_code="CYCLE_COUNT_TOO_HIGH",
                severity="warning",
                message=f"电池循环次数已达 {current_cycles} 次，接近或超过推荐值 {max_cycles} 次，建议减少使用频率或退役",
                evidence={
                    "current_cycles": current_cycles,
                    "max_recommended_cycles": max_cycles,
                }
            )
        
        return None
    
    def evaluate_battery(
        self,
        battery_id: str,
        mission_date: datetime,
        min_temperature: float,
        expected_flights: int
    ) -> ReleaseCheckResult:
        battery_info = self.get_battery_info(battery_id)
        
        if not battery_info:
            return ReleaseCheckResult(
                battery_id=battery_id,
                status=ReleaseStatus.FORBIDDEN,
                rule_hits=[
                    RuleHit(
                        rule_name="电池不存在",
                        rule_code="BATTERY_NOT_FOUND",
                        severity="critical",
                        message=f"电池编号 {battery_id} 不存在于系统中",
                        evidence={"battery_id": battery_id}
                    )
                ]
            )
        
        rule_hits = []
        
        critical_hit = self.check_battery_sealed(battery_info)
        if critical_hit:
            rule_hits.append(critical_hit)
        
        critical_hit = self.check_low_voltage_alert(battery_info)
        if critical_hit:
            rule_hits.append(critical_hit)
        
        warning_hit = self.check_storage_timeout(battery_info, mission_date)
        if warning_hit:
            rule_hits.append(warning_hit)
        
        warning_hit = self.check_cell_voltage_diff(battery_info)
        if warning_hit:
            rule_hits.append(warning_hit)
        
        warning_hit = self.check_temperature(min_temperature)
        if warning_hit:
            rule_hits.append(warning_hit)
        
        warning_hit = self.check_cycle_count(battery_info)
        if warning_hit:
            rule_hits.append(warning_hit)
        
        has_critical = any(h.severity == "critical" for h in rule_hits)
        has_warning = any(h.severity == "warning" for h in rule_hits)
        
        if has_critical:
            status = ReleaseStatus.FORBIDDEN
        elif has_warning:
            status = ReleaseStatus.NEEDS_REVIEW
        else:
            status = ReleaseStatus.APPROVED
        
        last_flight = battery_info.get('last_flight')
        last_charge = battery_info.get('last_charge')
        
        has_low_alert_since_last = False
        if last_flight and last_flight.has_low_voltage_alert:
            if last_charge:
                alert_time = last_flight.low_voltage_alert_time or last_flight.flight_date
                charge_time = last_charge.charge_end_time or last_charge.charge_start_time
                if charge_time and alert_time and charge_time <= alert_time:
                    has_low_alert_since_last = True
            else:
                has_low_alert_since_last = True
        
        return ReleaseCheckResult(
            battery_id=battery_id,
            status=status,
            rule_hits=rule_hits,
            current_cycles=battery_info.get('current_cycles'),
            last_flight_date=last_flight.flight_date if last_flight else None,
            last_charge_date=last_charge.charge_end_time if last_charge else None,
            storage_days=battery_info.get('storage_days'),
            has_low_voltage_alert_since_last_check=has_low_alert_since_last,
        )
    
    def batch_evaluate(
        self,
        battery_ids: List[str],
        mission_date: datetime,
        min_temperature: float,
        expected_flights: int
    ) -> List[ReleaseCheckResult]:
        results = []
        for battery_id in battery_ids:
            result = self.evaluate_battery(
                battery_id=battery_id,
                mission_date=mission_date,
                min_temperature=min_temperature,
                expected_flights=expected_flights
            )
            results.append(result)
        return results
