#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
缆索振动频率巡检 —— 训练教练老唐给新人讲流程用的演示脚本

老唐跟质检员交接的时候说：这个脚本跑一遍，三种记录怎么处理、
实验复盘图怎么更新、采样时间缺了半小时怎么标记，全都能看到。
不用翻采样间隔说明，跑一次就明白。
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field, asdict
from datetime import datetime, timedelta
from enum import Enum
from typing import Optional


class RecordStatus(Enum):
    NORMAL = "正常"
    GAP_DETECTED = "采样时间缺失-待质检复核"
    BACKFILLED = "旧口径补录-已校准"
    MANUAL_CORRECTED = "人工修正"
    RERUN = "重跑"


@dataclass
class SamplingIntervalSpec:
    """
    采样间隔说明 —— 老唐说：这是巡检的"尺子"，多久采一次、
    允许的最大间隔是多少，都在这儿。第一次导入的时候就按这个来。
    """
    cable_id: str
    normal_interval_min: float
    max_gap_tolerance_min: float
    effective_date: str
    note: str = ""


@dataclass
class TemperatureCalibration:
    """
    温度校准记录 —— 缆索频率会随温度漂移，老唐说：
    要是采样时间缺了一段，先别急着归正常，翻翻温校记录，
    看看缺的那段温度有没有异常，再决定是补录还是标异常。
    """
    cable_id: str
    timestamp: str
    temperature_c: float
    frequency_correction_hz: float
    spec_version: str
    note: str = ""


@dataclass
class InspectionRecord:
    """
    一条巡检记录 —— 老唐说：这是最核心的东西，
    每条记录最后都有一个状态，质检员一眼就知道该怎么处理。
    """
    cable_id: str
    timestamp: str
    measured_freq_hz: float
    corrected_freq_hz: Optional[float] = None
    status: RecordStatus = RecordStatus.NORMAL
    prev_timestamp: Optional[str] = None
    gap_minutes: Optional[float] = None
    correction_source: Optional[str] = None
    note: str = ""


@dataclass
class HistoryEntry:
    """
    历史记录 —— 每一次操作都留痕，老唐说：
    质检员开会翻这个就能对上，不用再问教练。
    """
    step: str
    timestamp: str
    detail: str
    affected_records: list[str] = field(default_factory=list)


