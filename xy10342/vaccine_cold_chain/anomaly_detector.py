import hashlib
from datetime import datetime, timedelta
from dateutil import parser as date_parser
from typing import List, Dict, Any, Optional
from dataclasses import dataclass, asdict

from .database import (
    get_temperature_logs, get_vaccine_batch, get_all_vaccine_batches,
    get_vaccination_records, get_door_events, get_manual_reviews,
    get_all_device_ids
)


@dataclass
class Anomaly:
    anomaly_id: str
    anomaly_type: str
    severity: str
    device_id: Optional[str]
    batch_number: Optional[str]
    start_time: str
    end_time: Optional[str]
    description: str
    affected_vaccinations: List[Dict[str, Any]]
    has_been_reviewed: bool
    review_result: Optional[str]


ANOMALY_TYPE_TEMPERATURE_ABNORMAL = "temperature_abnormal"
ANOMALY_TYPE_TEMPERATURE_MISSING = "temperature_missing"
ANOMALY_TYPE_BATCH_TIME_CONFLICT = "batch_time_conflict"
ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY = "vaccination_after_anomaly"
ANOMALY_TYPE_LONG_DOOR_OPEN = "long_door_open"


SEVERITY_CRITICAL = "CRITICAL"
SEVERITY_HIGH = "HIGH"
SEVERITY_MEDIUM = "MEDIUM"
SEVERITY_LOW = "LOW"


MISSING_DATA_THRESHOLD_MINUTES = 60
LONG_DOOR_OPEN_THRESHOLD_SECONDS = 120


ANOMALY_TYPE_NAMES = {
    ANOMALY_TYPE_TEMPERATURE_ABNORMAL: "温度异常",
    ANOMALY_TYPE_TEMPERATURE_MISSING: "温度缺测",
    ANOMALY_TYPE_BATCH_TIME_CONFLICT: "批号时间冲突",
    ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY: "异常后仍接种",
    ANOMALY_TYPE_LONG_DOOR_OPEN: "长时间开门"
}


def generate_anomaly_id(*args) -> str:
    content = "|".join(str(arg) for arg in args)
    return hashlib.sha256(content.encode('utf-8')).hexdigest()[:16]


def parse_time(time_str: str) -> datetime:
    return date_parser.parse(time_str)


def format_time(dt: datetime) -> str:
    return dt.isoformat()


def is_time_in_range(time_str: str, start_str: str, end_str: str) -> bool:
    t = parse_time(time_str)
    start = parse_time(start_str)
    end = parse_time(end_str)
    return start <= t <= end


def check_anomaly_reviewed(anomaly_id: str) -> Optional[Dict[str, Any]]:
    reviews = get_manual_reviews(anomaly_id)
    if reviews:
        return {
            "has_been_reviewed": True,
            "review_result": reviews[0].final_result,
            "latest_review": reviews[0]
        }
    return {
        "has_been_reviewed": False,
        "review_result": None,
        "latest_review": None
    }


