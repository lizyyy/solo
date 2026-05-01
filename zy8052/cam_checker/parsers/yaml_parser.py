import yaml
from dataclasses import dataclass
from typing import Dict, List


@dataclass
class MaterialRule:
    material: str
    supported_restorations: List[str]
    supported_teeth: List[str]


def parse_material_rules(yaml_path: str) -> Dict[str, MaterialRule]:
    rules = {}
    with open(yaml_path, "r", encoding="utf-8") as f:
        data = yaml.safe_load(f)
        for material, rule_data in data.get("materials", {}).items():
            rule = MaterialRule(
                material=material,
                supported_restorations=rule_data.get("supported_restorations", []),
                supported_teeth=rule_data.get("supported_teeth", [])
            )
            rules[material] = rule
    return rules
