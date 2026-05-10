import json
import os
import random
import string
from datetime import datetime, timedelta
from typing import Dict, List, Optional, Tuple
from pathlib import Path

from .models import (
    Reservation, Visitor, Vehicle, PlateChangeRequest,
    BlacklistEntry, GateEvent, GateShiftLog, DailyReport
)


class DataStore:
    def __init__(self, data_dir: str = "./data"):
        self.data_dir = Path(data_dir)
        self.data_dir.mkdir(parents=True, exist_ok=True)
        
        self.reservations: Dict[str, Reservation] = {}
        self.plate_changes: Dict[str, PlateChangeRequest] = {}
        self.blacklist: Dict[str, BlacklistEntry] = {}
        self.events: Dict[str, GateEvent] = {}
        self.current_plate_in_park: Dict[str, str] = {}
        
        self._load_data()
    
    def _load_data(self):
        if (self.data_dir / "reservations.json").exists():
            with open(self.data_dir / "reservations.json", "r", encoding="utf-8") as f:
                for rid, data in json.load(f).items():
                    visitor = Visitor(**data["visitor"])
                    vehicle = Vehicle(**data["vehicle"])
                    data["visitor"] = visitor
                    data["vehicle"] = vehicle
                    data["intended_arrival_time"] = datetime.fromisoformat(data["intended_arrival_time"])
                    data["intended_departure_time"] = datetime.fromisoformat(data["intended_departure_time"])
                    data["created_at"] = datetime.fromisoformat(data["created_at"])
                    self.reservations[rid] = Reservation(**data)
        
        if (self.data_dir / "plate_changes.json").exists():
            with open(self.data_dir / "plate_changes.json", "r", encoding="utf-8") as f:
                for pid, data in json.load(f).items():
                    data["requested_at"] = datetime.fromisoformat(data["requested_at"])
                    if data.get("approved_at"):
                        data["approved_at"] = datetime.fromisoformat(data["approved_at"])
                    self.plate_changes[pid] = PlateChangeRequest(**data)
        
        if (self.data_dir / "blacklist.json").exists():
            with open(self.data_dir / "blacklist.json", "r", encoding="utf-8") as f:
                for plate, data in json.load(f).items():
                    data["added_at"] = datetime.fromisoformat(data["added_at"])
                    self.blacklist[plate] = BlacklistEntry(**data)
        
        if (self.data_dir / "events.json").exists():
            with open(self.data_dir / "events.json", "r", encoding="utf-8") as f:
                for eid, data in json.load(f).items():
                    data["event_time"] = datetime.fromisoformat(data["event_time"])
                    event = GateEvent(**data)
                    self.events[eid] = event
                    if event.event_type == "entry" and event.result == "allowed":
                        self.current_plate_in_park[event.plate_number] = event.event_id
        
        if (self.data_dir / "current_in_park.json").exists():
            with open(self.data_dir / "current_in_park.json", "r", encoding="utf-8") as f:
                self.current_plate_in_park = json.load(f)
    
    def save_data(self):
        def _to_dict(obj):
            if hasattr(obj, "__dict__"):
                result = {}
                for key, value in obj.__dict__.items():
                    if isinstance(value, datetime):
                        result[key] = value.isoformat()
                    elif hasattr(value, "__dict__"):
                        result[key] = _to_dict(value)
                    else:
                        result[key] = value
                return result
            return obj
        
        with open(self.data_dir / "reservations.json", "w", encoding="utf-8") as f:
            json.dump({k: _to_dict(v) for k, v in self.reservations.items()}, f, ensure_ascii=False, indent=2)
        
        with open(self.data_dir / "plate_changes.json", "w", encoding="utf-8") as f:
            json.dump({k: _to_dict(v) for k, v in self.plate_changes.items()}, f, ensure_ascii=False, indent=2)
        
        with open(self.data_dir / "blacklist.json", "w", encoding="utf-8") as f:
            json.dump({k: _to_dict(v) for k, v in self.blacklist.items()}, f, ensure_ascii=False, indent=2)
        
        with open(self.data_dir / "events.json", "w", encoding="utf-8") as f:
            json.dump({k: _to_dict(v) for k, v in self.events.items()}, f, ensure_ascii=False, indent=2)
        
        with open(self.data_dir / "current_in_park.json", "w", encoding="utf-8") as f:
            json.dump(self.current_plate_in_park, f, ensure_ascii=False, indent=2)


