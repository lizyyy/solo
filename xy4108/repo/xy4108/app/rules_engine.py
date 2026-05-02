from typing import List, Dict, Optional, Tuple
from datetime import date
from .models import Child, MenuItem, Ingredient, SubstitutionRequest, BlockRecord, BatchStatus, SubstitutionStatus, AllergenType
import re


ALLERGEN_KEYWORDS = {
    AllergenType.NUT: ["坚果", "杏仁", "核桃", "腰果", "榛子", "栗子", "开心果", "夏威夷果", "nut", "almond", "walnut", "cashew", "hazelnut", "pistachio"],
    AllergenType.DAIRY: ["牛奶", "乳制品", "奶粉", "奶酪", "黄油", "酸奶", "奶油", "milk", "dairy", "cheese", "butter", "yogurt", "cream"],
    AllergenType.EGG: ["鸡蛋", "蛋", "蛋清", "蛋黄", "egg", "eggs"],
    AllergenType.WHEAT: ["小麦", "面粉", "面筋", "wheat", "flour", "gluten"],
    AllergenType.SOY: ["大豆", "黄豆", "酱油", "豆腐", "豆浆", "soy", "soybean", "tofu"],
    AllergenType.FISH: ["鱼", "三文鱼", "鳕鱼", "金枪鱼", "fish", "salmon", "cod", "tuna"],
    AllergenType.SHELLFISH: ["虾", "蟹", "龙虾", "贝类", "牡蛎", "扇贝", "shellfish", "shrimp", "crab", "lobster"],
    AllergenType.PEANUT: ["花生", "peanut"],
    AllergenType.SESAME: ["芝麻", "sesame"],
    AllergenType.MUSTARD: ["芥末", "mustard"],
}


class AllergenRulesEngine:
    @staticmethod
    def parse_allergens(text: Optional[str]) -> List[str]:
        if not text:
            return []
        return [a.strip() for a in re.split(r'[,，、;；]', text) if a.strip()]

    @staticmethod
    def match_allergens(child_allergens: List[str], dish_allergens: List[str]) -> List[str]:
        matched = []
        child_lower = [a.lower() for a in child_allergens]
        
        for dish_allergen in dish_allergens:
            dish_lower = dish_allergen.lower()
            for allergen_type, keywords in ALLERGEN_KEYWORDS.items():
                if dish_lower in [k.lower() for k in keywords] or any(k.lower() in dish_lower for k in keywords):
                    for child_allergen in child_lower:
                        if any(k.lower() in child_allergen for k in keywords) or child_allergen in [k.lower() for k in keywords]:
                            if allergen_type.value not in matched:
                                matched.append(allergen_type.value)
                            break
        return matched

    @staticmethod
    def check_forbidden_foods(child_forbidden: List[str], dish_ingredients: List[str]) -> List[str]:
        matched = []
        child_lower = [f.strip().lower() for f in child_forbidden if f.strip()]
        dish_lower = [i.strip().lower() for i in dish_ingredients if i.strip()]
        
        for forbidden in child_lower:
            if forbidden in dish_lower or any(forbidden in ingredient for ingredient in dish_lower):
                matched.append(forbidden)
        return matched

    @staticmethod
    def check_child_dish_compatibility(child: Child, menu_item: MenuItem) -> Dict:
        child_allergens = AllergenRulesEngine.parse_allergens(child.allergens)
        child_forbidden = AllergenRulesEngine.parse_allergens(child.forbidden_foods)
        dish_allergens = AllergenRulesEngine.parse_allergens(menu_item.allergens)
        dish_ingredients = AllergenRulesEngine.parse_allergens(menu_item.ingredients)

        matched_allergens = AllergenRulesEngine.match_allergens(child_allergens, dish_allergens)
        matched_forbidden = AllergenRulesEngine.check_forbidden_foods(child_forbidden, dish_ingredients)

        has_allergen_conflict = len(matched_allergens) > 0
        has_forbidden_conflict = len(matched_forbidden) > 0
        has_conflict = has_allergen_conflict or has_forbidden_conflict

        risk_level = "低风险"
        recommendation = "可正常分餐"

        if has_conflict:
            if has_allergen_conflict:
                risk_level = "高风险"
                recommendation = f"禁止分餐！检测到过敏原冲突：{', '.join(matched_allergens)}"
            else:
                risk_level = "中风险"
                recommendation = f"需确认禁忌食材：{', '.join(matched_forbidden)}"

        return {
            "child_name": child.name,
            "student_id": child.student_id,
            "class_name": child.class_name,
            "dish_name": menu_item.dish_name,
            "meal_type": menu_item.meal_type,
            "menu_date": menu_item.menu_date,
            "has_conflict": has_conflict,
            "has_allergen_conflict": has_allergen_conflict,
            "has_forbidden_conflict": has_forbidden_conflict,
            "matched_allergens": matched_allergens,
            "matched_forbidden": matched_forbidden,
            "risk_level": risk_level,
            "recommendation": recommendation
        }