def detect_temperature_anomalies() -> List[Anomaly]:
    anomalies = []
    device_ids = get_all_device_ids()
    all_batches = get_all_vaccine_batches()
    
    for device_id in device_ids:
        logs = get_temperature_logs(device_id=device_id)
        
        for batch in all_batches:
            batch_start = parse_time(batch.receive_time)
            batch_end = parse_time(batch.expiry_date)
            
            batch_logs = [
                log for log in logs 
                if batch_start <= parse_time(log.timestamp) <= batch_end
            ]
            
            if not batch_logs:
                continue
            
            abnormal_periods = []
            current_start = None
            current_max_temp = None
            current_min_temp = None
            
            for log in batch_logs:
                temp = log.temperature
                log_time = parse_time(log.timestamp)
                
                is_abnormal = (temp < batch.storage_min_temp or temp > batch.storage_max_temp)
                
                if is_abnormal:
                    if current_start is None:
                        current_start = log_time
                        current_max_temp = temp
                        current_min_temp = temp
                    else:
                        current_max_temp = max(current_max_temp, temp)
                        current_min_temp = min(current_min_temp, temp)
                else:
                    if current_start is not None:
                        abnormal_periods.append({
                            "start": current_start,
                            "end": log_time,
                            "max_temp": current_max_temp,
                            "min_temp": current_min_temp
                        })
                        current_start = None
                        current_max_temp = None
                        current_min_temp = None
            
            if current_start is not None:
                abnormal_periods.append({
                    "start": current_start,
                    "end": parse_time(batch_logs[-1].timestamp),
                    "max_temp": current_max_temp,
                    "min_temp": current_min_temp
                })
            
            for period in abnormal_periods:
                duration_minutes = (period["end"] - period["start"]).total_seconds() / 60
                
                if duration_minutes < 5:
                    severity = SEVERITY_LOW
                    desc_suffix = "(短时超温)"
                elif duration_minutes < 30:
                    severity = SEVERITY_MEDIUM
                    desc_suffix = "(中等时长)"
                else:
                    severity = SEVERITY_CRITICAL
                    desc_suffix = "(长时间超温)"
                
                anomaly_id = generate_anomaly_id(
                    ANOMALY_TYPE_TEMPERATURE_ABNORMAL,
                    device_id,
                    batch.batch_number,
                    format_time(period["start"]),
                    format_time(period["end"])
                )
                
                affected_vaccinations = []
                vaccinations = get_vaccination_records(batch.batch_number)
                for vac in vaccinations:
                    vac_time = parse_time(vac.vaccination_time)
                    if period["start"] <= vac_time <= period["end"]:
                        affected_vaccinations.append({
                            "vaccination_id": vac.vaccination_id,
                            "patient_name": vac.patient_name,
                            "patient_phone": vac.patient_phone,
                            "vaccination_time": vac.vaccination_time,
                            "batch_number": batch.batch_number
                        })
                
                review_info = check_anomaly_reviewed(anomaly_id)
                
                if period["max_temp"] > batch.storage_max_temp:
                    temp_issue = f"温度过高(最高{period['max_temp']}°C)"
                else:
                    temp_issue = f"温度过低(最低{period['min_temp']}°C)"
                
                anomalies.append(Anomaly(
                    anomaly_id=anomaly_id,
                    anomaly_type=ANOMALY_TYPE_TEMPERATURE_ABNORMAL,
                    severity=severity,
                    device_id=device_id,
                    batch_number=batch.batch_number,
                    start_time=format_time(period["start"]),
                    end_time=format_time(period["end"]),
                    description=f"批次[{batch.batch_number}] {batch.vaccine_name} 在设备[{device_id}]发生温度异常 {desc_suffix}: {temp_issue}, 超出范围[{batch.storage_min_temp}-{batch.storage_max_temp}]°C",
                    affected_vaccinations=affected_vaccinations,
                    has_been_reviewed=review_info["has_been_reviewed"],
                    review_result=review_info["review_result"]
                ))
    
    return anomalies


