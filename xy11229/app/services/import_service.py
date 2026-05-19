import json
import uuid
from datetime import datetime
from typing import List, Dict, Any
import pandas as pd
from io import StringIO

from app.models.models import (
    DeviceEvent, ServiceOrder, BadRecord, ImportResult,
    EventType, OrderStatus
)
from app.models.storage import storage


def parse_device_event(data: Dict[str, Any], index: int) -> tuple:
    try:
        event_id = data.get('event_id') or data.get('id') or f"event_{uuid.uuid4().hex[:8]}"
        
        event_type_str = data.get('event_type', data.get('type', 'other'))
        event_type = parse_event_type(event_type_str)
        
        event_time_str = data.get('event_time') or data.get('time') or datetime.now().isoformat()
        event_time = parse_datetime(event_time_str)
        
        event = DeviceEvent(
            event_id=str(event_id),
            device_id=str(data.get('device_id', data.get('deviceId', ''))),
            station_id=str(data.get('station_id', data.get('stationId', ''))),
            event_type=event_type,
            event_time=event_time,
            event_details={k: v for k, v in data.items() if k not in ['event_id', 'device_id', 'station_id', 'event_type', 'event_time']},
            severity=str(data.get('severity', 'normal'))
        )
        return event, None
    except Exception as e:
        bad_record = BadRecord(
            id=f"bad_event_{uuid.uuid4().hex[:8]}",
            source_type="device_event",
            original_position=f"index_{index}",
            raw_data=data,
            error_reason=str(e),
            suggestion="请检查必填字段：event_id, device_id, station_id, event_type, event_time"
        )
        return None, bad_record


def parse_service_order(data: Dict[str, Any], index: int) -> tuple:
    try:
        order_id = data.get('order_id') or data.get('id') or f"order_{uuid.uuid4().hex[:8]}"
        
        report_time_str = data.get('report_time') or data.get('time') or datetime.now().isoformat()
        report_time = parse_datetime(report_time_str)
        
        customer_phone = data.get('customer_phone') or data.get('phone')
        if customer_phone is not None:
            customer_phone = str(customer_phone)
        
        device_id = data.get('device_id') or data.get('deviceId')
        if device_id is not None:
            device_id = str(device_id)
        
        order = ServiceOrder(
            order_id=str(order_id),
            customer_name=data.get('customer_name') or data.get('user_name'),
            customer_phone=customer_phone,
            station_id=str(data.get('station_id', data.get('stationId', ''))),
            device_id=device_id,
            problem_description=str(data.get('problem_description') or data.get('description', '')),
            report_time=report_time,
            source=str(data.get('source', 'customer_service'))
        )
        return order, None
    except Exception as e:
        bad_record = BadRecord(
            id=f"bad_order_{uuid.uuid4().hex[:8]}",
            source_type="service_order",
            original_position=f"row_{index}",
            raw_data=data,
            error_reason=str(e),
            suggestion="请检查必填字段：order_id, station_id, problem_description, report_time"
        )
        return None, bad_record


def parse_event_type(event_type_str: str) -> EventType:
    event_type_lower = event_type_str.lower()
    
    if 'door' in event_type_lower or '柜门' in event_type_str:
        return EventType.DOOR_ERROR
    elif 'scan' in event_type_lower or '扫码' in event_type_str:
        return EventType.SCAN_FAIL
    elif 'empty' in event_type_lower or '空仓' in event_type_str:
        return EventType.EMPTY_BIN_FALSE_ALARM
    else:
        return EventType.OTHER


def parse_datetime(dt_str: str) -> datetime:
    formats = [
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%dT%H:%M:%S",
        "%Y/%m/%d %H:%M:%S",
        "%Y-%m-%d %H:%M",
        "%Y-%m-%d"
    ]
    
    for fmt in formats:
        try:
            return datetime.strptime(dt_str, fmt)
        except (ValueError, TypeError):
            continue
    
    return datetime.now()


def import_device_events_from_json(json_content: str) -> ImportResult:
    success_count = 0
    bad_records: List[BadRecord] = []
    
    try:
        data = json.loads(json_content)
        if not isinstance(data, list):
            data = [data]
        
        for index, item in enumerate(data):
            event, bad_record = parse_device_event(item, index)
            if bad_record:
                bad_records.append(bad_record)
                storage.add_bad_record(bad_record)
            else:
                if storage.add_device_event(event):
                    success_count += 1
        
        return ImportResult(
            success_count=success_count,
            failed_count=len(bad_records),
            bad_records=bad_records,
            total_processed=len(data)
        )
    except Exception as e:
        bad_record = BadRecord(
            id=f"bad_json_{uuid.uuid4().hex[:8]}",
            source_type="device_event_json",
            original_position="file",
            raw_data={"content": json_content[:500]},
            error_reason=f"JSON解析失败: {str(e)}",
            suggestion="请检查JSON格式是否正确"
        )
        bad_records.append(bad_record)
        storage.add_bad_record(bad_record)
        
        return ImportResult(
            success_count=0,
            failed_count=1,
            bad_records=bad_records,
            total_processed=0
        )


def import_service_orders_from_csv(csv_content: str) -> ImportResult:
    success_count = 0
    bad_records: List[BadRecord] = []
    total_processed = 0
    
    try:
        df = pd.read_csv(StringIO(csv_content))
        total_processed = len(df)
        
        for index, row in df.iterrows():
            data = row.to_dict()
            order, bad_record = parse_service_order(data, index)
            if bad_record:
                bad_records.append(bad_record)
                storage.add_bad_record(bad_record)
            else:
                if storage.add_service_order(order):
                    success_count += 1
        
        return ImportResult(
            success_count=success_count,
            failed_count=len(bad_records),
            bad_records=bad_records,
            total_processed=total_processed
        )
    except Exception as e:
        bad_record = BadRecord(
            id=f"bad_csv_{uuid.uuid4().hex[:8]}",
            source_type="service_order_csv",
            original_position="file",
            raw_data={"content": csv_content[:500]},
            error_reason=f"CSV解析失败: {str(e)}",
            suggestion="请检查CSV格式是否正确"
        )
        bad_records.append(bad_record)
        storage.add_bad_record(bad_record)
        
        return ImportResult(
            success_count=0,
            failed_count=1,
            bad_records=bad_records,
            total_processed=0
        )
