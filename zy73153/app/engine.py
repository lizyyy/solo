from __future__ import annotations

from datetime import datetime, timedelta
from typing import Optional

from .models import (
    CalculationTrail,
    FormulaStep,
    LabResult,
    PendingRecord,
    RecordStatus,
    SamplingRecord,
    Sensor,
    SensorStatus,
    SpatialAnnotation,
)
from .store import store


ZONE_BOUNDARIES: dict[str, dict[str, tuple[float, float]]] = {
    "水温": {
        "核心养殖区": (20.0, 28.0),
        "适宜养殖区": (15.0, 20.0),
        "缓冲区": (10.0, 15.0),
        "监测区": (0.0, 10.0),
    },
    "溶解氧": {
        "核心养殖区": (7.0, 12.0),
        "适宜养殖区": (5.0, 7.0),
        "缓冲区": (3.0, 5.0),
        "监测区": (0.0, 3.0),
    },
}

ZONE_LEVELS = ["核心养殖区", "适宜养殖区", "缓冲区", "监测区"]


class AnnotationEngine:
    def __init__(self) -> None:
        self.counter = 0

    def _next_annotation_id(self, sample_id: str) -> str:
        self.counter += 1
        return f"AN-{sample_id}-{self.counter:04d}"

    def _match_zone(self, test_item: str, value: float) -> tuple[str, str, dict[str, tuple[float, float]]]:
        boundaries = ZONE_BOUNDARIES.get(test_item, ZONE_BOUNDARIES["水温"])
        for zone in ZONE_LEVELS:
            lo, hi = boundaries[zone]
            if lo <= value < hi:
                return zone, test_item, boundaries
        last_zone = ZONE_LEVELS[-1]
        return last_zone, test_item, boundaries

    def validate_time_consistency(
        self, sampling: SamplingRecord, lab: LabResult
    ) -> tuple[bool, str]:
        if lab.sample_time != sampling.sampling_time:
            diff_seconds = (lab.sample_time - sampling.sampling_time).total_seconds()
            if abs(diff_seconds) > 60:
                return False, (
                    f"实验室记录采样时间({lab.sample_time.strftime('%Y-%m-%d %H:%M')})"
                    f"与现场采样时间({sampling.sampling_time.strftime('%Y-%m-%d %H:%M')})"
                    f"相差 {abs(diff_seconds)/60:.1f} 分钟，不一致"
                )
        if lab.experiment_time < sampling.sampling_time:
            return False, "实验时间早于采样时间，数据存疑"
        if (lab.experiment_time - sampling.sampling_time) > timedelta(hours=12):
            hours = (lab.experiment_time - sampling.sampling_time).total_seconds() / 3600
            return False, f"实验开展距采样已 {hours:.1f} 小时，超时，建议复核"
        return True, ""

    def calculate_spatial_score(
        self, sampling: SamplingRecord, lab: LabResult, sensor: Optional[Sensor]
    ) -> CalculationTrail:
        test_item = lab.test_item
        sensor_value = sampling.sensor_value
        lab_value = lab.result_value
        steps: list[FormulaStep] = []
        warnings: list[str] = []

        zone_name, _, boundaries = self._match_zone(test_item, lab_value)

        step1 = FormulaStep(
            step_index=1,
            description="传感器原始值读取",
            formula="raw_value = sensor.reading",
            unit=lab.result_unit,
            input_value=sensor_value,
            output_value=sensor_value,
        )
        steps.append(step1)

        step2 = FormulaStep(
            step_index=2,
            description="实验室校准值读取",
            formula="calibrated_value = lab.result",
            unit=lab.result_unit,
            input_value=lab_value,
            output_value=lab_value,
        )
        steps.append(step2)

        diff = round(abs(lab_value - sensor_value), 4)
        diff_pct = round(diff / sensor_value * 100, 2) if sensor_value else 0.0
        boundary_ok: Optional[str] = None
        if sensor and sensor.status != SensorStatus.NORMAL:
            boundary_ok = (
                f"传感器状态: {sensor.status.value}，"
                f"漂移阈值: ±{sensor.drift_threshold * 100:.0f}%，"
                f"实测偏差: ±{diff_pct}%"
            )
            if diff_pct > sensor.drift_threshold * 100:
                warnings.append(
                    f"传感器与实验室偏差 {diff_pct}% 超过阈值 "
                    f"{sensor.drift_threshold * 100:.0f}%"
                )
        step3 = FormulaStep(
            step_index=3,
            description="传感器-实验室偏差计算",
            formula="deviation_pct = |calibrated_value - raw_value| / raw_value * 100",
            unit="%",
            input_value=diff,
            output_value=diff_pct,
            boundary_check=boundary_ok,
        )
        steps.append(step3)

        fused = round((sensor_value + lab_value) / 2, 4) if sensor_value else lab_value
        step4 = FormulaStep(
            step_index=4,
            description="融合值计算（传感器与实验室结果均值）",
            formula="fused_value = (sensor_value + lab_value) / 2",
            unit=lab.result_unit,
            input_value=fused,
            output_value=fused,
        )
        steps.append(step4)

        boundary_desc = (
            f"{test_item}分区边界: "
            f"核心养殖区{boundaries['核心养殖区']}, "
            f"适宜养殖区{boundaries['适宜养殖区']}, "
            f"缓冲区{boundaries['缓冲区']}, "
            f"监测区{boundaries['监测区']}"
        )
        step5 = FormulaStep(
            step_index=5,
            description="空间分区判定",
            formula=f"zone = classify_{test_item}(fused_value)",
            unit="分区名",
            input_value=fused,
            output_value=float(ZONE_LEVELS.index(zone_name)),
            boundary_check=boundary_desc,
            note=f"判定结果: {zone_name}",
        )
        steps.append(step5)

        return CalculationTrail(
            final_result=fused,
            final_unit=lab.result_unit,
            formula_steps=steps,
            boundary_values=boundaries,
            warning_flags=warnings,
        )

    def run_annotation(
        self, sample_id: str, operator_id: str = "S001"
    ) -> Optional[SpatialAnnotation]:
        if sample_id in store.seen_sample_ids:
            for ann in store.annotations.values():
                if ann.sample_id == sample_id:
                    if RecordStatus.DUPLICATE not in [a for a in [ann.status]]:
                        ann.status = RecordStatus.DUPLICATE
                    if "重复导入，已保留原有记录与备注，未覆盖" not in ann.alerts:
                        ann.alerts.append("重复导入，已保留原有记录与备注，未覆盖")
                    return ann
            return None

        sampling = store.sampling_records.get(sample_id)
        if not sampling:
            return None

        lab: Optional[LabResult] = None
        for lb in store.lab_results.values():
            if lb.sample_id == sample_id:
                lab = lb
                break
        if not lab:
            return None

        sensor = store.sensors.get(sampling.sensor_id)
        trail = self.calculate_spatial_score(sampling, lab, sensor)
        zone_name, _, _ = self._match_zone(lab.test_item, lab.result_value)

        alerts: list[str] = []
        status = RecordStatus.NORMAL
        handler_hint = ""
        contact = ""
        first_source = ""

        time_ok, time_msg = self.validate_time_consistency(sampling, lab)
        if not time_ok:
            status = RecordStatus.TIME_MISMATCH
            alerts.append(time_msg)
            lab_tech = store.staff.get("S003")
            if lab_tech:
                contact = f"{lab_tech.name}（{lab_tech.role.value}）{lab_tech.phone} {lab_tech.contact_hint}"
            handler_hint = "联系实验室核对采样时间与实验时间"
            first_source = f"实验室原始采样记录 {lab.lab_result_id}"

        if not lab.attachment_arrived:
            if status == RecordStatus.NORMAL:
                status = RecordStatus.LATE_ATTACHMENT
            alerts.append("实验室附件尚未到达，等待原始扫描件与纸质报告")
            if not contact:
                lab_tech = store.staff.get("S003")
                if lab_tech:
                    contact = f"{lab_tech.name}（{lab_tech.role.value}）{lab_tech.phone} {lab_tech.contact_hint}"
            handler_hint = handler_hint or "等待实验室附件到达后补录并重新审核"
            first_source = first_source or "实验室附件寄送记录"

        if sensor and sensor.status in (SensorStatus.DRIFT_SUSPECTED, SensorStatus.DRIFT_CONFIRMED):
            if status == RecordStatus.NORMAL:
                status = RecordStatus.SENSOR_DRIFT
            drift_tech = store.staff.get(sensor.responsible_person_id)
            drift_msg = (
                f"传感器 {sensor.name}（{sensor.sensor_id}）状态: {sensor.status.value}。"
            )
            if drift_tech:
                drift_msg += (
                    f"请联系 {drift_tech.name}（{drift_tech.role.value}）"
                    f"{drift_tech.phone} {drift_tech.contact_hint} 确认。"
                )
            drift_msg += f" 先查看来源: {sensor.data_source_url}"
            alerts.append(drift_msg)
            alerts.extend(trail.warning_flags)
            handler_hint = handler_hint or "确认传感器漂移情况并决定是否使用实验室值单独判定"
            if drift_tech and not contact:
                contact = f"{drift_tech.name}（{drift_tech.role.value}）{drift_tech.phone} {drift_tech.contact_hint}"
            first_source = first_source or sensor.data_source_url

        annotation_id = self._next_annotation_id(sample_id)
        ann = SpatialAnnotation(
            annotation_id=annotation_id,
            sample_id=sample_id,
            station_id=sampling.station_id,
            location_lng=sampling.location_lng,
            location_lat=sampling.location_lat,
            zone_level=lab.test_item,
            zone_name=zone_name,
            calculation_trail=trail,
            status=status,
            alerts=alerts,
            handler_hint=handler_hint,
            data_sources=[
                f"采样记录 {sampling.sample_id}",
                f"实验室结果 {lab.lab_result_id}",
                f"传感器 {sensor.sensor_id if sensor else 'N/A'}",
            ],
            created_by=operator_id,
        )
        store.annotations[annotation_id] = ann
        store.seen_sample_ids.add(sample_id)
        return ann

    def run_main_flow(self, operator_id: str = "S001") -> list[SpatialAnnotation]:
        results: list[SpatialAnnotation] = []
        for sample_id in store.sampling_records:
            ann = self.run_annotation(sample_id, operator_id)
            if ann:
                results.append(ann)
        return results

    def list_pending(self) -> list[PendingRecord]:
        pending: list[PendingRecord] = []
        for ann in store.annotations.values():
            summary = (
                f"{ann.zone_level}-{ann.zone_name} | "
                f"融合值 {ann.calculation_trail.final_result} {ann.calculation_trail.final_unit}"
            )
            if ann.alerts:
                summary += " | " + "；".join(ann.alerts[:2])
            action = ann.handler_hint or "查看详情"

            contact = ""
            first_source = ""
            sr = next(
                (s for s in store.sampling_records.values() if s.sample_id == ann.sample_id),
                None,
            )
            if ann.status in (RecordStatus.TIME_MISMATCH, RecordStatus.LATE_ATTACHMENT):
                lab_tech = store.staff.get("S003")
                if lab_tech:
                    contact = f"{lab_tech.name}（{lab_tech.role.value}）{lab_tech.phone} {lab_tech.contact_hint}"
                first_source = "实验室原始记录"
            elif ann.status == RecordStatus.SENSOR_DRIFT and sr:
                sensor = store.sensors.get(sr.sensor_id)
                if sensor:
                    tech = store.staff.get(sensor.responsible_person_id)
                    if tech:
                        contact = f"{tech.name}（{tech.role.value}）{tech.phone} {tech.contact_hint}"
                    first_source = sensor.data_source_url

            pending.append(
                PendingRecord(
                    annotation_id=ann.annotation_id,
                    sample_id=ann.sample_id,
                    station_name=sr.station_name if sr else "",
                    status=ann.status,
                    summary=summary,
                    created_at=ann.created_at,
                    action_needed=action,
                    contact_person=contact,
                    check_first_source=first_source,
                )
            )
        return pending

    def update_lab_remark(self, lab_result_id: str, remark: str, operator_id: str) -> bool:
        lab = store.lab_results.get(lab_result_id)
        if not lab:
            return False
        if lab.remark_editable:
            lab.remark = remark
            return True
        return False

    def update_sampling_remark(self, sample_id: str, remark: str, operator_id: str) -> bool:
        sr = store.sampling_records.get(sample_id)
        if not sr:
            return False
        if sr.remark_editable:
            sr.remark = remark
            return True
        return False


engine = AnnotationEngine()
