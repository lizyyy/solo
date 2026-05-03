from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional, Set, Tuple

from ..timeline import Batch, CleaningRecord, TimelineEvent


class AllergenRiskRules:
    """过敏原风险判断规则"""

    def __init__(self, rules_config: Dict[str, Any]):
        self.rules = rules_config
        self.high_risk_allergens = set(
            rules_config.get("high_risk_allergens", [])
        )
        self.cross_contamination_matrix = rules_config.get(
            "cross_contamination_matrix", {}
        )
        self.cleaning_grace_hours = rules_config.get("cleaning_grace_hours", 4)

    def has_allergen_risk(
        self, prev_batch: Batch, next_batch: Batch
    ) -> Tuple[bool, List[str]]:
        """判断两个批次之间是否存在过敏原风险"""
        risks = []
        
        prev_allergens = set(prev_batch.product_info.allergens)
        next_allergens = set(next_batch.product_info.allergens)
        
        if not prev_allergens:
            return False, []
        
        new_allergens_in_prev = prev_allergens - next_allergens
        
        for allergen in new_allergens_in_prev:
            risk_level = self._get_risk_level(allergen)
            risks.append(
                f"过敏原 '{allergen}' 存在于上一批次 ({prev_batch.batch_id}) "
                f"但不存在于当前批次 ({next_batch.batch_id})，风险等级: {risk_level}"
            )
            
            if allergen in self.high_risk_allergens:
                risks.append(
                    f"⚠️ 高风险过敏原 '{allergen}' 需要额外验证"
                )
        
        return len(risks) > 0, risks

    def _get_risk_level(self, allergen: str) -> str:
        """获取过敏原风险等级"""
        if allergen in self.high_risk_allergens:
            return "高"
        return "中"

    def is_cleaning_required(
        self, prev_batch: Batch, next_batch: Batch
    ) -> bool:
        """判断是否需要清洁"""
        has_risk, _ = self.has_allergen_risk(prev_batch, next_batch)
        return has_risk


class CleaningVerificationRules:
    """清洁验证记录规则"""

    def __init__(self, rules_config: Dict[str, Any]):
        self.rules = rules_config
        self.required_swab_points = rules_config.get("required_swab_points", [])
        self.swab_validity_hours = rules_config.get("swab_validity_hours", 24)
        self.critical_equipment = set(rules_config.get("critical_equipment", []))
        self._build_equipment_swab_mapping()

    def _build_equipment_swab_mapping(self):
        """构建设备到 swab 点位的映射（基于命名约定）"""
        self.equipment_swab_map: Dict[str, Set[str]] = {}
        
        production_lines = self.rules.get("production_lines", [])
        for line in production_lines:
            line_name = line.get("name", "")
            equipment_list = line.get("equipment", [])
            line_swab_points = set()
            
            for swab in self.required_swab_points:
                swab_parts = swab.split("-")
                if len(swab_parts) >= 2:
                    swab_line_id = "-".join(swab_parts[1:-1]) if len(swab_parts) > 2 else swab_parts[1]
                    for eq in equipment_list:
                        eq_parts = eq.split("-")
                        if len(eq_parts) >= 2:
                            eq_line_id = "-".join(eq_parts[1:])
                            if swab_line_id == eq_line_id or swab_line_id in eq:
                                line_swab_points.add(swab)
            
            for eq in equipment_list:
                if eq not in self.equipment_swab_map:
                    self.equipment_swab_map[eq] = set()
                self.equipment_swab_map[eq].update(line_swab_points)

    def _get_relevant_swab_points(self, target_equipment: Set[str]) -> Set[str]:
        """获取与目标设备相关的 swab 点位"""
        relevant = set()
        
        for eq in target_equipment:
            if eq in self.equipment_swab_map:
                relevant.update(self.equipment_swab_map[eq])
            else:
                eq_parts = eq.split("-")
                if len(eq_parts) >= 2:
                    eq_line_id = "-".join(eq_parts[1:])
                    for swab in self.required_swab_points:
                        if eq_line_id in swab:
                            relevant.add(swab)
        
        if not relevant and target_equipment:
            relevant = set(self.required_swab_points)
        
        return relevant

    def check_cleaning_coverage(
        self,
        cleaning_records: List[CleaningRecord],
        target_equipment: Set[str],
        start_time: datetime,
        end_time: datetime,
    ) -> Dict[str, Any]:
        """检查清洁记录是否覆盖关键设备和必要的 swab 点位"""
        result = {
            "covered_equipment": set(),
            "missing_equipment": set(),
            "covered_swab_points": set(),
            "missing_swab_points": set(),
            "expired_records": [],
            "warnings": [],
        }

        relevant_records = [
            r for r in cleaning_records
            if start_time <= r.cleaning_time <= end_time
        ]

        for record in relevant_records:
            if record.equipment in target_equipment:
                result["covered_equipment"].add(record.equipment)
            
            if record.swab_point:
                result["covered_swab_points"].add(record.swab_point)
            
            if not record.is_valid(self.swab_validity_hours):
                result["expired_records"].append(record)
                result["warnings"].append(
                    f"清洁记录 {record.record_id} 已过期（超过 {self.swab_validity_hours} 小时）"
                )

        result["missing_equipment"] = (
            target_equipment & self.critical_equipment
        ) - result["covered_equipment"]
        
        relevant_swab_points = self._get_relevant_swab_points(target_equipment)
        result["missing_swab_points"] = (
            relevant_swab_points - result["covered_swab_points"]
        )

        if result["missing_equipment"]:
            result["warnings"].append(
                f"关键设备未覆盖: {', '.join(result['missing_equipment'])}"
            )
        
        if result["missing_swab_points"]:
            result["warnings"].append(
                f"缺失 swab 检测点位: {', '.join(result['missing_swab_points'])}"
            )

        return result