def detect_missing_data() -> List[Anomaly]:
    anomalies = []
    device_ids = get_all_device_ids()
    
    for device_id in device_ids:
        logs = get_temperature_logs(device_id=device_id)
        
        if len(logs) < 2:
            continue
        
        for i in range(len(logs) - 1):
            current = parse_time(logs[i].timestamp)
            next_time = parse_time(logs[i + 1].timestamp)
            gap_minutes = (next_time - current).total_seconds() / 60
            
            if gap_minutes >= MISSING_DATA_THRESHOLD_MINUTES:
                anomaly_id = generate_anomaly_id(
                    ANOMALY_TYPE_TEMPERATURE_MISSING,
                    device_id,
                    format_time(current),
                    format_time(next_time)
                )
                
                affected_batches = []
                affected_vaccinations = []
                all_batches = get_all_vaccine_batches()
                
                for batch in all_batches:
                    batch_start = parse_time(batch.receive_time)
                    batch_end = parse_time(batch.expiry_date)
                    
                    if current < batch_end and next_time > batch_start:
                        affected_batches.append(batch.batch_number)
                        vaccinations = get_vaccination_records(batch.batch_number)
                        for vac in vaccinations:
                            vac_time = parse_time(vac.vaccination_time)
                            if current <= vac_time <= next_time:
                                affected_vaccinations.append({
                                    "vaccination_id": vac.vaccination_id,
                                    "patient_name": vac.patient_name,
                                    "patient_phone": vac.patient_phone,
                                    "vaccination_time": vac.vaccination_time,
                                    "batch_number": batch.batch_number
                                })
                
                review_info = check_anomaly_reviewed(anomaly_id)
                
                if gap_minutes >= 240:
                    severity = SEVERITY_CRITICAL
                elif gap_minutes >= 120:
                    severity = SEVERITY_HIGH
                else:
                    severity = SEVERITY_MEDIUM
                
                batch_str = ", ".join(affected_batches) if affected_batches else "无"
                
                anomalies.append(Anomaly(
                    anomaly_id=anomaly_id,
                    anomaly_type=ANOMALY_TYPE_TEMPERATURE_MISSING,
                    severity=severity,
                    device_id=device_id,
                    batch_number=batch_str,
                    start_time=format_time(current),
                    end_time=format_time(next_time),
                    description=f"设备[{device_id}]存在温度数据缺口, 持续{gap_minutes:.1f}分钟。可能影响的批号: {batch_str}",
                    affected_vaccinations=affected_vaccinations,
                    has_been_reviewed=review_info["has_been_reviewed"],
                    review_result=review_info["review_result"]
                ))
    
    return anomalies


def detect_batch_time_conflicts() -> List[Anomaly]:
    anomalies = []
    all_batches = get_all_vaccine_batches()
    
    for batch in all_batches:
        vaccinations = get_vaccination_records(batch.batch_number)
        receive_time = parse_time(batch.receive_time)
        
        for vac in vaccinations:
            vac_time = parse_time(vac.vaccination_time)
            
            if vac_time < receive_time:
                anomaly_id = generate_anomaly_id(
                    ANOMALY_TYPE_BATCH_TIME_CONFLICT,
                    batch.batch_number,
                    vac.vaccination_id
                )
                
                review_info = check_anomaly_reviewed(anomaly_id)
                
                anomalies.append(Anomaly(
                    anomaly_id=anomaly_id,
                    anomaly_type=ANOMALY_TYPE_BATCH_TIME_CONFLICT,
                    severity=SEVERITY_HIGH,
                    device_id=None,
                    batch_number=batch.batch_number,
                    start_time=vac.vaccination_time,
                    end_time=vac.vaccination_time,
                    description=f"批号[{batch.batch_number}] {batch.vaccine_name} 入库时间[{batch.receive_time}]晚于接种时间[{vac.vaccination_time}], 接种人: {vac.patient_name}",
                    affected_vaccinations=[{
                        "vaccination_id": vac.vaccination_id,
                        "patient_name": vac.patient_name,
                        "patient_phone": vac.patient_phone,
                        "vaccination_time": vac.vaccination_time,
                        "batch_number": batch.batch_number
                    }],
                    has_been_reviewed=review_info["has_been_reviewed"],
                    review_result=review_info["review_result"]
                ))
    
    return anomalies


