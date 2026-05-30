from __future__ import annotations

from typing import Dict, Any, List, Tuple

from .models import (
    PipelineContext,
    Registration,
    AnomalyType,
    RecordStatus,
)


class AnomalyDetector:
    def __init__(self, calc_params: Dict[str, Any]):
        self.queue_jump_threshold = calc_params.get("queue_jump_detection_threshold", 3)
        self.skip_duplicate_window_minutes = calc_params.get("skip_duplicate_window_minutes", 5)

    def detect(self, ctx: PipelineContext) -> PipelineContext:
        for reg in ctx.registrations:
            if reg.status == RecordStatus.RETURNED_FOR_SUPPLEMENT:
                continue

            self._check_skip_duplicate(reg, ctx)
            self._check_doctor_suspended(reg, ctx)
            self._check_addon_queue_jump(reg, ctx)
            self._check_missing_schedule(reg, ctx)
            self._check_conflicting_room(reg, ctx)

            if reg.anomaly_types and AnomalyType.NONE not in reg.anomaly_types:
                if reg.status in (RecordStatus.VALIDATING, RecordStatus.ANOMALY_CHECKING):
                    reg.status = RecordStatus.ANOMALY_FLAGGED
            else:
                reg.anomaly_types = [AnomalyType.NONE]

            ctx.anomaly_flags[reg.reg_id] = list(reg.anomaly_types)

        return ctx

    def explain(self, ctx: PipelineContext) -> Dict[str, List[str]]:
        explanations: Dict[str, List[str]] = {}
        for reg in ctx.registrations:
            exps: List[str] = []
            for atype in reg.anomaly_types:
                if atype == AnomalyType.SKIP_DUPLICATE:
                    detail = reg.anomaly_details.get("skip_duplicate", {})
                    count = detail.get("skip_count", 2)
                    exps.append(
                        f"[过号重复] 挂号{reg.reg_id}在{self.skip_duplicate_window_minutes}分钟内"
                        f"被过号{count}次，可能为系统重复录入。"
                        f"处理建议: 确认实际过号次数，删除重复记录后重新模拟。"
                    )
                elif atype == AnomalyType.DOCTOR_SUSPENDED:
                    detail = reg.anomaly_details.get("doctor_suspended", {})
                    name = detail.get("doctor_name", reg.doctor_id)
                    exps.append(
                        f"[医生停诊] 医生{name}已停诊，该挂号无法按原计划就诊。"
                        f"处理建议: 安排转诊其他医生或等待恢复出诊。"
                    )
                elif atype == AnomalyType.ADDON_QUEUE_JUMP:
                    detail = reg.anomaly_details.get("addon_queue_jump", {})
                    pos = detail.get("insert_position", "?")
                    exps.append(
                        f"[加号插队] 加号挂号{reg.reg_id}被插入到队列位置{pos}，"
                        f"超过正常加号位置阈值{self.queue_jump_threshold}。"
                        f"处理建议: 确认加号审批流程，调整插入位置后重新模拟。"
                    )
                elif atype == AnomalyType.MISSING_SCHEDULE:
                    exps.append(
                        f"[缺少排班] 医生{reg.doctor_id}无排班记录，无法确定出诊时间。"
                        f"处理建议: 补充排班信息后重新预测。"
                    )
                elif atype == AnomalyType.CONFLICTING_ROOM:
                    detail = reg.anomaly_details.get("conflicting_room", {})
                    room = detail.get("room_id", "")
                    exps.append(
                        f"[诊室冲突] 医生{reg.doctor_id}所在诊室{room}存在冲突，"
                        f"可能有多位医生同时使用。"
                        f"处理建议: 确认诊室分配，修正冲突后重新模拟。"
                    )
                elif atype == AnomalyType.NONE:
                    exps.append("正常记录，无异常。")

            if exps:
                explanations[reg.reg_id] = exps

        return explanations

    def _check_skip_duplicate(self, reg: Registration, ctx: PipelineContext) -> None:
        for skip in ctx.skips:
            if skip.reg_id != reg.reg_id:
                continue
            if skip.is_duplicate:
                if AnomalyType.SKIP_DUPLICATE not in reg.anomaly_types:
                    reg.anomaly_types.append(AnomalyType.SKIP_DUPLICATE)
                    reg.anomaly_details["skip_duplicate"] = {
                        "skip_id": skip.skip_id,
                        "skip_count": skip.skip_count,
                        "message": f"挂号 {reg.reg_id} 存在重复过号（{skip.skip_count}次）",
                    }

    def _check_doctor_suspended(self, reg: Registration, ctx: PipelineContext) -> None:
        for schedule in ctx.schedules:
            if schedule.doctor_id == reg.doctor_id and schedule.is_suspended:
                if AnomalyType.DOCTOR_SUSPENDED not in reg.anomaly_types:
                    reg.anomaly_types.append(AnomalyType.DOCTOR_SUSPENDED)
                    reg.anomaly_details["doctor_suspended"] = {
                        "doctor_id": reg.doctor_id,
                        "doctor_name": schedule.doctor_name,
                        "message": f"医生 {schedule.doctor_name} 已停诊",
                    }

    def _check_addon_queue_jump(self, reg: Registration, ctx: PipelineContext) -> None:
        if not reg.is_addon:
            return
        for addon in ctx.addons:
            if addon.reg_id != reg.reg_id:
                continue
            if addon.is_queue_jump:
                if AnomalyType.ADDON_QUEUE_JUMP not in reg.anomaly_types:
                    reg.anomaly_types.append(AnomalyType.ADDON_QUEUE_JUMP)
                    reg.anomaly_details["addon_queue_jump"] = {
                        "request_id": addon.request_id,
                        "insert_position": addon.insert_position,
                        "message": f"加号 {reg.reg_id} 插队到位置 {addon.insert_position}",
                    }

    def _check_missing_schedule(self, reg: Registration, ctx: PipelineContext) -> None:
        doctor_ids = {s.doctor_id for s in ctx.schedules}
        if reg.doctor_id not in doctor_ids:
            if AnomalyType.MISSING_SCHEDULE not in reg.anomaly_types:
                reg.anomaly_types.append(AnomalyType.MISSING_SCHEDULE)
                reg.anomaly_details["missing_schedule"] = {
                    "doctor_id": reg.doctor_id,
                    "message": f"医生 {reg.doctor_id} 无排班记录",
                }

    def _check_conflicting_room(self, reg: Registration, ctx: PipelineContext) -> None:
        room_doctors: Dict[str, List[str]] = {}
        for schedule in ctx.schedules:
            if schedule.is_suspended:
                continue
            room_doctors.setdefault(schedule.room_id, []).append(schedule.doctor_id)

        for schedule in ctx.schedules:
            if schedule.doctor_id == reg.doctor_id:
                doctors_in_room = room_doctors.get(schedule.room_id, [])
                if len(doctors_in_room) > 1:
                    if AnomalyType.CONFLICTING_ROOM not in reg.anomaly_types:
                        reg.anomaly_types.append(AnomalyType.CONFLICTING_ROOM)
                        reg.anomaly_details["conflicting_room"] = {
                            "room_id": schedule.room_id,
                            "conflicting_doctors": doctors_in_room,
                            "message": f"诊室 {schedule.room_id} 存在多位医生冲突",
                        }
                break