class BatchRulesEngine:
    @staticmethod
    def check_batch_recall(ingredient: Ingredient) -> bool:
        return ingredient.status == BatchStatus.RECALLED

    @staticmethod
    def check_batch_expired(ingredient: Ingredient, check_date: date = None) -> bool:
        if check_date is None:
            check_date = date.today()
        if ingredient.expiry_date:
            return ingredient.expiry_date < check_date
        return False

    @staticmethod
    def check_dish_uses_recalled_batch(menu_item: MenuItem, ingredients: List[Ingredient]) -> Dict:
        dish_ingredients = AllergenRulesEngine.parse_allergens(menu_item.ingredients)
        dish_lower = [i.lower() for i in dish_ingredients]

        recalled_used = []
        expired_used = []

        for ing in ingredients:
            if ing.name.lower() in dish_lower or any(i in ing.name.lower() for i in dish_lower):
                if BatchRulesEngine.check_batch_recall(ing):
                    recalled_used.append({
                        "name": ing.name,
                        "batch_number": ing.batch_number,
                        "reason": ing.recall_reason
                    })
                if BatchRulesEngine.check_batch_expired(ing):
                    expired_used.append({
                        "name": ing.name,
                        "batch_number": ing.batch_number,
                        "expiry_date": ing.expiry_date
                    })

        return {
            "has_recalled": len(recalled_used) > 0,
            "has_expired": len(expired_used) > 0,
            "recalled_ingredients": recalled_used,
            "expired_ingredients": expired_used,
            "is_safe": len(recalled_used) == 0 and len(expired_used) == 0
        }


class SubstitutionRulesEngine:
    @staticmethod
    def can_approve_substitution(request: SubstitutionRequest) -> Tuple[bool, str]:
        if request.status != SubstitutionStatus.PENDING:
            return False, "只有待审批状态的申请可以审批"
        if not request.substitution_dish:
            return False, "替餐菜品不能为空"
        return True, "可以审批"

    @staticmethod
    def can_reject_substitution(request: SubstitutionRequest) -> Tuple[bool, str]:
        if request.status != SubstitutionStatus.PENDING:
            return False, "只有待审批状态的申请可以拒绝"
        return True, "可以拒绝"

    @staticmethod
    def can_implement_substitution(request: SubstitutionRequest) -> Tuple[bool, str]:
        if request.status != SubstitutionStatus.APPROVED:
            return False, "只有已批准状态的申请可以执行"
        return True, "可以执行"

    @staticmethod
    def get_valid_status_transitions(current_status: SubstitutionStatus) -> List[SubstitutionStatus]:
        transitions = {
            SubstitutionStatus.PENDING: [SubstitutionStatus.APPROVED, SubstitutionStatus.REJECTED],
            SubstitutionStatus.APPROVED: [SubstitutionStatus.IMPLEMENTED, SubstitutionStatus.REJECTED],
            SubstitutionStatus.REJECTED: [],
            SubstitutionStatus.IMPLEMENTED: [],
        }
        return transitions.get(current_status, [])
