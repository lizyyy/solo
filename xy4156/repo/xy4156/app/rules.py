from datetime import datetime, timedelta
from app.models import (
    Batch, Bottle, Cabinet, WasteBucket, WasteRecord,
    ReagentLedger, HazardClass
)
from app import db
from typing import Dict, List, Tuple, Any, Optional
import json


class ValidationResult:
    def __init__(self, valid: bool, message: str = "", details: Dict[str, Any] = None):
        self.valid = valid
        self.message = message
        self.details = details or {}
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'valid': self.valid,
            'message': self.message,
            'details': self.details
        }


class InventoryRule:
    @staticmethod
    def check_batch_volume(batch: Batch, dispense_volume: float) -> ValidationResult:
        if dispense_volume <= 0:
            return ValidationResult(
                valid=False,
                message="分装体积必须大于0",
                details={'dispense_volume': dispense_volume}
            )
        
        if dispense_volume > batch.remaining_volume:
            return ValidationResult(
                valid=False,
                message=f"批次超量分装风险：批次剩余{batch.remaining_volume} {batch.unit}，申请分装{dispense_volume} {batch.unit}",
                details={
                    'batch_number': batch.batch_number,
                    'remaining_volume': batch.remaining_volume,
                    'requested_volume': dispense_volume,
                    'exceed_volume': dispense_volume - batch.remaining_volume
                }
            )
        
        return ValidationResult(
            valid=True,
            message="库存充足",
            details={
                'batch_number': batch.batch_number,
                'remaining_volume': batch.remaining_volume,
                'requested_volume': dispense_volume
            }
        )
    
    @staticmethod
    def update_batch_volume(batch: Batch, dispense_volume: float) -> None:
        batch.remaining_volume -= dispense_volume
        db.session.commit()


class CompatibilityRule:
    INCOMPATIBLE_GROUPS = {
        HazardClass.EXPLOSIVE: [
            HazardClass.FLAMMABLE, HazardClass.OXIDIZING, 
            HazardClass.CORROSIVE, HazardClass.COMPRESSED_GAS
        ],
        HazardClass.OXIDIZING: [
            HazardClass.FLAMMABLE, HazardClass.EXPLOSIVE, 
            HazardClass.CORROSIVE
        ],
        HazardClass.FLAMMABLE: [
            HazardClass.OXIDIZING, HazardClass.EXPLOSIVE, 
            HazardClass.CORROSIVE
        ],
        HazardClass.CORROSIVE: [
            HazardClass.EXPLOSIVE, HazardClass.FLAMMABLE,
            HazardClass.OXIDIZING
        ],
        HazardClass.COMPRESSED_GAS: [
            HazardClass.EXPLOSIVE, HazardClass.FLAMMABLE,
            HazardClass.CORROSIVE
        ]
    }
    
    @staticmethod
    def check_bottle_placement(bottle: Bottle, cabinet: Cabinet) -> ValidationResult:
        bottle_ledger = ReagentLedger.query.get(bottle.ledger_id)
        if not bottle_ledger:
            return ValidationResult(
                valid=False,
                message=f"试剂台账不存在: ledger_id={bottle.ledger_id}"
            )
        
        if cabinet.hazard_class:
            if bottle_ledger.hazard_class != cabinet.hazard_class and \
               bottle_ledger.hazard_class not in CompatibilityRule._get_compatible_classes(cabinet.hazard_class):
                return ValidationResult(
                    valid=False,
                    message=f"互斥试剂同柜风险：试剂({bottle_ledger.reagent_name}, {bottle_ledger.hazard_class.value})与柜位({cabinet.name}, {cabinet.hazard_class.value})互斥",
                    details={
                        'bottle_code': bottle.bottle_code,
                        'reagent_name': bottle_ledger.reagent_name,
                        'reagent_hazard': bottle_ledger.hazard_class.value,
                        'cabinet_code': cabinet.cabinet_code,
                        'cabinet_name': cabinet.name,
                        'cabinet_hazard': cabinet.hazard_class.value
                    }
                )
        
        existing_bottles = Bottle.query.filter_by(cabinet_id=cabinet.id).all()
        for existing_bottle in existing_bottles:
            if existing_bottle.id == bottle.id:
                continue
            
            existing_ledger = ReagentLedger.query.get(existing_bottle.ledger_id)
            if existing_ledger and CompatibilityRule._are_incompatible(
                bottle_ledger.hazard_class, 
                existing_ledger.hazard_class
            ):
                return ValidationResult(
                    valid=False,
                    message=f"互斥试剂同柜风险：试剂({bottle_ledger.reagent_name})与柜内现有试剂({existing_ledger.reagent_name})互斥",
                    details={
                        'bottle_code': bottle.bottle_code,
                        'reagent_name': bottle_ledger.reagent_name,
                        'existing_bottle_code': existing_bottle.bottle_code,
                        'existing_reagent_name': existing_ledger.reagent_name,
                        'cabinet_code': cabinet.cabinet_code
                    }
                )
        
        return ValidationResult(
            valid=True,
            message="柜位相容性检查通过",
            details={'cabinet_code': cabinet.cabinet_code}
        )
    
    @staticmethod
    def _get_compatible_classes(hazard_class: HazardClass) -> List[HazardClass]:
        incompatible = CompatibilityRule.INCOMPATIBLE_GROUPS.get(hazard_class, [])
        return [c for c in HazardClass if c not in incompatible and c != hazard_class]
    
    @staticmethod
    def _are_incompatible(class1: HazardClass, class2: HazardClass) -> bool:
        if class1 == class2:
            return False
        
        if class1 in CompatibilityRule.INCOMPATIBLE_GROUPS:
            if class2 in CompatibilityRule.INCOMPATIBLE_GROUPS[class1]:
                return True
        
        if class2 in CompatibilityRule.INCOMPATIBLE_GROUPS:
            if class1 in CompatibilityRule.INCOMPATIBLE_GROUPS[class2]:
                return True
        
        return False


