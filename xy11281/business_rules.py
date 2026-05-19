from datetime import datetime
from typing import Dict, List, Tuple, Optional
from database import execute_query, get_connection


class ValidationResult:
    def __init__(self, passed: bool, reason: str = "", details: Dict = None):
        self.passed = passed
        self.reason = reason
        self.details = details or {}

    def __bool__(self):
        return self.passed


def calculate_dose(medicine_id: int, weight_kg: float) -> Tuple[float, float, float]:
    medicine = execute_query(
        'SELECT min_dose_per_kg, max_dose_per_kg, dose_unit FROM medicines WHERE id = ?',
        (medicine_id,),
        fetch=True
    )
    if not medicine:
        raise ValueError(f"Medicine {medicine_id} not found")
    
    med = medicine[0]
    min_dose = med['min_dose_per_kg'] * weight_kg
    max_dose = med['max_dose_per_kg'] * weight_kg
    recommended = (min_dose + max_dose) / 2
    
    return min_dose, recommended, max_dose


def validate_dose(medicine_id: int, weight_kg: float, prescribed_dose: float) -> ValidationResult:
    try:
        min_dose, _, max_dose = calculate_dose(medicine_id, weight_kg)
    except ValueError as e:
        return ValidationResult(False, str(e))
    
    if prescribed_dose < min_dose:
        return ValidationResult(
            False,
            f"剂量低于下限: 处方{prescribed_dose:.4f} < 最小{min_dose:.4f}",
            {"prescribed": prescribed_dose, "min": min_dose, "max": max_dose}
        )
    
    if prescribed_dose > max_dose:
        return ValidationResult(
            False,
            f"剂量超过上限: 处方{prescribed_dose:.4f} > 最大{max_dose:.4f}",
            {"prescribed": prescribed_dose, "min": min_dose, "max": max_dose}
        )
    
    return ValidationResult(
        True,
        f"剂量在范围内: {min_dose:.4f} - {prescribed_dose:.4f} - {max_dose:.4f}",
        {"prescribed": prescribed_dose, "min": min_dose, "max": max_dose}
    )


def check_contraindications(medicine_ids: List[int]) -> ValidationResult:
    if len(medicine_ids) < 2:
        return ValidationResult(True, "单药无禁忌组合检查")
    
    placeholders = ','.join(['?'] * len(medicine_ids))
    contraindications = execute_query(
        f'''
            SELECT m1.name as medicine_a, m2.name as medicine_b, c.reason
            FROM contraindications c
            JOIN medicines m1 ON c.medicine_a_id = m1.id
            JOIN medicines m2 ON c.medicine_b_id = m2.id
            WHERE c.medicine_a_id IN ({placeholders}) 
            AND c.medicine_b_id IN ({placeholders})
        ''',
        tuple(medicine_ids + medicine_ids),
        fetch=True
    )
    
    if contraindications:
        reasons = []
        for ci in contraindications:
            reasons.append(f"[{ci['medicine_a']}] 与 [{ci['medicine_b']}] 禁忌: {ci['reason']}")
        
        return ValidationResult(
            False,
            "存在禁忌组合: " + "; ".join(reasons),
            {"contraindications": contraindications}
        )
    
    return ValidationResult(True, "无禁忌组合")


def validate_batch(batch_id: int, required_quantity: int = 1) -> ValidationResult:
    batch = execute_query(
        '''
            SELECT mb.batch_number, mb.quantity, mb.expiry_date, m.name as medicine_name
            FROM medicine_batches mb
            JOIN medicines m ON mb.medicine_id = m.id
            WHERE mb.id = ?
        ''',
        (batch_id,),
        fetch=True
    )
    
    if not batch:
        return ValidationResult(False, f"批号 {batch_id} 不存在")
    
    b = batch[0]
    
    if b['quantity'] < required_quantity:
        return ValidationResult(
            False,
            f"库存不足: 批号{b['batch_number']} 现有{b['quantity']} < 需要{required_quantity}",
            {"available": b['quantity'], "required": required_quantity}
        )
    
    expiry_date = datetime.strptime(b['expiry_date'], '%Y-%m-%d').date()
    today = datetime.now().date()
    
    if expiry_date < today:
        return ValidationResult(
            False,
            f"批号已过期: {b['batch_number']} 过期日期 {b['expiry_date']}",
            {"expiry_date": b['expiry_date'], "today": str(today)}
        )
    
    days_until_expiry = (expiry_date - today).days
    if days_until_expiry <= 30:
        return ValidationResult(
            True,
            f"即将过期警告: {b['batch_number']} 还有 {days_until_expiry} 天过期",
            {"days_until_expiry": days_until_expiry}
        )
    
    return ValidationResult(
        True,
        f"批号有效: {b['batch_number']} 库存{b['quantity']}",
        {"available": b['quantity'], "batch_number": b['batch_number']}
    )


def validate_prescription_item(
    prescription_id: int,
    medicine_id: int,
    weight_kg: float,
    prescribed_dose: float,
    batch_id: Optional[int] = None
) -> Dict:
    results = {
        "dose_validation": None,
        "batch_validation": None,
        "overall_passed": True,
        "warnings": []
    }
    
    dose_result = validate_dose(medicine_id, weight_kg, prescribed_dose)
    results["dose_validation"] = {
        "passed": dose_result.passed,
        "reason": dose_result.reason,
        "details": dose_result.details
    }
    
    if not dose_result.passed:
        results["overall_passed"] = False
    
    if batch_id:
        batch_result = validate_batch(batch_id)
        results["batch_validation"] = {
            "passed": batch_result.passed,
            "reason": batch_result.reason,
            "details": batch_result.details
        }
        
        if not batch_result.passed:
            results["overall_passed"] = False
        elif "即将过期" in batch_result.reason:
            results["warnings"].append(batch_result.reason)
    
    return results


def validate_prescription(prescription_id: int) -> Dict:
    prescription = execute_query(
        'SELECT * FROM prescriptions WHERE id = ?',
        (prescription_id,),
        fetch=True
    )
    
    if not prescription:
        return {"overall_passed": False, "reason": "处方不存在"}
    
    items = execute_query(
        'SELECT * FROM prescription_items WHERE prescription_id = ?',
        (prescription_id,),
        fetch=True
    )
    
    if not items:
        return {"overall_passed": False, "reason": "处方无药品"}
    
    medicine_ids = [item['medicine_id'] for item in items]
    
    results = {
        "prescription_id": prescription_id,
        "items": [],
        "contraindication_check": None,
        "overall_passed": True,
        "warnings": []
    }
    
    contra_result = check_contraindications(medicine_ids)
    results["contraindication_check"] = {
        "passed": contra_result.passed,
        "reason": contra_result.reason,
        "details": contra_result.details
    }
    
    if not contra_result.passed:
        results["overall_passed"] = False
    
    weight_kg = prescription[0]['pet_weight_kg']
    
    for item in items:
        item_result = validate_prescription_item(
            prescription_id,
            item['medicine_id'],
            weight_kg,
            item['prescribed_dose'],
            item['batch_id']
        )
        item_result['item_id'] = item['id']
        results["items"].append(item_result)
        
        if not item_result["overall_passed"]:
            results["overall_passed"] = False
        results["warnings"].extend(item_result.get("warnings", []))
    
    return results
