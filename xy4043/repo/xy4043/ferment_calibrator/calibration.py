"""
校准算法模块 - 修正传感器漂移、对齐OD600取样时间线
"""
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Any, Optional, Tuple, Callable
from dataclasses import dataclass, asdict
from collections import defaultdict

from .ferment_config import FermentConfig
from .csv_parser import FermentationRecord


@dataclass
class CalibrationResult:
    """校准结果"""
    original_record: FermentationRecord
    calibrated_ph: Optional[float] = None
    calibrated_temperature: Optional[float] = None
    calibrated_do: Optional[float] = None
    ph_drift_correction: Optional[float] = None
    temp_drift_correction: Optional[float] = None
    do_drift_correction: Optional[float] = None
    calibration_time: datetime = None
    
    def __post_init__(self):
        if self.calibration_time is None:
            self.calibration_time = datetime.now()


@dataclass 
class AlignedODData:
    """对齐后的OD数据"""
    time: datetime
    od600: float
    interpolated: bool = False
    nearest_sensor_time: Optional[datetime] = None
    time_diff_seconds: Optional[float] = None


class SensorCalibrator:
    """传感器校准器"""
    
    def __init__(self, config: FermentConfig):
        self.config = config
        self._start_time: Optional[datetime] = None
    
    def calibrate_record(self, record: FermentationRecord, start_time: Optional[datetime] = None) -> CalibrationResult:
        """
        校准单个记录
        
        Args:
            record: 原始发酵记录
            start_time: 实验开始时间（用于计算漂移）
            
        Returns:
            CalibrationResult对象
        """
        if start_time:
            self._start_time = start_time
        elif self._start_time is None:
            self._start_time = record.time
        
        hours_elapsed = self._calculate_hours_elapsed(record.time)
        
        calibrated_ph, ph_correction = self._calibrate_ph(
            record.ph, hours_elapsed
        )
        calibrated_temp, temp_correction = self._calibrate_temperature(
            record.temperature, hours_elapsed
        )
        calibrated_do, do_correction = self._calibrate_dissolved_oxygen(
            record.dissolved_oxygen, hours_elapsed
        )
        
        return CalibrationResult(
            original_record=record,
            calibrated_ph=calibrated_ph,
            calibrated_temperature=calibrated_temp,
            calibrated_do=calibrated_do,
            ph_drift_correction=ph_correction,
            temp_drift_correction=temp_correction,
            do_drift_correction=do_correction
        )
    
    def _calculate_hours_elapsed(self, current_time: datetime) -> float:
        """计算从开始时间过去的小时数"""
        if self._start_time is None:
            return 0.0
        delta = current_time - self._start_time
        return delta.total_seconds() / 3600.0
    
    def _calibrate_ph(self, raw_ph: Optional[float], hours_elapsed: float) -> Tuple[Optional[float], Optional[float]]:
        """
        校准pH值
        
        校准公式: calibrated = (raw + offset) * slope - drift_correction
        漂移修正: drift = drift_per_hour * hours_elapsed
        
        Args:
            raw_ph: 原始pH值
            hours_elapsed: 经过的小时数
            
        Returns:
            (校准后的值, 漂移修正量)
        """
        if raw_ph is None:
            return None, None
        
        ph_calib = self.config.get_sensor_calibration('ph')
        offset = ph_calib.get('offset', 0.0)
        slope = ph_calib.get('slope', 1.0)
        drift_per_hour = ph_calib.get('drift_per_hour', 0.0)
        
        drift_correction = drift_per_hour * hours_elapsed
        calibrated = (raw_ph + offset) * slope - drift_correction
        
        return round(calibrated, 4), round(drift_correction, 4)
    
    def _calibrate_temperature(self, raw_temp: Optional[float], hours_elapsed: float) -> Tuple[Optional[float], Optional[float]]:
        """
        校准温度
        
        Args:
            raw_temp: 原始温度值
            hours_elapsed: 经过的小时数
            
        Returns:
            (校准后的值, 漂移修正量)
        """
        if raw_temp is None:
            return None, None
        
        temp_calib = self.config.get_sensor_calibration('temperature')
        offset = temp_calib.get('offset', 0.0)
        drift_per_hour = temp_calib.get('drift_per_hour', 0.0)
        
        drift_correction = drift_per_hour * hours_elapsed
        calibrated = raw_temp + offset - drift_correction
        
        return round(calibrated, 2), round(drift_correction, 4)
    
    def _calibrate_dissolved_oxygen(self, raw_do: Optional[float], hours_elapsed: float) -> Tuple[Optional[float], Optional[float]]:
        """
        校准溶氧
        
        Args:
            raw_do: 原始溶氧值
            hours_elapsed: 经过的小时数
            
        Returns:
            (校准后的值, 漂移修正量)
        """
        if raw_do is None:
            return None, None
        
        do_calib = self.config.get_sensor_calibration('dissolved_oxygen')
        offset = do_calib.get('offset', 0.0)
        slope = do_calib.get('slope', 1.0)
        drift_per_hour = do_calib.get('drift_per_hour', 0.0)
        
        drift_correction = drift_per_hour * hours_elapsed
        calibrated = (raw_do + offset) * slope - drift_correction
        
        calibrated = max(0.0, min(100.0, calibrated))
        
        return round(calibrated, 2), round(drift_correction, 4)
    
    def calibrate_all_records(self, records: List[FermentationRecord]) -> List[CalibrationResult]:
        """
        校准所有记录
        
        Args:
            records: 记录列表
            
        Returns:
            校准结果列表
        """
        if not records:
            return []
        
        self._start_time = min(r.time for r in records)
        
        return [self.calibrate_record(record) for record in records]