class TemperatureRule:
    @staticmethod
    def check_temperature_range(cabinet: Cabinet, temperature: float, record_time: datetime) -> ValidationResult:
        if not cabinet.is_low_temp:
            return ValidationResult(
                valid=True,
                message="非低温柜位，无需温度检查",
                details={'cabinet_code': cabinet.cabinet_code}
            )
        
        alerts = []
        if cabinet.min_temp is not None and temperature < cabinet.min_temp:
            alerts.append({
                'type': '低温越界',
                'current': temperature,
                'limit': cabinet.min_temp,
                'threshold': '下限'
            })
        
        if cabinet.max_temp is not None and temperature > cabinet.max_temp:
            alerts.append({
                'type': '高温越界',
                'current': temperature,
                'limit': cabinet.max_temp,
                'threshold': '上限'
            })
        
        if alerts:
            return ValidationResult(
                valid=False,
                message=f"温控异常：柜位{cabinet.name}温度{temperature}°C越界",
                details={
                    'cabinet_code': cabinet.cabinet_code,
                    'cabinet_name': cabinet.name,
                    'temperature': temperature,
                    'min_temp': cabinet.min_temp,
                    'max_temp': cabinet.max_temp,
                    'alerts': alerts,
                    'record_time': record_time.isoformat()
                }
            )
        
        return ValidationResult(
            valid=True,
            message="温度正常",
            details={
                'cabinet_code': cabinet.cabinet_code,
                'temperature': temperature
            }
        )
    
    @staticmethod
    def check_continuity(cabinet: Cabinet, gap_hours: int = 4) -> ValidationResult:
        from app.models import TemperatureRecord
        
        latest_record = TemperatureRecord.query.filter_by(
            cabinet_id=cabinet.id
        ).order_by(TemperatureRecord.record_time.desc()).first()
        
        if not latest_record:
            return ValidationResult(
                valid=True,
                message="无历史温度记录",
                details={'cabinet_code': cabinet.cabinet_code}
            )
        
        now = datetime.utcnow()
        time_gap = now - latest_record.record_time
        gap_hours_actual = time_gap.total_seconds() / 3600
        
        if gap_hours_actual > gap_hours:
            return ValidationResult(
                valid=False,
                message=f"温控断档风险：柜位{cabinet.name}已{gap_hours_actual:.1f}小时无温度记录",
                details={
                    'cabinet_code': cabinet.cabinet_code,
                    'latest_record_time': latest_record.record_time.isoformat(),
                    'gap_hours': gap_hours_actual,
                    'threshold_hours': gap_hours
                }
            )
        
        return ValidationResult(
            valid=True,
            message="温度记录连续",
            details={
                'cabinet_code': cabinet.cabinet_code,
                'latest_record_time': latest_record.record_time.isoformat(),
                'gap_hours': gap_hours_actual
            }
        )


