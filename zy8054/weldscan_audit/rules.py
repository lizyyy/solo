from typing import List, Dict
from .parser import AcceptanceRule, Weld, INCH_TO_MM
from .geometry import Defect


def apply_rules(
    defects: List[Defect],
    rules: List[AcceptanceRule],
    welds: Dict[str, Weld],
) -> List[Defect]:
    for defect in defects:
        weld = welds.get(defect.weld_id)
        if not weld:
            continue

        applicable_rules = []
        for rule in rules:
            max_depth_mm = (
                rule.max_depth * INCH_TO_MM if rule.unit == "inch" else rule.max_depth
            )
            max_length_mm = (
                rule.max_length * INCH_TO_MM if rule.unit == "inch" else rule.max_length
            )

            if (
                defect.depth_mm <= max_depth_mm
                and defect.amplitude >= rule.amplitude_threshold
            ):
                applicable_rules.append(rule)

        if applicable_rules:
            applicable_rules.sort(key=lambda r: r.severity_level, reverse=True)
            most_severe = applicable_rules[0]
            defect.severity_level = most_severe.severity_level
            defect.rule_name = most_severe.name
        else:
            defect.severity_level = 0
            defect.rule_name = "No rule applied"

    defects.sort(key=lambda d: (-d.severity_level, d.depth_mm))
    return defects


def generate_summary(defects: List[Defect]) -> Dict[str, int]:
    summary = {
        "total_defects": len(defects),
        "critical": 0,
        "major": 0,
        "minor": 0,
        "acceptable": 0,
    }

    for defect in defects:
        if defect.severity_level >= 3:
            summary["critical"] += 1
        elif defect.severity_level == 2:
            summary["major"] += 1
        elif defect.severity_level == 1:
            summary["minor"] += 1
        else:
            summary["acceptable"] += 1

    return summary
