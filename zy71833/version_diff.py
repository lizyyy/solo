from typing import Dict, List, Tuple, Any, Optional
from models import BattleMaterial, BattleRecord, BattleResult
from datetime import datetime


class VersionDiff:
    def __init__(self):
        pass

    def compare_materials(
        self,
        old_material: BattleMaterial,
        new_material: BattleMaterial
    ) -> Dict[str, Dict[str, Any]]:
        diff = {}

        old_dict = old_material.to_dict()
        new_dict = new_material.to_dict()

        top_level_fields = ["source", "terrain", "weather", "version"]
        for field in top_level_fields:
            if old_dict.get(field) != new_dict.get(field):
                diff[field] = {
                    "old": old_dict.get(field),
                    "new": new_dict.get(field),
                    "type": "metadata",
                    "impact": self._assess_field_impact(field),
                }

        if old_dict.get("turn_order") != new_dict.get("turn_order"):
            diff["turn_order"] = {
                "old": old_dict["turn_order"],
                "new": new_dict["turn_order"],
                "type": "critical",
                "impact": "high",
                "details": self._diff_turn_order(
                    old_dict["turn_order"],
                    new_dict["turn_order"]
                ),
            }

        if sorted(old_dict.get("special_rules", [])) != sorted(new_dict.get("special_rules", [])):
            diff["special_rules"] = {
                "old": old_dict.get("special_rules", []),
                "new": new_dict.get("special_rules", []),
                "type": "rules",
                "impact": "high",
                "details": self._diff_list(
                    old_dict.get("special_rules", []),
                    new_dict.get("special_rules", [])
                ),
            }

        units_diff = self._diff_units(old_dict["units"], new_dict["units"])
        if units_diff:
            diff["units"] = {
                "changes": units_diff,
                "type": "units",
                "impact": self._assess_units_impact(units_diff),
            }

        return diff

    def compare_results(
        self,
        old_result: Optional[BattleResult],
        new_result: Optional[BattleResult]
    ) -> Dict[str, Any]:
        if old_result is None and new_result is None:
            return {}
        if old_result is None:
            return {
                "result_change": {
                    "old": None,
                    "new": new_result.to_dict(),
                    "type": "new_result",
                    "impact": "high",
                }
            }
        if new_result is None:
            return {
                "result_change": {
                    "old": old_result.to_dict(),
                    "new": None,
                    "type": "result_cleared",
                    "impact": "high",
                }
            }

        diff = {}
        old_dict = old_result.to_dict()
        new_dict = new_result.to_dict()

        if old_dict["winner"] != new_dict["winner"]:
            diff["winner"] = {
                "old": old_dict["winner"],
                "new": new_dict["winner"],
                "type": "critical",
                "impact": "high",
                "description": "胜负结果发生变化",
            }

        if old_dict["total_turns"] != new_dict["total_turns"]:
            diff["total_turns"] = {
                "old": old_dict["total_turns"],
                "new": new_dict["total_turns"],
                "type": "timing",
                "impact": "medium",
            }

        if abs(old_dict["balance_score"] - new_dict["balance_score"]) > 5:
            diff["balance_score"] = {
                "old": old_dict["balance_score"],
                "new": new_dict["balance_score"],
                "delta": round(new_dict["balance_score"] - old_dict["balance_score"], 2),
                "type": "balance",
                "impact": "high",
            }

        if old_dict["issues"] != new_dict["issues"]:
            diff["issues"] = {
                "old": old_dict["issues"],
                "new": new_dict["issues"],
                "details": self._diff_list(old_dict["issues"], new_dict["issues"]),
                "type": "issues",
                "impact": "medium",
            }

        if old_dict["final_hp"] != new_dict["final_hp"]:
            hp_diff = {}
            for uid in set(old_dict["final_hp"].keys()) | set(new_dict["final_hp"].keys()):
                old_hp = old_dict["final_hp"].get(uid, 0)
                new_hp = new_dict["final_hp"].get(uid, 0)
                if old_hp != new_hp:
                    hp_diff[uid] = {"old": old_hp, "new": new_hp}
            if hp_diff:
                diff["final_hp"] = {
                    "changes": hp_diff,
                    "type": "final_state",
                    "impact": "medium",
                }

        return diff

    def generate_diff_report(
        self,
        record: BattleRecord,
        new_material: BattleMaterial
    ) -> Dict[str, Any]:
        material_diff = self.compare_materials(record.material, new_material)

        old_result = record.result
        new_result_simulated = None

        return {
            "record_id": record.record_id,
            "timestamp": datetime.now().isoformat(),
            "material_diff": material_diff,
            "old_material_version": record.material.version,
            "new_material_version": new_material.version,
            "has_conflicts": len(material_diff) > 0,
            "high_impact_changes": [
                field for field, data in material_diff.items()
                if data.get("impact") == "high"
            ],
            "warnings": self._generate_warnings(material_diff),
        }

    def _diff_units(
        self,
        old_units: List[Dict[str, Any]],
        new_units: List[Dict[str, Any]]
    ) -> List[Dict[str, Any]]:
        changes = []
        old_by_id = {u["unit_id"]: u for u in old_units}
        new_by_id = {u["unit_id"]: u for u in new_units}

        for uid in set(old_by_id.keys()) | set(new_by_id.keys()):
            if uid not in old_by_id:
                changes.append({
                    "unit_id": uid,
                    "action": "added",
                    "unit": new_by_id[uid],
                })
            elif uid not in new_by_id:
                changes.append({
                    "unit_id": uid,
                    "action": "removed",
                    "unit": old_by_id[uid],
                })
            else:
                old_u = old_by_id[uid]
                new_u = new_by_id[uid]
                field_changes = {}
                for field in ["name", "hp", "attack", "defense", "speed"]:
                    if old_u.get(field) != new_u.get(field):
                        field_changes[field] = {
                            "old": old_u.get(field),
                            "new": new_u.get(field),
                        }
                if sorted(old_u.get("skills", [])) != sorted(new_u.get("skills", [])):
                    field_changes["skills"] = {
                        "old": old_u.get("skills", []),
                        "new": new_u.get("skills", []),
                        "details": self._diff_list(
                            old_u.get("skills", []),
                            new_u.get("skills", [])
                        ),
                    }
                if field_changes:
                    changes.append({
                        "unit_id": uid,
                        "action": "modified",
                        "fields": field_changes,
                    })
        return changes

    def _diff_turn_order(self, old: List[str], new: List[str]) -> Dict[str, Any]:
        return {
            "removed": [x for x in old if x not in new],
            "added": [x for x in new if x not in old],
            "reordering": old != new and set(old) == set(new),
        }

    def _diff_list(self, old: List[str], new: List[str]) -> Dict[str, List[str]]:
        old_set = set(old)
        new_set = set(new)
        return {
            "removed": sorted(list(old_set - new_set)),
            "added": sorted(list(new_set - old_set)),
            "common": sorted(list(old_set & new_set)),
        }

    def _assess_field_impact(self, field: str) -> str:
        high_impact = ["terrain", "weather"]
        medium_impact = ["source"]
        if field in high_impact:
            return "high"
        elif field in medium_impact:
            return "medium"
        return "low"

    def _assess_units_impact(self, changes: List[Dict[str, Any]]) -> str:
        has_stat_change = False
        has_add_remove = False
        for change in changes:
            if change["action"] in ["added", "removed"]:
                has_add_remove = True
            elif change["action"] == "modified":
                for field in change.get("fields", {}):
                    if field in ["hp", "attack", "defense", "speed", "skills"]:
                        old_val = change["fields"][field].get("old")
                        new_val = change["fields"][field].get("new")
                        if field in ["skills"]:
                            if sorted(old_val) != sorted(new_val):
                                has_stat_change = True
                        elif abs(old_val - new_val) > 5 if isinstance(old_val, (int, float)) else old_val != new_val:
                            has_stat_change = True
        if has_add_remove or has_stat_change:
            return "high"
        return "medium"

    def _generate_warnings(self, diff: Dict[str, Any]) -> List[str]:
        warnings = []
        for field, data in diff.items():
            if data.get("impact") == "high":
                if field == "turn_order":
                    warnings.append("⚠️ 回合顺序已变更，可能完全改变战斗结果！")
                elif field == "units":
                    warnings.append("⚠️ 单位配置有重大变更，平衡性需要重新评估")
                elif field == "special_rules":
                    warnings.append("⚠️ 特殊规则已变更，战斗逻辑将受影响")
                elif field == "terrain":
                    warnings.append(f"⚠️ 地形从 {data['old']} 改为 {data['new']}，攻防修正将变化")
                elif field == "weather":
                    warnings.append(f"⚠️ 天气从 {data['old']} 改为 {data['new']}，攻防修正将变化")
        return warnings
