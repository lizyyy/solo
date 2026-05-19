import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional
import pandas as pd

from app.models import (
    DeviceEvent,
    CustomerServiceTicket,
    FaultClassification,
    BadRecord,
)


class DataStorage:
    def __init__(self, base_dir: str = "data"):
        self.base_dir = base_dir
        self.device_events_dir = os.path.join(base_dir, "device_events")
        self.tickets_dir = os.path.join(base_dir, "customer_tickets")
        self.faults_dir = os.path.join(base_dir, "faults")
        self.bad_records_dir = os.path.join(base_dir, "bad_records")

        for directory in [
            self.device_events_dir,
            self.tickets_dir,
            self.faults_dir,
            self.bad_records_dir,
        ]:
            os.makedirs(directory, exist_ok=True)

    def save_device_event(self, event: DeviceEvent) -> str:
        file_path = os.path.join(self.device_events_dir, f"{event.event_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(event.dict(), f, ensure_ascii=False, indent=2, default=str)
        return file_path

    def save_customer_ticket(self, ticket: CustomerServiceTicket) -> str:
        file_path = os.path.join(self.tickets_dir, f"{ticket.ticket_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(ticket.dict(), f, ensure_ascii=False, indent=2, default=str)
        return file_path

    def save_fault_classification(self, fault: FaultClassification) -> str:
        file_path = os.path.join(self.faults_dir, f"{fault.fault_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(fault.dict(), f, ensure_ascii=False, indent=2, default=str)
        return file_path

    def save_bad_record(self, bad_record: BadRecord) -> str:
        file_path = os.path.join(self.bad_records_dir, f"{bad_record.bad_record_id}.json")
        with open(file_path, "w", encoding="utf-8") as f:
            json.dump(bad_record.dict(), f, ensure_ascii=False, indent=2, default=str)
        return file_path

    def load_all_device_events(self) -> List[DeviceEvent]:
        events = []
        for filename in os.listdir(self.device_events_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.device_events_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    events.append(DeviceEvent(**data))
        return sorted(events, key=lambda x: x.event_time, reverse=True)

    def load_all_customer_tickets(self) -> List[CustomerServiceTicket]:
        tickets = []
        for filename in os.listdir(self.tickets_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.tickets_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    tickets.append(CustomerServiceTicket(**data))
        return sorted(tickets, key=lambda x: x.create_time, reverse=True)

    def load_all_faults(self) -> List[FaultClassification]:
        faults = []
        for filename in os.listdir(self.faults_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.faults_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    faults.append(FaultClassification(**data))
        return sorted(faults, key=lambda x: x.event_time, reverse=True)

    def load_all_bad_records(self) -> List[BadRecord]:
        bad_records = []
        for filename in os.listdir(self.bad_records_dir):
            if filename.endswith(".json"):
                with open(os.path.join(self.bad_records_dir, filename), "r", encoding="utf-8") as f:
                    data = json.load(f)
                    bad_records.append(BadRecord(**data))
        return sorted(bad_records, key=lambda x: x.created_at, reverse=True)

    def update_fault_status(self, fault_id: str, status: str, notes: str = None) -> Optional[FaultClassification]:
        faults = self.load_all_faults()
        for fault in faults:
            if fault.fault_id == fault_id:
                fault.status = status
                fault.updated_at = datetime.now()
                if notes:
                    fault.notes = notes
                self.save_fault_classification(fault)
                return fault
        return None

    def assign_fault(self, fault_id: str, assignee: str) -> Optional[FaultClassification]:
        faults = self.load_all_faults()
        for fault in faults:
            if fault.fault_id == fault_id:
                fault.assignee = assignee
                fault.updated_at = datetime.now()
                self.save_fault_classification(fault)
                return fault
        return None
