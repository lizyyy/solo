import pandas as pd
import numpy as np
from typing import Dict, List, Tuple, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime, timedelta
import logging
from collections import defaultdict

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)


@dataclass
class RuleResult:
    rule_id: str
    rule_name: str
    triggered: bool
    record_index: int
    manhole_id: str
    confidence: float
    details: Dict[str, Any] = field(default_factory=dict)
    risk_score: float = 0.0
    risk_level: str = "low"


@dataclass
class EngineResult:
    total_records: int
    triggered_rules: int
    rule_results: List[RuleResult]
    risk_summary: Dict[str, int]
    high_risk_records: pd.DataFrame
    rules_statistics: Dict[str, Dict]


class RuleEngine:
    RULE_CONFIG = {
        "HIGH_FREQ_SOUND": {
            "id": "R001",
            "name": "暴雨后2小时内高频异响",
            "threshold_count": 3,
            "time_window_hours": 2,
            "base_score": 30,
            "description": "暴雨后2小时内异响次数超过阈值"
        },
        "WATER_RADIUS_HIT": {
            "id": "R002",
            "name": "积水半径命中",
            "radius_meters": 50,
            "base_score": 25,
            "description": "井盖位于积水点影响半径内"
        },
        "CONTINUOUS_RECURRENCE": {
            "id": "R003",
            "name": "同井盖连续复发",
            "recurrence_days": 7,
            "min_occurrences": 2,
            "base_score": 20,
            "description": "同一井盖在7天内连续出现问题"
        },
        "TIMEOUT_REVIEW": {
            "id": "R004",
            "name": "超时未复核",
            "timeout_hours": 24,
            "base_score": 15,
            "description": "异常记录超过24小时未复核"
        }
    }
    
    def __init__(self, config: Optional[Dict] = None):
        self.config = config or {}
        self.rule_config = self.RULE_CONFIG.copy()
        
        if "RULE_CONFIG" in self.config:
            for rule_key, overrides in self.config["RULE_CONFIG"].items():
                if rule_key in self.rule_config:
                    self.rule_config[rule_key].update(overrides)
        
        self.earth_radius_km = 6371.0
    
    def haversine_distance(self, lat1: float, lon1: float, lat2: float, lon2: float) -> float:
        if pd.isna(lat1) or pd.isna(lon1) or pd.isna(lat2) or pd.isna(lon2):
            return float('inf')
        
        lat1_rad = np.radians(lat1)
        lon1_rad = np.radians(lon1)
        lat2_rad = np.radians(lat2)
        lon2_rad = np.radians(lon2)
        
        d_lat = lat2_rad - lat1_rad
        d_lon = lon2_rad - lon1_rad
        
        a = np.sin(d_lat / 2.0) ** 2 + \
            np.cos(lat1_rad) * np.cos(lat2_rad) * \
            np.sin(d_lon / 2.0) ** 2
        
        c = 2 * np.arctan2(np.sqrt(a), np.sqrt(1 - a))
        
        return self.earth_radius_km * c
    
    def check_high_frequency_sound(
        self,
        records_df: pd.DataFrame,
        storm_time: Optional[datetime] = None
    ) -> List[RuleResult]:
        results = []
        rule = self.rule_config["HIGH_FREQ_SOUND"]
        threshold = rule["threshold_count"]
        time_window = rule["time_window_hours"]
        
        if records_df.empty:
            return results
        
        if storm_time is None:
            if "事件时间" in records_df.columns:
                valid_times = records_df[records_df["事件时间"].notna()]["事件时间"]
                if not valid_times.empty:
                    storm_time = valid_times.min()
                else:
                    storm_time = datetime.now()
            else:
                storm_time = datetime.now()
        
        window_end = storm_time + timedelta(hours=time_window)
        
        for idx, row in records_df.iterrows():
            sound_count = row.get("异响次数", 0)
            event_time = row.get("事件时间")
            
            if pd.isna(sound_count):
                sound_count = 0
            
            if sound_count >= threshold:
                in_window = True
                if event_time is not None and pd.notna(event_time):
                    in_window = storm_time <= event_time <= window_end
                
                if in_window:
                    confidence = min(1.0, sound_count / (threshold * 2))
                    
                    results.append(RuleResult(
                        rule_id=rule["id"],
                        rule_name=rule["name"],
                        triggered=True,
                        record_index=idx,
                        manhole_id=str(row.get("井盖编号", f"IDX_{idx}")),
                        confidence=confidence,
                        details={
                            "异响次数": int(sound_count),
                            "阈值": threshold,
                            "暴雨时间": storm_time.isoformat() if storm_time else "未知",
                            "时间窗口小时": time_window,
                            "在时间窗口内": in_window
                        },
                        risk_score=rule["base_score"] + (sound_count - threshold) * 5
                    ))
        
        return results
    
    def check_water_radius_hit(
        self,
        records_df: pd.DataFrame,
        water_points_df: pd.DataFrame
    ) -> List[RuleResult]:
        results = []
        rule = self.rule_config["WATER_RADIUS_HIT"]
        radius_km = rule["radius_meters"] / 1000.0
        
        if records_df.empty or water_points_df.empty:
            return results
        
        for idx, row in records_df.iterrows():
            manhole_lat = row.get("纬度", 0)
            manhole_lon = row.get("经度", 0)
            water_hits = []
            
            for w_idx, water_row in water_points_df.iterrows():
                water_lat = water_row.get("纬度", 0)
                water_lon = water_row.get("经度", 0)
                water_radius = water_row.get("积水半径", rule["radius_meters"]) / 1000.0
                
                distance = self.haversine_distance(
                    manhole_lat, manhole_lon,
                    water_lat, water_lon
                )
                
                if distance <= max(radius_km, water_radius):
                    water_hits.append({
                        "积水点索引": int(w_idx),
                        "距离_米": round(distance * 1000, 2),
                        "积水深度": float(water_row.get("积水深度", 0)),
                        "严重程度": str(water_row.get("严重程度", "未知"))
                    })
            
            if water_hits:
                min_distance = min(hit["距离_米"] for hit in water_hits)
                max_depth = max(hit["积水深度"] for hit in water_hits)
                
                confidence = 1.0 - (min_distance / (rule["radius_meters"] * 1.5))
                confidence = max(0.5, min(1.0, confidence))
                
                results.append(RuleResult(
                    rule_id=rule["id"],
                    rule_name=rule["name"],
                    triggered=True,
                    record_index=idx,
                    manhole_id=str(row.get("井盖编号", f"IDX_{idx}")),
                    confidence=confidence,
                    details={
                        "命中积水点数量": len(water_hits),
                        "最近距离_米": min_distance,
                        "最大积水深度": max_depth,
                        "积水点详情": water_hits
                    },
                    risk_score=rule["base_score"] + (max_depth / 10)
                ))
        
        return results
    
    def check_continuous_recurrence(
        self,
        records_df: pd.DataFrame,
        historical_df: Optional[pd.DataFrame] = None
    ) -> List[RuleResult]:
        results = []
        rule = self.rule_config["CONTINUOUS_RECURRENCE"]
        recurrence_days = rule["recurrence_days"]
        min_occurrences = rule["min_occurrences"]
        
        if records_df.empty:
            return results
        
        all_records = records_df.copy()
        if historical_df is not None and not historical_df.empty:
            all_records = pd.concat([all_records, historical_df], ignore_index=True)
        
        if "normalized_id" not in all_records.columns:
            if "井盖编号" in all_records.columns:
                all_records["normalized_id"] = all_records["井盖编号"].astype(str).str.strip()
            else:
                return results
        
        grouped = all_records.groupby("normalized_id")
        
        for norm_id, group in grouped:
            if len(group) < min_occurrences:
                continue
            
            if "事件时间" in group.columns:
                group = group.sort_values("事件时间")
                times = group["事件时间"].dropna()
                
                if len(times) >= min_occurrences:
                    first_time = times.iloc[0]
                    last_time = times.iloc[-1]
                    
                    if isinstance(first_time, datetime) and isinstance(last_time, datetime):
                        days_diff = (last_time - first_time).total_seconds() / 86400
                        
                        if days_diff <= recurrence_days:
                            for idx, row in records_df.iterrows():
                                row_norm_id = str(row.get("normalized_id", row.get("井盖编号", ""))).strip()
                                if row_norm_id == norm_id:
                                    results.append(RuleResult(
                                        rule_id=rule["id"],
                                        rule_name=rule["name"],
                                        triggered=True,
                                        record_index=idx,
                                        manhole_id=str(row.get("井盖编号", f"IDX_{idx}")),
                                        confidence=min(1.0, len(group) / 5),
                                        details={
                                            "归一化编号": norm_id,
                                            "复发次数": len(group),
                                            "时间跨度_天": round(days_diff, 2),
                                            "首次时间": first_time.isoformat(),
                                            "末次时间": last_time.isoformat()
                                        },
                                        risk_score=rule["base_score"] + (len(group) - min_occurrences) * 10
                                    ))
                                    break
        
        return results
    
    def check_timeout_review(
        self,
        records_df: pd.DataFrame,
        current_time: Optional[datetime] = None,
        reviewed_ids: Optional[List[str]] = None
    ) -> List[RuleResult]:
        results = []
        rule = self.rule_config["TIMEOUT_REVIEW"]
        timeout_hours = rule["timeout_hours"]
        
        if records_df.empty:
            return results
        
        if current_time is None:
            current_time = datetime.now()
        
        reviewed_ids = set(reviewed_ids) if reviewed_ids else set()
        
        for idx, row in records_df.iterrows():
            manhole_id = str(row.get("井盖编号", f"IDX_{idx}"))
            
            if manhole_id in reviewed_ids:
                continue
            
            event_time = row.get("事件时间")
            status = str(row.get("状态", "")).strip() if "状态" in row.index else ""
            
            if event_time is not None and pd.notna(event_time):
                if isinstance(event_time, datetime):
                    hours_elapsed = (current_time - event_time).total_seconds() / 3600.0
                    
                    if hours_elapsed > timeout_hours:
                        is_reviewed = any(
                            keyword in status 
                            for keyword in ["已复核", "已处理", "已完成", "已关闭", "reviewed", "closed"]
                        )
                        
                        if not is_reviewed:
                            results.append(RuleResult(
                                rule_id=rule["id"],
                                rule_name=rule["name"],
                                triggered=True,
                                record_index=idx,
                                manhole_id=manhole_id,
                                confidence=min(1.0, hours_elapsed / (timeout_hours * 2)),
                                details={
                                    "已过小时数": round(hours_elapsed, 2),
                                    "超时阈值_小时": timeout_hours,
                                    "当前状态": status,
                                    "事件时间": event_time.isoformat()
                                },
                                risk_score=rule["base_score"] + (hours_elapsed - timeout_hours)
                            ))
        
        return results
    
    def run_all_rules(
        self,
        records_df: pd.DataFrame,
        water_points_df: Optional[pd.DataFrame] = None,
        historical_df: Optional[pd.DataFrame] = None,
        storm_time: Optional[datetime] = None,
        current_time: Optional[datetime] = None,
        reviewed_ids: Optional[List[str]] = None
    ) -> EngineResult:
        all_results: List[RuleResult] = []
        
        all_results.extend(self.check_high_frequency_sound(records_df, storm_time))
        
        if water_points_df is not None and not water_points_df.empty:
            all_results.extend(self.check_water_radius_hit(records_df, water_points_df))
        
        all_results.extend(self.check_continuous_recurrence(records_df, historical_df))
        
        all_results.extend(self.check_timeout_review(records_df, current_time, reviewed_ids))
        
        record_rule_map: Dict[int, List[RuleResult]] = defaultdict(list)
        for result in all_results:
            record_rule_map[result.record_index].append(result)
        
        risk_counts = {"critical": 0, "high": 0, "medium": 0, "low": 0}
        high_risk_data = []
        
        for idx, rules in record_rule_map.items():
            total_score = sum(r.risk_score for r in rules)
            
            if total_score >= 90:
                risk_level = "critical"
            elif total_score >= 70:
                risk_level = "high"
            elif total_score >= 50:
                risk_level = "medium"
            else:
                risk_level = "low"
            
            risk_counts[risk_level] += 1
            
            if idx < len(records_df):
                row_data = records_df.iloc[idx].copy()
                row_data["风险评分"] = total_score
                row_data["风险等级"] = risk_level
                row_data["触发规则数"] = len(rules)
                row_data["触发规则列表"] = ", ".join([r.rule_name for r in rules])
                
                if risk_level in ["critical", "high", "medium"]:
                    high_risk_data.append(row_data)
        
        rules_stats = {}
        for rule_key, rule_info in self.rule_config.items():
            rule_id = rule_info["id"]
            triggered = sum(1 for r in all_results if r.rule_id == rule_id)
            rules_stats[rule_key] = {
                "rule_id": rule_id,
                "rule_name": rule_info["name"],
                "triggered_count": triggered,
                "description": rule_info["description"]
            }
        
        return EngineResult(
            total_records=len(records_df),
            triggered_rules=len(all_results),
            rule_results=all_results,
            risk_summary=risk_counts,
            high_risk_records=pd.DataFrame(high_risk_data) if high_risk_data else pd.DataFrame(),
            rules_statistics=rules_stats
        )
    
    def get_risk_level(self, score: float) -> Tuple[str, str]:
        if score >= 90:
            return "critical", "#DC2626"
        elif score >= 70:
            return "high", "#EA580C"
        elif score >= 50:
            return "medium", "#CA8A04"
        else:
            return "low", "#16A34A"