class TimelineAligner:
    """时间线对齐器 - 对齐OD600取样数据和在线传感器数据"""
    
    def __init__(self, config: FermentConfig):
        self.config = config
    
    def align_od600_to_sensors(
        self,
        calibration_results: List[CalibrationResult],
        od_records: List[FermentationRecord]
    ) -> Tuple[List[AlignedODData], Dict[str, Any]]:
        """
        将OD600取样数据对齐到传感器时间线
        
        Args:
            calibration_results: 校准后的传感器数据
            od_records: 包含OD600的记录
            
        Returns:
            (对齐后的OD数据列表, 对齐统计信息)
        """
        if not calibration_results or not od_records:
            return [], {"message": "没有数据需要对齐"}
        
        sensor_times = np.array([
            (cr.original_record.time - datetime(1970, 1, 1)).total_seconds()
            for cr in calibration_results
        ])
        sensor_data = {
            'ph': np.array([cr.calibrated_ph for cr in calibration_results], dtype=float),
            'temperature': np.array([cr.calibrated_temperature for cr in calibration_results], dtype=float),
            'do': np.array([cr.calibrated_do for cr in calibration_results], dtype=float),
        }
        
        aligned_data: List[AlignedODData] = []
        interpolation_count = 0
        exact_match_count = 0
        time_diffs: List[float] = []
        
        for od_record in od_records:
            if od_record.od600 is None:
                continue
            
            od_time_seconds = (od_record.time - datetime(1970, 1, 1)).total_seconds()
            
            exact_match_idx = np.where(sensor_times == od_time_seconds)[0]
            
            if len(exact_match_idx) > 0:
                exact_match_count += 1
                aligned = AlignedODData(
                    time=od_record.time,
                    od600=od_record.od600,
                    interpolated=False,
                    nearest_sensor_time=od_record.time,
                    time_diff_seconds=0.0
                )
            else:
                interpolation_count += 1
                nearest_idx = np.argmin(np.abs(sensor_times - od_time_seconds))
                nearest_seconds = sensor_times[nearest_idx]
                nearest_time = datetime(1970, 1, 1) + timedelta(seconds=nearest_seconds)
                time_diff = abs(od_time_seconds - nearest_seconds)
                time_diffs.append(time_diff)
                
                aligned = AlignedODData(
                    time=od_record.time,
                    od600=od_record.od600,
                    interpolated=True,
                    nearest_sensor_time=nearest_time,
                    time_diff_seconds=time_diff
                )
            
            aligned_data.append(aligned)
        
        aligned_data.sort(key=lambda x: x.time)
        
        stats = {
            "total_od_points": len(aligned_data),
            "exact_matches": exact_match_count,
            "interpolated_points": interpolation_count,
            "avg_time_diff_seconds": np.mean(time_diffs) if time_diffs else 0.0,
            "max_time_diff_seconds": max(time_diffs) if time_diffs else 0.0,
        }
        
        return aligned_data, stats
    
    def merge_sensor_and_od_data(
        self,
        calibration_results: List[CalibrationResult],
        aligned_od_data: List[AlignedODData]
    ) -> List[Dict[str, Any]]:
        """
        合并传感器数据和对齐后的OD数据
        
        创建统一的时间序列，包含所有传感器数据和OD600值
        
        Args:
            calibration_results: 校准后的传感器数据
            aligned_od_data: 对齐后的OD数据
            
        Returns:
            合并后的时间序列数据列表
        """
        merged: List[Dict[str, Any]] = []
        
        od_lookup = {ad.time: ad for ad in aligned_od_data}
        
        for cr in calibration_results:
            record_time = cr.original_record.time
            
            od_point = od_lookup.get(record_time)
            
            merged_point = {
                "time": record_time.isoformat(),
                "datetime": record_time,
                "temperature": cr.calibrated_temperature,
                "ph": cr.calibrated_ph,
                "dissolved_oxygen": cr.calibrated_do,
                "stirring_speed": cr.original_record.stirring_speed,
                "feed_amount": cr.original_record.feed_amount,
                "feed_formulation": cr.original_record.feed_formulation,
                "phase": cr.original_record.phase,
                "batch_notes": cr.original_record.batch_notes,
                "od600": od_point.od600 if od_point else None,
                "od_interpolated": od_point.interpolated if od_point else None,
                "calibration": {
                    "ph_correction": cr.ph_drift_correction,
                    "temp_correction": cr.temp_drift_correction,
                    "do_correction": cr.do_drift_correction,
                }
            }
            merged.append(merged_point)
        
        for od_point in aligned_od_data:
            if od_point.time not in [cr.original_record.time for cr in calibration_results]:
                if od_point.nearest_sensor_time:
                    nearest_cr = next(
                        (cr for cr in calibration_results if cr.original_record.time == od_point.nearest_sensor_time),
                        None
                    )
                    if nearest_cr:
                        merged_point = {
                            "time": od_point.time.isoformat(),
                            "datetime": od_point.time,
                            "temperature": nearest_cr.calibrated_temperature,
                            "ph": nearest_cr.calibrated_ph,
                            "dissolved_oxygen": nearest_cr.calibrated_do,
                            "stirring_speed": nearest_cr.original_record.stirring_speed,
                            "feed_amount": nearest_cr.original_record.feed_amount,
                            "feed_formulation": nearest_cr.original_record.feed_formulation,
                            "phase": nearest_cr.original_record.phase,
                            "batch_notes": None,
                            "od600": od_point.od600,
                            "od_interpolated": True,
                            "interpolated_from": od_point.nearest_sensor_time.isoformat(),
                            "time_diff_seconds": od_point.time_diff_seconds,
                            "calibration": {
                                "ph_correction": nearest_cr.ph_drift_correction,
                                "temp_correction": nearest_cr.temp_drift_correction,
                                "do_correction": nearest_cr.do_drift_correction,
                            }
                        }
                        merged.append(merged_point)
        
        merged.sort(key=lambda x: x["datetime"])
        
        return merged