def detect_vaccination_after_anomaly(temp_anomalies: List[Anomaly]) -> List[Anomaly]:
    anomalies = []
    
    for anomaly in temp_anomalies:
        if anomaly.anomaly_type != ANOMALY_TYPE_TEMPERATURE_ABNORMAL:
            continue
        
        if anomaly.review_result == "CONFIRMED_SAFE":
            continue
        
        batch = get_vaccine_batch(anomaly.batch_number)
        if not batch:
            continue
        
        anomaly_end = parse_time(anomaly.end_time)
        vaccinations = get_vaccination_records(anomaly.batch_number)
        
        for vac in vaccinations:
            vac_time = parse_time(vac.vaccination_time)
            
            if vac_time > anomaly_end:
                anomaly_id = generate_anomaly_id(
                    ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY,
                    anomaly.anomaly_id,
                    vac.vaccination_id
                )
                
                review_info = check_anomaly_reviewed(anomaly_id)
                
                days_after = (vac_time - anomaly_end).total_seconds() / 86400
                
                anomalies.append(Anomaly(
                    anomaly_id=anomaly_id,
                    anomaly_type=ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY,
                    severity=SEVERITY_CRITICAL,
                    device_id=anomaly.device_id,
                    batch_number=anomaly.batch_number,
                    start_time=anomaly.end_time,
                    end_time=vac.vaccination_time,
                    description=f"温度异常[{anomaly.anomaly_id[:8]}]后仍有接种: {batch.vaccine_name}[{batch.batch_number}], 异常结束于{anomaly.end_time}, 接种时间{vac.vaccination_time}(异常后{days_after:.1f}天), 接种人: {vac.patient_name}",
                    affected_vaccinations=[{
                        "vaccination_id": vac.vaccination_id,
                        "patient_name": vac.patient_name,
                        "patient_phone": vac.patient_phone,
                        "vaccination_time": vac.vaccination_time,
                        "batch_number": batch.batch_number
                    }],
                    has_been_reviewed=review_info["has_been_reviewed"],
                    review_result=review_info["review_result"]
                ))
    
    return anomalies


def detect_long_door_open() -> List[Anomaly]:
    anomalies = []
    device_ids = get_all_device_ids()
    all_batches = get_all_vaccine_batches()
    
    for device_id in device_ids:
        events = get_door_events(device_id=device_id)
        
        for event in events:
            if event.event_type != "open" or not event.duration_seconds:
                continue
            
            if event.duration_seconds >= LONG_DOOR_OPEN_THRESHOLD_SECONDS:
                anomaly_id = generate_anomaly_id(
                    ANOMALY_TYPE_LONG_DOOR_OPEN,
                    device_id,
                    event.timestamp
                )
                
                event_time = parse_time(event.timestamp)
                affected_vaccinations = []
                affected_batches = []
                
                for batch in all_batches:
                    batch_start = parse_time(batch.receive_time)
                    batch_end = parse_time(batch.expiry_date)
                    
                    if batch_start <= event_time <= batch_end:
                        affected_batches.append(batch.batch_number)
                
                review_info = check_anomaly_reviewed(anomaly_id)
                
                if event.duration_seconds >= 300:
                    severity = SEVERITY_HIGH
                else:
                    severity = SEVERITY_MEDIUM
                
                batch_str = ", ".join(affected_batches) if affected_batches else "无"
                
                anomalies.append(Anomaly(
                    anomaly_id=anomaly_id,
                    anomaly_type=ANOMALY_TYPE_LONG_DOOR_OPEN,
                    severity=severity,
                    device_id=device_id,
                    batch_number=batch_str,
                    start_time=event.timestamp,
                    end_time=format_time(event_time + timedelta(seconds=event.duration_seconds)),
                    description=f"设备[{device_id}]长时间开门: {event.duration_seconds}秒。可能影响的批号: {batch_str}",
                    affected_vaccinations=affected_vaccinations,
                    has_been_reviewed=review_info["has_been_reviewed"],
                    review_result=review_info["review_result"]
                ))
    
    return anomalies


