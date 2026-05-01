from typing import List, Dict, Any
from collections import Counter


class MetricsCalculator:
    def __init__(self, validation_results: List):
        self.results = validation_results

    def field_level_accuracy(self) -> Dict[str, float]:
        total_fields = 0
        correct_fields = 0

        for result in self.results:
            if not result.errors:
                correct_fields += 1

            ing_match = result.ingredient_match
            if ing_match:
                total_fields += ing_match.get("total_golden", 0)
                correct_fields += ing_match.get("matched", 0)

        accuracy = (correct_fields / total_fields * 100) if total_fields > 0 else 0
        return {
            "field_accuracy_percent": round(accuracy, 2),
            "total_fields": total_fields,
            "correct_fields": correct_fields
        }

    def common_confusions(self) -> Dict[str, Any]:
        confusion_types = Counter()
        ingredient_confusions = Counter()
        heat_level_confusions = Counter()

        for result in self.results:
            for err in result.errors:
                err_type = err.get("type", "unknown")
                confusion_types[err_type] += 1

                if err_type == "heat_level_mismatch":
                    key = f"{err.get('expected_heat')} -> {err.get('actual_heat')}"
                    heat_level_confusions[key] += 1
                elif err_type in ("quantity_mismatch", "unit_mismatch", "missing_ingredient", "extra_ingredient"):
                    ingredient_confusions[err.get("ingredient", "unknown")] += 1

        return {
            "error_type_distribution": dict(confusion_types),
            "top_ingredient_confusions": dict(ingredient_confusions.most_common(10)),
            "top_heat_level_confusions": dict(heat_level_confusions.most_common(10))
        }

    def step_order_statistics(self) -> Dict[str, Any]:
        total_recipes = len(self.results)
        recipes_with_order_issues = 0
        total_step_errors = 0

        for result in self.results:
            if result.step_order_errors:
                recipes_with_order_issues += 1
                total_step_errors += len(result.step_order_errors)

        return {
            "total_recipes": total_recipes,
            "recipes_with_order_issues": recipes_with_order_issues,
            "order_issue_rate_percent": round(recipes_with_order_issues / total_recipes * 100, 2) if total_recipes > 0 else 0,
            "total_step_order_errors": total_step_errors
        }

    def missing_field_statistics(self) -> Dict[str, Any]:
        missing_counts = Counter()
        recipes_with_missing = 0

        for result in self.results:
            has_missing = False
            for err in result.errors:
                if err.get("type") in ("missing_ingredient", "missing_field"):
                    missing_counts[err.get("field", "unknown")] += 1
                    has_missing = True
            if has_missing:
                recipes_with_missing += 1

        return {
            "total_missing_fields": sum(missing_counts.values()),
            "missing_by_field": dict(missing_counts),
            "recipes_with_missing_fields": recipes_with_missing
        }

    def summary(self) -> Dict[str, Any]:
        return {
            "field_level_accuracy": self.field_level_accuracy(),
            "common_confusions": self.common_confusions(),
            "step_order_statistics": self.step_order_statistics(),
            "missing_field_statistics": self.missing_field_statistics(),
            "total_recipes_evaluated": len(self.results),
            "total_errors": sum(len(r.errors) for r in self.results),
            "total_warnings": sum(len(r.warnings) for r in self.results)
        }