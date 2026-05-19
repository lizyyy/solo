from typing import List, Tuple
from models import RecordStatus, ExceptionType, Elderly
from schemas import MealValidationResult
import re


DIABETES_FORBIDDEN = {
    "糖", "蜂蜜", "蛋糕", "巧克力", "糖果", "冰淇淋", "奶茶", "可乐",
    "雪碧", "果汁", "甜点", "月饼", "汤圆", "粽子", "蜜饯", "果酱",
    "红糖", "白糖", "冰糖", "糖浆", "甜甜圈", "马卡龙", "曲奇", "饼干"
}


class MealValidator:
    @staticmethod
    def check_diabetes_risk(menu_items: str, elderly: Elderly) -> Tuple[bool, List[str]]:
        if not elderly.chronic_conditions or "糖尿病" not in elderly.chronic_conditions:
            return False, []

        warnings = []
        for forbidden in DIABETES_FORBIDDEN:
            if forbidden in menu_items:
                warnings.append(f"菜单包含糖尿病禁忌食物：{forbidden}")

        return len(warnings) > 0, warnings

    @staticmethod
    def check_allergy_risk(menu_items: str, elderly: Elderly) -> Tuple[bool, List[str]]:
        if not elderly.allergies:
            return False, []

        allergies = [a.strip() for a in elderly.allergies.split(",") if a.strip()]
        warnings = []

        for allergy in allergies:
            if allergy and allergy in menu_items:
                warnings.append(f"菜单包含过敏食材：{allergy}")

        return len(warnings) > 0, warnings

    @staticmethod
    def check_dietary_restrictions(menu_items: str, elderly: Elderly) -> Tuple[bool, List[str]]:
        if not elderly.dietary_restrictions:
            return False, []

        restrictions = [r.strip() for r in elderly.dietary_restrictions.split(",") if r.strip()]
        warnings = []

        for restriction in restrictions:
            if restriction and restriction in menu_items:
                warnings.append(f"菜单包含饮食禁忌食物：{restriction}")

        return len(warnings) > 0, warnings

    @staticmethod
    def validate_meal(menu_items: str, elderly: Elderly) -> MealValidationResult:
        all_warnings = []

        allergy_risk, allergy_warnings = MealValidator.check_allergy_risk(menu_items, elderly)
        all_warnings.extend(allergy_warnings)

        diabetes_risk, diabetes_warnings = MealValidator.check_diabetes_risk(menu_items, elderly)
        all_warnings.extend(diabetes_warnings)

        dietary_risk, dietary_warnings = MealValidator.check_dietary_restrictions(menu_items, elderly)
        all_warnings.extend(dietary_warnings)

        if allergy_risk:
            return MealValidationResult(
                status=RecordStatus.BLOCKED,
                exception_type=ExceptionType.ALLERGY_RISK,
                reason="；".join(allergy_warnings),
                warnings=all_warnings
            )

        if diabetes_risk:
            return MealValidationResult(
                status=RecordStatus.BLOCKED,
                exception_type=ExceptionType.DIABETES_RISK,
                reason="；".join(diabetes_warnings),
                warnings=all_warnings
            )

        if dietary_risk:
            return MealValidationResult(
                status=RecordStatus.BLOCKED,
                exception_type=ExceptionType.DIABETES_RISK,
                reason="；".join(dietary_warnings),
                warnings=all_warnings
            )

        return MealValidationResult(
            status=RecordStatus.PASSED,
            exception_type=ExceptionType.NO_EXCEPTION,
            reason="配餐符合所有饮食要求",
            warnings=[]
        )