class LabelSwitchRules:
    """标签切换规则"""

    def __init__(self, rules_config: Dict[str, Any]):
        self.rules = rules_config
        self.max_lag_minutes = rules_config.get("max_label_lag_minutes", 30)

    def check_label_switch(
        self,
        prev_batch: Batch,
        next_batch: Batch,
        label_switch_time: Optional[datetime],
    ) -> Dict[str, Any]:
        """检查标签切换是否滞后"""
        result = {
            "has_lag": False,
            "lag_minutes": 0,
            "warning": None,
        }

        if not label_switch_time:
            result["has_lag"] = True
            result["warning"] = "未找到标签切换时间记录"
            return result

        transition_start = prev_batch.end_time
        expected_switch_time = transition_start + timedelta(
            minutes=self.max_lag_minutes
        )

        if label_switch_time > expected_switch_time:
            lag = (label_switch_time - expected_switch_time).total_seconds() / 60
            result["has_lag"] = True
            result["lag_minutes"] = round(lag, 2)
            result["warning"] = (
                f"标签切换滞后 {result['lag_minutes']} 分钟 "
                f"(允许最大滞后: {self.max_lag_minutes} 分钟)"
            )

        return result


class ConflictRules:
    """设备冲突规则"""

    def __init__(self, rules_config: Dict[str, Any]):
        self.rules = rules_config

    def check_equipment_conflicts(
        self, batches: List[Batch]
    ) -> List[Dict[str, Any]]:
        """检查设备冲突（同一设备重复占用）"""
        conflicts = []
        
        equipment_batches: Dict[str, List[Batch]] = {}
        for batch in batches:
            for equipment in batch.equipment:
                if equipment not in equipment_batches:
                    equipment_batches[equipment] = []
                equipment_batches[equipment].append(batch)

        for equipment, eq_batches in equipment_batches.items():
            sorted_batches = sorted(eq_batches, key=lambda b: b.start_time)
            
            for i in range(len(sorted_batches) - 1):
                current = sorted_batches[i]
                next_batch = sorted_batches[i + 1]
                
                if next_batch.start_time < current.end_time:
                    overlap_minutes = (
                        current.end_time - next_batch.start_time
                    ).total_seconds() / 60
                    
                    conflicts.append({
                        "type": "equipment_conflict",
                        "equipment": equipment,
                        "batch_a": current.batch_id,
                        "batch_b": next_batch.batch_id,
                        "overlap_minutes": round(overlap_minutes, 2),
                        "message": (
                            f"设备 '{equipment}' 冲突: 批次 {current.batch_id} "
                            f"({current.start_time} 至 {current.end_time}) 与 "
                            f"批次 {next_batch.batch_id} "
                            f"({next_batch.start_time} 至 {next_batch.end_time}) "
                            f"重叠 {round(overlap_minutes, 2)} 分钟"
                        )
                    })

        return conflicts

    def check_midnight_transition(
        self, batch: Batch
    ) -> Optional[Dict[str, Any]]:
        """检查是否跨午夜换产"""
        start_date = batch.start_time.date()
        end_date = batch.end_time.date()
        
        if start_date != end_date:
            hours_midnight = (
                datetime.combine(end_date, datetime.min.time()) - batch.start_time
            ).total_seconds() / 3600
            
            return {
                "type": "midnight_transition",
                "batch_id": batch.batch_id,
                "start_time": batch.start_time,
                "end_time": batch.end_time,
                "hours_after_midnight": round(hours_midnight, 2),
                "message": (
                    f"批次 {batch.batch_id} 跨午夜运行: "
                    f"从 {batch.start_time} 到 {batch.end_time}, "
                    f"午夜后运行 {round(hours_midnight, 2)} 小时"
                )
            }
        
        return None


class RulesEngine:
    """规则引擎"""

    def __init__(self, rules_config: Dict[str, Any]):
        self.allergen_rules = AllergenRiskRules(rules_config)
        self.cleaning_rules = CleaningVerificationRules(rules_config)
        self.label_rules = LabelSwitchRules(rules_config)
        self.conflict_rules = ConflictRules(rules_config)

    def evaluate_transition(
        self,
        prev_batch: Batch,
        next_batch: Batch,
        cleaning_records: List[CleaningRecord],
        label_switch_time: Optional[datetime],
    ) -> Dict[str, Any]:
        """评估换产风险"""
        result = {
            "prev_batch": prev_batch.batch_id,
            "next_batch": next_batch.batch_id,
            "risks": [],
            "warnings": [],
            "allergen_risk": False,
            "cleaning_ok": True,
            "label_ok": True,
        }

        has_allergen_risk, allergen_risks = self.allergen_rules.has_allergen_risk(
            prev_batch, next_batch
        )
        result["allergen_risk"] = has_allergen_risk
        if has_allergen_risk:
            result["risks"].extend(allergen_risks)

        if has_allergen_risk:
            target_equipment = set(prev_batch.equipment) | set(next_batch.equipment)
            
            cleaning_result = self.cleaning_rules.check_cleaning_coverage(
                cleaning_records,
                target_equipment,
                prev_batch.end_time,
                next_batch.start_time,
            )
            
            if cleaning_result["warnings"]:
                result["warnings"].extend(cleaning_result["warnings"])
                result["cleaning_ok"] = False

        label_result = self.label_rules.check_label_switch(
            prev_batch, next_batch, label_switch_time
        )
        if label_result["has_lag"]:
            result["warnings"].append(label_result["warning"])
            result["label_ok"] = False

        result["overall_status"] = (
            "PASS"
            if not result["risks"] and result["cleaning_ok"] and result["label_ok"]
            else "FAIL"
            if result["risks"]
            else "WARNING"
        )

        return result
