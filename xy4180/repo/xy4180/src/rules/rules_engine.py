from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any
from decimal import Decimal

from src.storage.database import DAOFactory
from src.models.models import (
    Material, Team, BorrowRecord, BorrowItem,
    ReturnRecord, ReturnItem, AnomalyRecord,
    MaterialStatus, ReturnStatus
)


class AnomalyType(str, Enum):
    DUPLICATE_RETURN = "重复归还"
    MISSING_ITEMS = "缺件"
    WEIGHT_ANOMALY = "重量异常"
    DEPOSIT_MISMATCH = "押金不匹配"
    OVERDUE_RETURN = "超时未归还"
    UNKNOWN_MATERIAL = "未知物资"


@dataclass
class RuleResult:
    passed: bool
    anomaly_type: Optional[AnomalyType] = None
    message: str = ""
    details: Dict[str, Any] = field(default_factory=dict)
    severity: str = "warning"


class RulesEngine:
    WEIGHT_TOLERANCE_PERCENT = 0.05
    WEIGHT_TOLERANCE_KG = 0.5
    
    def __init__(self):
        self.dao_factory = DAOFactory
    
    def check_duplicate_return(
        self,
        barcode: str,
        borrow_record_id: int
    ) -> RuleResult:
        material_dao = self.dao_factory.get_material_dao()
        return_item_dao = self.dao_factory.get_return_item_dao()
        
        material = material_dao.get_by_barcode(barcode)
        
        if not material:
            return RuleResult(
                passed=True,
                anomaly_type=AnomalyType.UNKNOWN_MATERIAL,
                message=f"物资条形码 {barcode} 未在物资清单中找到",
                details={"barcode": barcode},
                severity="error"
            )
        
        return_items = return_item_dao.get_by_material(material.id)
        
        for return_item in return_items:
            return_record = self.dao_factory.get_return_record_dao().get_by_id(
                return_item.return_record_id
            )
            if return_record and return_record.borrow_record_id == borrow_record_id:
                return RuleResult(
                    passed=False,
                    anomaly_type=AnomalyType.DUPLICATE_RETURN,
                    message=f"物资 {barcode} ({material.material_name}) 已在本次借出记录中归还过",
                    details={
                        "barcode": barcode,
                        "material_name": material.material_name,
                        "borrow_record_id": borrow_record_id,
                        "previous_return_id": return_item.id
                    },
                    severity="error"
                )
        
        return RuleResult(passed=True, message="无重复归还")
    
    def check_missing_items(
        self,
        borrow_record_id: int,
        returned_barcodes: List[str]
    ) -> RuleResult:
        borrow_record_dao = self.dao_factory.get_borrow_record_dao()
        borrow_item_dao = self.dao_factory.get_borrow_item_dao()
        material_dao = self.dao_factory.get_material_dao()
        
        borrow_record = borrow_record_dao.get_with_items(borrow_record_id)
        if not borrow_record:
            return RuleResult(
                passed=False,
                message=f"借出记录 {borrow_record_id} 不存在",
                severity="error"
            )
        
        borrow_items = borrow_item_dao.get_by_borrow_record(borrow_record_id)
        
        expected_barcodes = set()
        for item in borrow_items:
            material = material_dao.get_by_id(item.material_id)
            if material:
                for _ in range(item.quantity - item.returned_quantity):
                    expected_barcodes.add(material.barcode)
        
        returned_set = set(returned_barcodes)
        missing_barcodes = expected_barcodes - returned_set
        
        if missing_barcodes:
            missing_materials = []
            for barcode in missing_barcodes:
                material = material_dao.get_by_barcode(barcode)
                if material:
                    missing_materials.append({
                        "barcode": barcode,
                        "name": material.material_name,
                        "type": material.material_type
                    })
            
            return RuleResult(
                passed=False,
                anomaly_type=AnomalyType.MISSING_ITEMS,
                message=f"缺少 {len(missing_barcodes)} 件物资",
                details={
                    "missing_count": len(missing_barcodes),
                    "expected_count": len(expected_barcodes),
                    "returned_count": len(returned_barcodes),
                    "missing_materials": missing_materials
                },
                severity="warning"
            )
        
        return RuleResult(passed=True, message="所有物资均已归还")
    
    def check_weight_anomaly(
        self,
        barcode: str,
        measured_weight_kg: float
    ) -> RuleResult:
        material_dao = self.dao_factory.get_material_dao()
        
        material = material_dao.get_by_barcode(barcode)
        if not material:
            return RuleResult(
                passed=True,
                message=f"物资 {barcode} 未知，跳过重量校验",
                severity="info"
            )
        
        expected_weight = material.weight_kg
        if expected_weight <= 0:
            return RuleResult(
                passed=True,
                message=f"物资 {barcode} 未设置标准重量，跳过重量校验",
                severity="info"
            )
        
        percent_tolerance = expected_weight * self.WEIGHT_TOLERANCE_PERCENT
        tolerance = max(percent_tolerance, self.WEIGHT_TOLERANCE_KG)
        
        min_acceptable = expected_weight - tolerance
        max_acceptable = expected_weight + tolerance
        
        if measured_weight_kg < min_acceptable or measured_weight_kg > max_acceptable:
            diff_percent = ((measured_weight_kg - expected_weight) / expected_weight) * 100
            diff_kg = measured_weight_kg - expected_weight
            
            return RuleResult(
                passed=False,
                anomaly_type=AnomalyType.WEIGHT_ANOMALY,
                message=f"物资 {barcode} 重量异常: 实测 {measured_weight_kg}kg vs 标准 {expected_weight}kg",
                details={
                    "barcode": barcode,
                    "material_name": material.material_name,
                    "expected_weight": expected_weight,
                    "measured_weight": measured_weight_kg,
                    "difference_kg": diff_kg,
                    "difference_percent": diff_percent,
                    "tolerance": tolerance,
                    "acceptable_range": f"{min_acceptable} - {max_acceptable}"
                },
                severity="warning"
            )
        
        return RuleResult(
            passed=True,
            message=f"重量正常: {measured_weight_kg}kg (标准: {expected_weight}kg)",
            details={
                "expected_weight": expected_weight,
                "measured_weight": measured_weight_kg,
                "tolerance": tolerance
            }
        )
    
    def check_deposit_mismatch(
        self,
        borrow_record_id: int,
        deposit_returned: float
    ) -> RuleResult:
        borrow_record_dao = self.dao_factory.get_borrow_record_dao()
        
        borrow_record = borrow_record_dao.get_by_id(borrow_record_id)
        if not borrow_record:
            return RuleResult(
                passed=False,
                message=f"借出记录 {borrow_record_id} 不存在",
                severity="error"
            )
        
        expected_deposit = borrow_record.deposit_amount or 0.0
        
        if abs(deposit_returned - expected_deposit) > 0.01:
            return RuleResult(
                passed=False,
                anomaly_type=AnomalyType.DEPOSIT_MISMATCH,
                message=f"押金不匹配: 应退 {expected_deposit} 元 vs 实退 {deposit_returned} 元",
                details={
                    "borrow_record_id": borrow_record_id,
                    "expected_deposit": expected_deposit,
                    "actual_returned": deposit_returned,
                    "difference": deposit_returned - expected_deposit
                },
                severity="warning"
            )
        
        return RuleResult(
            passed=True,
            message=f"押金匹配: {deposit_returned} 元",
            details={
                "expected_deposit": expected_deposit,
                "actual_returned": deposit_returned
            }
        )
    
    def check_overdue(
        self,
        borrow_record_id: int,
        return_date: Optional[datetime] = None
    ) -> RuleResult:
        borrow_record_dao = self.dao_factory.get_borrow_record_dao()
        
        borrow_record = borrow_record_dao.get_by_id(borrow_record_id)
        if not borrow_record:
            return RuleResult(
                passed=False,
                message=f"借出记录 {borrow_record_id} 不存在",
                severity="error"
            )
        
        if not borrow_record.expected_return_date:
            return RuleResult(
                passed=True,
                message="未设置预计归还日期，跳过超时检查",
                severity="info"
            )
        
        actual_return = return_date or datetime.now()
        expected_return = borrow_record.expected_return_date
        
        if actual_return > expected_return:
            overdue_seconds = (actual_return - expected_return).total_seconds()
            overdue_days = overdue_seconds / (24 * 3600)
            
            return RuleResult(
                passed=False,
                anomaly_type=AnomalyType.OVERDUE_RETURN,
                message=f"超时归还: 预计 {expected_return.strftime('%Y-%m-%d %H:%M')}, 实际 {actual_return.strftime('%Y-%m-%d %H:%M')}, 超时 {overdue_days:.1f} 天",
                details={
                    "borrow_record_id": borrow_record_id,
                    "expected_return": expected_return.isoformat(),
                    "actual_return": actual_return.isoformat(),
                    "overdue_days": round(overdue_days, 1),
                    "overdue_seconds": int(overdue_seconds)
                },
                severity="warning"
            )
        
        return RuleResult(
            passed=True,
            message="按时归还",
            details={
                "expected_return": expected_return.isoformat(),
                "actual_return": actual_return.isoformat()
            }
        )
    
    def check_all_return_rules(
        self,
        borrow_record_id: int,
        barcodes: List[str],
        measured_weights: Dict[str, float],
        deposit_returned: float,
        return_date: Optional[datetime] = None
    ) -> List[RuleResult]:
        results = []
        
        for barcode in barcodes:
            duplicate_result = self.check_duplicate_return(
                barcode=barcode,
                borrow_record_id=borrow_record_id
            )
            if not duplicate_result.passed:
                results.append(duplicate_result)
        
        missing_result = self.check_missing_items(
            borrow_record_id=borrow_record_id,
            returned_barcodes=barcodes
        )
        if not missing_result.passed:
            results.append(missing_result)
        
        for barcode, weight in measured_weights.items():
            if barcode in barcodes:
                weight_result = self.check_weight_anomaly(
                    barcode=barcode,
                    measured_weight_kg=weight
                )
                if not weight_result.passed:
                    results.append(weight_result)
        
        deposit_result = self.check_deposit_mismatch(
            borrow_record_id=borrow_record_id,
            deposit_returned=deposit_returned
        )
        if not deposit_result.passed:
            results.append(deposit_result)
        
        overdue_result = self.check_overdue(
            borrow_record_id=borrow_record_id,
            return_date=return_date
        )
        if not overdue_result.passed:
            results.append(overdue_result)
        
        return results
    
    def create_anomaly_record(self, rule_result: RuleResult, **kwargs) -> Optional[AnomalyRecord]:
        if not rule_result.anomaly_type:
            return None
        
        anomaly_dao = self.dao_factory.get_anomaly_record_dao()
        
        return anomaly_dao.create(
            anomaly_type=rule_result.anomaly_type.value,
            borrow_record_id=kwargs.get("borrow_record_id"),
            return_record_id=kwargs.get("return_record_id"),
            material_id=kwargs.get("material_id"),
            team_id=kwargs.get("team_id"),
            description=rule_result.message,
            is_resolved=False
        )


def get_rules_engine() -> RulesEngine:
    return RulesEngine()
