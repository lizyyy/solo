import uuid
from datetime import datetime
from typing import Optional, Tuple, List
import statistics

from models import (
    ElevatorAccelerationReview,
    ThresholdTable,
    MaintenanceOrder,
    VibrationCurve,
    VibrationPoint,
    ReviewConclusion,
    JudgmentStep,
    ChangeRecord,
    ChangeType,
    ConclusionType,
    ThresholdLevel,
    DataSource,
)


LEVEL_ACCELERATION_RANGES = {
    ThresholdLevel.A: (0, 0.5),
    ThresholdLevel.B: (0.5, 1.0),
    ThresholdLevel.C: (1.0, 1.5),
    ThresholdLevel.D: (1.5, float('inf')),
}


def infer_level_from_acceleration(acceleration: float) -> ThresholdLevel:
    for level, (min_val, max_val) in LEVEL_ACCELERATION_RANGES.items():
        if min_val <= acceleration < max_val:
            return level
    return ThresholdLevel.D


def calculate_curve_statistics(curve: VibrationCurve) -> Tuple[float, float, float]:
    if not curve.points:
        return 0.0, 0.0, 0.0
    accelerations = [p.acceleration for p in curve.points]
    return max(accelerations), min(accelerations), statistics.mean(accelerations)


class ReviewEngine:
    def __init__(self):
        self.step_counter = 0

    def _reset_step_counter(self):
        self.step_counter = 0

    def _create_step(
        self,
        description: str,
        judgment: str,
        reason: str,
        evidence: dict,
        data_source: Optional[DataSource] = None,
    ) -> JudgmentStep:
        self.step_counter += 1
        return JudgmentStep(
            step_order=self.step_counter,
            description=description,
            judgment=judgment,
            reason=reason,
            evidence=evidence,
            data_source=data_source,
        )

    def _add_change_record(
        self,
        review: ElevatorAccelerationReview,
        change_type: ChangeType,
        field_name: Optional[str] = None,
        old_value=None,
        new_value=None,
        data_source: DataSource = DataSource.MANUAL_EDIT,
        operator: Optional[str] = None,
        reason: Optional[str] = None,
        affects_conclusion: bool = False,
    ):
        change = ChangeRecord(
            id=str(uuid.uuid4()),
            timestamp=datetime.now(),
            change_type=change_type,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            data_source=data_source,
            operator=operator,
            reason=reason,
            affects_conclusion=affects_conclusion,
        )
        review.change_history.append(change)
        review.version += 1

    def bind_threshold_table(
        self,
        review: ElevatorAccelerationReview,
        threshold: ThresholdTable,
        operator: Optional[str] = None,
    ) -> Tuple[bool, str]:
        old_threshold = review.threshold_table
        affects_conclusion = old_threshold is not None and (
            old_threshold.level != threshold.level
            or old_threshold.max_acceleration != threshold.max_acceleration
        )

        review.threshold_table = threshold

        if old_threshold is None:
            self._add_change_record(
                review,
                ChangeType.THRESHOLD_UPDATED,
                field_name="threshold_table",
                old_value=None,
                new_value=f"阈值表{threshold.id}(档位{threshold.level.value})",
                data_source=DataSource.THRESHOLD_TABLE,
                operator=operator,
                reason="阈值表到达，绑定到复核单",
                affects_conclusion=False,
            )
            return True, "阈值表绑定成功"
        else:
            self._add_change_record(
                review,
                ChangeType.THRESHOLD_UPDATED,
                field_name="threshold_table",
                old_value=f"阈值表{old_threshold.id}(档位{old_threshold.level.value})",
                new_value=f"阈值表{threshold.id}(档位{threshold.level.value})",
                data_source=DataSource.THRESHOLD_TABLE,
                operator=operator,
                reason="阈值表更新",
                affects_conclusion=affects_conclusion,
            )
            return True, f"阈值表更新成功{'，影响结论' if affects_conclusion else ''}"

    def bind_maintenance_order(
        self,
        review: ElevatorAccelerationReview,
        maintenance: MaintenanceOrder,
        operator: Optional[str] = None,
    ) -> Tuple[bool, str]:
        old_maintenance = review.maintenance_order
        affects_conclusion = False

        if old_maintenance and maintenance.actual_max_acceleration is not None:
            old_max = old_maintenance.actual_max_acceleration
            new_max = maintenance.actual_max_acceleration
            if old_max != new_max:
                old_level = infer_level_from_acceleration(old_max) if old_max else None
                new_level = infer_level_from_acceleration(new_max) if new_max else None
                affects_conclusion = old_level != new_level

        is_late = maintenance.is_late_supply
        change_type = ChangeType.MAINTENANCE_SUPPLIED if is_late else ChangeType.MATERIAL_ONLY

        review.maintenance_order = maintenance

        change_reason = "维修单晚补" if is_late else "维修单绑定"
        if old_maintenance is None:
            self._add_change_record(
                review,
                change_type,
                field_name="maintenance_order",
                old_value=None,
                new_value=f"维修单{maintenance.id}",
                data_source=DataSource.MAINTENANCE_ORDER,
                operator=operator,
                reason=change_reason,
                affects_conclusion=affects_conclusion,
            )
        else:
            self._add_change_record(
                review,
                change_type,
                field_name="maintenance_order",
                old_value=f"维修单{old_maintenance.id}",
                new_value=f"维修单{maintenance.id}",
                data_source=DataSource.MAINTENANCE_ORDER,
                operator=operator,
                reason=change_reason,
                affects_conclusion=affects_conclusion,
            )

        msg = "维修单绑定成功"
        if is_late:
            msg = "维修单晚补成功"
        if affects_conclusion:
            msg += "，数据变化影响结论档位"
        return True, msg

    def update_vibration_curve(
        self,
        review: ElevatorAccelerationReview,
        new_curve: VibrationCurve,
        operator: Optional[str] = None,
        edit_reason: Optional[str] = None,
    ) -> Tuple[bool, str]:
        old_curve = review.vibration_curve
        affects_conclusion = False

        if old_curve and old_curve.points:
            old_max, _, _ = calculate_curve_statistics(old_curve)
            new_max, _, _ = calculate_curve_statistics(new_curve)
            if old_max != new_max:
                old_level = infer_level_from_acceleration(old_max)
                new_level = infer_level_from_acceleration(new_max)
                affects_conclusion = old_level != new_level

        if old_curve and new_curve.is_manually_edited:
            new_curve.original_curve_id = old_curve.id

        review.vibration_curve = new_curve

        change_type = ChangeType.CURVE_EDITED if new_curve.is_manually_edited else ChangeType.MATERIAL_ONLY
        reason = edit_reason or ("振动曲线人工修改" if new_curve.is_manually_edited else "振动曲线更新")

        if old_curve is None:
            self._add_change_record(
                review,
                change_type,
                field_name="vibration_curve",
                old_value=None,
                new_value=f"振动曲线{new_curve.id}",
                data_source=DataSource.VIBRATION_CURVE,
                operator=operator,
                reason=reason,
                affects_conclusion=False,
            )
        else:
            old_max, _, _ = calculate_curve_statistics(old_curve) if old_curve.points else (0, 0, 0)
            new_max, _, _ = calculate_curve_statistics(new_curve) if new_curve.points else (0, 0, 0)
            self._add_change_record(
                review,
                change_type,
                field_name="vibration_curve",
                old_value=f"振动曲线{old_curve.id}(峰值{old_max:.2f})",
                new_value=f"振动曲线{new_curve.id}(峰值{new_max:.2f})",
                data_source=DataSource.VIBRATION_CURVE,
                operator=operator,
                reason=reason,
                affects_conclusion=affects_conclusion,
            )

        msg = "振动曲线更新成功"
        if new_curve.is_manually_edited:
            msg = "振动曲线人工修改成功，历史已留存"
        if affects_conclusion:
            msg += "，峰值变化影响结论档位"
        return True, msg

    def _check_cross_level(
        self,
        review: ElevatorAccelerationReview,
        steps: List[JudgmentStep],
    ) -> Tuple[bool, Optional[DataSource], Optional[ThresholdLevel], Optional[ThresholdLevel]]:
        threshold = review.threshold_table
        maintenance = review.maintenance_order

        if not threshold:
            return False, None, None, None

        threshold_level = threshold.level

        if maintenance and maintenance.actual_max_acceleration is not None:
            maintenance_level = infer_level_from_acceleration(maintenance.actual_max_acceleration)
            if maintenance_level != threshold_level:
                steps.append(self._create_step(
                    description="检查阈值表与维修单档位一致性",
                    judgment=f"阈值跨档：阈值表为{threshold_level.value}档，维修单实测为{maintenance_level.value}档",
                    reason="维修单实测加速度对应的档位与阈值表给定档位不一致",
                    evidence={
                        "threshold_level": threshold_level.value,
                        "threshold_source": "阈值表",
                        "maintenance_level": maintenance_level.value,
                        "maintenance_acceleration": maintenance.actual_max_acceleration,
                        "maintenance_source": "维修单",
                    },
                    data_source=DataSource.MAINTENANCE_ORDER,
                ))
                return True, DataSource.MAINTENANCE_ORDER, threshold_level, maintenance_level

        if review.vibration_curve and review.vibration_curve.points:
            curve_max, _, _ = calculate_curve_statistics(review.vibration_curve)
            curve_level = infer_level_from_acceleration(curve_max)
            if curve_level != threshold_level:
                steps.append(self._create_step(
                    description="检查阈值表与振动曲线档位一致性",
                    judgment=f"阈值跨档：阈值表为{threshold_level.value}档，振动曲线实测为{curve_level.value}档",
                    reason="振动曲线实测加速度峰值对应的档位与阈值表给定档位不一致",
                    evidence={
                        "threshold_level": threshold_level.value,
                        "threshold_source": "阈值表",
                        "curve_level": curve_level.value,
                        "curve_max_acceleration": curve_max,
                        "curve_source": "振动曲线",
                    },
                    data_source=DataSource.VIBRATION_CURVE,
                ))
                return True, DataSource.VIBRATION_CURVE, threshold_level, curve_level

        return False, None, None, None

    def _classify_changes(self, review: ElevatorAccelerationReview) -> Tuple[List[ChangeRecord], List[ChangeRecord]]:
        material_only = []
        conclusion_changes = []
        for change in review.change_history:
            if change.affects_conclusion or change.change_type in (ChangeType.CONCLUSION_CHANGED, ChangeType.CURVE_EDITED):
                conclusion_changes.append(change)
            else:
                material_only.append(change)
        return material_only, conclusion_changes

    def _determine_next_action(self, review: ElevatorAccelerationReview, conclusion_type: ConclusionType, cross_source: Optional[DataSource]) -> Tuple[str, str]:
        if conclusion_type == ConclusionType.PENDING:
            missing = []
            if not review.threshold_table:
                missing.append("阈值表")
            if not review.maintenance_order:
                missing.append("维修单")
            if not review.vibration_curve:
                missing.append("振动曲线")
            return f"请补充以下材料：{', '.join(missing)}", "设备工程师"

        if conclusion_type == ConclusionType.CROSS_LEVEL:
            if cross_source == DataSource.MAINTENANCE_ORDER:
                return "请与维修班组确认维修单实测数据准确性，或校核阈值表档位是否正确", "设备主管"
            elif cross_source == DataSource.VIBRATION_CURVE:
                return "请与振动检测班组确认曲线数据准确性，或校核阈值表档位是否正确", "设备主管"
            else:
                return "请核对阈值表与实测数据的档位差异", "设备主管"

        return "复核完成，可归档", "档案管理员"

    def run_review(self, review: ElevatorAccelerationReview) -> ReviewConclusion:
        self._reset_step_counter()
        steps: List[JudgmentStep] = []

        steps.append(self._create_step(
            description="复核启动",
            judgment="开始电梯加速度复核",
            reason=f"复核单{review.id}启动，对电梯{review.elevator_id}进行加速度复核",
            evidence={"review_id": review.id, "elevator_id": review.elevator_id, "version": review.version},
            data_source=DataSource.AUTO_CALC,
        ))

        if not review.threshold_table:
            steps.append(self._create_step(
                description="检查阈值表是否齐备",
                judgment="材料不齐备",
                reason="阈值表未到达，无法进行档位判断",
                evidence={"missing": "threshold_table"},
                data_source=DataSource.THRESHOLD_TABLE,
            ))
            next_action, next_owner = self._determine_next_action(review, ConclusionType.PENDING, None)
            review.conclusion = ReviewConclusion(
                conclusion_type=ConclusionType.PENDING,
                judgment_steps=steps,
                next_action=next_action,
                next_owner=next_owner,
            )
            review.status = "待补充材料"
            return review.conclusion

        steps.append(self._create_step(
            description="检查阈值表是否齐备",
            judgment=f"阈值表已到，档位为{review.threshold_table.level.value}档",
            reason=f"阈值表{review.threshold_table.id}于{review.threshold_table.received_at.strftime('%Y-%m-%d %H:%M')}到达",
            evidence={
                "threshold_id": review.threshold_table.id,
                "level": review.threshold_table.level.value,
                "received_at": review.threshold_table.received_at.isoformat(),
                "max_acceleration": review.threshold_table.max_acceleration,
                "min_acceleration": review.threshold_table.min_acceleration,
            },
            data_source=DataSource.THRESHOLD_TABLE,
        ))

        if not review.maintenance_order:
            steps.append(self._create_step(
                description="检查维修单是否齐备",
                judgment="材料不齐备",
                reason="维修单未到达，无法确认现场实测数据",
                evidence={"missing": "maintenance_order"},
                data_source=DataSource.MAINTENANCE_ORDER,
            ))
            next_action, next_owner = self._determine_next_action(review, ConclusionType.PENDING, None)
            review.conclusion = ReviewConclusion(
                conclusion_type=ConclusionType.PENDING,
                judgment_steps=steps,
                next_action=next_action,
                next_owner=next_owner,
            )
            review.status = "待补充材料"
            return review.conclusion

        maintenance = review.maintenance_order
        maintenance_msg = "维修单已到"
        if maintenance.is_late_supply:
            maintenance_msg = "维修单晚补（阈值表先到，维修单滞后）"
        steps.append(self._create_step(
            description="检查维修单是否齐备",
            judgment=maintenance_msg,
            reason=f"维修单{maintenance.id}于{maintenance.received_at.strftime('%Y-%m-%d %H:%M')}到达",
            evidence={
                "maintenance_id": maintenance.id,
                "received_at": maintenance.received_at.isoformat(),
                "is_late_supply": maintenance.is_late_supply,
                "actual_max": maintenance.actual_max_acceleration,
                "actual_min": maintenance.actual_min_acceleration,
                "operator": maintenance.operator,
            },
            data_source=DataSource.MAINTENANCE_ORDER,
        ))

        if not review.vibration_curve or not review.vibration_curve.points:
            steps.append(self._create_step(
                description="检查振动曲线是否齐备",
                judgment="材料不齐备",
                reason="振动曲线未到达或无数据点，无法进行实测校验",
                evidence={"missing": "vibration_curve"},
                data_source=DataSource.VIBRATION_CURVE,
            ))
            next_action, next_owner = self._determine_next_action(review, ConclusionType.PENDING, None)
            review.conclusion = ReviewConclusion(
                conclusion_type=ConclusionType.PENDING,
                judgment_steps=steps,
                next_action=next_action,
                next_owner=next_owner,
            )
            review.status = "待补充材料"
            return review.conclusion

        curve = review.vibration_curve
        curve_max, curve_min, curve_mean = calculate_curve_statistics(curve)
        curve_msg = "振动曲线已到"
        if curve.is_manually_edited:
            curve_msg = "振动曲线已人工修改，历史版本已留存"
        steps.append(self._create_step(
            description="检查振动曲线是否齐备",
            judgment=curve_msg,
            reason=f"振动曲线{curve.id}于{curve.measured_at.strftime('%Y-%m-%d %H:%M')}检测",
            evidence={
                "curve_id": curve.id,
                "measured_at": curve.measured_at.isoformat(),
                "is_manually_edited": curve.is_manually_edited,
                "edited_by": curve.edited_by,
                "edit_reason": curve.edit_reason,
                "original_curve_id": curve.original_curve_id,
                "max_acceleration": curve_max,
                "min_acceleration": curve_min,
                "mean_acceleration": curve_mean,
                "point_count": len(curve.points),
            },
            data_source=DataSource.VIBRATION_CURVE,
        ))

        cross_level, cross_source, cross_from, cross_to = self._check_cross_level(review, steps)
        if cross_level:
            next_action, next_owner = self._determine_next_action(review, ConclusionType.CROSS_LEVEL, cross_source)
            review.conclusion = ReviewConclusion(
                conclusion_type=ConclusionType.CROSS_LEVEL,
                final_level=review.threshold_table.level if review.threshold_table else None,
                max_acceleration=curve_max,
                min_acceleration=curve_min,
                judgment_steps=steps,
                next_action=next_action,
                next_owner=next_owner,
                cross_level_source=cross_source,
                cross_level_from=cross_from,
                cross_level_to=cross_to,
            )
            review.status = "跨档待确认"
            return review.conclusion

        threshold = review.threshold_table
        if maintenance.actual_max_acceleration is not None:
            check_value = maintenance.actual_max_acceleration
            check_source = DataSource.MAINTENANCE_ORDER
        else:
            check_value = curve_max
            check_source = DataSource.VIBRATION_CURVE

        is_qualified = check_value <= threshold.max_acceleration
        judgment_result = "合格" if is_qualified else "不合格"
        steps.append(self._create_step(
            description="加速度符合性判断",
            judgment=f"加速度{judgment_result}",
            reason=f"{'维修单实测' if check_source == DataSource.MAINTENANCE_ORDER else '振动曲线实测'}峰值{check_value:.3f}m/s²，阈值表{threshold.level.value}档上限为{threshold.max_acceleration:.3f}m/s²",
            evidence={
                "check_value": check_value,
                "threshold_value": threshold.max_acceleration,
                "threshold_level": threshold.level.value,
                "is_qualified": is_qualified,
                "check_source": check_source.value,
            },
            data_source=check_source,
        ))

        material_only, conclusion_changes = self._classify_changes(review)
        if material_only:
            material_descs = [f"{c.change_type.value}({c.field_name})" for c in material_only]
            steps.append(self._create_step(
                description="区分变更类型：仅补材料",
                judgment=f"以下变更仅为补材料，不影响结论：{', '.join(material_descs)}",
                reason="这些变更仅补充或完善资料，未改变关键数据或结论档位",
                evidence={
                    "material_only_changes": [
                        {
                            "change_type": c.change_type.value,
                            "field_name": c.field_name,
                            "timestamp": c.timestamp.isoformat(),
                            "reason": c.reason,
                        }
                        for c in material_only
                    ]
                },
                data_source=DataSource.AUTO_CALC,
            ))

        if conclusion_changes:
            concl_descs = [f"{c.change_type.value}({c.field_name}): {c.old_value} → {c.new_value}" for c in conclusion_changes]
            steps.append(self._create_step(
                description="区分变更类型：结论变更",
                judgment=f"以下变更改变了结论：{', '.join(concl_descs)}",
                reason="这些变更修改了关键数据，导致结论档位或合格性判断变化",
                evidence={
                    "conclusion_changes": [
                        {
                            "change_type": c.change_type.value,
                            "field_name": c.field_name,
                            "old_value": c.old_value,
                            "new_value": c.new_value,
                            "timestamp": c.timestamp.isoformat(),
                            "reason": c.reason,
                            "operator": c.operator,
                        }
                        for c in conclusion_changes
                    ]
                },
                data_source=DataSource.AUTO_CALC,
            ))

        final_conclusion = ConclusionType.QUALIFIED if is_qualified else ConclusionType.UNQUALIFIED
        next_action, next_owner = self._determine_next_action(review, final_conclusion, None)

        steps.append(self._create_step(
            description="复核完成",
            judgment=f"复核完成，最终结论：{final_conclusion.value}",
            reason="所有材料齐备，自动判断流程执行完毕",
            evidence={"final_conclusion": final_conclusion.value},
            data_source=DataSource.AUTO_CALC,
        ))

        review.conclusion = ReviewConclusion(
            conclusion_type=final_conclusion,
            final_level=threshold.level,
            max_acceleration=check_value,
            min_acceleration=maintenance.actual_min_acceleration if maintenance and maintenance.actual_min_acceleration else curve_min,
            judgment_steps=steps,
            next_action=next_action,
            next_owner=next_owner,
        )
        review.status = "已完成"

        return review.conclusion
