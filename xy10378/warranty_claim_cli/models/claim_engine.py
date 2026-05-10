from datetime import date, timedelta
from enum import Enum
from typing import Dict, List, Optional, Any

from warranty_claim_cli.utils.date_utils import (
    parse_date,
    days_between,
    is_valid_purchase_date,
)
from warranty_claim_cli.utils.storage import (
    load_devices,
    load_failures,
    load_inspections,
    load_warranties,
    load_materials,
    load_claims,
)


class ClaimStatus(Enum):
    ELIGIBLE = "可索赔"
    REJECTED = "拒绝索赔"
    PENDING = "待补充材料"
    SUBMITTED = "已提交"


class RejectReason(Enum):
    HUMAN_DAMAGE = "人为损坏"
    OUT_OF_WARRANTY = "超出保修期"
    MATERIAL_MISSING = "材料缺失"
    INVALID_PURCHASE_DATE = "采购日期异常"
    DUPLICATE_CLAIM = "重复索赔"


def find_device(devices: List[Dict], device_id: str) -> Optional[Dict]:
    for d in devices:
        if d.get("device_id") == device_id:
            return d
    return None


def find_failure(failures: List[Dict], failure_id: str) -> Optional[Dict]:
    for f in failures:
        if f.get("failure_id") == failure_id:
            return f
    return None


def find_inspection(inspections: List[Dict], failure_id: str) -> Optional[Dict]:
    for i in inspections:
        if i.get("failure_id") == failure_id:
            return i
    return None


def find_warranty(warranties: List[Dict], device_type: str, brand: str) -> Optional[Dict]:
    for w in warranties:
        if (w.get("device_type") == device_type and
                (w.get("brand") == brand or w.get("brand") == "*")):
            return w
    for w in warranties:
        if (w.get("device_type") == "*" and
                (w.get("brand") == brand or w.get("brand") == "*")):
            return w
    return None


def is_duplicate_claim(claims: List[Dict], failure_id: str) -> bool:
    for c in claims:
        if c.get("failure_id") == failure_id:
            return True
    return False


def is_within_warranty(purchase_date_str: str, failure_date_str: str,
                        warranty_months: int) -> bool:
    purchase_date = parse_date(purchase_date_str)
    failure_date = parse_date(failure_date_str)
    if not purchase_date or not failure_date:
        return False
    
    warranty_days = warranty_months * 30
    actual_days = days_between(purchase_date, failure_date)
    
    if actual_days is None or actual_days < 0:
        return False
    
    return actual_days <= warranty_days


def check_materials(materials: List[Dict], failure_id: str,
                     required_materials: List[str]) -> Dict[str, Any]:
    provided = set()
    for m in materials:
        if m.get("failure_id") == failure_id:
            provided.add(m.get("material_type", ""))
    
    missing = [r for r in required_materials if r not in provided]
    
    return {
        "provided": list(provided),
        "missing": missing,
        "complete": len(missing) == 0
    }


def evaluate_claim(failure_id: str) -> Dict[str, Any]:
    devices = load_devices()
    failures = load_failures()
    inspections = load_inspections()
    warranties = load_warranties()
    materials = load_materials()
    claims = load_claims()
    
    result = {
        "failure_id": failure_id,
        "status": ClaimStatus.ELIGIBLE.value,
        "reasons": [],
        "details": {},
        "device_info": None,
        "failure_info": None,
        "inspection_info": None,
        "warranty_info": None,
        "material_info": None
    }
    
    if is_duplicate_claim(claims, failure_id):
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(RejectReason.DUPLICATE_CLAIM.value)
        result["details"]["duplicate_check"] = "该故障已提交过索赔，不可重复申请"
    
    failure = find_failure(failures, failure_id)
    if not failure:
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(f"故障记录不存在: {failure_id}")
        return result
    
    result["failure_info"] = failure
    device_id = failure.get("device_id")
    
    device = find_device(devices, device_id)
    if not device:
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(f"设备台账不存在: {device_id}")
        return result
    
    result["device_info"] = device
    purchase_date = device.get("purchase_date")
    
    if not is_valid_purchase_date(purchase_date):
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(RejectReason.INVALID_PURCHASE_DATE.value)
        result["details"]["purchase_date_check"] = f"采购日期格式异常或超出合理范围: {purchase_date}"
    
    device_type = device.get("device_type", "")
    brand = device.get("brand", "")
    
    warranty = find_warranty(warranties, device_type, brand)
    result["warranty_info"] = warranty
    
    if not warranty:
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(f"未找到保修条款 (设备类型: {device_type}, 品牌: {brand})")
        return result
    
    inspection = find_inspection(inspections, failure_id)
    if not inspection:
        result["status"] = ClaimStatus.PENDING.value
        result["reasons"].append(RejectReason.MATERIAL_MISSING.value)
        result["details"]["material_check"] = "缺少维修鉴定报告"
        return result
    
    result["inspection_info"] = inspection
    
    if inspection.get("is_human_damage"):
        result["status"] = ClaimStatus.REJECTED.value
        result["reasons"].append(RejectReason.HUMAN_DAMAGE.value)
        result["details"]["damage_check"] = "经鉴定为非自然损坏（人为/意外损坏），不在保修范围内"
        return result
    
    failure_date = failure.get("failure_date")
    warranty_months = warranty.get("warranty_months", 12)
    
    if result["status"] == ClaimStatus.ELIGIBLE.value:
        if not is_within_warranty(purchase_date, failure_date, warranty_months):
            result["status"] = ClaimStatus.REJECTED.value
            result["reasons"].append(RejectReason.OUT_OF_WARRANTY.value)
            result["details"]["warranty_check"] = (
                f"故障发生时已超出保修期: 采购日期 {purchase_date}, "
                f"故障日期 {failure_date}, 保修期 {warranty_months} 个月"
            )
    
    required_materials = warranty.get("required_materials", [
        "维修申请单",
        "故障照片",
        "维修鉴定报告"
    ])
    
    material_check = check_materials(materials, failure_id, required_materials)
    result["material_info"] = material_check
    
    if result["status"] == ClaimStatus.ELIGIBLE.value and not material_check["complete"]:
        result["status"] = ClaimStatus.PENDING.value
        result["reasons"].append(RejectReason.MATERIAL_MISSING.value)
        result["details"]["material_check"] = (
            f"缺少索赔材料: {', '.join(material_check['missing'])}"
        )
    
    if result["status"] == ClaimStatus.ELIGIBLE.value:
        result["details"]["summary"] = (
            f"设备 {device.get('device_name', device_id)} ({device.get('serial_number', '')}) "
            f"在保修期内发生自然故障，材料齐全，符合索赔条件"
        )
    
    return result


def evaluate_all_claims() -> List[Dict[str, Any]]:
    failures = load_failures()
    results = []
    for f in failures:
        failure_id = f.get("failure_id")
        if failure_id:
            results.append(evaluate_claim(failure_id))
    return results
