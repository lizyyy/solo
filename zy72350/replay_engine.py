from datetime import datetime, timedelta
from typing import List, Dict, Optional, Tuple
from models import (
    DefrostEnergyRecord,
    RecordStatus,
    UnitCaliber,
    UnitConversionNote,
    SamplingInterval,
    TemperatureCalibration,
    ReviewRecord,
    ReplayRun,
    ManualCorrection
)
from demo_data import get_demo_threshold


class DefrostReplayEngine:
    def __init__(self):
        self.threshold_kwh: float = get_demo_threshold()
        self.records: List[DefrostEnergyRecord] = []
        self.sampling_interval: Optional[SamplingInterval] = None
        self.calibrations: List[TemperatureCalibration] = []
        self.reviews: List[ReviewRecord] = []
        self.replay_runs: List[ReplayRun] = []
        self.manual_corrections: List[ManualCorrection] = []
        self.unit_conversion = UnitConversionNote()
        self.current_run_id: str = "initial"

    def import_sampling_interval(self, interval: SamplingInterval) -> str:
        interval.imported_at = datetime.now()
        self.sampling_interval = interval
        return (
            f"✅ 采样间隔已导入\n"
            f"   时间：{interval.start_time.strftime('%Y-%m-%d')} 至 {interval.end_time.strftime('%Y-%m-%d')}\n"
            f"   间隔：{interval.interval_minutes}分钟\n"
            f"   说明：{interval.description}\n"
            f"   备注：{interval.import_note}"
        )

    def import_defrost_records(self, records: List[DefrostEnergyRecord]) -> str:
        count_before = len(self.records)
        for record in records:
            record.run_id = self.current_run_id
            self.records.append(record)
        count_after = len(self.records)

        self._detect_threshold_violations()
        self._apply_average_masking()

        return (
            f"✅ 已导入 {count_after - count_before} 条除霜记录\n"
            f"   累计记录：{count_after} 条\n"
            f"   阈值：{self.threshold_kwh} kWh\n"
            f"   超阈值记录：{self._count_over_threshold()} 条\n"
            f"   被平均值盖掉：{self._count_masked()} 条"
        )

    def _detect_threshold_violations(self):
        for record in self.records:
            if record.run_id != self.current_run_id:
                continue
            if record.energy_consumption_kwh > self.threshold_kwh:
                record.threshold_exceeded = True
                if record.status == RecordStatus.NORMAL:
                    record.status = RecordStatus.OVER_THRESHOLD
                    record.status_note = (
                        f"超阈值：耗电 {record.energy_consumption_kwh} kWh，"
                        f"超过阈值 {self.threshold_kwh} kWh，等待维修师傅复核"
                    )

    def _apply_average_masking(self):
        sorted_records = sorted(
            [r for r in self.records if r.run_id == self.current_run_id],
            key=lambda x: x.start_time
        )

        for i, record in enumerate(sorted_records):
            if not record.threshold_exceeded:
                continue

            has_prev = i > 0
            has_next = i < len(sorted_records) - 1

            if has_prev and has_next:
                prev_energy = sorted_records[i - 1].energy_consumption_kwh
                next_energy = sorted_records[i + 1].energy_consumption_kwh
                avg_energy = round((prev_energy + next_energy) / 2, 1)

                too_far_from_average = abs(record.energy_consumption_kwh - avg_energy) > self.threshold_kwh * 0.5
                way_over_threshold = record.energy_consumption_kwh > self.threshold_kwh * 2

                if too_far_from_average and not way_over_threshold:
                    if record.original_value is None:
                        record.original_value = record.energy_consumption_kwh
                    record.masked_value = avg_energy
                    record.status = RecordStatus.MASKED_BY_AVERAGE
                    record.status_note = (
                        f"⚠️  超阈值记录被平均值盖掉\n"
                        f"   原始值：{record.original_value} kWh\n"
                        f"   前后记录平均值：{avg_energy} kWh\n"
                        f"   当前显示：{avg_energy} kWh\n"
                        f"   老岑师傅说：别急着归正常，留给维修师傅复核！"
                    )
                elif way_over_threshold:
                    record.status = RecordStatus.OVER_THRESHOLD
                    record.status_note = (
                        f"⚠️  超阈值太多（超过阈值2倍），系统不敢盖，留给人来判断\n"
                        f"   耗电：{record.energy_consumption_kwh} kWh\n"
                        f"   阈值：{self.threshold_kwh} kWh\n"
                        f"   老岑师傅说：超这么多肯定有问题，赶紧查！"
                    )

    def supplement_from_calibration(self, calibrations: List[TemperatureCalibration]) -> str:
        for cal in calibrations:
            self.calibrations.append(cal)

        has_old_caliber = any(c.caliber == UnitCaliber.OLD for c in calibrations)
        if has_old_caliber:
            self.unit_conversion.update_caliber(
                UnitCaliber.OLD,
                "老岑",
                "补录了温度校准记录（旧口径），自动切换单位换算说明"
            )

        new_records = self._generate_supplemented_records(calibrations)
        for record in new_records:
            record.run_id = self.current_run_id
            self.records.append(record)

        return (
            f"✅ 已补录 {len(calibrations)} 条温度校准记录\n"
            f"   新增除霜记录：{len(new_records)} 条\n"
            f"   单位口径：已自动切换为「{self.unit_conversion.current_caliber}」\n"
            f"   {self.unit_conversion.get_conversion_text().split(chr(10))[1]}"
        )

    def _generate_supplemented_records(
        self, calibrations: List[TemperatureCalibration]
    ) -> List[DefrostEnergyRecord]:
        new_records = []
        for cal in calibrations:
            if cal.caliber != UnitCaliber.OLD:
                continue

            est_energy = round(
                (abs(cal.calibrated_temperature) * 0.35 + cal.calibration_offset * 0.8),
                1
            )

            existing = [
                r for r in self.records
                if abs((r.start_time - cal.record_time).total_seconds()) < 1800
            ]
            if existing:
                continue

            record = DefrostEnergyRecord(
                id=f"DEF-{cal.record_time.strftime('%Y%m%d')}-{len(self.records) + len(new_records) + 1:03d}",
                start_time=cal.record_time,
                end_time=cal.record_time + timedelta(minutes=20),
                duration_minutes=20,
                energy_consumption_kwh=est_energy,
                ambient_temp=cal.calibrated_temperature,
                coil_temp=cal.calibrated_temperature + 2.5,
                status=RecordStatus.SUPPLEMENTED_FROM_CALIBRATION,
                status_note=(
                    f"从温度校准记录补来的旧口径：{cal.recorded_by}师傅 "
                    f"{cal.record_time.strftime('%H:%M')} 现场记的，"
                    f"按旧口径算 {est_energy} 度，"
                    f"换算新口径是 {round(est_energy * self.unit_conversion.old_to_new_coefficient, 1)} 度"
                ),
                threshold_exceeded=est_energy > self.threshold_kwh,
                supplemented_from=f"校准记录 {cal.sensor_id} {cal.record_time.strftime('%Y-%m-%d %H:%M')}",
                caliber=UnitCaliber.OLD,
                caliber_note="旧口径，从校准记录补录",
                run_id=self.current_run_id
            )
            new_records.append(record)

        return new_records

    def apply_manual_correction(self, correction: ManualCorrection) -> str:
        self.manual_corrections.append(correction)

        record = self._find_record(correction.record_id)
        if not record:
            return f"❌ 未找到记录 {correction.record_id}"

        record.energy_consumption_kwh = correction.corrected_value
        record.masked_value = None
        record.status = RecordStatus.OVER_THRESHOLD
        record.status_note = (
            f"人工修正：{correction.correction_note}\n"
            f"   原值：{correction.original_value} kWh → 修正值：{correction.corrected_value} kWh\n"
            f"   修正人：{correction.corrected_by}，时间：{correction.corrected_at.strftime('%Y-%m-%d %H:%M')}"
        )
        record.reviewed_by = correction.corrected_by
        record.reviewed_at = correction.corrected_at

        return (
            f"✅ 人工修正已应用\n"
            f"   记录：{correction.record_id}\n"
            f"   原值：{correction.original_value} kWh → 修正值：{correction.corrected_value} kWh\n"
            f"   说明：{correction.correction_note}"
        )

    def review_record(
        self,
        record_id: str,
        reviewed_by: str,
        is_normal: bool,
        review_note: str
    ) -> str:
        record = self._find_record(record_id)
        if not record:
            return f"❌ 未找到记录 {record_id}"

        original_status = record.status
        new_status = RecordStatus.REVIEWED_NORMAL if is_normal else RecordStatus.REVIEWED_ABNORMAL

        review = ReviewRecord(
            record_id=record_id,
            reviewed_by=reviewed_by,
            reviewed_at=datetime.now(),
            original_status=original_status,
            new_status=new_status,
            review_note=review_note
        )
        self.reviews.append(review)

        record.status = new_status
        record.reviewed_by = reviewed_by
        record.reviewed_at = review.reviewed_at
        record.status_note = (
            f"已复核 - {'正常' if is_normal else '异常'}\n"
            f"   复核人：{reviewed_by}\n"
            f"   复核说明：{review_note}"
        )

        return (
            f"✅ 复核完成\n"
            f"   记录：{record_id}\n"
            f"   状态：{original_status} → {new_status}\n"
            f"   说明：{review_note}"
        )

    def rerun(self, run_by: str, description: str = "") -> str:
        previous_count = len(self.records)

        run_id = f"replay-{datetime.now().strftime('%Y%m%d-%H%M%S')}"
        self.current_run_id = run_id

        changes = []
        for record in self.records:
            if record.status == RecordStatus.MASKED_BY_AVERAGE and record.original_value:
                old_status = record.status
                record.status = RecordStatus.OVER_THRESHOLD
                record.energy_consumption_kwh = record.original_value
                record.masked_value = None
                record.run_id = run_id
                changes.append(
                    f"{record.id}：状态从 {old_status} 改为 over_threshold，"
                    f"恢复原始值 {record.original_value}"
                )

        new_records = self._generate_supplemented_records(self.calibrations)
        for record in new_records:
            record.run_id = run_id
            self.records.append(record)
            changes.append(
                f"{record.id}：新增一条从温度校准记录补来的旧口径数据"
            )

        if self.unit_conversion.current_caliber == UnitCaliber.OLD:
            changes.append(
                "单位换算说明：从新口径切换为旧口径（因补录了校准记录）"
            )

        replay_run = ReplayRun(
            run_id=run_id,
            run_time=datetime.now(),
            run_by=run_by,
            description=description or "补录温度校准记录后的重跑",
            previous_records_count=previous_count,
            new_records_count=len(self.records),
            changes=changes
        )
        self.replay_runs.append(replay_run)

        return (
            f"✅ 重跑完成\n"
            f"   批次：{run_id}\n"
            f"   操作人：{run_by}\n"
            f"   说明：{replay_run.description}\n"
            f"   变动：{len(changes)} 项\n" +
            "\n".join(f"   • {c}" for c in changes)
        )

    def get_records_summary(self) -> str:
        status_counts: Dict[RecordStatus, int] = {}
        for record in self.records:
            status_counts[record.status] = status_counts.get(record.status, 0) + 1

        total_energy = sum(r.energy_consumption_kwh for r in self.records)
        masked_energy = sum(
            r.original_value or r.energy_consumption_kwh
            for r in self.records
            if r.status == RecordStatus.MASKED_BY_AVERAGE
        )

        lines = [
            "📊 热泵除霜能耗复盘汇总",
            "=" * 50,
            f"总记录数：{len(self.records)} 条",
            f"总耗电量：{total_energy:.1f} kWh",
            f"被盖掉的真实能耗：{masked_energy:.1f} kWh",
            f"能耗阈值：{self.threshold_kwh} kWh",
            "",
            "状态分布："
        ]
        for status, count in status_counts.items():
            status_label = self._get_status_label(status)
            lines.append(f"  {status_label}：{count} 条")

        if self.sampling_interval:
            lines.extend([
                "",
                "采样间隔说明：",
                f"  {self.sampling_interval.description}",
                f"  {self.sampling_interval.import_note}"
            ])

        lines.extend([
            "",
            "单位换算说明：",
            "  " + self.unit_conversion.get_conversion_text().replace("\n", "\n  ")
        ])

        return "\n".join(lines)

    def get_record_detail(self, record_id: str) -> str:
        record = self._find_record(record_id)
        if not record:
            return f"❌ 未找到记录 {record_id}"

        status_label = self._get_status_label(record.status)
        lines = [
            f"📋 记录详情：{record.id}",
            "=" * 50,
            f"时间：{record.start_time.strftime('%Y-%m-%d %H:%M')} - {record.end_time.strftime('%H:%M')}",
            f"时长：{record.duration_minutes} 分钟",
            f"耗电：{record.energy_consumption_kwh} kWh",
            f"环境温度：{record.ambient_temp}°C",
            f"盘管温度：{record.coil_temp}°C",
            f"状态：{status_label}",
            f"口径：{record.caliber}",
            "",
            "状态说明：",
            f"  {record.status_note}"
        ]

        if record.original_value:
            lines.extend([
                "",
                "⚠️  历史痕迹：",
                f"  原始值：{record.original_value} kWh",
                f"  曾被盖为：{record.masked_value} kWh" if record.masked_value else ""
            ])

        if record.supplemented_from:
            lines.extend([
                "",
                "📎 补录来源：",
                f"  {record.supplemented_from}"
            ])

        if record.reviewed_by:
            lines.extend([
                "",
                "✅ 复核信息：",
                f"  复核人：{record.reviewed_by}",
                f"  复核时间：{record.reviewed_at.strftime('%Y-%m-%d %H:%M') if record.reviewed_at else ''}"
            ])

        return "\n".join(line for line in lines if line)

    def get_pending_review_records(self) -> List[DefrostEnergyRecord]:
        return [
            r for r in self.records
            if r.status in [
                RecordStatus.OVER_THRESHOLD,
                RecordStatus.MASKED_BY_AVERAGE,
                RecordStatus.SUPPLEMENTED_FROM_CALIBRATION
            ]
        ]

    def _find_record(self, record_id: str) -> Optional[DefrostEnergyRecord]:
        for record in self.records:
            if record.id == record_id:
                return record
        return None

    def _count_over_threshold(self) -> int:
        return sum(1 for r in self.records if r.threshold_exceeded and r.run_id == self.current_run_id)

    def _count_masked(self) -> int:
        return sum(1 for r in self.records if r.status == RecordStatus.MASKED_BY_AVERAGE and r.run_id == self.current_run_id)

    @staticmethod
    def _get_status_label(status: RecordStatus) -> str:
        labels = {
            RecordStatus.NORMAL: "✅ 正常",
            RecordStatus.OVER_THRESHOLD: "⚠️  超阈值（待复核）",
            RecordStatus.MASKED_BY_AVERAGE: "❓ 被平均值盖掉（待复核）",
            RecordStatus.SUPPLEMENTED_FROM_CALIBRATION: "📎 校准补录（待复核）",
            RecordStatus.PENDING_REVIEW: "⏳ 待复核",
            RecordStatus.REVIEWED_NORMAL: "✅ 已复核-正常",
            RecordStatus.REVIEWED_ABNORMAL: "❌ 已复核-异常"
        }
        return labels.get(status, status)