def scan_all_anomalies() -> Dict[str, Any]:
    temp_anomalies = detect_temperature_anomalies()
    missing_anomalies = detect_missing_data()
    batch_conflicts = detect_batch_time_conflicts()
    vac_after_anomaly = detect_vaccination_after_anomaly(temp_anomalies)
    long_door = detect_long_door_open()
    
    all_anomalies = temp_anomalies + missing_anomalies + batch_conflicts + vac_after_anomaly + long_door
    
    affected_batches = set()
    all_affected_vaccinations = []
    
    for anomaly in all_anomalies:
        if anomaly.batch_number and anomaly.anomaly_type in [ANOMALY_TYPE_TEMPERATURE_ABNORMAL, ANOMALY_TYPE_BATCH_TIME_CONFLICT]:
            affected_batches.add(anomaly.batch_number)
        if anomaly.affected_vaccinations:
            all_affected_vaccinations.extend(anomaly.affected_vaccinations)
    
    severity_order = {SEVERITY_CRITICAL: 0, SEVERITY_HIGH: 1, SEVERITY_MEDIUM: 2, SEVERITY_LOW: 3}
    all_anomalies.sort(key=lambda a: severity_order.get(a.severity, 999))
    
    return {
        "total_anomalies": len(all_anomalies),
        "by_type": {
            ANOMALY_TYPE_TEMPERATURE_ABNORMAL: len(temp_anomalies),
            ANOMALY_TYPE_TEMPERATURE_MISSING: len(missing_anomalies),
            ANOMALY_TYPE_BATCH_TIME_CONFLICT: len(batch_conflicts),
            ANOMALY_TYPE_VACCINATION_AFTER_ANOMALY: len(vac_after_anomaly),
            ANOMALY_TYPE_LONG_DOOR_OPEN: len(long_door)
        },
        "by_severity": {
            SEVERITY_CRITICAL: len([a for a in all_anomalies if a.severity == SEVERITY_CRITICAL]),
            SEVERITY_HIGH: len([a for a in all_anomalies if a.severity == SEVERITY_HIGH]),
            SEVERITY_MEDIUM: len([a for a in all_anomalies if a.severity == SEVERITY_MEDIUM]),
            SEVERITY_LOW: len([a for a in all_anomalies if a.severity == SEVERITY_LOW])
        },
        "affected_batches": list(affected_batches),
        "total_affected_vaccinations": len(all_affected_vaccinations),
        "anomalies": all_anomalies
    }


def get_affected_batch_details(batch_number: str = None) -> List[Dict[str, Any]]:
    scan_result = scan_all_anomalies()
    anomalies = scan_result["anomalies"]
    
    batch_details = {}
    
    for anomaly in anomalies:
        if anomaly.batch_number and batch_number and anomaly.batch_number != batch_number:
            continue
        
        if anomaly.anomaly_type in [ANOMALY_TYPE_TEMPERATURE_ABNORMAL, ANOMALY_TYPE_BATCH_TIME_CONFLICT]:
            batch_num = anomaly.batch_number
            if batch_num not in batch_details:
                batch = get_vaccine_batch(batch_num)
                batch_details[batch_num] = {
                    "batch_number": batch_num,
                    "vaccine_name": batch.vaccine_name if batch else "Unknown",
                    "manufacturer": batch.manufacturer if batch else "Unknown",
                    "receive_time": batch.receive_time if batch else "Unknown",
                    "expiry_date": batch.expiry_date if batch else "Unknown",
                    "anomalies": [],
                    "affected_vaccinations": []
                }
            
            batch_details[batch_num]["anomalies"].append({
                "anomaly_id": anomaly.anomaly_id,
                "type": anomaly.anomaly_type,
                "severity": anomaly.severity,
                "start_time": anomaly.start_time,
                "end_time": anomaly.end_time,
                "description": anomaly.description,
                "has_been_reviewed": anomaly.has_been_reviewed,
                "review_result": anomaly.review_result
            })
            
            for vac in anomaly.affected_vaccinations:
                batch_details[batch_num]["affected_vaccinations"].append(vac)
    
    return list(batch_details.values())


def anomaly_to_dict(anomaly: Anomaly) -> Dict[str, Any]:
    return {
        "anomaly_id": anomaly.anomaly_id,
        "anomaly_type": anomaly.anomaly_type,
        "severity": anomaly.severity,
        "device_id": anomaly.device_id,
        "batch_number": anomaly.batch_number,
        "start_time": anomaly.start_time,
        "end_time": anomaly.end_time,
        "description": anomaly.description,
        "affected_vaccinations": anomaly.affected_vaccinations,
        "has_been_reviewed": anomaly.has_been_reviewed,
        "review_result": anomaly.review_result
    }
