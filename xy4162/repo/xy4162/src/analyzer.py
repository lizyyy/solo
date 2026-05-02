import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
import sys
import os
import uuid

sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
import config
from .utils import parse_datetime, format_datetime, format_timedelta


class RiskAnalyzer:
    def __init__(self, cleaning_records: pd.DataFrame = None, 
                 work_orders: pd.DataFrame = None,
                 volume_records: pd.DataFrame = None):
        self.cleaning_records = cleaning_records
        self.work_orders = work_orders
        self.volume_records = volume_records
        self.risks = []
        
    def set_data(self, cleaning_records: pd.DataFrame = None, 
                 work_orders: pd.DataFrame = None,
                 volume_records: pd.DataFrame = None):
        if cleaning_records is not None:
            self.cleaning_records = cleaning_records
        if work_orders is not None:
            self.work_orders = work_orders
        if volume_records is not None:
            self.volume_records = volume_records
    
    def _generate_risk_id(self) -> str:
        return str(uuid.uuid4())[:8]
    
    def analyze_late_cleaning(self) -> List[Dict]:
        risks = []
        if self.cleaning_records is None or len(self.cleaning_records) == 0:
            return risks
        
        df = self.cleaning_records.copy()
        df = df.sort_values(["store_name", "machine_id", "cleaning_time"])
        
        for (store_name, machine_id), group in df.groupby(["store_name", "machine_id"]):
            group = group.sort_values("cleaning_time")
            
            for i in range(1, len(group)):
                prev_record = group.iloc[i-1]
                curr_record = group.iloc[i]
                
                time_diff = curr_record["cleaning_time"] - prev_record["cleaning_time"]
                interval_hours = time_diff.total_seconds() / 3600
                
                if interval_hours > config.LATE_CLEANING_THRESHOLD_HOURS:
                    risk = {
                        "risk_id": self._generate_risk_id(),
                        "risk_type": "late_cleaning",
                        "risk_type_name": "超时未清洁",
                        "store_name": store_name,
                        "machine_id": machine_id,
                        "event_time": curr_record["cleaning_time"],
                        "interval_hours": round(interval_hours, 2),
                        "threshold_hours": config.LATE_CLEANING_THRESHOLD_HOURS,
                        "prev_cleaning_time": prev_record["cleaning_time"],
                        "curr_cleaning_time": curr_record["cleaning_time"],
                        "operator": curr_record.get("operator", ""),
                        "cleaning_type": curr_record.get("cleaning_type", ""),
                        "risk_level": self._determine_risk_level(interval_hours, "late_cleaning"),
                        "description": f"机器 {machine_id} 在 {format_datetime(prev_record['cleaning_time'])} 到 {format_datetime(curr_record['cleaning_time'])} 之间间隔 {format_timedelta(time_diff)} 未清洁，超过阈值 {config.LATE_CLEANING_THRESHOLD_HOURS} 小时",
                        "review_status": "pending",
                        "review_comment": ""
                    }
                    risks.append(risk)
        
        return risks
    
    def analyze_unclosed_workorders(self) -> List[Dict]:
        risks = []
        if self.work_orders is None or len(self.work_orders) == 0:
            return risks
        
        now = datetime.now()
        open_statuses = [config.WORKORDER_STATUS_OPEN, config.WORKORDER_STATUS_IN_PROGRESS]
        
        for _, row in self.work_orders.iterrows():
            if row["status"] in open_statuses:
                reported_time = row["reported_time"]
                if reported_time:
                    duration = now - reported_time
                    duration_hours = duration.total_seconds() / 3600
                else:
                    duration = None
                    duration_hours = 0
                
                risk = {
                    "risk_id": self._generate_risk_id(),
                    "risk_type": "unclosed_workorder",
                    "risk_type_name": "工单未闭环",
                    "store_name": row["store_name"],
                    "machine_id": row["machine_id"],
                    "workorder_id": row["workorder_id"],
                    "event_time": row["reported_time"],
                    "issue_type": row.get("issue_type", ""),
                    "status": row["status"],
                    "description": row.get("description", ""),
                    "duration_hours": round(duration_hours, 2) if duration_hours else 0,
                    "risk_level": self._determine_risk_level(duration_hours, "unclosed_workorder"),
                    "description": f"工单 {row['workorder_id']} ({row.get('issue_type', '')}) 状态为 {row['status']}，自 {format_datetime(row['reported_time'])} 以来已 {format_timedelta(duration) if duration else '未知时间'} 未闭环",
                    "review_status": "pending",
                    "review_comment": ""
                }
                risks.append(risk)
        
        return risks
    
    def analyze_abnormal_volume(self) -> List[Dict]:
        risks = []
        if self.volume_records is None or len(self.volume_records) == 0:
            return risks
        
        df = self.volume_records.copy()
        
        daily_volume = df.groupby(["store_name", "machine_id", "record_date"]).agg({
            "cup_count": "sum"
        }).reset_index()
        
        for (store_name, machine_id), group in daily_volume.groupby(["store_name", "machine_id"]):
            if len(group) < 3:
                continue
            
            avg_volume = group["cup_count"].mean()
            std_volume = group["cup_count"].std()
            
            for _, row in group.iterrows():
                volume = row["cup_count"]
                if avg_volume > 0:
                    deviation = abs(volume - avg_volume) / avg_volume
                else:
                    deviation = 0
                
                if deviation > config.ABNORMAL_VOLUME_RATIO or volume > config.HIGH_VOLUME_THRESHOLD:
                    risk = {
                        "risk_id": self._generate_risk_id(),
                        "risk_type": "abnormal_volume",
                        "risk_type_name": "出杯异常",
                        "store_name": store_name,
                        "machine_id": machine_id,
                        "event_time": row["record_date"],
                        "cup_count": volume,
                        "avg_cup_count": round(avg_volume, 2),
                        "deviation_ratio": round(deviation * 100, 2),
                        "risk_level": self._determine_risk_level(deviation, "abnormal_volume"),
                        "description": f"机器 {machine_id} 在 {row['record_date']} 出杯 {volume} 杯，与平均值 {round(avg_volume, 2)} 偏差 {round(deviation * 100, 2)}%",
                        "review_status": "pending",
                        "review_comment": ""
                    }
                    risks.append(risk)
        
        return risks
    
    def analyze_backfill_suspect(self) -> List[Dict]:
        risks = []
        if self.cleaning_records is None or self.volume_records is None:
            return risks
        
        cleaning_df = self.cleaning_records.copy()
        volume_df = self.volume_records.copy()
        
        for _, cleaning_row in cleaning_df.iterrows():
            store_name = cleaning_row["store_name"]
            machine_id = cleaning_row["machine_id"]
            cleaning_time = cleaning_row["cleaning_time"]
            
            if cleaning_time is None:
                continue
            
            time_window_start = cleaning_time - timedelta(hours=2)
            time_window_end = cleaning_time
            
            relevant_volume = volume_df[
                (volume_df["store_name"] == store_name) &
                (volume_df["machine_id"] == machine_id) &
                (volume_df["record_time"] >= time_window_start) &
                (volume_df["record_time"] <= time_window_end)
            ]
            
            if len(relevant_volume) == 0:
                risk = {
                    "risk_id": self._generate_risk_id(),
                    "risk_type": "backfill_suspect",
                    "risk_type_name": "补填嫌疑",
                    "store_name": store_name,
                    "machine_id": machine_id,
                    "event_time": cleaning_time,
                    "cleaning_time": cleaning_time,
                    "operator": cleaning_row.get("operator", ""),
                    "cleaning_type": cleaning_row.get("cleaning_type", ""),
                    "volume_in_window": 0,
                    "risk_level": "medium",
                    "description": f"机器 {machine_id} 在 {format_datetime(cleaning_time)} 的清洁记录，在清洁前2小时内无出杯记录，存在补填嫌疑",
                    "review_status": "pending",
                    "review_comment": ""
                }
                risks.append(risk)
            else:
                window_volume = relevant_volume["cup_count"].sum()
                if window_volume < 5:
                    risk = {
                        "risk_id": self._generate_risk_id(),
                        "risk_type": "backfill_suspect",
                        "risk_type_name": "补填嫌疑",
                        "store_name": store_name,
                        "machine_id": machine_id,
                        "event_time": cleaning_time,
                        "cleaning_time": cleaning_time,
                        "operator": cleaning_row.get("operator", ""),
                        "cleaning_type": cleaning_row.get("cleaning_type", ""),
                        "volume_in_window": int(window_volume),
                        "risk_level": "low",
                        "description": f"机器 {machine_id} 在 {format_datetime(cleaning_time)} 的清洁记录，清洁前2小时内仅出杯 {int(window_volume)} 杯，存在补填嫌疑",
                        "review_status": "pending",
                        "review_comment": ""
                    }
                    risks.append(risk)
        
        return risks
    
    def _determine_risk_level(self, value: float, risk_type: str) -> str:
        if risk_type == "late_cleaning":
            if value > 12:
                return "critical"
            elif value > 8:
                return "high"
            elif value > 6:
                return "medium"
            else:
                return "low"
        elif risk_type == "unclosed_workorder":
            if value > 72:
                return "critical"
            elif value > 48:
                return "high"
            elif value > 24:
                return "medium"
            else:
                return "low"
        elif risk_type == "abnormal_volume":
            if value > 0.8:
                return "critical"
            elif value > 0.5:
                return "high"
            elif value > 0.3:
                return "medium"
            else:
                return "low"
        return "medium"
    
    def analyze_all(self) -> List[Dict]:
        self.risks = []
        
        self.risks.extend(self.analyze_late_cleaning())
        self.risks.extend(self.analyze_unclosed_workorders())
        self.risks.extend(self.analyze_abnormal_volume())
        self.risks.extend(self.analyze_backfill_suspect())
        
        return self.risks
    
    def get_risks_by_type(self, risk_type: str = None) -> List[Dict]:
        if risk_type is None:
            return self.risks
        return [r for r in self.risks if r.get("risk_type") == risk_type]
    
    def get_risks_by_store(self, store_name: str = None) -> List[Dict]:
        if store_name is None:
            return self.risks
        return [r for r in self.risks if r.get("store_name") == store_name]
    
    def get_risks_by_machine(self, machine_id: str = None) -> List[Dict]:
        if machine_id is None:
            return self.risks
        return [r for r in self.risks if r.get("machine_id") == machine_id]
    
    def get_risk_statistics(self) -> Dict:
        stats = {
            "total_risks": len(self.risks),
            "by_type": {},
            "by_level": {},
            "by_store": {}
        }
        
        risk_types = set([r.get("risk_type") for r in self.risks])
        for rt in risk_types:
            stats["by_type"][rt] = len([r for r in self.risks if r.get("risk_type") == rt])
        
        risk_levels = set([r.get("risk_level") for r in self.risks])
        for rl in risk_levels:
            stats["by_level"][rl] = len([r for r in self.risks if r.get("risk_level") == rl])
        
        stores = set([r.get("store_name") for r in self.risks])
        for store in stores:
            stats["by_store"][store] = len([r for r in self.risks if r.get("store_name") == store])
        
        return stats
    
    def risks_to_dataframe(self) -> pd.DataFrame:
        if not self.risks:
            return pd.DataFrame()
        
        df = pd.DataFrame(self.risks)
        
        for col in df.columns:
            if "time" in col.lower() or "date" in col.lower():
                df[col] = df[col].apply(lambda x: format_datetime(x) if x else "")
        
        return df
