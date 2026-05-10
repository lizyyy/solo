from datetime import date
from typing import Dict, List, Any, Optional
from hashlib import md5

from .models import (
    Animal,
    FeedFormula,
    HealthCorrectionRule,
    FeedInventory,
    RationItem,
    VerificationResult
)
from .enums import Season
from .store import store


class RationCalculator:
    @staticmethod
    def calculate_original_hash(
        animal: Animal,
        formula: FeedFormula,
        ration_date: date
    ) -> str:
        data = f"{animal.id}:{animal.weight_kg}:{animal.health_status}:{formula.id}:{ration_date}"
        return md5(data.encode()).hexdigest()

    @staticmethod
    def calculate_base_ration(
        animal: Animal,
        formula: FeedFormula
    ) -> List[Dict[str, Any]]:
        return formula.calculate_base_ingredients(animal.weight_kg)

    @staticmethod
    def apply_health_corrections(
        base_items: List[Dict[str, Any]],
        animal: Animal,
        rules: List[HealthCorrectionRule]
    ) -> tuple[List[Dict[str, Any]], List[str]]:
        corrected_items = {item["feed_name"]: dict(item) for item in base_items}
        corrections_applied = []

        for rule in rules:
            for feed_name, item in list(corrected_items.items()):
                if not rule.applies_to(animal, feed_name):
                    continue

                if feed_name in rule.remove_feeds:
                    del corrected_items[feed_name]
                    corrections_applied.append(f"移除饲料: {feed_name} (规则: {rule.description or '健康修正'})")
                    continue

                if rule.ratio_multiplier != 1.0:
                    item["quantity_kg"] = round(item["quantity_kg"] * rule.ratio_multiplier, 4)
                    corrections_applied.append(f"调整 {feed_name}: {rule.ratio_multiplier}倍 (规则: {rule.description or '健康修正'})")

                for add_ing in rule.add_ingredients:
                    if add_ing.feed_name not in corrected_items:
                        corrected_items[add_ing.feed_name] = {
                            "feed_name": add_ing.feed_name,
                            "quantity_kg": add_ing.quantity_kg,
                            "unit": "kg"
                        }
                        corrections_applied.append(f"添加饲料: {add_ing.feed_name} ({add_ing.quantity_kg}kg)")
                    else:
                        corrected_items[add_ing.feed_name]["quantity_kg"] += add_ing.quantity_kg
                        corrections_applied.append(f"补充 {add_ing.feed_name}: +{add_ing.quantity_kg}kg")

        return list(corrected_items.values()), corrections_applied


class ValidationService:
    @staticmethod
    def verify_animal_profile(animal: Animal) -> VerificationResult:
        messages = []
        warnings = []
        errors = []
        success = True

        if not animal.is_active():
            errors.append(f"动物档案状态无效: {animal.status.value}")
            success = False
        else:
            messages.append("动物档案状态有效: active")

        if animal.weight_kg <= 0:
            errors.append("体重数据异常，必须大于0")
            success = False
        else:
            messages.append(f"体重数据正常: {animal.weight_kg}kg")

        if not animal.area or len(animal.area.strip()) == 0:
            errors.append("活动区域未设置")
            success = False
        else:
            messages.append(f"活动区域已设置: {animal.area}")

        if animal.last_checkup_date:
            days_since = (date.today() - animal.last_checkup_date).days
            if days_since > 90:
                warnings.append(f"体检已超过 {days_since} 天，建议更新")
            else:
                messages.append(f"最近体检日期: {animal.last_checkup_date}")
        else:
            warnings.append("未设置最近体检日期")

        if animal.health_status.value != "healthy":
            messages.append(f"健康状态: {animal.health_status.value} (将应用健康修正)")
        else:
            messages.append("健康状态: healthy")

        return VerificationResult(
            success=success,
            stage="animal_profile",
            messages=messages,
            warnings=warnings,
            errors=errors
        )

    @staticmethod
    def verify_feed_formula(
        formula: Optional[FeedFormula],
        species: str,
        season: Season
    ) -> VerificationResult:
        messages = []
        warnings = []
        errors = []
        success = True

        if formula is None:
            errors.append(f"未找到 {species} 在 {season.value} 季节的活跃饲料配方")
            success = False
            return VerificationResult(
                success=False,
                stage="feed_formula",
                messages=messages,
                warnings=warnings,
                errors=errors
            )

        if not formula.is_active:
            errors.append(f"配方 '{formula.name}' 未激活")
            success = False
        else:
            messages.append(f"使用配方: {formula.name} (ID: {formula.id})")

        if formula.base_ratio_per_100kg <= 0:
            errors.append("配方基础比例异常，必须大于0")
            success = False
        else:
            messages.append(f"基础配比: 每100kg体重 {formula.base_ratio_per_100kg}倍配方量")

        if not formula.ingredients:
            errors.append("配方未包含任何饲料成分")
            success = False
        else:
            messages.append(f"包含 {len(formula.ingredients)} 种饲料成分")
            for ing in formula.ingredients:
                if ing.quantity_kg <= 0:
                    errors.append(f"成分 {ing.feed_name} 数量异常")
                    success = False

        if formula.source:
            messages.append(f"配方来源: {formula.source}")

        return VerificationResult(
            success=success,
            stage="feed_formula",
            messages=messages,
            warnings=warnings,
            errors=errors
        )

    @staticmethod
    def verify_inventory(items: List[RationItem]) -> VerificationResult:
        messages = []
        warnings = []
        errors = []
        success = True

        for item in items:
            inventory = store.get_inventory(item.feed_name)
            if inventory is None:
                warnings.append(f"未找到 {item.feed_name} 的库存记录，跳过库存检查")
                continue

            if inventory.is_available(item.planned_quantity_kg):
                messages.append(
                    f"{item.feed_name}: 库存充足 "
                    f"(需要 {item.planned_quantity_kg}kg, 现有 {inventory.current_qty_kg}kg)"
                )
            else:
                errors.append(
                    f"{item.feed_name}: 库存不足 "
                    f"(需要 {item.planned_quantity_kg}kg, 现有 {inventory.current_qty_kg}kg)"
                )
                success = False

            if inventory.is_below_threshold():
                warnings.append(
                    f"{item.feed_name}: 库存低于安全阈值 "
                    f"(当前 {inventory.current_qty_kg}kg, 阈值 {inventory.min_threshold_kg}kg)"
                )

        return VerificationResult(
            success=success,
            stage="inventory",
            messages=messages,
            warnings=warnings,
            errors=errors
        )

    @staticmethod
    def verify_data_consistency(
        ration_hash: Optional[str],
        animal: Animal,
        formula: FeedFormula,
        ration_date: date
    ) -> VerificationResult:
        messages = []
        warnings = []
        errors = []
        success = True

        expected_hash = RationCalculator.calculate_original_hash(animal, formula, ration_date)

        if ration_hash is None:
            warnings.append("日配计划未生成原始数据哈希，无法验证一致性")
            return VerificationResult(
                success=True,
                stage="data_consistency",
                messages=messages,
                warnings=warnings,
                errors=errors
            )

        if ration_hash == expected_hash:
            messages.append("日配计划与原始数据一致，数据完整性验证通过")
            messages.append(f"原始数据哈希: {ration_hash}")
        else:
            errors.append("日配计划与原始数据不一致，可能存在数据篡改或漏改")
            errors.append(f"记录哈希: {ration_hash}")
            errors.append(f"计算哈希: {expected_hash}")
            success = False

        return VerificationResult(
            success=success,
            stage="data_consistency",
            messages=messages,
            warnings=warnings,
            errors=errors
        )
