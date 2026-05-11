from typing import Dict, List, Tuple, Optional
from models import (
    ElderlyProfile,
    Dish,
    MealOrder,
    SubstitutionRule,
    VerificationIssue,
    VerificationResult,
    VerificationStatus,
    FailureReason
)


class AllergenVerificationEngine:
    def __init__(
        self,
        elderly_profiles: Dict[str, ElderlyProfile],
        dishes: Dict[str, Dish],
        substitution_rules: Dict[str, List[SubstitutionRule]]
    ):
        self.elderly_profiles = elderly_profiles
        self.dishes = dishes
        self.substitution_rules = substitution_rules

    def check_allergen_match(
        self,
        dish: Dish,
        elderly: ElderlyProfile
    ) -> Tuple[bool, List[str]]:
        matched_allergens = dish.allergens & elderly.known_allergens
        return (len(matched_allergens) == 0, list(matched_allergens))

    def check_dietary_compliance(
        self,
        dish: Dish,
        elderly: ElderlyProfile
    ) -> Tuple[bool, List[str]]:
        violated_restrictions = dish.dietary_tags & elderly.dietary_restrictions
        return (len(violated_restrictions) == 0, list(violated_restrictions))

    def find_valid_substitute(
        self,
        source_dish: Dish,
        elderly: ElderlyProfile,
        violation_details: List[str],
        violation_type: str
    ) -> Tuple[Optional[Dish], Optional[SubstitutionRule], List[str]]:
        if source_dish.id not in self.substitution_rules:
            return None, None, [f'未找到菜品 {source_dish.name} 的替换规则']

        matching_rules = []
        for rule in self.substitution_rules[source_dish.id]:
            rule_conditions = rule.applicable_conditions
            if any(cond in rule_conditions for cond in violation_details):
                matching_rules.append(rule)

        if not matching_rules:
            return None, None, [f'替换规则中无与违规条件 {violation_details} 匹配的规则']

        validation_issues = []
        for rule in matching_rules:
            substitute_dish = self.dishes.get(rule.substitute_dish_id)
            if not substitute_dish:
                validation_issues.append(f'替换菜品 {rule.substitute_dish_id} 不存在')
                continue

            allergen_ok, allergen_issues = self.check_allergen_match(substitute_dish, elderly)
            dietary_ok, dietary_issues = self.check_dietary_compliance(substitute_dish, elderly)

            if allergen_ok and dietary_ok:
                return substitute_dish, rule, []
            else:
                if not allergen_ok:
                    validation_issues.append(
                        f'替换菜品 {substitute_dish.name} 仍有过敏源问题: {allergen_issues}'
                    )
                if not dietary_ok:
                    validation_issues.append(
                        f'替换菜品 {substitute_dish.name} 仍有忌口问题: {dietary_issues}'
                    )

        return None, None, validation_issues

    def verify_dish_for_elderly(
        self,
        dish: Dish,
        elderly: ElderlyProfile,
        order_id: str,
        elderly_name: str
    ) -> Tuple[VerificationStatus, Optional[Dish], Optional[SubstitutionRule], List[VerificationIssue]]:
        issues = []
        substituted_dish = None
        used_rule = None

        allergen_ok, allergen_matches = self.check_allergen_match(dish, elderly)
        dietary_ok, dietary_violations = self.check_dietary_compliance(dish, elderly)

        if allergen_ok and dietary_ok:
            return VerificationStatus.PASS, None, None, []

        if not allergen_ok:
            issues.append(VerificationIssue(
                order_id=order_id,
                elderly_name=elderly_name,
                dish_name=dish.name,
                reason=FailureReason.ALLERGEN_MISMATCH,
                details=f'检测到过敏源冲突: {allergen_matches}. 老人过敏源: {list(elderly.known_allergens)}, 菜品过敏源: {list(dish.allergens)}'
            ))

            substitute, rule, substitute_issues = self.find_valid_substitute(
                dish, elderly, allergen_matches, 'allergen'
            )

            if substitute and rule:
                substituted_dish = substitute
                used_rule = rule
            else:
                for issue_detail in substitute_issues:
                    issues.append(VerificationIssue(
                        order_id=order_id,
                        elderly_name=elderly_name,
                        dish_name=dish.name,
                        reason=FailureReason.NO_VALID_SUBSTITUTE,
                        details=issue_detail
                    ))

        if not dietary_ok:
            issues.append(VerificationIssue(
                order_id=order_id,
                elderly_name=elderly_name,
                dish_name=dish.name,
                reason=FailureReason.DIETARY_RESTRICTION_VIOLATED,
                details=f'违反忌口规则: {dietary_violations}. 老人口味限制: {list(elderly.dietary_restrictions)}, 菜品标签: {list(dish.dietary_tags)}'
            ))

            if not substituted_dish:
                substitute, rule, substitute_issues = self.find_valid_substitute(
                    dish, elderly, dietary_violations, 'dietary'
                )

                if substitute and rule:
                    substituted_dish = substitute
                    used_rule = rule
                else:
                    for issue_detail in substitute_issues:
                        issues.append(VerificationIssue(
                            order_id=order_id,
                            elderly_name=elderly_name,
                            dish_name=dish.name,
                            reason=FailureReason.NO_VALID_SUBSTITUTE,
                            details=issue_detail
                        ))

        if substituted_dish:
            return VerificationStatus.NEED_MANUAL_CHECK, substituted_dish, used_rule, issues
        else:
            return VerificationStatus.FAIL, None, None, issues

    def verify_order(self, order: MealOrder) -> VerificationResult:
        result = VerificationResult(
            status=VerificationStatus.PASS,
            issues=[],
            substituted_dishes=[]
        )

        if not order.elderly_id:
            result.status = VerificationStatus.FAIL
            result.issues.append(VerificationIssue(
                order_id=order.id,
                elderly_name='未知',
                dish_name='N/A',
                reason=FailureReason.MISSING_DATA,
                details='订单缺少老人ID'
            ))
            return result

        elderly = self.elderly_profiles.get(order.elderly_id)
        if not elderly:
            result.status = VerificationStatus.FAIL
            result.issues.append(VerificationIssue(
                order_id=order.id,
                elderly_name=f'ID: {order.elderly_id}',
                dish_name='N/A',
                reason=FailureReason.MISSING_DATA,
                details=f'未找到老人档案 ID: {order.elderly_id}'
            ))
            return result

        if not order.dish_ids:
            result.status = VerificationStatus.FAIL
            result.issues.append(VerificationIssue(
                order_id=order.id,
                elderly_name=elderly.name,
                dish_name='N/A',
                reason=FailureReason.MISSING_DATA,
                details='订单缺少菜品列表'
            ))
            return result

        for dish_id in order.dish_ids:
            dish = self.dishes.get(dish_id)
            if not dish:
                result.status = VerificationStatus.FAIL
                result.issues.append(VerificationIssue(
                    order_id=order.id,
                    elderly_name=elderly.name,
                    dish_name=f'ID: {dish_id}',
                    reason=FailureReason.MISSING_DATA,
                    details=f'未找到菜品 ID: {dish_id}'
                ))
                continue

            status, substitute, rule, issues = self.verify_dish_for_elderly(
                dish, elderly, order.id, elderly.name
            )

            result.issues.extend(issues)

            if status == VerificationStatus.FAIL:
                result.status = VerificationStatus.FAIL
            elif status == VerificationStatus.NEED_MANUAL_CHECK and result.status == VerificationStatus.PASS:
                result.status = VerificationStatus.NEED_MANUAL_CHECK

            if substitute and rule:
                result.substituted_dishes.append((
                    order.id,
                    elderly.name,
                    dish.name,
                    substitute.name,
                    rule.id
                ))

        return result

    def verify_all_orders(self, orders: List[MealOrder]) -> List[VerificationResult]:
        return [self.verify_order(order) for order in orders]
