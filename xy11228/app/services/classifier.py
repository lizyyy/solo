import uuid
import re
from typing import List, Tuple
from datetime import datetime

from app.models import (
    DeviceEvent,
    CustomerServiceTicket,
    FaultClassification,
    FaultType,
    FaultStatus,
    FaultSeverity,
)
from app.utils.storage import DataStorage


class FaultClassifier:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def classify_device_event(self, event: DeviceEvent) -> FaultClassification:
        fault_type = FaultType.OTHER
        confidence = 0.0
        description = ""
        severity = FaultSeverity.MEDIUM

        event_type_lower = event.event_type.lower()
        details_str = str(event.details).lower()

        if self._match_door_failure(event_type_lower, details_str):
            fault_type = FaultType.DOOR_FAILURE
            confidence = 0.9
            description = f"柜门打不开 - 仓号: {event.bay_number or '未知'}"
            severity = FaultSeverity.HIGH
        elif self._match_scan_failure(event_type_lower, details_str):
            fault_type = FaultType.SCAN_FAILURE
            confidence = 0.85
            description = f"扫码失败 - 用户: {event.user_id or '未知'}"
            severity = FaultSeverity.HIGH
        elif self._match_empty_bay_alarm(event_type_lower, details_str):
            fault_type = FaultType.EMPTY_BAY_FALSE_ALARM
            confidence = 0.8
            description = f"空仓误报 - 仓号: {event.bay_number or '未知'}"
            severity = FaultSeverity.MEDIUM
        elif self._match_battery_issue(event_type_lower, details_str):
            fault_type = FaultType.BATTERY_ISSUE
            confidence = 0.75
            description = f"电池异常 - 电池ID: {event.battery_id or '未知'}"
            severity = FaultSeverity.HIGH
        elif self._match_network_issue(event_type_lower, details_str):
            fault_type = FaultType.NETWORK_ISSUE
            confidence = 0.7
            description = "网络通信异常"
            severity = FaultSeverity.MEDIUM
        else:
            description = f"未分类事件: {event.event_type}"
            confidence = 0.3

        fault = FaultClassification(
            fault_id=f"flt_{uuid.uuid4().hex[:12]}",
            source_type="device_event",
            source_id=event.event_id,
            station_id=event.station_id,
            fault_type=fault_type,
            fault_description=description,
            status=FaultStatus.PENDING_REVIEW if confidence >= 0.7 else FaultStatus.PENDING_CLASSIFICATION,
            severity=severity,
            bay_number=event.bay_number,
            event_time=event.event_time,
            confidence=confidence,
        )
        self.storage.save_fault_classification(fault)
        return fault

    def classify_customer_ticket(self, ticket: CustomerServiceTicket) -> FaultClassification:
        fault_type = FaultType.OTHER
        confidence = 0.0
        description = ""
        severity = FaultSeverity.MEDIUM

        text = (ticket.title + " " + ticket.description).lower()

        if self._match_door_failure_text(text):
            fault_type = FaultType.DOOR_FAILURE
            confidence = 0.85
            description = f"柜门打不开问题 - {ticket.title}"
            severity = FaultSeverity.HIGH
        elif self._match_scan_failure_text(text):
            fault_type = FaultType.SCAN_FAILURE
            confidence = 0.8
            description = f"扫码失败问题 - {ticket.title}"
            severity = FaultSeverity.HIGH
        elif self._match_empty_bay_alarm_text(text):
            fault_type = FaultType.EMPTY_BAY_FALSE_ALARM
            confidence = 0.75
            description = f"空仓误报问题 - {ticket.title}"
            severity = FaultSeverity.MEDIUM
        elif self._match_battery_issue_text(text):
            fault_type = FaultType.BATTERY_ISSUE
            confidence = 0.7
            description = f"电池相关问题 - {ticket.title}"
            severity = FaultSeverity.HIGH
        else:
            description = f"客服工单: {ticket.title}"
            confidence = 0.4

        fault = FaultClassification(
            fault_id=f"flt_{uuid.uuid4().hex[:12]}",
            source_type="customer_service",
            source_id=ticket.ticket_id,
            station_id=ticket.station_id,
            fault_type=fault_type,
            fault_description=description,
            status=FaultStatus.PENDING_REVIEW if confidence >= 0.7 else FaultStatus.PENDING_CLASSIFICATION,
            severity=severity,
            assignee=ticket.assignee,
            event_time=ticket.create_time,
            confidence=confidence,
        )
        self.storage.save_fault_classification(fault)
        return fault

    def classify_all(self) -> Tuple[int, int]:
        events = self.storage.load_all_device_events()
        tickets = self.storage.load_all_customer_tickets()
        existing_faults = self.storage.load_all_faults()
        existing_source_ids = {f.source_id for f in existing_faults}

        event_count = 0
        ticket_count = 0

        for event in events:
            if event.event_id not in existing_source_ids:
                self.classify_device_event(event)
                event_count += 1

        for ticket in tickets:
            if ticket.ticket_id not in existing_source_ids:
                self.classify_customer_ticket(ticket)
                ticket_count += 1

        return event_count, ticket_count

    def _match_door_failure(self, event_type: str, details: str) -> bool:
        keywords = ["door", "柜门", "门", "打不开", "开启失败", "lock", "解锁", "开门"]
        return any(k in event_type or k in details for k in keywords)

    def _match_scan_failure(self, event_type: str, details: str) -> bool:
        keywords = ["scan", "扫码", "二维码", "qr", "识别失败", "扫描"]
        return any(k in event_type or k in details for k in keywords)

    def _match_empty_bay_alarm(self, event_type: str, details: str) -> bool:
        keywords = ["empty", "空仓", "无电池", "battery missing", "仓空"]
        return any(k in event_type or k in details for k in keywords)

    def _match_battery_issue(self, event_type: str, details: str) -> bool:
        keywords = ["battery", "电池", "充电", "voltage", "电压", "温度", "温度过高"]
        return any(k in event_type or k in details for k in keywords)

    def _match_network_issue(self, event_type: str, details: str) -> bool:
        keywords = ["network", "网络", "连接", "connection", "timeout", "超时", "断开"]
        return any(k in event_type or k in details for k in keywords)

    def _match_door_failure_text(self, text: str) -> bool:
        patterns = [
            r"柜门?打不开",
            r"门开不了",
            r"door.*fail",
            r"无法开门",
            r"门锁故障",
            r"仓门.*打不开",
        ]
        return any(re.search(p, text) for p in patterns) or "门" in text and "打不开" in text

    def _match_scan_failure_text(self, text: str) -> bool:
        patterns = [
            r"扫码.*失败",
            r"二维码.*扫不出来",
            r"scan.*fail",
            r"无法识别",
            r"扫码.*错误",
        ]
        return any(re.search(p, text) for p in patterns) or "扫码" in text and "失败" in text

    def _match_empty_bay_alarm_text(self, text: str) -> bool:
        patterns = [
            r"空仓",
            r"没有电池",
            r"电池不在",
            r"仓里没电池",
            r"empty.*bay",
        ]
        return any(re.search(p, text) for p in patterns)

    def _match_battery_issue_text(self, text: str) -> bool:
        patterns = [
            r"电池.*异常",
            r"电池.*坏",
            r"充电.*失败",
            r"battery.*error",
            r"电池.*温度",
        ]
        return any(re.search(p, text) for p in patterns) or "电池" in text
