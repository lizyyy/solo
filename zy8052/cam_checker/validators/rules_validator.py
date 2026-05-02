from dataclasses import dataclass
from typing import List, Dict, Set
from ..parsers.csv_parser import OrderItem
from ..parsers.json_parser import STLFile
from ..parsers.yaml_parser import MaterialRule


@dataclass
class RiskItem:
    severity: str
    message: str
    case_id: str
    tooth_number: str = ""


@dataclass
class ValidationResult:
    valid: bool
    risks: List[RiskItem]
    missing_files: List[Dict]
    merged_cases: Dict[str, Dict]


def normalize_tooth_number(tooth: str) -> str:
    tooth = tooth.strip()
    if len(tooth) == 2 and tooth[0] in "1234" and tooth[1].isdigit():
        return tooth
    return tooth


def get_tooth_side(tooth: str) -> str:
    tooth = normalize_tooth_number(tooth)
    if len(tooth) == 2:
        quadrant = tooth[0]
        if quadrant in "14":
            return "right"
        elif quadrant in "23":
            return "left"
    return "unknown"


def validate_case(
    orders: List[OrderItem],
    stl_files: List[STLFile],
    material_rules: Dict[str, MaterialRule]
) -> ValidationResult:
    risks = []
    missing_files = []
    merged_cases = {}
    valid = True

    case_orders: Dict[str, List[OrderItem]] = {}
    for order in orders:
        if order.case_id not in case_orders:
            case_orders[order.case_id] = []
        case_orders[order.case_id].append(order)

    case_stls: Dict[str, List[STLFile]] = {}
    for stl in stl_files:
        if stl.case_id not in case_stls:
            case_stls[stl.case_id] = []
        case_stls[stl.case_id].append(stl)

    all_case_ids = set(case_orders.keys()).union(set(case_stls.keys()))

    for case_id in all_case_ids:
        merged_case = {
            "case_id": case_id,
            "patient_name": "",
            "teeth": {},
            "doctor": "",
            "clinic": ""
        }

        if case_id in case_orders:
            order_list = case_orders[case_id]
            merged_case["patient_name"] = order_list[0].patient_name
            merged_case["doctor"] = order_list[0].doctor
            merged_case["clinic"] = order_list[0].clinic

            teeth_in_case: Set[str] = set()
            tooth_restorations: Dict[str, List[Dict]] = {}

            for order in order_list:
                norm_tooth = normalize_tooth_number(order.tooth_number)
                teeth_in_case.add(norm_tooth)

                if norm_tooth not in tooth_restorations:
                    tooth_restorations[norm_tooth] = []
                tooth_restorations[norm_tooth].append({
                    "restoration_type": order.restoration_type,
                    "material": order.material
                })

                if order.material in material_rules:
                    rule = material_rules[order.material]
                    if order.restoration_type not in rule.supported_restorations:
                        risks.append(RiskItem(
                            severity="high",
                            message=f"材料 {order.material} 不支持修复类型 {order.restoration_type}",
                            case_id=case_id,
                            tooth_number=norm_tooth
                        ))
                        valid = False
                    if rule.supported_teeth and norm_tooth not in rule.supported_teeth:
                        risks.append(RiskItem(
                            severity="medium",
                            message=f"材料 {order.material} 通常不用于牙位 {norm_tooth}",
                            case_id=case_id,
                            tooth_number=norm_tooth
                        ))

            if len(teeth_in_case) >= 2:
                sides = {get_tooth_side(t) for t in teeth_in_case}
                if "left" in sides and "right" in sides:
                    risks.append(RiskItem(
                        severity="warning",
                        message=f"病例 {case_id} 包含左右两侧牙位，请注意检查",
                        case_id=case_id
                    ))

            merged_case["teeth"] = tooth_restorations

        if case_id in case_stls:
            stl_list = case_stls[case_id]
            for stl in stl_list:
                norm_stl_tooth = normalize_tooth_number(stl.tooth_number)
                if case_id in case_orders:
                    order_teeth = {normalize_tooth_number(o.tooth_number) for o in case_orders[case_id]}
                    if norm_stl_tooth not in order_teeth:
                        risks.append(RiskItem(
                            severity="medium",
                            message=f"STL文件 {stl.filename} 牙位 {stl.tooth_number} 与订单牙位不一致",
                            case_id=case_id,
                            tooth_number=norm_stl_tooth
                        ))

        if case_id in case_orders:
            for order in case_orders[case_id]:
                norm_tooth = normalize_tooth_number(order.tooth_number)
                has_stl = False
                if case_id in case_stls:
                    for stl in case_stls[case_id]:
                        if normalize_tooth_number(stl.tooth_number) == norm_tooth:
                            has_stl = True
                            break
                if not has_stl:
                    missing_files.append({
                        "case_id": case_id,
                        "tooth_number": norm_tooth,
                        "patient_name": order.patient_name,
                        "restoration_type": order.restoration_type,
                        "material": order.material
                    })
                    valid = False

        if merged_case["patient_name"]:
            merged_cases[case_id] = merged_case

    return ValidationResult(
        valid=valid,
        risks=risks,
        missing_files=missing_files,
        merged_cases=merged_cases
    )
