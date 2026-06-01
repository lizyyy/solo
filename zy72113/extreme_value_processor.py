from typing import List, Tuple, Dict, Optional, Any
from dataclasses import dataclass
import statistics

from data_models import AirExchangeRecord, EfficiencyResult, Direction


@dataclass
class ExtremeValueInfo:
    value: float
    is_extreme: bool
    extreme_type: Optional[str]
    deviation: float
    threshold: float


class ExtremeValueProcessor:
    def __init__(
        self,
        iqr_factor: float = 1.5,
        zscore_threshold: float = 2.5,
        preserve_extremes: bool = True,
    ):
        self.iqr_factor = iqr_factor
        self.zscore_threshold = zscore_threshold
        self.preserve_extremes = preserve_extremes

    def detect_extremes_iqr(self, values: List[float]) -> List[ExtremeValueInfo]:
        if len(values) < 4:
            return [ExtremeValueInfo(v, False, None, 0.0, 0.0) for v in values]

        sorted_vals = sorted(values)
        q1 = statistics.median(sorted_vals[: len(sorted_vals) // 2])
        q3 = statistics.median(sorted_vals[(len(sorted_vals) + 1) // 2 :])
        iqr = q3 - q1
        lower_bound = q1 - self.iqr_factor * iqr
        upper_bound = q3 + self.iqr_factor * iqr

        results = []
        for v in values:
            is_extreme = False
            extreme_type = None
            deviation = 0.0
            threshold = upper_bound if v > statistics.median(values) else lower_bound

            if v < lower_bound:
                is_extreme = True
                extreme_type = "极低值"
                deviation = lower_bound - v
            elif v > upper_bound:
                is_extreme = True
                extreme_type = "极高值"
                deviation = v - upper_bound

            results.append(
                ExtremeValueInfo(v, is_extreme, extreme_type, deviation, threshold)
            )
        return results

    def detect_extremes_zscore(self, values: List[float]) -> List[ExtremeValueInfo]:
        if len(values) < 3:
            return [ExtremeValueInfo(v, False, None, 0.0, 0.0) for v in values]

        mean = statistics.mean(values)
        stdev = statistics.stdev(values) if len(values) > 1 else 0

        results = []
        for v in values:
            zscore = abs(v - mean) / stdev if stdev > 0 else 0
            is_extreme = zscore > self.zscore_threshold
            extreme_type = None
            if is_extreme:
                extreme_type = "极高值" if v > mean else "极低值"
            results.append(
                ExtremeValueInfo(
                    v, is_extreme, extreme_type, zscore, self.zscore_threshold
                )
            )
        return results

    def detect_extremes_combined(
        self, values: List[float]
    ) -> List[ExtremeValueInfo]:
        iqr_results = self.detect_extremes_iqr(values)
        zscore_results = self.detect_extremes_zscore(values)

        combined = []
        for iqr_res, zscore_res in zip(iqr_results, zscore_results):
            is_extreme = iqr_res.is_extreme or zscore_res.is_extreme
            extreme_type = iqr_res.extreme_type or zscore_res.extreme_type
            deviation = max(iqr_res.deviation, zscore_res.deviation)
            threshold = min(iqr_res.threshold, zscore_res.threshold)
            combined.append(
                ExtremeValueInfo(
                    value=iqr_res.value,
                    is_extreme=is_extreme,
                    extreme_type=extreme_type,
                    deviation=deviation,
                    threshold=threshold,
                )
            )
        return combined

    def calculate_efficiency(
        self,
        records: List[AirExchangeRecord],
        room_volume: float,
    ) -> List[EfficiencyResult]:
        if not records:
            return []

        supply_volumes = [
            r.air_volume
            for r in records
            if r.direction in [Direction.SUPPLY, Direction.RECIRCULATE]
            and r.air_volume is not None
        ]
        exhaust_volumes = [
            r.air_volume
            for r in records
            if r.direction == Direction.EXHAUST and r.air_volume is not None
        ]

        extreme_info = self.detect_extremes_combined(
            [r.air_volume for r in records if r.air_volume is not None]
        )
        extreme_map = {
            info.value: info for info in extreme_info if info.is_extreme
        }

        results = []
        for record in records:
            if record.air_volume is None:
                continue

            raw_efficiency = self._calculate_single_efficiency(
                record.air_volume, room_volume
            )

            is_extreme = record.air_volume in extreme_map
            extreme_type = extreme_map[record.air_volume].extreme_type if is_extreme else None

            adjusted_efficiency = raw_efficiency
            notes = []
            calc_method = "标准计算"

            if is_extreme:
                if self.preserve_extremes:
                    notes.append(
                        f"⚠️ {extreme_type}检测：{record.air_volume} {record.unit}，"
                        f"偏离阈值 {extreme_map[record.air_volume].deviation:.2f}"
                    )
                    notes.append("原始值已保留，未参与平均掩盖风险")
                    calc_method = "极端值保留计算"
                else:
                    normal_values = [
                        v for v in [r.air_volume for r in records if r.air_volume is not None]
                        if v not in extreme_map
                    ]
                    if normal_values:
                        adjusted_value = statistics.mean(normal_values)
                        adjusted_efficiency = self._calculate_single_efficiency(
                            adjusted_value, room_volume
                        )
                        notes.append(
                            f"极端值 {record.air_volume} {record.unit} 已用正常值均值 {adjusted_value:.2f} 替代"
                        )
                        calc_method = "极端值替代计算"

            if room_volume <= 0:
                notes.append("房间体积无效，效率计算可能不准确")

            results.append(
                EfficiencyResult(
                    record_id=record.record_id,
                    raw_efficiency=raw_efficiency,
                    adjusted_efficiency=adjusted_efficiency,
                    is_extreme=is_extreme,
                    extreme_type=extreme_type,
                    calculation_method=calc_method,
                    raw_values=[record.air_volume],
                    notes=notes,
                )
            )

        return results

    def calculate_group_efficiency(
        self,
        records: List[AirExchangeRecord],
        room_volume: float,
        location: Optional[str] = None,
    ) -> Dict[str, Any]:
        if location:
            records = [r for r in records if r.location == location]

        if not records:
            return {"error": "无有效记录"}

        all_volumes = [r.air_volume for r in records if r.air_volume is not None]
        extreme_info = self.detect_extremes_combined(all_volumes)
        extreme_values = [info for info in extreme_info if info.is_extreme]
        normal_values = [info.value for info in extreme_info if not info.is_extreme]

        raw_mean = statistics.mean(all_volumes) if all_volumes else 0
        normal_mean = statistics.mean(normal_values) if normal_values else raw_mean
        median_val = statistics.median(all_volumes) if all_volumes else 0

        raw_efficiency = self._calculate_single_efficiency(raw_mean, room_volume)
        normal_efficiency = self._calculate_single_efficiency(normal_mean, room_volume)
        median_efficiency = self._calculate_single_efficiency(median_val, room_volume)

        return {
            "location": location or "全部",
            "record_count": len(records),
            "extreme_count": len(extreme_values),
            "extreme_details": [
                {"value": e.value, "type": e.extreme_type, "deviation": e.deviation}
                for e in extreme_values
            ],
            "methods": {
                "简单平均（易掩盖风险）": {
                    "efficiency": raw_efficiency,
                    "air_volume": raw_mean,
                    "warning": "⚠️ 包含极端值，可能掩盖真实风险",
                },
                "剔除极端值后平均": {
                    "efficiency": normal_efficiency,
                    "air_volume": normal_mean,
                    "note": "已排除极端值，反映正常工况",
                },
                "中位数（抗干扰）": {
                    "efficiency": median_efficiency,
                    "air_volume": median_val,
                    "note": "对极端值不敏感，适合存在异常值场景",
                },
                "原始值逐个展示": {
                    "records": [
                        {
                            "record_id": r.record_id,
                            "air_volume": r.air_volume,
                            "efficiency": self._calculate_single_efficiency(r.air_volume, room_volume),
                            "is_extreme": r.air_volume in [e.value for e in extreme_values],
                            "time": r.measure_time.strftime("%H:%M"),
                        }
                        for r in records
                        if r.air_volume is not None
                    ]
                },
            },
            "risk_assessment": self._assess_risk(
                extreme_values, normal_efficiency, raw_efficiency
            ),
        }

    def _calculate_single_efficiency(self, air_volume: float, room_volume: float) -> float:
        if room_volume <= 0 or air_volume <= 0:
            return 0.0
        return (air_volume / 60.0) / room_volume * 100

    def _assess_risk(
        self,
        extreme_values: List[ExtremeValueInfo],
        normal_efficiency: float,
        raw_efficiency: float,
    ) -> Dict[str, Any]:
        efficiency_gap = abs(normal_efficiency - raw_efficiency)
        high_extremes = [e for e in extreme_values if e.extreme_type == "极高值"]
        low_extremes = [e for e in extreme_values if e.extreme_type == "极低值"]

        risk_level = "正常"
        risk_description = "数据分布正常，无明显风险"

        if low_extremes:
            risk_level = "⚠️ 需关注"
            risk_description = (
                f"检测到 {len(low_extremes)} 个极低值，简单平均后效率从 {normal_efficiency:.2f}% "
                f"变为 {raw_efficiency:.2f}%，差距 {efficiency_gap:.2f} 个百分点，"
                "极端低值表示换气能力可能存在瞬时不足，风险被平均掩盖！"
            )
        elif high_extremes:
            risk_level = "ℹ️ 信息"
            risk_description = (
                f"检测到 {len(high_extremes)} 个极高值，可能是设备调试或异常工况，"
                f"简单平均后效率偏差 {efficiency_gap:.2f} 个百分点"
            )

        if extreme_values and efficiency_gap > 5:
            risk_level = "🔴 高风险"
            risk_description += " 效率偏差超过5%，建议逐条查看原始数据！"

        return {
            "level": risk_level,
            "description": risk_description,
            "efficiency_gap": efficiency_gap,
            "extreme_summary": f"{len(low_extremes)}个极低值, {len(high_extremes)}个极高值",
        }

    def mark_extreme_records(
        self, records: List[AirExchangeRecord]
    ) -> List[AirExchangeRecord]:
        volumes = [r.air_volume for r in records if r.air_volume is not None]
        if not volumes:
            return records

        extreme_info = self.detect_extremes_combined(volumes)
        extreme_values = {
            info.value: info for info in extreme_info if info.is_extreme
        }

        for record in records:
            if record.air_volume in extreme_values:
                info = extreme_values[record.air_volume]
                record.is_extreme_value = True
                record.extreme_value_reason = (
                    f"{info.extreme_type}：偏离阈值 {info.deviation:.2f}，"
                    f"阈值={info.threshold:.2f}"
                )
                if info.extreme_type == "极低值":
                    record.processing_suggestion = (
                        "⚠️ 极低值警报：此时间段换气能力严重不足，"
                        "建议检查设备运行状态，原始数据已保留供追溯"
                    )
                else:
                    record.processing_suggestion = (
                        "ℹ️ 极高值提示：风量异常偏高，"
                        "建议确认是否为调试工况，原始数据已保留"
                    )

        return records
