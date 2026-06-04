from typing import List, Dict, Any, Optional, Tuple
from models import BoundaryRule, UniformZoneRecord, ProcessingStatus


class BoundaryRuleEngine:
    def __init__(self):
        self.rules: List[BoundaryRule] = []
        self._register_default_rules()

    def _register_default_rules(self):
        self.rules.extend([
            BoundaryRule(
                rule_id="TEMP_MIX_001",
                description="检测摄氏度(°C)与开尔文(K)混用",
                rule_type="temperature_validation",
                condition="""
                    同一批导入的传感器记录中，同时存在温度单位为°C和K的记录；
                    或单条记录的温度值与单位明显不匹配（如25K应是25°C，300°C应是300K）
                """,
                action="""
                    1. 设置 has_mixed_temp_units = True
                    2. 设置 coach_review_required = True
                    3. 状态流转为 TEMP_MIXED（温度单位混用待复核）
                    4. 不自动修正，必须等待训练教练复核
                    5. 记录混用详情到 review_notes
                """,
                rollback_action="""
                    1. 清除 has_mixed_temp_units 标记
                    2. 清除 coach_review_required 标记
                    3. 恢复到前一个有效状态（通常是 IMPORTED）
                    4. 清空因混用添加的 review_notes
                """,
            ),
            BoundaryRule(
                rule_id="TEMP_MIX_002",
                description="温度值范围合理性校验",
                rule_type="temperature_validation",
                condition="""
                    - 单位为°C时，温度值 < -273.15 或 > 1000
                    - 单位为K时，温度值 < 0 或 > 1273
                    - 缺少单位但有数值
                """,
                action="""
                    1. 标记为 coach_review_required = True
                    2. 状态流转为 TEMP_MIXED
                    3. 在 review_notes 中记录异常值详情
                """,
                rollback_action="""
                    1. 清除 coach_review_required 标记
                    2. 恢复到 IMPORTED 状态
                    3. 清空异常值相关的 review_notes
                """,
            ),
            BoundaryRule(
                rule_id="TEMP_CORR_001",
                description="训练教练复核后温度单位修正",
                rule_type="temperature_correction",
                condition="""
                    训练教练明确确认修正方向，支持两种模式：
                    模式1 - convert（数值转换）：
                    - °C -> K: value + 273.15
                    - K -> °C: value - 273.15
                    模式2 - fix_unit（标签修正）：
                    - 仅修正单位标签，数值不变
                    - 例如：25K实为25°C（记录错误），修正为25°C
                """,
                action="""
                    1. 按教练确认的模式和目标单位修正
                    2. 更新 temperature_value 和 temperature_unit
                    3. 设置 processing_status = COACH_REVIEWED
                    4. 记录修改前后值到历史记录
                    5. 在 manual_annotation 中记录修正依据和模式
                    6. 设置 coach_review_required = False
                """,
                rollback_action="""
                    1. 从历史记录恢复 temperature_value 和 temperature_unit
                    2. 恢复 processing_status = TEMP_MIXED
                    3. 设置 coach_review_required = True
                    4. 清空本次修正的 manual_annotation
                """,
            ),
            BoundaryRule(
                rule_id="LATE_ARRIVAL_001",
                description="晚到工况照片处理规则",
                rule_type="photo_processing",
                condition="""
                    工况照片上传时间晚于传感器编号导入时间超过4小时；
                    或明确标记为 is_late_arrival = True
                """,
                action="""
                    1. 只更新 related_photo_ids 字段
                    2. 只刷新 review_notes 中与该照片相关的内容
                    3. 不修改 sensor_id、temperature_value、uniform_zone_flag
                    4. 不修改已为 CONFIRMED 状态的记录
                    5. 状态流转为 PHOTO_REVIEWED（如果之前低于此状态）
                    6. 在 review_notes 中标注"晚到材料"
                """,
                rollback_action="""
                    1. 移除该 photo_id 从 related_photo_ids
                    2. 移除 review_notes 中与该照片相关的内容
                    3. 如果状态是 PHOTO_REVIEWED 且没有其他照片，回退到 IMPORTED
                """,
            ),
            BoundaryRule(
                rule_id="DUPLICATE_001",
                description="重复导入防翻倍规则",
                rule_type="import_validation",
                condition="""
                    传感器记录的 sensor_id + original_line_number + source_file
                    哈希值已存在于系统中
                """,
                action="""
                    1. 不创建新的 UniformZoneRecord
                    2. 对比新旧 raw_data，如有差异则更新 raw_data
                    3. 只更新 import_batch_id 为最新批次
                    4. 记录一条 MANUAL_EDIT 类型的历史变更
                    5. 状态保持不变
                """,
                rollback_action="""
                    1. 恢复 raw_data 到重复导入前的版本
                    2. 恢复 import_batch_id 到之前的批次
                    3. 移除本次重复导入产生的历史记录
                """,
            ),
        ])

    def get_rule(self, rule_id: str) -> Optional[BoundaryRule]:
        for rule in self.rules:
            if rule.rule_id == rule_id:
                return rule
        return None

    def check_temperature_mix(self, records: List[Dict[str, Any]]) -> List[Dict[str, Any]]:
        units = set()
        unit_records = {}
        for rec in records:
            unit = rec.get("temperature_unit")
            if unit:
                units.add(unit)
                if unit not in unit_records:
                    unit_records[unit] = []
                unit_records[unit].append(rec)

        mixed_sensors = []
        if len(units) > 1:
            for unit, recs in unit_records.items():
                for rec in recs:
                    mixed_sensors.append({
                        "sensor_id": rec.get("sensor_id"),
                        "uniform_zone_id": rec.get("uniform_zone_id"),
                        "issue": f"单位混用，当前批次同时存在: {units}",
                        "units_found": list(units),
                    })

        for rec in records:
            val = rec.get("temperature_value")
            unit = rec.get("temperature_unit")
            if val is None:
                continue
            issue = None
            expected_range = None
            if unit == "°C" and (val < -273.15 or val > 1000):
                issue = f"摄氏度数值异常: {val}{unit}"
                expected_range = "-273.15 ~ 1000"
            elif unit == "K" and (val < 0 or val > 1273):
                issue = f"开尔文数值异常: {val}{unit}"
                expected_range = "0 ~ 1273"
            elif unit is None and val is not None:
                issue = "缺少温度单位"

            if issue:
                entry = {
                    "sensor_id": rec.get("sensor_id"),
                    "uniform_zone_id": rec.get("uniform_zone_id"),
                    "issue": issue,
                }
                if expected_range:
                    entry["expected_range"] = expected_range
                if unit is None:
                    entry["value"] = val
                mixed_sensors.append(entry)

        seen = set()
        unique_mixed = []
        for m in mixed_sensors:
            key = (m.get("sensor_id"), m.get("issue"))
            if key not in seen:
                seen.add(key)
                unique_mixed.append(m)

        return unique_mixed

    def apply_correction(
        self,
        current_value: float,
        current_unit: str,
        target_unit: str,
    ) -> Tuple[float, str]:
        if current_unit == target_unit:
            return current_value, current_unit

        if current_unit == "°C" and target_unit == "K":
            return round(current_value + 273.15, 2), "K"
        elif current_unit == "K" and target_unit == "°C":
            return round(current_value - 273.15, 2), "°C"
        else:
            raise ValueError(f"不支持的单位转换: {current_unit} -> {target_unit}")

    def rollback_correction(
        self,
        corrected_value: float,
        corrected_unit: str,
        original_unit: str,
    ) -> Tuple[float, str]:
        return self.apply_correction(corrected_value, corrected_unit, original_unit)

    def execute_rule(
        self,
        rule_id: str,
        record: UniformZoneRecord,
        operator: Optional[str] = None,
        **kwargs,
    ) -> Dict[str, Any]:
        rule = self.get_rule(rule_id)
        if not rule:
            raise ValueError(f"规则不存在: {rule_id}")

        result = {
            "rule_id": rule_id,
            "rule_description": rule.description,
            "before": record.to_dict(),
            "changes_applied": {},
        }

        if rule_id == "TEMP_MIX_001":
            mixed_details = kwargs.get("mixed_details", "")
            record.has_mixed_temp_units = True
            record.coach_review_required = True
            record.processing_status = ProcessingStatus.TEMP_MIXED
            existing_notes = record.review_notes or ""
            record.review_notes = (existing_notes + f"\n[温度单位混用] {mixed_details}").strip()
            result["changes_applied"] = {
                "has_mixed_temp_units": True,
                "coach_review_required": True,
                "processing_status": ProcessingStatus.TEMP_MIXED.value,
                "review_notes": record.review_notes,
            }

        elif rule_id == "TEMP_MIX_002":
            anomaly_details = kwargs.get("anomaly_details", "")
            record.coach_review_required = True
            record.processing_status = ProcessingStatus.TEMP_MIXED
            existing_notes = record.review_notes or ""
            record.review_notes = (existing_notes + f"\n[温度异常] {anomaly_details}").strip()
            result["changes_applied"] = {
                "coach_review_required": True,
                "processing_status": ProcessingStatus.TEMP_MIXED.value,
                "review_notes": record.review_notes,
            }

        elif rule_id == "TEMP_CORR_001":
            target_unit = kwargs.get("target_unit")
            correction_mode = kwargs.get("correction_mode", "convert")
            coach_remark = kwargs.get("coach_remark", "")
            if not target_unit:
                raise ValueError("修正温度单位必须指定 target_unit")

            original_value = record.temperature_value
            original_unit = record.temperature_unit

            if original_value is None or original_unit is None:
                raise ValueError("原始温度数据不完整，无法修正")

            if correction_mode == "convert":
                new_value, new_unit = self.apply_correction(
                    original_value, original_unit, target_unit
                )
                correction_desc = f"数值转换: {original_value}{original_unit} -> {new_value}{new_unit}"
            elif correction_mode == "fix_unit":
                new_value = original_value
                new_unit = target_unit
                correction_desc = f"标签修正: {original_value}{original_unit} -> {new_value}{new_unit}（仅修正单位标签，数值不变）"
            else:
                raise ValueError(f"不支持的修正模式: {correction_mode}")

            record.temperature_value = new_value
            record.temperature_unit = new_unit
            record.processing_status = ProcessingStatus.COACH_REVIEWED
            record.coach_review_required = False
            record.manual_annotation = (
                f"教练修正[{correction_mode}]: {correction_desc}。"
                f"依据: {coach_remark}。操作人: {operator or '未知'}"
            )
            result["changes_applied"] = {
                "correction_mode": correction_mode,
                "temperature_value": {"before": original_value, "after": new_value},
                "temperature_unit": {"before": original_unit, "after": new_unit},
                "processing_status": ProcessingStatus.COACH_REVIEWED.value,
                "manual_annotation": record.manual_annotation,
            }

        elif rule_id == "LATE_ARRIVAL_001":
            photo_id = kwargs.get("photo_id")
            photo_notes = kwargs.get("photo_notes", "")
            if not photo_id:
                raise ValueError("晚到照片处理必须指定 photo_id")

            if record.processing_status == ProcessingStatus.CONFIRMED:
                result["changes_applied"] = {"note": "已确认状态，跳过晚到照片更新"}
                return result

            if photo_id not in record.related_photo_ids:
                record.related_photo_ids.append(photo_id)

            existing_notes = record.review_notes or ""
            record.review_notes = (
                existing_notes + f"\n[晚到材料][照片:{photo_id}] {photo_notes}"
            ).strip()

            if record.processing_status in [ProcessingStatus.PENDING, ProcessingStatus.IMPORTED]:
                record.processing_status = ProcessingStatus.PHOTO_REVIEWED

            result["changes_applied"] = {
                "related_photo_ids": record.related_photo_ids,
                "review_notes": record.review_notes,
                "processing_status": record.processing_status.value,
            }

        elif rule_id == "DUPLICATE_001":
            new_raw_data = kwargs.get("new_raw_data")
            new_batch_id = kwargs.get("new_batch_id")
            record.import_batch_id = new_batch_id
            if new_raw_data and new_raw_data != kwargs.get("old_raw_data"):
                record.manual_edits = kwargs.get("manual_edits", []) + [{
                    "field": "raw_data",
                    "before": kwargs.get("old_raw_data"),
                    "after": new_raw_data,
                    "operator": operator,
                }]
                result["changes_applied"] = {
                    "import_batch_id": new_batch_id,
                    "raw_data_updated": True,
                }
            else:
                result["changes_applied"] = {
                    "import_batch_id": new_batch_id,
                    "note": "数据无变化，仅更新批次号",
                }

        result["after"] = record.to_dict()
        return result

    def get_all_rules(self) -> List[Dict[str, Any]]:
        return [rule.to_dict() for rule in self.rules]
