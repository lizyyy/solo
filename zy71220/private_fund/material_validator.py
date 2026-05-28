"""
材料校验引擎 - 合格投资者材料过期校验、完整性校验
"""
from datetime import date, datetime
from typing import List, Dict, Tuple, Optional, Any
from .models import InvestorMaterial, MaterialStatus, MaterialType, SubscriptionOrder


class MaterialValidator:
    """材料校验引擎"""

    REQUIRED_MATERIALS = {
        MaterialType.ID_CARD: "身份证",
        MaterialType.INVESTOR_QUALIFICATION: "合格投资者认定",
        MaterialType.RISK_ASSESSMENT: "风险测评",
    }

    @classmethod
    def validate_order_materials(cls, order: SubscriptionOrder,
                                 check_date: Optional[date] = None) -> Tuple[bool, List[str], List[str]]:
        """校验订单下所有材料"""
        check_date = check_date or date.today()
        errors: List[str] = []
        warnings: List[str] = []

        if not order.materials:
            errors.append("订单无任何投资者材料")
            return False, errors, warnings

        found_types = set()
        for mat in order.materials:
            found_types.add(mat.material_type)
            mat_errors, mat_warnings = cls.validate_single_material(mat, check_date)
            errors.extend(mat_errors)
            warnings.extend(mat_warnings)

        for req_type, req_name in cls.REQUIRED_MATERIALS.items():
            if req_type not in found_types:
                errors.append(f"缺少必备材料：{req_name}")

        asset_proof = next((m for m in order.materials if m.material_type == MaterialType.ASSET_PROOF), None)
        if not asset_proof:
            warnings.append("缺少资产证明材料（建议补充）")

        is_valid = len(errors) == 0
        return is_valid, errors, warnings

    @classmethod
    def validate_single_material(cls, material: InvestorMaterial,
                                 check_date: Optional[date] = None) -> Tuple[List[str], List[str]]:
        """校验单份材料"""
        check_date = check_date or date.today()
        errors: List[str] = []
        warnings: List[str] = []

        status = material.check_valid(check_date)

        if status == MaterialStatus.EXPIRED:
            expire_str = material.expire_date.strftime('%Y-%m-%d') if material.expire_date else "未知"
            days_expired = (check_date - material.expire_date).days if material.expire_date else 0
            errors.append(
                f"材料[{material.material_type.value}]已过期{days_expired}天"
                f"（过期日期：{expire_str}，校验日期：{check_date.strftime('%Y-%m-%d')}）"
            )
        elif status == MaterialStatus.NOT_FOUND:
            errors.append(f"材料[{material.material_type.value}]未上传文件（file_path为空）")
        elif status == MaterialStatus.INCOMPLETE:
            errors.append(f"材料[{material.material_type.value}]内容不完整")

        if material.expire_date:
            days_to_expire = (material.expire_date - check_date).days
            if 0 < days_to_expire <= 30:
                warnings.append(
                    f"材料[{material.material_type.value}]将于{days_to_expire}天后过期"
                    f"（过期日期：{material.expire_date.strftime('%Y-%m-%d')}）"
                )

        return errors, warnings

    @classmethod
    def check_expiry_batch(cls, materials: List[InvestorMaterial],
                           check_date: Optional[date] = None) -> Dict[str, List[InvestorMaterial]]:
        """批量检查材料过期情况，按状态分组便于复查"""
        check_date = check_date or date.today()
        result = {
            "valid": [],
            "expiring_soon": [],
            "expired": [],
            "invalid": []
        }

        for mat in materials:
            status = mat.check_valid(check_date)
            if status == MaterialStatus.VALID:
                if mat.expire_date:
                    days_to_expire = (mat.expire_date - check_date).days
                    if 0 < days_to_expire <= 30:
                        result["expiring_soon"].append(mat)
                        continue
                result["valid"].append(mat)
            elif status == MaterialStatus.EXPIRED:
                result["expired"].append(mat)
            else:
                result["invalid"].append(mat)

        return result

    @classmethod
    def get_material_summary(cls, order: SubscriptionOrder) -> Dict[str, Any]:
        """获取材料校验完整摘要"""
        check_date = date.today()
        is_valid, errors, warnings = cls.validate_order_materials(order, check_date)

        material_details = []
        for mat in order.materials:
            mat_errors, mat_warnings = cls.validate_single_material(mat, check_date)
            material_details.append({
                "material_id": mat.material_id,
                "material_type": mat.material_type.value,
                "status": mat.status.value,
                "upload_date": mat.upload_date.strftime('%Y-%m-%d'),
                "expire_date": mat.expire_date.strftime('%Y-%m-%d') if mat.expire_date else "长期有效",
                "file_path": mat.file_path,
                "errors": mat_errors,
                "warnings": mat_warnings,
            })

        return {
            "subscription_id": order.subscription_id,
            "order_no": order.order_no,
            "investor_name": order.investor_name,
            "investor_id": order.investor_id,
            "check_date": check_date.strftime('%Y-%m-%d'),
            "is_valid": is_valid,
            "total_materials": len(order.materials),
            "valid_materials": sum(1 for m in order.materials if m.status == MaterialStatus.VALID),
            "errors": errors,
            "warnings": warnings,
            "details": material_details,
        }