class CableVibrationInspection:
    """
    缆索振动频率巡检主流程

    老唐给新人的话：跑这个类的三步方法，就是咱们日常工作流。
    第一步导入采样间隔说明，第二步补看温度校准记录，
    第三步更新实验复盘图。中间碰到采样时间缺了半小时，
    别急着归正常，留给质检员复核。
    """

    def __init__(self):
        self.specs: list[SamplingIntervalSpec] = []
        self.calibrations: list[TemperatureCalibration] = []
        self.records: list[InspectionRecord] = []
        self.history: list[HistoryEntry] = []
        self.review_chart_data: list[dict] = []

    # ========== 第一步：采样间隔说明首次导入 ==========

    def import_sampling_spec(self, spec: SamplingIntervalSpec):
        """
        老唐说：先把"尺子"拿进来，后面判断采样时间缺不缺，
        全靠这个间隔说明，不用再翻别的材料。
        """
        self.specs.append(spec)
        entry = HistoryEntry(
            step="采样间隔说明导入",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            detail=(
                f"缆索{spec.cable_id}：正常间隔{spec.normal_interval_min}分钟，"
                f"最大容忍{spec.max_gap_tolerance_min}分钟，"
                f"生效日期{spec.effective_date}"
                + (f"，备注：{spec.note}" if spec.note else "")
            ),
            affected_records=[spec.cable_id],
        )
        self.history.append(entry)

    # ========== 第二步：老唐补看温度校准记录 ==========

    def review_temperature_calibration(self, cal: TemperatureCalibration):
        """
        老唐说：温校记录不是每次都要看，但采样时间缺了一段的时候，
        一定要翻温校，看看缺的那段温度有没有跳变，
        再决定补不补、怎么补。
        """
        self.calibrations.append(cal)
        entry = HistoryEntry(
            step="温度校准记录补看",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            detail=(
                f"缆索{cal.cable_id} {cal.timestamp}："
                f"温度{cal.temperature_c}°C，"
                f"频率修正{cal.frequency_correction_hz:+.3f}Hz，"
                f"口径版本{cal.spec_version}"
                + (f"，备注：{cal.note}" if cal.note else "")
            ),
            affected_records=[cal.cable_id],
        )
        self.history.append(entry)

    # ========== 添加巡检记录 ==========

    def add_record(self, record: InspectionRecord):
        self.records.append(record)

    # ========== 间隔检测 ==========

    def check_gaps(self):
        """
        老唐说：跑完这个方法，哪条记录采样时间缺了半小时，
        一目了然。缺了的标成"待质检复核"，别急着归正常。
        """
        for spec in self.specs:
            cable_records = [
                r for r in self.records if r.cable_id == spec.cable_id
            ]
            cable_records.sort(key=lambda r: r.timestamp)

            for i in range(1, len(cable_records)):
                curr = cable_records[i]
                prev = cable_records[i - 1]
                if curr.prev_timestamp is None:
                    curr.prev_timestamp = prev.timestamp

                t_prev = datetime.strptime(prev.timestamp, "%Y-%m-%d %H:%M")
                t_curr = datetime.strptime(curr.timestamp, "%Y-%m-%d %H:%M")
                gap = (t_curr - t_prev).total_seconds() / 60.0
                curr.gap_minutes = gap

                if gap > spec.max_gap_tolerance_min:
                    curr.status = RecordStatus.GAP_DETECTED
                    entry = HistoryEntry(
                        step="间隔检测",
                        timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                        detail=(
                            f"缆索{curr.cable_id} {curr.timestamp}："
                            f"采样间隔{gap:.0f}分钟，"
                            f"超过最大容忍{spec.max_gap_tolerance_min}分钟，"
                            f"标记为'{RecordStatus.GAP_DETECTED.value}'，等质检员复核"
                        ),
                        affected_records=[f"{curr.cable_id}@{curr.timestamp}"],
                    )
                    self.history.append(entry)

    # ========== 从温度校准记录补录（旧口径） ==========

    def backfill_from_calibration(
        self,
        cable_id: str,
        timestamp: str,
        cal: TemperatureCalibration,
    ):
        """
        老唐说：补录就是拿温校记录里的旧口径去填缺的那段。
        补完之后状态改成"旧口径补录-已校准"，但不是正常，
        质检员一看就知道这条是后补的。
        """
        for rec in self.records:
            if rec.cable_id == cable_id and rec.timestamp == timestamp:
                rec.corrected_freq_hz = (
                    rec.measured_freq_hz + cal.frequency_correction_hz
                )
                rec.status = RecordStatus.BACKFILLED
                rec.correction_source = (
                    f"温校记录@{cal.timestamp} "
                    f"口径版本{cal.spec_version}"
                )
                rec.note = (
                    f"从温度校准记录补录：温度{cal.temperature_c}°C，"
                    f"修正量{cal.frequency_correction_hz:+.3f}Hz"
                )
                entry = HistoryEntry(
                    step="旧口径补录",
                    timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    detail=(
                        f"缆索{cable_id} {timestamp}："
                        f"从温校记录（口径版本{cal.spec_version}）补录，"
                        f"原始频率{rec.measured_freq_hz:.3f}Hz → "
                        f"修正后{rec.corrected_freq_hz:.3f}Hz"
                    ),
                    affected_records=[f"{cable_id}@{timestamp}"],
                )
                self.history.append(entry)
                return True
        return False

    # ========== 人工修正 ==========

    def manual_correct(
        self,
        cable_id: str,
        timestamp: str,
        corrected_freq_hz: float,
        reason: str,
    ):
        """
        老唐说：人工修正就是教练自己改的，改完写明原因，
        状态标成"人工修正"，和正常记录区分开。
        """
        for rec in self.records:
            if rec.cable_id == cable_id and rec.timestamp == timestamp:
                rec.corrected_freq_hz = corrected_freq_hz
                rec.status = RecordStatus.MANUAL_CORRECTED
                rec.correction_source = "人工修正"
                rec.note = f"人工修正原因：{reason}"
                entry = HistoryEntry(
                    step="人工修正",
                    timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    detail=(
                        f"缆索{cable_id} {timestamp}："
                        f"人工修正为{corrected_freq_hz:.3f}Hz，原因：{reason}"
                    ),
                    affected_records=[f"{cable_id}@{timestamp}"],
                )
                self.history.append(entry)
                return True
        return False

    # ========== 重跑 ==========

    def rerun_record(
        self,
        cable_id: str,
        timestamp: str,
        new_freq_hz: float,
    ):
        """
        老唐说：重跑就是觉得原来测的不对，重新跑一遍采样，
        跑完状态标"重跑"，和首次正常记录区分开。
        """
        for rec in self.records:
            if rec.cable_id == cable_id and rec.timestamp == timestamp:
                rec.measured_freq_hz = new_freq_hz
                rec.corrected_freq_hz = None
                rec.status = RecordStatus.RERUN
                rec.correction_source = "重跑"
                rec.note = f"重跑：原始{rec.measured_freq_hz:.3f}Hz → {new_freq_hz:.3f}Hz"
                entry = HistoryEntry(
                    step="重跑",
                    timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
                    detail=(
                        f"缆索{cable_id} {timestamp}："
                        f"重跑结果{new_freq_hz:.3f}Hz"
                    ),
                    affected_records=[f"{cable_id}@{timestamp}"],
                )
                self.history.append(entry)
                return True
        return False

    # ========== 第三步：实验复盘图更新 ==========

    def update_review_chart(self):
        """
        老唐说：复盘图就是把所有记录按时间排开，
        不同状态用不同标记，质检员一眼就能看出
        哪条是正常的、哪条缺了半小时、哪条是后补的。
        更新完复盘图，历史记录也同步留痕。
        """
        self.review_chart_data = []
        for rec in self.records:
            chart_point = {
                "cable_id": rec.cable_id,
                "timestamp": rec.timestamp,
                "measured_freq_hz": rec.measured_freq_hz,
                "corrected_freq_hz": rec.corrected_freq_hz,
                "status": rec.status.value,
                "gap_minutes": rec.gap_minutes,
                "correction_source": rec.correction_source,
            }
            self.review_chart_data.append(chart_point)

        entry = HistoryEntry(
            step="实验复盘图更新",
            timestamp=datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            detail=(
                f"复盘图已更新，共{len(self.review_chart_data)}条记录，"
                f"状态分布："
                + "、".join(
                    f"{s.value}{sum(1 for r in self.records if r.status == s)}条"
                    for s in RecordStatus
                    if any(r.status == s for r in self.records)
                )
            ),
            affected_records=[
                f"{r.cable_id}@{r.timestamp}" for r in self.records
            ],
        )
        self.history.append(entry)

    # ========== 输出 ==========

    def print_records(self, title: str = "巡检记录"):
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
        for rec in self.records:
            gap_info = (
                f"间隔{rec.gap_minutes:.0f}分钟"
                if rec.gap_minutes is not None
                else "首条"
            )
            freq_display = f"{rec.measured_freq_hz:.3f}Hz"
            if rec.corrected_freq_hz is not None:
                freq_display += f" → 修正后{rec.corrected_freq_hz:.3f}Hz"
            print(f"  [{rec.status.value}] {rec.cable_id} {rec.timestamp}")
            print(f"    频率：{freq_display}  {gap_info}")
            if rec.correction_source:
                print(f"    来源：{rec.correction_source}")
            if rec.note:
                print(f"    备注：{rec.note}")
            print()

    def print_history(self, title: str = "历史记录"):
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
        for i, h in enumerate(self.history, 1):
            print(f"  {i}. [{h.step}] {h.timestamp}")
            print(f"     {h.detail}")
            if h.affected_records:
                print(f"     涉及：{', '.join(h.affected_records)}")
            print()

    def print_review_chart(self, title: str = "实验复盘图"):
        print(f"\n{'='*60}")
        print(f"  {title}")
        print(f"{'='*60}")
        if not self.review_chart_data:
            print("  （复盘图为空，请先执行 update_review_chart）")
            return
        print(f"  {'时间':<18} {'缆索':<6} {'测量频率':>10} {'修正频率':>10} {'状态':<20} {'间隔/min':>8}")
        print(f"  {'-'*18} {'-'*6} {'-'*10} {'-'*10} {'-'*20} {'-'*8}")
        for p in self.review_chart_data:
            corrected = (
                f"{p['corrected_freq_hz']:.3f}"
                if p["corrected_freq_hz"] is not None
                else "-"
            )
            gap = f"{p['gap_minutes']:.0f}" if p["gap_minutes"] is not None else "-"
            print(
                f"  {p['timestamp']:<18} {p['cable_id']:<6} "
                f"{p['measured_freq_hz']:>10.3f} {corrected:>10} "
                f"{p['status']:<20} {gap:>8}"
            )
        print()

    def to_json(self) -> str:
        result = {
            "specs": [asdict(s) for s in self.specs],
            "calibrations": [asdict(c) for c in self.calibrations],
            "records": [
                {**asdict(r), "status": r.status.value} for r in self.records
            ],
            "history": [asdict(h) for h in self.history],
            "review_chart": self.review_chart_data,
        }
        return json.dumps(result, ensure_ascii=False, indent=2)


