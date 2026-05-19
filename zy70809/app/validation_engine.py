from datetime import date
from typing import List, Dict, Any, Tuple
from collections import defaultdict
from app.models import ResultType, RuleType
from app.excel_parser import to_json_str

def validate_all(
    equipment_list: List[Dict[str, Any]],
    photo_list: List[Dict[str, Any]],
    contract_list: List[Dict[str, Any]],
    today: date = None
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    
    if today is None:
        today = date.today()
    
    normal_items = []
    pending_confirm_items = []
    failed_items = []
    
    photos_by_equipment = defaultdict(list)
    for photo in photo_list:
        photos_by_equipment[photo["equipment_code"]].append(photo)
    
    contracts_by_equipment = defaultdict(list)
    for contract in contract_list:
        contracts_by_equipment[contract["equipment_code"]].append(contract)
    
    for equipment in equipment_list:
        equipment_code = equipment["equipment_code"]
        equipment_failures = []
        equipment_pending = []
        
        if check_expired(equipment, today):
            equipment_failures.append(create_validation_result(
                equipment_code, RuleType.EXPIRED, equipment,
                "维保已过期，请立即安排维保并更新维保日期"
            ))
        
        if check_multiple_contracts(equipment_code, contracts_by_equipment):
            contracts = contracts_by_equipment[equipment_code]
            equipment_pending.append(create_validation_result(
                equipment_code, RuleType.MULTIPLE_CONTRACTS,
                {"equipment": equipment, "contracts": contracts},
                f"设备存在{len(contracts)}份有效合同，请确认合同归属关系"
            ))
        
        if check_photo_missing(equipment_code, photos_by_equipment):
            equipment_failures.append(create_validation_result(
                equipment_code, RuleType.PHOTO_MISSING, equipment,
                "缺少巡检照片，请补拍上传后再次提交"
            ))
        
        if equipment_failures:
            failed_items.extend(equipment_failures)
        elif equipment_pending:
            pending_confirm_items.extend(equipment_pending)
            normal_items.append(equipment)
        else:
            normal_items.append(equipment)
    
    return normal_items, pending_confirm_items, failed_items

def check_expired(equipment: Dict[str, Any], today: date) -> bool:
    next_date = equipment.get("next_maintenance_date")
    if next_date is None:
        return True
    return next_date < today

def check_multiple_contracts(equipment_code: str, contracts_by_equipment: Dict[str, List]) -> bool:
    contracts = contracts_by_equipment.get(equipment_code, [])
    return len(contracts) > 1

def check_photo_missing(equipment_code: str, photos_by_equipment: Dict[str, List]) -> bool:
    photos = photos_by_equipment.get(equipment_code, [])
    return len(photos) == 0

def create_validation_result(
    equipment_code: str,
    rule_type: RuleType,
    original_data: Any,
    suggestion: str
) -> Dict[str, Any]:
    return {
        "equipment_code": equipment_code,
        "result_type": ResultType.FAILED if rule_type in [RuleType.EXPIRED, RuleType.PHOTO_MISSING] else ResultType.PENDING_CONFIRM,
        "rule_type": rule_type,
        "original_data": to_json_str(original_data),
        "suggestion": suggestion
    }

def get_expired_equipment(equipment_list: List[Dict[str, Any]], today: date = None) -> List[Dict[str, Any]]:
    if today is None:
        today = date.today()
    return [eq for eq in equipment_list if check_expired(eq, today)]
