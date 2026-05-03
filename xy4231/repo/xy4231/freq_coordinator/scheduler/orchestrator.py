from datetime import datetime
from typing import List, Dict, Optional
from collections import defaultdict

from freq_coordinator.models import (
    SupplyStation,
    RepeaterStation,
    VolunteerShift,
    Device,
    AssignedChannel,
    ScheduleEntry,
    CommunicationPlan,
)
from freq_coordinator.scheduler.rules import (
    SchedulerRules,
    ChannelAssigner,
    DeviceAssigner,
)


class Orchestrator:
    def __init__(
        self,
        stations: List[SupplyStation],
        repeaters: List[RepeaterStation],
        shifts: List[VolunteerShift],
        devices: List[Device],
        event_name: str = "山地越野赛",
    ):
        self.stations = stations
        self.repeaters = repeaters
        self.shifts = shifts
        self.devices = devices
        self.event_name = event_name
        
        self.rules = SchedulerRules(
            stations=stations,
            repeaters=repeaters,
            shifts=shifts,
            devices=devices,
        )
        self.channel_assigner = ChannelAssigner(self.rules)
        self.device_assigner = DeviceAssigner(self.rules)
        
        self.schedule: List[ScheduleEntry] = []
        self.channel_plan: Dict[str, List[AssignedChannel]] = {}
    
    def orchestrate(self) -> CommunicationPlan:
        self.channel_assigner.assign_channels()
        self.channel_plan = self.channel_assigner._assignments
        
        self.device_assigner.assign_devices()
        
        self._build_schedule()
        
        return CommunicationPlan(
            event_name=self.event_name,
            supply_stations=self.stations,
            repeater_stations=self.repeaters,
            volunteer_shifts=self.shifts,
            devices=self.devices,
            schedule=self.schedule,
            channel_plan=self.channel_plan,
        )
    
    def _build_schedule(self):
        self.schedule = []
        
        station_map = {s.id: s for s in self.stations}
        
        for shift in self.shifts:
            station = station_map.get(shift.station_id)
            if not station:
                continue
            
            device_id = self.device_assigner.get_device_for_shift(shift.id)
            if not device_id:
                device_id = "unassigned"
            
            assigned_channels = []
            emergency_channels = self.channel_plan.get("*", [])
            assigned_channels.extend(emergency_channels)
            
            station_channels = self.channel_plan.get(shift.station_id, [])
            assigned_channels.extend(station_channels)
            
            schedule_entry = ScheduleEntry(
                shift_id=shift.id,
                volunteer_name=shift.volunteer_name,
                station_id=shift.station_id,
                station_name=station.name,
                start_time=shift.start_time,
                end_time=shift.end_time,
                device_id=device_id,
                assigned_channels=assigned_channels,
            )
            self.schedule.append(schedule_entry)
        
        self.schedule.sort(key=lambda e: (e.station_id, e.start_time))
    
    def get_schedule_by_station(self) -> Dict[str, List[ScheduleEntry]]:
        result = defaultdict(list)
        for entry in self.schedule:
            result[entry.station_id].append(entry)
        return dict(result)
    
    def get_schedule_by_time(self) -> List[ScheduleEntry]:
        return sorted(self.schedule, key=lambda e: e.start_time)