class ParkService:
    def __init__(self, data_store: DataStore):
        self.store = data_store
    
    def create_reservation(
        self,
        visitor_name: str,
        visitor_id: str,
        visitor_phone: str,
        visitor_company: str,
        plate_number: str,
        arrival_time: datetime,
        departure_time: datetime,
        access_area: str = "全园区",
        approved: bool = True
    ) -> Reservation:
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        reservation_id = f"RES{datetime.now().strftime('%Y%m%d%H%M%S')}{random_suffix}"
        visitor = Visitor(visitor_name, visitor_id, visitor_phone, visitor_company)
        vehicle = Vehicle(plate_number)
        
        reservation = Reservation(
            reservation_id=reservation_id,
            visitor=visitor,
            vehicle=vehicle,
            intended_arrival_time=arrival_time,
            intended_departure_time=departure_time,
            access_area=access_area,
            approved=approved
        )
        
        self.store.reservations[reservation_id] = reservation
        self.store.save_data()
        return reservation
    
    def request_plate_change(
        self,
        original_plate: str,
        new_plate: str,
        reason: str
    ) -> PlateChangeRequest:
        random_suffix = ''.join(random.choices(string.ascii_uppercase + string.digits, k=4))
        request_id = f"PC{datetime.now().strftime('%Y%m%d%H%M%S')}{random_suffix}"
        request = PlateChangeRequest(
            request_id=request_id,
            original_plate=original_plate,
            new_plate=new_plate,
            reason=reason
        )
        self.store.plate_changes[request_id] = request
        self.store.save_data()
        return request
    
    def approve_plate_change(self, request_id: str) -> Optional[PlateChangeRequest]:
        if request_id not in self.store.plate_changes:
            return None
        
        request = self.store.plate_changes[request_id]
        request.approved = True
        request.approved_at = datetime.now()
        
        for res in self.store.reservations.values():
            if res.vehicle.plate_number == request.original_plate:
                res.vehicle.plate_number = request.new_plate
        
        self.store.save_data()
        return request
    
    def add_to_blacklist(self, plate_number: str, reason: str, added_by: str = "系统") -> BlacklistEntry:
        entry = BlacklistEntry(
            plate_number=plate_number,
            reason=reason,
            added_by=added_by
        )
        self.store.blacklist[plate_number] = entry
        self.store.save_data()
        return entry
    
    def check_entry(self, plate_number: str, current_time: Optional[datetime] = None) -> Tuple[bool, str, Optional[Reservation]]:
        now = current_time or datetime.now()
        
        if plate_number in self.store.blacklist:
            blacklist_entry = self.store.blacklist[plate_number]
            return False, f"黑名单拦截：{blacklist_entry.reason}", None
        
        if plate_number in self.store.current_plate_in_park:
            return False, "重复入场：该车辆已在园区内", None
        
        matching_reservation = None
        for res in self.store.reservations.values():
            if res.vehicle.plate_number == plate_number and res.status == "active":
                matching_reservation = res
                break
        
        if not matching_reservation:
            return False, "预约未找到：该车牌没有有效的访客预约", None
        
        if not matching_reservation.approved:
            return False, "预约未审批：访客预约尚未通过审批", None
        
        if now > matching_reservation.intended_departure_time:
            return False, "预约已过期：访客预约的离场时间已过", None
        
        grace_period = timedelta(minutes=30)
        if now < matching_reservation.intended_arrival_time - grace_period:
            return False, f"预约未到时间：距离预约入场还有 {(matching_reservation.intended_arrival_time - now).seconds // 60} 分钟", None
        
        return True, "入场检查通过", matching_reservation
    
    def process_entry(
        self,
        plate_number: str,
        gate_name: str = "南门",
        operator: str = "",
        current_time: Optional[datetime] = None
    ) -> GateEvent:
        now = current_time or datetime.now()
        allowed, message, reservation = self.check_entry(plate_number, now)
        
        event_id = f"EVT{now.strftime('%Y%m%d%H%M%S%f')[:-3]}"
        event = GateEvent(
            event_id=event_id,
            event_type="entry",
            plate_number=plate_number,
            event_time=now,
            gate_name=gate_name,
            operator=operator,
            result="allowed" if allowed else "blocked",
            remark=message
        )
        
        self.store.events[event_id] = event
        
        if allowed:
            self.store.current_plate_in_park[plate_number] = event_id
        
        self.store.save_data()
        return event
    
    def check_exit(self, plate_number: str, current_time: Optional[datetime] = None) -> Tuple[bool, str, Optional[timedelta]]:
        now = current_time or datetime.now()
        
        if plate_number not in self.store.current_plate_in_park:
            return False, "出场异常：该车辆不在园区内（未入场或已出场）", None
        
        entry_event_id = self.store.current_plate_in_park[plate_number]
        entry_event = self.store.events.get(entry_event_id)
        
        if not entry_event:
            return False, "出场异常：无法找到入场记录", None
        
        matching_reservation = None
        for res in self.store.reservations.values():
            if res.vehicle.plate_number == plate_number and res.status == "active":
                matching_reservation = res
                break
        
        if matching_reservation:
            intended_departure = matching_reservation.intended_departure_time
            if now > intended_departure:
                overtime = now - intended_departure
                hours = overtime.total_seconds() / 3600
                return True, f"超时离场：超时 {hours:.1f} 小时", overtime
        
        return True, "离场检查通过", None
    
    def process_exit(
        self,
        plate_number: str,
        gate_name: str = "南门",
        operator: str = "",
        current_time: Optional[datetime] = None
    ) -> GateEvent:
        now = current_time or datetime.now()
        allowed, message, overtime = self.check_exit(plate_number, now)
        
        event_id = f"EVT{now.strftime('%Y%m%d%H%M%S%f')[:-3]}"
        event = GateEvent(
            event_id=event_id,
            event_type="exit",
            plate_number=plate_number,
            event_time=now,
            gate_name=gate_name,
            operator=operator,
            result="allowed" if allowed else "blocked",
            remark=message
        )
        
        self.store.events[event_id] = event
        
        if allowed and plate_number in self.store.current_plate_in_park:
            del self.store.current_plate_in_park[plate_number]
        
        self.store.save_data()
        return event
    
    def generate_shift_log(
        self,
        start_time: datetime,
        end_time: datetime,
        operator: str
    ) -> GateShiftLog:
        shift_events = [
            evt for evt in self.store.events.values()
            if start_time <= evt.event_time <= end_time
        ]
        
        total_entries = sum(1 for evt in shift_events if evt.event_type == "entry")
        total_exits = sum(1 for evt in shift_events if evt.event_type == "exit")
        blocked_entries = sum(1 for evt in shift_events if evt.event_type == "entry" and evt.result == "blocked")
        violations = sum(1 for evt in shift_events if "超时" in evt.remark or "黑名单" in evt.remark)
        
        log_id = f"LOG{datetime.now().strftime('%Y%m%d%H%M%S')}"
        return GateShiftLog(
            log_id=log_id,
            shift_start=start_time,
            shift_end=end_time,
            operator_on_duty=operator,
            events=shift_events,
            total_entries=total_entries,
            total_exits=total_exits,
            blocked_entries=blocked_entries,
            violations=violations
        )
    
    def generate_daily_report(self, report_date: str) -> DailyReport:
        date_obj = datetime.strptime(report_date, "%Y-%m-%d")
        next_day = date_obj + timedelta(days=1)
        
        day_events = [
            evt for evt in self.store.events.values()
            if date_obj <= evt.event_time < next_day
        ]
        
        day_reservations = [
            res for res in self.store.reservations.values()
            if date_obj <= res.intended_arrival_time < next_day
        ]
        
        total_reservations = len(day_reservations)
        actual_entries = sum(1 for evt in day_events if evt.event_type == "entry" and evt.result == "allowed")
        actual_exits = sum(1 for evt in day_events if evt.event_type == "exit" and evt.result == "allowed")
        blocked_entries = sum(1 for evt in day_events if evt.event_type == "entry" and evt.result == "blocked")
        
        expired_reservations = sum(
            1 for res in day_reservations
            if res.intended_departure_time < datetime.now() and res.status == "active"
        )
        
        overtime_exits = sum(1 for evt in day_events if "超时" in evt.remark)
        
        total_stay = timedelta()
        stay_count = 0
        
        for res in day_reservations:
            plate = res.vehicle.plate_number
            entry_events = [
                evt for evt in self.store.events.values()
                if evt.plate_number == plate and evt.event_type == "entry" and evt.result == "allowed"
            ]
            exit_events = [
                evt for evt in self.store.events.values()
                if evt.plate_number == plate and evt.event_type == "exit" and evt.result == "allowed"
            ]
            
            if entry_events and exit_events:
                entry_events.sort(key=lambda x: x.event_time)
                exit_events.sort(key=lambda x: x.event_time)
                
                if exit_events[-1].event_time > entry_events[0].event_time:
                    total_stay += exit_events[-1].event_time - entry_events[0].event_time
                    stay_count += 1
        
        avg_stay = total_stay / stay_count if stay_count > 0 else timedelta(0)
        avg_hours = avg_stay.total_seconds() / 3600
        avg_stay_str = f"{avg_hours:.1f} 小时"
        
        return DailyReport(
            report_date=report_date,
            total_reservations=total_reservations,
            actual_entries=actual_entries,
            actual_exits=actual_exits,
            blocked_entries=blocked_entries,
            expired_reservations=expired_reservations,
            overtime_exits=overtime_exits,
            average_stay_duration=avg_stay_str
        )
