import uuid
from datetime import datetime
from typing import List, Optional
from models import (
    ProjectState, WorkflowStage, CalibrationRecord,
    TempUnit, HandoverReport, RetentionNote, NextContact,
    ShockDataPoint
)
from temp_detector import (
    parse_sampling_interval, detect_mixed_units_in_shock_data,
    build_clickable_links
)


class WorkflowEngine:
    def __init__(self):
        self.state = ProjectState()

    def step1_import_sampling_spec(self, content: str, file_name: str) -> ProjectState:
        spec = parse_sampling_interval(content, file_name)
        self.state.sampling_spec = spec
        self.state.current_stage = WorkflowStage.STEP1_IMPORTED

        if spec.has_mixed_units:
            self.state.current_stage = WorkflowStage.COACH_REVIEW_PENDING
        else:
            self.state.current_stage = WorkflowStage.STEP1_IMPORTED

        return self.state

    def step1_import_shock_data(self, shock_data: List[ShockDataPoint]) -> ProjectState:
        if not self.state.sampling_spec:
            raise ValueError("请先导入采样间隔说明")

        self.state.shock_data = detect_mixed_units_in_shock_data(
            shock_data, self.state.sampling_spec
        )
        build_clickable_links(self.state)
        self._generate_handover_report()
        return self.state

    def step2_lin_add_calibration(
        self,
        data_point_ids: List[int],
        instrument_id: str,
        calibration_temp: float,
        calibration_unit: TempUnit,
        remarks: str,
        offset_correction: Optional[float] = None
    ) -> ProjectState:
        cal_id = f"CAL-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}"

        record = CalibrationRecord(
            record_id=cal_id,
            recorded_by="实验老师林老师",
            recorded_at=datetime.now(),
            calibration_temperature=calibration_temp,
            calibration_unit=calibration_unit,
            instrument_id=instrument_id,
            offset_correction=offset_correction,
            remarks=remarks
        )
        self.state.calibration_records.append(record)

        for pid in data_point_ids:
            if 0 <= pid < len(self.state.shock_data):
                self.state.shock_data[pid].linked_calibration_id = cal_id

        build_clickable_links(self.state)
        self.state.current_stage = WorkflowStage.STEP2_LIN_REVIEWED
        self._generate_handover_report()
        return self.state

    def step3_update_report(self, coach_notes: str = "") -> ProjectState:
        self.state.current_stage = WorkflowStage.STEP3_REPORT_UPDATED
        self._generate_handover_report(coach_notes)
        return self.state

    def _determine_retention(self, point_idx: int, point: ShockDataPoint) -> RetentionNote:
        missing = []
        reason = ""
        next_contact = NextContact.COACH

        if point.has_mixed_units:
            reason = ("该点温度采样存在摄氏度/开尔文混用，保留原始数据供训练教练复核，"
                      "不做自动归一化处理。")
            if not point.linked_calibration_id:
                missing.append("温度校准记录")
                next_contact = NextContact.BOTH
            else:
                next_contact = NextContact.COACH
        else:
            reason = "数据完整，单位一致，已通过初步校验。"

        if point.acceleration_g > 15:
            reason += " 开伞冲击峰值超过15g，属于高风险数据点，需特别关注。"
            if next_contact == NextContact.COACH:
                next_contact = NextContact.BOTH

        return RetentionNote(
            data_point_id=point_idx,
            reason_kept=reason,
            missing_materials=missing,
            next_contact=next_contact,
            priority="高" if point.has_mixed_units or point.acceleration_g > 15 else "中"
        )

    def _generate_handover_report(self, coach_notes: str = "") -> HandoverReport:
        mixed_points = [i for i, p in enumerate(self.state.shock_data) if p.has_mixed_units]
        retention_notes = [
            self._determine_retention(i, p)
            for i, p in enumerate(self.state.shock_data)
        ]

        pending = []
        if mixed_points:
            pending.append(f"训练教练需复核 {len(mixed_points)} 个单位混用数据点")
        if any(not p.linked_calibration_id for p in self.state.shock_data if p.has_mixed_units):
            pending.append("林老师需补录部分温度校准记录")

        summary_coach = self._build_coach_summary(retention_notes, coach_notes)
        summary_lin = self._build_lin_summary(retention_notes)

        report = HandoverReport(
            report_id=f"RPT-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6]}",
            generated_at=datetime.now(),
            workflow_stage=self.state.current_stage,
            total_data_points=len(self.state.shock_data),
            mixed_unit_count=len(mixed_points),
            calibration_count=len(self.state.calibration_records),
            retention_notes=retention_notes,
            summary_for_coach=summary_coach,
            summary_for_lin=summary_lin,
            pending_actions=pending
        )
        self.state.handover_report = report
        return report

    def _build_coach_summary(self, notes: List[RetentionNote], coach_notes: str) -> str:
        high_risk = [n for n in notes if n.priority == "高"]
        mixed_notes = [n for n in notes if self.state.shock_data[n.data_point_id].has_mixed_units]

        lines = [
            "【训练教练您好】",
            f"本次开伞冲击试验共 {len(notes)} 个数据点，"
            f"其中 {len(mixed_notes)} 个点存在温度单位混用（摄氏度/开尔文）。",
            "",
            "特别说明：系统未对混用数据做自动归一化，全部保留原始数值供您复核。",
            "请您在3D图表中点击红色⚠️标记，可回溯采样间隔说明和校准记录。"
        ]

        if high_risk:
            lines.append(f"\n高优先级数据点 {len(high_risk)} 个：")
            for n in high_risk:
                point = self.state.shock_data[n.data_point_id]
                lines.append(
                    f"  • 点{n.data_point_id}: 冲击{point.acceleration_g:.1f}g - {n.reason_kept}"
                )

        if coach_notes:
            lines.append(f"\n您的备注：{coach_notes}")

        next_steps = [n for n in notes if n.next_contact in (NextContact.COACH, NextContact.BOTH)]
        if next_steps:
            lines.append(f"\n需要您处理的事项：")
            for n in next_steps:
                lines.append(f"  • 点{n.data_point_id}: {n.reason_kept}")

        return "\n".join(lines)

    def _build_lin_summary(self, notes: List[RetentionNote]) -> str:
        need_cal = [n for n in notes if "温度校准记录" in n.missing_materials]

        lines = [
            "【林老师您好】",
            f"已完成温度校准记录 {len(self.state.calibration_records)} 份，"
            f"还有 {len(need_cal)} 个混用数据点待关联校准记录。",
            ""
        ]

        if need_cal:
            lines.append("待补录校准的数据点：")
            for n in need_cal:
                point = self.state.shock_data[n.data_point_id]
                temp = point.temperature_reading
                if temp:
                    lines.append(
                        f"  • 点{n.data_point_id}: 采样值{temp.value}{temp.unit.value}，"
                        f"需补充校准记录"
                    )

        if self.state.calibration_records:
            lines.append("\n已录入的校准记录：")
            for cal in self.state.calibration_records:
                lines.append(
                    f"  • {cal.record_id}: 校准温度{cal.calibration_temperature}"
                    f"{cal.calibration_unit.value}，仪器{cal.instrument_id}"
                )

        next_steps = [n for n in notes if n.next_contact in (NextContact.TEACHER_LIN, NextContact.BOTH)]
        if any("温度校准记录" in n.missing_materials for n in next_steps):
            lines.append("\n需要您处理的事项：请为上述数据点补充温度校准记录。")

        return "\n".join(lines)
