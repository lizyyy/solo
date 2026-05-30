from __future__ import annotations

from datetime import datetime, timedelta, date, time
from typing import Dict, List, Any, Optional, Tuple

from .models import (
    PipelineContext,
    Registration,
    DoctorSchedule,
    SkipRecord,
    AddOnRequest,
    ClinicRoom,
    SimulationResult,
    TimelineEvent,
    AnomalyType,
    RecordStatus,
)


class QueueSimulator:
    def __init__(self, calc_params: Dict[str, Any]):
        self.avg_consult_minutes = calc_params.get("avg_consult_minutes", 10.0)
        self.skip_penalty_factor = calc_params.get("skip_penalty_factor", 1.5)
        self.addon_insert_strategy = calc_params.get("addon_insert_strategy", "after_current")
        self.skip_recall_wait_minutes = calc_params.get("skip_recall_wait_minutes", 30)
        self.suspended_doctor_reassign = calc_params.get("suspended_doctor_reassign", True)
        self.skip_duplicate_window_minutes = calc_params.get("skip_duplicate_window_minutes", 5)

    def simulate(self, ctx: PipelineContext) -> PipelineContext:
        schedule_map = self._build_schedule_map(ctx.schedules)
        skip_map = self._build_skip_map(ctx.skips)
        addon_map = self._build_addon_map(ctx.addons)
        room_map = {r.room_id: r for r in ctx.rooms}

        grouped = self._group_registrations_by_doctor(ctx.registrations)

        for doctor_id, regs in grouped.items():
            schedule = schedule_map.get(doctor_id)
            if schedule is None:
                for reg in regs:
                    if AnomalyType.MISSING_SCHEDULE not in reg.anomaly_types:
                        reg.anomaly_types.append(AnomalyType.MISSING_SCHEDULE)
                        reg.anomaly_details["missing_schedule"] = {
                            "doctor_id": doctor_id,
                            "message": f"医生 {doctor_id} 无排班记录",
                        }
                continue

            if schedule.is_suspended:
                for reg in regs:
                    if AnomalyType.DOCTOR_SUSPENDED not in reg.anomaly_types:
                        reg.anomaly_types.append(AnomalyType.DOCTOR_SUSPENDED)
                        reg.anomaly_details["doctor_suspended"] = {
                            "doctor_id": doctor_id,
                            "doctor_name": schedule.doctor_name,
                            "message": f"医生 {schedule.doctor_name} 已停诊",
                        }
                if not self.suspended_doctor_reassign:
                    continue

            ordered = self._build_ordered_queue(regs, addon_map.get(doctor_id, []), schedule)
            skips_for_doc = skip_map.get(doctor_id, [])
            results = self._simulate_doctor_queue(ordered, schedule, skips_for_doc, room_map, ctx)

            for reg_id, result in results.items():
                ctx.simulation_results[reg_id] = result

        ctx.timeline_events = self._build_timeline_events(ctx)

        return ctx

    def _build_schedule_map(self, schedules: List[DoctorSchedule]) -> Dict[str, DoctorSchedule]:
        return {s.doctor_id: s for s in schedules}

    def _build_skip_map(self, skips: List[SkipRecord]) -> Dict[str, List[SkipRecord]]:
        m: Dict[str, List[SkipRecord]] = {}
        for s in skips:
            m.setdefault(s.doctor_id, []).append(s)
        return m

    def _build_addon_map(self, addons: List[AddOnRequest]) -> Dict[str, List[AddOnRequest]]:
        m: Dict[str, List[AddOnRequest]] = {}
        for a in addons:
            m.setdefault(a.doctor_id, []).append(a)
        return m

    def _group_registrations_by_doctor(self, regs: List[Registration]) -> Dict[str, List[Registration]]:
        m: Dict[str, List[Registration]] = {}
        for r in regs:
            m.setdefault(r.doctor_id, []).append(r)
        return m

    def _build_ordered_queue(
        self,
        regs: List[Registration],
        addons: List[AddOnRequest],
        schedule: DoctorSchedule,
    ) -> List[Tuple[Registration, int]]:
        normal = [r for r in regs if not r.is_addon]
        normal.sort(key=lambda r: r.queue_number)

        addon_entries = []
        for addon_req in addons:
            if not addon_req.approved:
                continue
            matching = [r for r in regs if r.reg_id == addon_req.reg_id and r.is_addon]
            if matching:
                reg = matching[0]
                pos = addon_req.insert_position if addon_req.insert_position is not None else len(normal)
                addon_entries.append((reg, pos, addon_req))

        queue: List[Tuple[Registration, int]] = [(r, r.queue_number) for r in normal]

        addon_entries.sort(key=lambda x: x[1])
        offset = 0
        for reg, pos, addon_req in addon_entries:
            insert_idx = min(pos + offset, len(queue))
            if addon_req.is_queue_jump:
                if AnomalyType.ADDON_QUEUE_JUMP not in reg.anomaly_types:
                    reg.anomaly_types.append(AnomalyType.ADDON_QUEUE_JUMP)
                    reg.anomaly_details["addon_queue_jump"] = {
                        "request_id": addon_req.request_id,
                        "insert_position": pos,
                        "message": f"加号 {reg.reg_id} 插队到位置 {pos}，疑似插队",
                    }
            queue.insert(insert_idx, (reg, pos))
            offset += 1

        return queue

    def _detect_skip_duplicates(self, skips: List[SkipRecord]) -> List[SkipRecord]:
        seen: Dict[str, SkipRecord] = {}
        for s in skips:
            if s.reg_id in seen:
                prev = seen[s.reg_id]
                if s.skip_time and prev.skip_time:
                    delta = abs((s.skip_time - prev.skip_time).total_seconds()) / 60.0
                    if delta < self.skip_duplicate_window_minutes:
                        s.is_duplicate = True
                        s.skip_count = prev.skip_count + 1
                continue
            seen[s.reg_id] = s
        return skips

    def _simulate_doctor_queue(
        self,
        ordered_queue: List[Tuple[Registration, int]],
        schedule: DoctorSchedule,
        skips: List[SkipRecord],
        room_map: Dict[str, ClinicRoom],
        ctx: PipelineContext,
    ) -> Dict[str, SimulationResult]:
        results: Dict[str, SimulationResult] = {}
        skips = self._detect_skip_duplicates(skips)
        skip_by_reg = {s.reg_id: s for s in skips}

        base_dt = datetime.combine(schedule.clinic_date, schedule.start_time)
        end_dt = datetime.combine(schedule.clinic_date, schedule.end_time)
        current_time = base_dt

        active_skips: List[SkipRecord] = []

        for idx, (reg, _) in enumerate(ordered_queue):
            if schedule.is_suspended and not self.suspended_doctor_reassign:
                results[reg.reg_id] = SimulationResult(
                    reg_id=reg.reg_id,
                    estimated_wait_minutes=-1,
                    metadata={"reason": "doctor_suspended_no_reassign"},
                )
                continue

            skip = skip_by_reg.get(reg.reg_id)
            skip_penalty = 0.0
            anomaly_adjusted = False

            if skip and skip.is_duplicate:
                if AnomalyType.SKIP_DUPLICATE not in reg.anomaly_types:
                    reg.anomaly_types.append(AnomalyType.SKIP_DUPLICATE)
                    reg.anomaly_details["skip_duplicate"] = {
                        "skip_id": skip.skip_id,
                        "skip_count": skip.skip_count,
                        "message": f"挂号 {reg.reg_id} 存在重复过号（{skip.skip_count}次）",
                    }
                skip_penalty = self.skip_recall_wait_minutes * (skip.skip_count - 1)
                anomaly_adjusted = True
                active_skips.append(skip)
            elif skip:
                recall_dt = current_time + timedelta(minutes=self.skip_recall_wait_minutes)
                skip.recall_time = recall_dt
                skip_penalty = self.skip_penalty_factor * self.avg_consult_minutes
                active_skips.append(skip)

            addon_delay = 0.0
            if reg.is_addon:
                addon_delay = self.avg_consult_minutes * 0.5

            ahead_count = idx
            estimated_wait = (ahead_count * self.avg_consult_minutes) + skip_penalty + addon_delay

            for s in active_skips:
                if s.recall_time and s.recall_time > current_time + timedelta(minutes=estimated_wait):
                    estimated_wait += self.skip_recall_wait_minutes * 0.3

            est_start = current_time + timedelta(minutes=estimated_wait)
            est_end = est_start + timedelta(minutes=self.avg_consult_minutes)

            results[reg.reg_id] = SimulationResult(
                reg_id=reg.reg_id,
                queue_position=idx + 1,
                estimated_wait_minutes=round(estimated_wait, 1),
                estimated_start_time=est_start,
                estimated_end_time=est_end,
                skip_penalty_minutes=round(skip_penalty, 1),
                addon_delay_minutes=round(addon_delay, 1),
                ahead_count=ahead_count,
                anomaly_adjusted=anomaly_adjusted,
            )

            current_time = est_end
            if current_time > end_dt:
                for remaining_reg, _ in ordered_queue[idx + 1:]:
                    results[remaining_reg.reg_id] = SimulationResult(
                        reg_id=remaining_reg.reg_id,
                        queue_position=-1,
                        estimated_wait_minutes=-1,
                        metadata={"reason": "exceeds_schedule_end"},
                    )
                break

        return results

    def _build_timeline_events(self, ctx: PipelineContext) -> List[TimelineEvent]:
        events: List[TimelineEvent] = []

        for reg in ctx.registrations:
            is_anomaly = len(reg.anomaly_types) > 0 and AnomalyType.NONE not in reg.anomaly_types
            events.append(TimelineEvent(
                event_type="registration",
                time_point=reg.reg_time,
                label=f"挂号 {reg.queue_number}号",
                reg_id=reg.reg_id,
                doctor_id=reg.doctor_id,
                is_anomaly=is_anomaly,
                detail=f"患者 {reg.patient_name} 挂号",
            ))

        for skip in ctx.skips:
            is_anomaly = skip.is_duplicate
            events.append(TimelineEvent(
                event_type="skip",
                time_point=skip.skip_time,
                label="过号" + ("(重复)" if is_anomaly else ""),
                reg_id=skip.reg_id,
                doctor_id=skip.doctor_id,
                is_anomaly=is_anomaly,
                detail=f"过号记录 {'(重复' + str(skip.skip_count) + '次)' if is_anomaly else ''}",
            ))

        for addon in ctx.addons:
            is_anomaly = addon.is_queue_jump
            events.append(TimelineEvent(
                event_type="addon",
                time_point=addon.request_time,
                label="加号" + ("(插队)" if is_anomaly else ""),
                reg_id=addon.reg_id,
                doctor_id=addon.doctor_id,
                is_anomaly=is_anomaly,
                detail=f"加号申请 {'(疑似插队)' if is_anomaly else ''}",
            ))

        for schedule in ctx.schedules:
            if schedule.is_suspended:
                events.append(TimelineEvent(
                    event_type="suspension",
                    time_point=datetime.combine(schedule.clinic_date, schedule.start_time),
                    label="医生停诊",
                    doctor_id=schedule.doctor_id,
                    is_anomaly=True,
                    detail=f"医生 {schedule.doctor_name} 停诊",
                ))

        events.sort(key=lambda e: e.time_point or datetime.min)
        return events