class WasteBucketRule:
    @staticmethod
    def check_volume(bucket: WasteBucket, added_volume: float, unit: str = "mL") -> ValidationResult:
        unit_factor = 0.001 if unit == "mL" else 1.0 if unit == "L" else 1.0
        added_volume_l = added_volume * unit_factor
        
        new_volume = bucket.current_volume + added_volume_l
        
        if new_volume > bucket.max_volume:
            return ValidationResult(
                valid=False,
                message=f"废液桶容量风险：桶{bucket.bucket_code}容量不足，当前{bucket.current_volume}/{bucket.max_volume} {bucket.unit}，新增{added_volume_l} {bucket.unit}",
                details={
                    'bucket_code': bucket.bucket_code,
                    'current_volume': bucket.current_volume,
                    'max_volume': bucket.max_volume,
                    'added_volume': added_volume_l,
                    'exceed_volume': new_volume - bucket.max_volume,
                    'unit': bucket.unit
                }
            )
        
        warnings = []
        if new_volume >= bucket.max_volume * 0.8:
            warnings.append(f"即将满：已达{new_volume/bucket.max_volume*100:.0f}%")
        
        if warnings:
            return ValidationResult(
                valid=True,
                message="容量检查通过，但有警告",
                details={
                    'bucket_code': bucket.bucket_code,
                    'current_volume': bucket.current_volume,
                    'added_volume': added_volume_l,
                    'new_volume': new_volume,
                    'max_volume': bucket.max_volume,
                    'warnings': warnings
                }
            )
        
        return ValidationResult(
            valid=True,
            message="容量充足",
            details={
                'bucket_code': bucket.bucket_code,
                'new_volume': new_volume
            }
        )
    
    @staticmethod
    def check_expiry(bucket: WasteBucket) -> ValidationResult:
        now = datetime.utcnow().date()
        expiry_date = bucket.start_date + timedelta(days=bucket.expiry_days)
        
        if now > expiry_date:
            days_overdue = (now - expiry_date).days
            return ValidationResult(
                valid=False,
                message=f"废液桶逾期风险：桶{bucket.bucket_code}已逾期{days_overdue}天",
                details={
                    'bucket_code': bucket.bucket_code,
                    'start_date': bucket.start_date.isoformat(),
                    'expiry_days': bucket.expiry_days,
                    'expiry_date': expiry_date.isoformat(),
                    'current_date': now.isoformat(),
                    'days_overdue': days_overdue
                }
            )
        
        days_remaining = (expiry_date - now).days
        if days_remaining <= 7:
            return ValidationResult(
                valid=True,
                message=f"废液桶即将到期：剩余{days_remaining}天",
                details={
                    'bucket_code': bucket.bucket_code,
                    'expiry_date': expiry_date.isoformat(),
                    'days_remaining': days_remaining
                }
            )
        
        return ValidationResult(
            valid=True,
            message="废液桶在有效期内",
            details={
                'bucket_code': bucket.bucket_code,
                'days_remaining': days_remaining
            }
        )
    
    @staticmethod
    def update_bucket_status(bucket: WasteBucket) -> None:
        from app.models import WasteStatus
        
        expiry_check = WasteBucketRule.check_expiry(bucket)
        volume_ratio = bucket.current_volume / bucket.max_volume if bucket.max_volume > 0 else 0
        
        if not expiry_check.valid:
            bucket.status = WasteStatus.EXPIRED
        elif volume_ratio >= 1.0:
            bucket.status = WasteStatus.FULL
        elif volume_ratio >= 0.8:
            bucket.status = WasteStatus.WARNING
        else:
            bucket.status = WasteStatus.ACTIVE
        
        db.session.commit()


class ReviewRule:
    @staticmethod
    def check_signature(reviewed_by: str, review_comment: str) -> ValidationResult:
        if not reviewed_by or not reviewed_by.strip():
            return ValidationResult(
                valid=False,
                message="复核签名缺失",
                details={'error': 'reviewed_by不能为空'}
            )
        
        return ValidationResult(
            valid=True,
            message="复核信息完整",
            details={
                'reviewed_by': reviewed_by,
                'has_comment': bool(review_comment and review_comment.strip())
            }
        )
