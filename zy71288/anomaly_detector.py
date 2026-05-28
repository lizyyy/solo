import pandas as pd
import numpy as np
from typing import List, Dict, Any, Tuple
from datetime import datetime, timedelta
import logging

from config import config
from data_models import AnomalyRecord, ForecastResult

logger = logging.getLogger(__name__)


class AnomalyDetector:
    def __init__(self):
        self.anomalies: List[AnomalyRecord] = []
    
    def detect_weather_anomalies(self, weather_data: List[Dict[str, Any]]) -> List[AnomalyRecord]:
        logger.info("检测天气数据异常...")
        anomalies = []
        
        df = pd.DataFrame([w for w in weather_data])
        
        missing_temp = df['temperature'].isna().sum()
        missing_rain = df['rain_probability'].isna().sum()
        missing_condition = df['weather_condition'].isna().sum()
        
        if missing_temp > 0 or missing_rain > 0 or missing_condition > 0:
            anomaly = AnomalyRecord(
                anomaly_type="weather_missing_values",
                severity="warning",
                message=f"天气数据存在缺失值: 温度{missing_temp}条, 降雨概率{missing_rain}条, 天气状况{missing_condition}条",
                related_data={
                    "missing_temperature": int(missing_temp),
                    "missing_rain_probability": int(missing_rain),
                    "missing_weather_condition": int(missing_condition)
                },
                suggestion="建议补充天气数据，或使用历史均值进行填充。缺失数据将影响预测准确性"
            )
            anomalies.append(anomaly)
        
        if 'rain_probability' in df.columns:
            high_rain_days = df[df['rain_probability'] >= 0.8]
            if len(high_rain_days) > 0:
                for _, row in high_rain_days.iterrows():
                    anomaly = AnomalyRecord(
                        anomaly_type="extreme_weather",
                        severity="warning",
                        message=f"{row['date']} {row['hour']}时降雨概率达{row['rain_probability']*100:.0f}%，可能影响客流",
                        related_data={
                            "date": row['date'],
                            "hour": int(row['hour']),
                            "rain_probability": float(row['rain_probability'])
                        },
                        suggestion="建议准备室内备选方案，或在官网发布天气提示引导观众调整参观时间"
                    )
                    anomalies.append(anomaly)
        
        self.anomalies.extend(anomalies)
        return anomalies
    
    def detect_event_anomalies(self, event_data: List[Dict[str, Any]]) -> List[AnomalyRecord]:
        logger.info("检测活动数据异常...")
        anomalies = []
        
        df = pd.DataFrame(event_data)
        
        over_capacity = df[df['expected_attendance'] > config.GALLERY_CAPACITY]
        for _, row in over_capacity.iterrows():
            anomaly = AnomalyRecord(
                anomaly_type="event_capacity_exceeded",
                severity="warning",
                message=f"活动 '{row.get('event_name', row['event_id'])}' 预期人数({row['expected_attendance']})超过展厅容量({config.GALLERY_CAPACITY})",
                related_data={
                    "event_id": row['event_id'],
                    "event_name": row.get('event_name'),
                    "expected_attendance": int(row['expected_attendance']),
                    "capacity": config.GALLERY_CAPACITY
                },
                suggestion="强烈建议：1)实行分时段预约制 2)增加引导人员 3)考虑扩容或增加场次"
            )
            anomalies.append(anomaly)
        
        same_time_events = df.groupby(['date', 'hour']).filter(lambda x: len(x) > 1)
        if len(same_time_events) > 0:
            for (date, hour), group in same_time_events.groupby(['date', 'hour']):
                total_attendance = group['expected_attendance'].sum()
                if total_attendance > config.GALLERY_CAPACITY:
                    anomaly = AnomalyRecord(
                        anomaly_type="event_overlap",
                        severity="warning",
                        message=f"{date} {hour}时有{len(group)}个活动同时进行，总预期人数({total_attendance})超容",
                        related_data={
                            "date": date,
                            "hour": int(hour),
                            "event_count": len(group),
                            "total_attendance": int(total_attendance),
                            "events": group['event_id'].tolist()
                        },
                        suggestion="建议调整活动时间，或增加临时工作人员维持秩序"
                    )
                    anomalies.append(anomaly)
        
        self.anomalies.extend(anomalies)
        return anomalies
    
    def detect_capacity_warnings(self, forecast_results: List[ForecastResult], 
                                  capacity_data: List[Dict[str, Any]]) -> List[AnomalyRecord]:
        logger.info("检测容量预警...")
        anomalies = []
        
        total_capacity = sum(c['max_capacity'] for c in capacity_data) if capacity_data else config.GALLERY_CAPACITY
        safe_capacity = total_capacity * config.SAFE_OCCUPANCY_RATE
        
        df = pd.DataFrame([f.model_dump() for f in forecast_results])
        
        over_warning = df[df['predicted_visitors'] > safe_capacity]
        for _, row in over_warning.iterrows():
            occupancy_rate = row['predicted_visitors'] / total_capacity
            anomaly = AnomalyRecord(
                anomaly_type="capacity_warning",
                severity="warning",
                message=f"预测 {row['date']} {row['hour']}时 客流将达{row['predicted_visitors']:.0f}人，达到容量的{occupancy_rate*100:.1f}%",
                related_data={
                    "date": row['date'],
                    "hour": int(row['hour']),
                    "predicted": float(row['predicted_visitors']),
                    "capacity": total_capacity,
                    "occupancy_rate": float(occupancy_rate),
                    "scenario": row['scenario']
                },
                suggestion=f"该时段已达安全预警线({config.SAFE_OCCUPANCY_RATE*100:.0f}%)，建议启动限流预案"
            )
            anomalies.append(anomaly)
        
        over_capacity = df[df['predicted_visitors'] > total_capacity]
        for _, row in over_capacity.iterrows():
            anomaly = AnomalyRecord(
                anomaly_type="capacity_exceeded",
                severity="error",
                message=f"预警: {row['date']} {row['hour']}时 预测客流({row['predicted_visitors']:.0f})将超容{total_capacity}人",
                related_data={
                    "date": row['date'],
                    "hour": int(row['hour']),
                    "predicted": float(row['predicted_visitors']),
                    "capacity": total_capacity,
                    "excess": float(row['predicted_visitors'] - total_capacity),
                    "scenario": row['scenario']
                },
                suggestion="立即启动：1)关闭预约通道 2)现场分流 3)启动应急广播 4)联系安保部门"
            )
            anomalies.append(anomaly)
        
        self.anomalies.extend(anomalies)
        return anomalies
    
    def detect_data_integrity_issues(self, data_summary: Dict[str, Any]) -> List[AnomalyRecord]:
        logger.info("检测数据完整性问题...")
        anomalies = []
        
        historical_count = data_summary.get('historical', 0)
        if historical_count < 168:
            anomaly = AnomalyRecord(
                anomaly_type="insufficient_history",
                severity="warning",
                message=f"历史数据不足({historical_count}条)，建议至少提供168条(7天*24小时)数据以提高预测准确度",
                related_data={"historical_records": historical_count, "recommended": 168},
                suggestion="补充历史客流数据将显著提升预测模型的可靠性"
            )
            anomalies.append(anomaly)
        
        reservation_count = data_summary.get('reservations', 0)
        if reservation_count == 0:
            anomaly = AnomalyRecord(
                anomaly_type="no_reservation_data",
                severity="warning",
                message="未检测到预约数据，预测将仅基于历史趋势和天气",
                related_data={},
                suggestion="导入预约数据可大幅提高近期预测的准确性"
            )
            anomalies.append(anomaly)
        
        self.anomalies.extend(anomalies)
        return anomalies
    
    def get_anomaly_summary(self) -> Dict[str, Any]:
        if not self.anomalies:
            return {"total": 0, "by_severity": {}, "by_type": {}}
        
        df = pd.DataFrame([a.model_dump() for a in self.anomalies])
        
        return {
            "total": len(self.anomalies),
            "by_severity": df['severity'].value_counts().to_dict(),
            "by_type": df['anomaly_type'].value_counts().to_dict(),
            "details": [a.model_dump() for a in self.anomalies]
        }
