from __future__ import annotations
from copy import deepcopy
from datetime import datetime
from typing import Dict, List, Optional, Tuple

from .models import (
    Conflict,
    ConflictSeverity,
    OrderItem,
    PlaybackResult,
    PriceRule,
    RuleStatus,
    RuleType,
    SampleOrder,
    SKUInfo,
    ValidationResult,
)


class PriceEngine:
    def __init__(self):
        pass

    @staticmethod
    def _is_rule_applicable(rule: PriceRule, sku_info: SKUInfo, coupons: List[str]) -> bool:
        if rule.status in {RuleStatus.INACTIVE, RuleStatus.REVERTED, RuleStatus.DRAFT}:
            return False
        if rule.valid_from and datetime.now() < rule.valid_from:
            return False
        if rule.valid_to and datetime.now() > rule.valid_to:
            return False
        if rule.type == RuleType.COUPON:
            if rule.coupon_code and rule.coupon_code not in coupons:
                return False
        if rule.skus and sku_info.sku not in rule.skus:
            return False
        if rule.categories and sku_info.category not in rule.categories:
            return False
        if rule.brands and sku_info.brand not in rule.brands:
            return False
        return True

    @staticmethod
    def _apply_single_rule(rule: PriceRule, sku_info: SKUInfo) -> float:
        price = sku_info.original_price
        if rule.type == RuleType.DIRECT_DISCOUNT:
            if rule.discount_percent is not None:
                price = price * (1 - rule.discount_percent / 100)
            if rule.discount_value is not None:
                price = price - rule.discount_value
        elif rule.type == RuleType.MULTIBUY:
            if rule.buy_count and rule.get_free:
                effective_qty = sku_info.quantity
                groups = effective_qty // (rule.buy_count + rule.get_free)
                paid_items = groups * rule.buy_count + (effective_qty % (rule.buy_count + rule.get_free))
                if paid_items > 0:
                    per_item = (paid_items * sku_info.original_price) / effective_qty
                    price = per_item
        elif rule.type in {RuleType.CATEGORY, RuleType.BRAND}:
            if rule.discount_percent is not None:
                price = price * (1 - rule.discount_percent / 100)
            if rule.discount_value is not None:
                price = price - rule.discount_value
        elif rule.type == RuleType.COUPON:
            if rule.discount_percent is not None:
                price = price * (1 - rule.discount_percent / 100)
            if rule.discount_value is not None:
                price = price - rule.discount_value
        return max(0, price)

    @staticmethod
    def _calculate_order_total(items: List[Dict], coupons: List[str], rules: List[PriceRule], strict_block: bool = False) -> Tuple[float, List[str], List[Dict]]:
        final_items = []
        applied_rule_ids = []
        total = 0.0
        sorted_rules = sorted(rules, key=lambda r: r.priority, reverse=True)
        for item in items:
            sku_info = SKUInfo(
                sku=item["sku"],
                name=item.get("name", ""),
                original_price=item["original_price"],
                category=item.get("category"),
                brand=item.get("brand"),
                quantity=item.get("quantity", 1),
            )
            applied_item_rules = []
            current_price = sku_info.original_price
            for rule in sorted_rules:
                if not PriceEngine._is_rule_applicable(rule, sku_info, coupons):
                    continue
                if not rule.can_overlay and applied_item_rules:
                    continue
                if rule.exclude_rule_ids:
                    has_conflict = any(rid in rule.exclude_rule_ids for rid in applied_item_rules)
                    if has_conflict and strict_block:
                        continue
                current_price = PriceEngine._apply_single_rule(rule, sku_info)
                applied_item_rules.append(rule.id)
                if rule.id not in applied_rule_ids:
                    applied_rule_ids.append(rule.id)
                if not rule.can_overlay:
                    break
            item_total = current_price * sku_info.quantity
            final_items.append({
                "sku": sku_info.sku,
                "original_price": sku_info.original_price,
                "final_price": current_price,
                "quantity": sku_info.quantity,
                "total_final": item_total,
                "applied_rules": applied_item_rules,
            })
            total += item_total
        return round(total, 2), applied_rule_ids, final_items

    def calculate_sample(
        self,
        sample: SampleOrder,
        rules: List[PriceRule],
        strict_block: bool = False,
    ) -> PlaybackResult:
        items_data = []
        expected_original = 0.0
        for item in sample.items:
            items_data.append({
                "sku": item.sku,
                "original_price": item.original_price,
                "quantity": item.quantity,
            })
            expected_original += item.original_price * item.quantity
        actual_final, applied_rules, final_items = self._calculate_order_total(
            items_data,
            sample.applied_coupons,
            rules,
            strict_block=strict_block,
        )
        diff = actual_final - sample.expected_total_final
        passed = abs(diff) < 0.01
        message = None
        if not passed:
            message = f"预期 {sample.expected_total_final:.2f}，实际 {actual_final:.2f}，差额 {diff:.2f}"
        return PlaybackResult(
            sample_id=sample.id,
            passed=passed,
            expected=sample.expected_total_final,
            actual=actual_final,
            diff=diff,
            applied_rules=applied_rules,
            items=final_items,
            message=message,
        )

    def detect_conflicts(
        self,
        rules: List[PriceRule],
        sku_catalog: Optional[Dict[str, Dict]] = None,
    ) -> List[Conflict]:
        conflicts = []
        active_rules = [r for r in rules if r.status not in {
            RuleStatus.INACTIVE, RuleStatus.REVERTED, RuleStatus.DRAFT
        }]
        conflict_id = 1
        for i, rule1 in enumerate(active_rules):
            for rule2 in active_rules[i + 1:]:
                c = self._check_pair_conflict(rule1, rule2, sku_catalog)
                if c:
                    c.id = f"CONF-{conflict_id:04d}"
                    conflicts.append(c)
                    conflict_id += 1
        return conflicts

    def _check_pair_conflict(
        self,
        rule1: PriceRule,
        rule2: PriceRule,
        sku_catalog: Optional[Dict[str, Dict]],
    ) -> Optional[Conflict]:
        if rule1.id == rule2.id:
            return None
        overlap_skus = self._find_sku_overlap(rule1, rule2, sku_catalog)
        if not overlap_skus:
            return None
        if rule1.exclude_rule_ids and rule2.id in rule1.exclude_rule_ids:
            return None
        if rule2.exclude_rule_ids and rule1.id in rule2.exclude_rule_ids:
            return None
        severity, description = self._assess_conflict_severity(rule1, rule2)
        if severity is None:
            return None
        suggestion = self._build_suggestion(rule1, rule2)
        return Conflict(
            id="",
            rule_ids=[rule1.id, rule2.id],
            severity=severity,
            description=description,
            affected_skus=overlap_skus,
            suggestion=suggestion,
        )

    def _find_sku_overlap(
        self,
        rule1: PriceRule,
        rule2: PriceRule,
        sku_catalog: Optional[Dict[str, Dict]],
    ) -> List[str]:
        if rule1.skus and rule2.skus:
            return sorted(set(rule1.skus) & set(rule2.skus))
        if sku_catalog:
            r1_skus = self._expand_rule_skus(rule1, sku_catalog)
            r2_skus = self._expand_rule_skus(rule2, sku_catalog)
            return sorted(r1_skus & r2_skus)
        has_category_overlap = bool(set(rule1.categories) & set(rule2.categories))
        has_brand_overlap = bool(set(rule1.brands) & set(rule2.brands))
        if has_category_overlap or has_brand_overlap:
            return ["<overlap-by-category-or-brand>"]
        return []

    @staticmethod
    def _expand_rule_skus(rule: PriceRule, catalog: Dict[str, Dict]) -> set:
        result = set()
        for sku, info in catalog.items():
            if rule.skus and sku not in rule.skus:
                continue
            if rule.categories and info.get("category") not in rule.categories:
                continue
            if rule.brands and info.get("brand") not in rule.brands:
                continue
            result.add(sku)
        return result

    def _assess_conflict_severity(self, rule1: PriceRule, rule2: PriceRule) -> Tuple[Optional[ConflictSeverity], str]:
        if not rule1.can_overlay or not rule2.can_overlay:
            return (
                ConflictSeverity.HIGH,
                f"规则「{rule1.name}」和「{rule2.name}」存在叠加风险：至少有一个规则标记为不可叠加，但可能同时生效"
            )
        has_both_percent = rule1.discount_percent is not None and rule2.discount_percent is not None
        has_both_value = rule1.discount_value is not None and rule2.discount_value is not None
        if has_both_percent:
            total = (rule1.discount_percent or 0) + (rule2.discount_percent or 0)
            if total >= 80:
                return (
                    ConflictSeverity.CRITICAL,
                    f"规则「{rule1.name}」和「{rule2.name}」折扣叠加后高达 {total:.1f}%，可能造成重大亏损"
                )
            if total >= 50:
                return (
                    ConflictSeverity.HIGH,
                    f"规则「{rule1.name}」和「{rule2.name}」折扣叠加后为 {total:.1f}%，需要关注"
                )
        if has_both_value:
            return (
                ConflictSeverity.MEDIUM,
                f"规则「{rule1.name}」和「{rule2.name}」均设置了直减金额，叠加后金额较大"
            )
        if has_both_percent or has_both_value:
            return (
                ConflictSeverity.LOW,
                f"规则「{rule1.name}」和「{rule2.name}」可能叠加生效"
            )
        return None, ""

    def _build_suggestion(self, rule1: PriceRule, rule2: PriceRule) -> str:
        if rule1.priority != rule2.priority:
            higher = rule1 if rule1.priority > rule2.priority else rule2
            lower = rule2 if rule1.priority > rule2.priority else rule1
            return f"当前优先级：「{higher.name}」(p={higher.priority}) >「{lower.name}」(p={lower.priority})。建议确认优先级是否正确，或设置 exclude_rule_ids 明确互斥关系。"
        return f"两条规则优先级相同。建议：1) 调整 priority 区分优先级；2) 对不需要叠加的规则设置 can_overlay=false；3) 用 exclude_rule_ids 明确互斥。"

    def validate_changes(
        self,
        new_or_updated_rules: List[PriceRule],
        existing_rules: List[PriceRule],
        samples: List[SampleOrder],
        sku_catalog: Optional[Dict[str, Dict]] = None,
        fail_on_critical: bool = True,
        fail_on_sample_failure: bool = True,
    ) -> ValidationResult:
        errors: List[str] = []
        warnings: List[str] = []
        merged_rules = deepcopy(existing_rules)
        existing_by_id = {r.id: r for r in existing_rules}
        for rule in new_or_updated_rules:
            if rule.id in existing_by_id:
                existing_by_id[rule.id] = rule
            else:
                merged_rules.append(rule)
        merged_rules = list(existing_by_id.values()) + [
            r for r in merged_rules if r.id not in existing_by_id
        ]
        for rule in new_or_updated_rules:
            errs = self._validate_single_rule(rule)
            errors.extend(errs)
        conflicts = self.detect_conflicts(merged_rules, sku_catalog)
        critical_conflicts = [c for c in conflicts if c.severity == ConflictSeverity.CRITICAL]
        if critical_conflicts:
            msg = f"检测到 {len(critical_conflicts)} 个严重冲突"
            if fail_on_critical:
                errors.append(msg)
            else:
                warnings.append(msg)
        sample_results = []
        sample_failures = 0
        for sample in samples:
            pr = self.calculate_sample(sample, merged_rules)
            sample_results.append(pr.model_dump())
            if not pr.passed:
                sample_failures += 1
        if sample_failures > 0:
            msg = f"{sample_failures}/{len(samples)} 个样例回放失败"
            if fail_on_sample_failure:
                errors.append(msg)
            else:
                warnings.append(msg)
        success = len(errors) == 0
        return ValidationResult(
            success=success,
            errors=errors,
            warnings=warnings,
            conflicts=conflicts,
            sample_results=sample_results,
        )

    def _validate_single_rule(self, rule: PriceRule) -> List[str]:
        errs = []
        if not rule.id or not rule.id.strip():
            errs.append("规则 id 不能为空")
        if not rule.name or not rule.name.strip():
            errs.append("规则名称不能为空")
        if rule.discount_percent is not None and (rule.discount_percent < 0 or rule.discount_percent > 100):
            errs.append(f"规则「{rule.name}」折扣百分比 {rule.discount_percent} 超出 0-100 范围")
        if rule.type == RuleType.MULTIBUY:
            if rule.buy_count is None or rule.buy_count <= 0:
                errs.append(f"规则「{rule.name}」买赠规则缺少有效的 buy_count")
            if rule.get_free is None or rule.get_free < 0:
                errs.append(f"规则「{rule.name}」买赠规则缺少有效的 get_free")
        if rule.valid_from and rule.valid_to and rule.valid_from > rule.valid_to:
            errs.append(f"规则「{rule.name}」生效时间晚于失效时间")
        return errs