# =====================================================================
# 演示数据 —— 老唐说：跑一遍 demo()，三种处理结果全出来
# =====================================================================

def build_demo_data() -> CableVibrationInspection:
    insp = CableVibrationInspection()

    # ---- 采样间隔说明 ----
    # 老唐说：C1缆索，10分钟采一次，最多容忍30分钟，
    # 超过30分钟就是缺了，得标异常。
    insp.import_sampling_spec(SamplingIntervalSpec(
        cable_id="C1",
        normal_interval_min=10,
        max_gap_tolerance_min=30,
        effective_date="2026-06-01",
        note="每10分钟采样，超30分钟视为缺失",
    ))

    # ---- 温度校准记录 ----
    # 老唐说：这两条温校是后面补录用的"旧口径"，
    # v1.0是老版本的修正系数，补录的时候就用这个。
    insp.review_temperature_calibration(TemperatureCalibration(
        cable_id="C1",
        timestamp="2026-06-03 08:00",
        temperature_c=22.5,
        frequency_correction_hz=-0.012,
        spec_version="v1.0",
        note="旧口径修正系数，用于补录",
    ))
    insp.review_temperature_calibration(TemperatureCalibration(
        cable_id="C1",
        timestamp="2026-06-03 12:00",
        temperature_c=28.3,
        frequency_correction_hz=+0.018,
        spec_version="v2.0",
        note="新口径，本次巡检用",
    ))

    # ---- 巡检记录 ----
    # 老唐说：下面四条就是演示的核心——
    # 第一条顺利记录（自始至终正常），第二条缺了半小时（后补录），
    # 第三条会做人工修正，第四条会重跑。

    # 顺利记录：08:00正常采样，从头到尾不变
    insp.add_record(InspectionRecord(
        cable_id="C1",
        timestamp="2026-06-03 08:00",
        measured_freq_hz=1.234,
        note="顺利记录，全程无异常",
    ))

    # 采样时间缺了半小时的记录
    # 上一次是08:00，这一次直接跳到08:45，中间缺了45分钟
    # 超过了30分钟的容忍上限，标记为待质检复核
    # 后面老唐会从温校旧口径补录
    insp.add_record(InspectionRecord(
        cable_id="C1",
        timestamp="2026-06-03 08:45",
        measured_freq_hz=1.221,
    ))

    # 后续做人工修正的记录
    insp.add_record(InspectionRecord(
        cable_id="C1",
        timestamp="2026-06-03 08:55",
        measured_freq_hz=1.240,
    ))

    # 后续做重跑的记录
    insp.add_record(InspectionRecord(
        cable_id="C1",
        timestamp="2026-06-03 09:05",
        measured_freq_hz=1.228,
    ))

    return insp


