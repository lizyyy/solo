from decimal import Decimal
from typing import Dict, List, Optional, Set

from .models import (
    Inventory,
    Material,
    RecipeTarget,
    ElementLimit,
    WeighingPlan,
    CalculationResult,
    ElementResult,
)


class FormulaSolver:
    def __init__(self):
        self.precision = Decimal("0.0001")

    def solve(
        self,
        inventory: Inventory,
        recipe: RecipeTarget,
    ) -> CalculationResult:
        warnings: List[str] = []
        available_materials = self._filter_available_materials(
            inventory, recipe.forbidden_materials
        )

        element_sources = self._map_element_sources(
            available_materials, recipe.element_limits.keys()
        )

        for element in recipe.element_limits.keys():
            if element not in element_sources or not element_sources[element]:
                warnings.append(f"元素 {element} 没有可用原料提供")

        grams_per_liter_to_ppm = Decimal("1000")

        total_grams_needed: Dict[str, Decimal] = {}
        element_contributions: Dict[str, Dict[str, Decimal]] = {}

        for material in available_materials:
            total_grams_needed[material.name] = Decimal("0")
            element_contributions[material.name] = {}

        for material in available_materials:
            for element in material.element_composition.keys():
                element_contributions[material.name][element] = Decimal("0")

        special_elements = ["CA", "MG", "P"]
        other_elements = [
            e for e in recipe.element_limits.keys()
            if e not in special_elements
        ]

        for element in special_elements:
            if element not in recipe.element_limits:
                continue

            limit = recipe.element_limits[element]
            sources = element_sources.get(element, [])

            if not sources:
                continue

            primary_source = self._select_primary_source(sources, element)
            if not primary_source:
                warnings.append(f"元素 {element} 无法找到合适的主要来源")
                continue

            target_mid = (limit.min_ppm + limit.max_ppm) / Decimal("2")
            target_grams = (target_mid / grams_per_liter_to_ppm) * recipe.target_volume_liters

            element_per_gram = primary_source.get_element_content(element)
            if element_per_gram <= 0:
                continue

            grams_needed = target_grams / element_per_gram

            if grams_needed > primary_source.remaining_grams:
                warnings.append(
                    f"元素 {element} 原料 {primary_source.name} 库存不足 "
                    f"(需要 {grams_needed.normalize():.4f}g, 剩余 {primary_source.remaining_grams.normalize():.4f}g)"
                )
                grams_needed = primary_source.remaining_grams

            total_grams_needed[primary_source.name] += grams_needed

            for elem, ratio in primary_source.element_composition.items():
                content = ratio * primary_source.purity
                element_contributions[primary_source.name][elem] = (
                    total_grams_needed[primary_source.name] * content
                )

        for material in available_materials:
            if total_grams_needed[material.name] > material.remaining_grams:
                warnings.append(
                    f"原料 {material.name} 用量将超过库存 "
                    f"(需要 {total_grams_needed[material.name].normalize():.4f}g, "
                    f"剩余 {material.remaining_grams.normalize():.4f}g), 将进行调整"
                )

        self._adjust_for_overuse(
            total_grams_needed, element_contributions, available_materials,
            recipe, grams_per_liter_to_ppm
        )

        for element in other_elements:
            if element not in recipe.element_limits:
                continue

            limit = recipe.element_limits[element]
            current_actual = self._calculate_element_actual(
                element, element_contributions, recipe.target_volume_liters, grams_per_liter_to_ppm
            )

            if current_actual >= limit.min_ppm and current_actual <= limit.max_ppm:
                continue

            if current_actual > limit.max_ppm:
                warnings.append(
                    f"元素 {element} 已超过上限: 当前 {current_actual.normalize():.2f}ppm, 上限 {limit.max_ppm}ppm"
                )
                continue

            deficit = limit.min_ppm - current_actual
            if deficit <= 0:
                continue

            sources = [
                m for m in element_sources.get(element, [])
                if self._is_single_element_source(m, element)
            ]

            if not sources:
                warnings.append(
                    f"元素 {element} 不足，缺少单一元素来源调整 "
                    f"(当前 {current_actual.normalize():.2f}ppm, 需要至少 {limit.min_ppm}ppm)"
                )
                continue

            source = sources[0]
            deficit_grams = (deficit / grams_per_liter_to_ppm) * recipe.target_volume_liters
            element_per_gram = source.get_element_content(element)

            if element_per_gram <= 0:
                continue

            add_grams = deficit_grams / element_per_gram
            available = source.remaining_grams - total_grams_needed.get(source.name, Decimal("0"))

            if add_grams > available:
                warnings.append(
                    f"元素 {element} 原料 {source.name} 不足以补充差额 "
                    f"(需要补充 {add_grams.normalize():.4f}g, 可用 {available.normalize():.4f}g)"
                )
                add_grams = available

            total_grams_needed[source.name] = total_grams_needed.get(source.name, Decimal("0")) + add_grams

            for elem, ratio in source.element_composition.items():
                content = ratio * source.purity
                element_contributions[source.name][elem] = (
                    total_grams_needed[source.name] * content
                )

        plans: List[WeighingPlan] = []
        total_cost = Decimal("0")

        for material in available_materials:
            grams = total_grams_needed.get(material.name, Decimal("0"))
            if grams <= 0:
                continue

            if grams > material.remaining_grams:
                warnings.append(
                    f"警告: 原料 {material.name} 用量 {grams.normalize():.4f}g "
                    f"超过库存 {material.remaining_grams.normalize():.4f}g，已截断到库存上限"
                )
                grams = material.remaining_grams

            cost = grams * material.price_per_gram
            total_cost += cost

            elem_contrib: Dict[str, Decimal] = {}
            for elem, ratio in material.element_composition.items():
                content = ratio * material.purity
                elem_contrib[elem] = grams * content

            plans.append(WeighingPlan(
                material_name=material.name,
                grams_needed=grams,
                cost=cost,
                element_contributions=elem_contrib,
            ))

        element_results: Dict[str, ElementResult] = {}
        all_actuals: Dict[str, Decimal] = {}

        for element in recipe.element_limits.keys():
            limit = recipe.element_limits[element]
            actual_ppm = self._calculate_element_actual(
                element, element_contributions, recipe.target_volume_liters, grams_per_liter_to_ppm
            )
            all_actuals[element] = actual_ppm

            target_mid = (limit.min_ppm + limit.max_ppm) / Decimal("2")
            deviation = actual_ppm - target_mid

            if target_mid > 0:
                deviation_percent = (deviation / target_mid) * Decimal("100")
            else:
                deviation_percent = Decimal("0")

            if actual_ppm < limit.min_ppm:
                status = "below"
            elif actual_ppm > limit.max_ppm:
                status = "above"
            else:
                status = "ok"

            element_results[element] = ElementResult(
                element=element,
                target_min_ppm=limit.min_ppm,
                target_max_ppm=limit.max_ppm,
                actual_ppm=actual_ppm,
                deviation=deviation,
                deviation_percent=deviation_percent,
                status=status,
            )

        is_feasible = all(
            result.is_within_range for result in element_results.values()
        )

        return CalculationResult(
            volume_liters=recipe.target_volume_liters,
            plans=plans,
            total_cost=total_cost,
            element_results=element_results,
            warnings=warnings,
            is_feasible=is_feasible,
        )

    def _filter_available_materials(
        self, inventory: Inventory, forbidden: List[str]
    ) -> List[Material]:
        forbidden_set = set(forbidden)
        return [
            m for m in inventory.list_materials()
            if m.name not in forbidden_set and m.remaining_grams > 0
        ]

    def _map_element_sources(
        self, materials: List[Material], target_elements: Set[str]
    ) -> Dict[str, List[Material]]:
        sources: Dict[str, List[Material]] = {}
        for material in materials:
            for element in material.element_composition.keys():
                if element in target_elements:
                    if element not in sources:
                        sources[element] = []
                    sources[element].append(material)
        return sources

    def _select_primary_source(
        self, sources: List[Material], element: str
    ) -> Optional[Material]:
        if not sources:
            return None

        scored = []
        for source in sources:
            content = source.get_element_content(element)
            other_elements = len(source.element_composition) - 1
            score = content * Decimal("1") - Decimal(other_elements) * Decimal("0.1")
            scored.append((score, source))

        scored.sort(key=lambda x: x[0], reverse=True)
        return scored[0][1]

    def _is_single_element_source(self, material: Material, element: str) -> bool:
        return len(material.element_composition) == 1 and element in material.element_composition

    def _calculate_element_actual(
        self,
        element: str,
        contributions: Dict[str, Dict[str, Decimal]],
        volume_liters: Decimal,
        grams_to_ppm_factor: Decimal,
    ) -> Decimal:
        total_grams = Decimal("0")
        for material_contrib in contributions.values():
            total_grams += material_contrib.get(element, Decimal("0"))

        if volume_liters <= 0:
            return Decimal("0")

        ppm = (total_grams / volume_liters) * grams_to_ppm_factor
        return ppm

    def _adjust_for_overuse(
        self,
        total_grams_needed: Dict[str, Decimal],
        element_contributions: Dict[str, Dict[str, Decimal]],
        materials: List[Material],
        recipe: RecipeTarget,
        grams_per_liter_to_ppm: Decimal,
    ) -> None:
        material_map = {m.name: m for m in materials}

        for material_name in list(total_grams_needed.keys()):
            needed = total_grams_needed[material_name]
            material = material_map.get(material_name)

            if not material or needed <= material.remaining_grams:
                continue

            ratio = material.remaining_grams / needed if needed > 0 else Decimal("1")

            total_grams_needed[material_name] = material.remaining_grams

            for elem, ratio_elem in material.element_composition.items():
                content = ratio_elem * material.purity
                element_contributions[material_name][elem] = (
                    total_grams_needed[material_name] * content
                )