def full_calibration_pipeline(
    config: FermentConfig,
    records: List[FermentationRecord]
) -> Dict[str, Any]:
    """
    完整的校准流水线
    
    执行以下步骤：
    1. 识别OD600取样记录和传感器记录
    2. 校准所有传感器数据
    3. 对齐OD600数据到传感器时间线
    4. 合并所有数据
    
    Args:
        config: 配置对象
        records: 所有发酵记录
        
    Returns:
        包含校准结果、对齐数据和合并数据的字典
    """
    if not records:
        return {"error": "没有数据需要校准"}
    
    od_records = [r for r in records if r.od600 is not None]
    sensor_records = [r for r in records]
    
    calibrator = SensorCalibrator(config)
    calibration_results = calibrator.calibrate_all_records(sensor_records)
    
    aligner = TimelineAligner(config)
    aligned_od_data, alignment_stats = aligner.align_od600_to_sensors(
        calibration_results, od_records
    )
    
    merged_data = aligner.merge_sensor_and_od_data(
        calibration_results, aligned_od_data
    )
    
    feed_events = [
        {
            "time": r.original_record.time.isoformat(),
            "amount": r.original_record.feed_amount,
            "formulation": r.original_record.feed_formulation
        }
        for r in calibration_results
        if r.original_record.feed_amount is not None and r.original_record.feed_amount > 0
    ]
    
    return {
        "calibration_results": calibration_results,
        "aligned_od_data": aligned_od_data,
        "merged_data": merged_data,
        "feed_events": feed_events,
        "statistics": {
            "total_records": len(records),
            "sensor_records": len(sensor_records),
            "od_records": len(od_records),
            "alignment": alignment_stats,
            "feed_events_count": len(feed_events),
            "time_range": {
                "start": merged_data[0]["time"] if merged_data else None,
                "end": merged_data[-1]["time"] if merged_data else None
            }
        }
    }