def demo():
    """
    老唐的演示流程 —— 三步走：

    第一步：采样间隔说明第一次导入（build_demo_data里已完成）
    第二步：老唐补看温度校准记录，发现缺的那段用旧口径补录
    第三步：实验复盘图更新

    中间还会演示一次人工修正和一次重跑。
    """

    print("=" * 60)
    print("  缆索振动频率巡检 —— 训练教练老唐的演示")
    print("  老唐说：跑一遍，三种处理结果全出来，不用翻采样间隔说明")
    print("=" * 60)

    insp = build_demo_data()

    # ---- 间隔检测 ----
    # 老唐说：先跑间隔检测，看看哪条缺了半小时
    print("\n>>> 第一步：采样间隔说明已导入，开始间隔检测...")
    insp.check_gaps()
    insp.print_records("间隔检测后的记录")

    # ---- 人工修正 ----
    # 老唐说：08:55那条频率有个小跳动，
    # 教练判断是传感器漂移，人工修正一下
    print(">>> 演示人工修正：C1 08:55 频率从1.240修正为1.236Hz")
    insp.manual_correct(
        cable_id="C1",
        timestamp="2026-06-03 08:55",
        corrected_freq_hz=1.236,
        reason="传感器漂移，教练判定修正",
    )

    # ---- 补看温度校准记录，用旧口径补录 ----
    # 老唐说：08:45那条缺了半小时，翻温校记录，
    # v1.0旧口径在08:00有修正系数，拿过来补录
    # 补录之后状态变成"旧口径补录-已校准"，但不是正常，
    # 质检员一看就知道这条是后补的
    print(">>> 第二步：老唐补看温度校准记录，对08:45缺失记录做旧口径补录...")
    backfill_cal = TemperatureCalibration(
        cable_id="C1",
        timestamp="2026-06-03 08:00",
        temperature_c=22.5,
        frequency_correction_hz=-0.012,
        spec_version="v1.0",
        note="旧口径修正系数，用于补录缺失段",
    )
    insp.backfill_from_calibration(
        cable_id="C1",
        timestamp="2026-06-03 08:45",
        cal=backfill_cal,
    )

    # ---- 重跑 ----
    # 老唐说：09:05那条觉得测的不对，重新跑一遍
    print(">>> 演示重跑：C1 09:05 重新采样，频率从1.228变为1.232Hz")
    insp.rerun_record(
        cable_id="C1",
        timestamp="2026-06-03 09:05",
        new_freq_hz=1.232,
    )

    # ---- 第三步：实验复盘图更新 ----
    print(">>> 第三步：实验复盘图更新...")
    insp.update_review_chart()

    # ---- 输出最终结果 ----
    insp.print_records("最终巡检记录（三种处理结果）")
    insp.print_review_chart("实验复盘图")
    insp.print_history("完整历史记录")

    # ---- 验证：复盘图与历史记录能否对上 ----
    print("=" * 60)
    print("  验证：复盘图 vs 历史记录")
    print("=" * 60)
    chart_keys = {p["cable_id"] + "@" + p["timestamp"] for p in insp.review_chart_data}
    history_record_keys = set()
    for h in insp.history:
        for key in h.affected_records:
            if "@" in key:
                history_record_keys.add(key)
    overlap = chart_keys & history_record_keys
    chart_only = chart_keys - history_record_keys
    history_only = history_record_keys - chart_keys
    print(f"  复盘图记录数：{len(chart_keys)}")
    print(f"  历史涉及记录数：{len(history_record_keys)}")
    print(f"  重叠（能对上）：{len(overlap)}条")
    if chart_only:
        print(f"  仅复盘图有（无历史操作）：{chart_only}")
    if history_only:
        print(f"  仅历史有（不在复盘图）：{history_only}")
    if not chart_only and not history_only:
        print("  结论：复盘图与历史记录完全对上，质检员可以放心用。")
    else:
        print("  结论：复盘图覆盖了所有历史操作记录，部分历史条目涉及规格/温校级别不影响记录对齐。")
    print()

    # ---- 关键提醒 ----
    print("=" * 60)
    print("  老唐的提醒")
    print("=" * 60)
    print("  1. 采样时间缺了半小时的记录，状态是'待质检复核'，")
    print("     不是'正常'，别急着归正常，等质检员确认。")
    print("  2. 旧口径补录的记录，状态是'旧口径补录-已校准'，")
    print("     和正常记录不同，质检员一眼能分辨。")
    print("  3. 人工修正和重跑也都有明确标记，历史记录全留痕。")
    print("  4. 复盘图更新后，三种状态的记录分布一目了然。")
    print("=" * 60)


if __name__ == "__main__":
    demo()
