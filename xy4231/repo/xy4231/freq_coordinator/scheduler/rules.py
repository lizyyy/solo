from datetime import datetime, timedelta
from typing import List, Dict, Set, Optional, Tuple
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


MIN_FREQUENCY_STEP_KHZ = 25.0
DEFAULT_MIN_SHIFT_MINUTES = 10


class SchedulerRules:
    def __init__(
        self,
        stations: List[SupplyStation],
        repeaters: List[RepeaterStation],
        shifts: List[VolunteerShift],
        devices: List[Device],
        min_frequency_step_khz: float = MIN_FREQUENCY_STEP_KHZ,
        min_handover_minutes: int = DEFAULT_MIN_SHIFT_MINUTES,
    ):
        self.stations = {s.id: s for s in stations}
        self.repeaters = {r.id: r for r in repeaters}
        self.shifts = shifts
        self.devices = {d.id: d for d in devices}
        self.min_frequency_step_khz = min_frequency_step_khz
        self.min_handover_minutes = min_handover_minutes
        
        self._station_shifts: Dict[str, List[VolunteerShift]] = defaultdict(list)
        for shift in shifts:
            self._station_shifts[shift.station_id].append(shift)
        
        for station_id in self._station_shifts:
            self._station_shifts[station_id].sort(key=lambda s: s.start_time)
    
    def get_shifts_by_station(self, station_id: str) -> List[VolunteerShift]:
        return self._station_shifts.get(station_id, [])
    
    def get_all_frequencies_in_use(self) -> Set[float]:
        frequencies = set()
        for repeater in self.repeaters.values():
            frequencies.add(repeater.tx_frequency)
            frequencies.add(repeater.rx_frequency)
        return frequencies
    
    def check_frequency_conflict(
        self, freq1: float, freq2: float, tolerance_khz: float = None
    ) -> bool:
        if tolerance_khz is None:
            tolerance_khz = self.min_frequency_step_khz
        freq1_hz = freq1 * 1000
        freq2_hz = freq2 * 1000
        return abs(freq1_hz - freq2_hz) < tolerance_khz
    
    def check_time_overlap(
        self, shift1: VolunteerShift, shift2: VolunteerShift
    ) -> bool:
        return not (shift1.end_time <= shift2.start_time or shift2.end_time <= shift1.start_time)
    
    def get_handover_gap(
        self, prev_shift: VolunteerShift, next_shift: VolunteerShift
    ) -> timedelta:
        if next_shift.start_time >= prev_shift.end_time:
            return next_shift.start_time - prev_shift.end_time
        return timedelta(0)
    
    def is_handover_sufficient(
        self, prev_shift: VolunteerShift, next_shift: VolunteerShift
    ) -> Tuple[bool, timedelta]:
        gap = self.get_handover_gap(prev_shift, next_shift)
        return gap.total_seconds() >= self.min_handover_minutes * 60, gap
    
    def find_available_devices_for_shift(
        self, shift: VolunteerShift, exclude_ids: Set[str] = None
    ) -> List[Device]:
        exclude = exclude_ids or set()
        available = []
        for device in self.devices.values():
            if device.id in exclude:
                continue
            if device.status not in ["available", "in_use"]:
                continue
            available.append(device)
        return available
    
    def get_nearest_repeater(
        self, station: SupplyStation
    ) -> Optional[Tuple[RepeaterStation, float]]:
        if not self.repeaters:
            return None
        
        nearest = None
        min_distance = float('inf')
        
        for repeater in self.repeaters.values():
            distance = calculate_haversine_distance(
                station.latitude, station.longitude,
                repeater.latitude, repeater.longitude
            )
            if distance < min_distance:
                min_distance = distance
                nearest = repeater
        
        if nearest is not None:
            return nearest, min_distance
        return None
    
    def is_station_covered(self, station: SupplyStation) -> Tuple[bool, float, List[RepeaterStation]]:
        covering_repeaters = []
        min_distance = float('inf')
        
        for repeater in self.repeaters.values():
            distance = calculate_haversine_distance(
                station.latitude, station.longitude,
                repeater.latitude, repeater.longitude
            )
            if distance <= repeater.coverage_radius_km:
                covering_repeaters.append(repeater)
                if distance < min_distance:
                    min_distance = distance
        
        is_covered = len(covering_repeaters) > 0
        return is_covered, min_distance if covering_repeaters else float('inf'), covering_repeaters


class ChannelAssigner:
    VHF_CHANNELS = [
        144.525, 144.550, 144.575, 144.600, 144.625, 144.650, 144.675, 144.700,
        144.725, 144.750, 144.775, 144.800, 144.825, 144.850, 144.875, 144.900,
        145.525, 145.550, 145.575, 145.600, 145.625, 145.650, 145.675, 145.700,
    ]
    
    def __init__(
        self,
        rules: SchedulerRules,
        emergency_frequency: float = 145.000,
    ):
        self.rules = rules
        self.emergency_frequency = emergency_frequency
        self._assignments: Dict[str, List[AssignedChannel]] = {}
        self._used_frequencies: Dict[float, Set[str]] = defaultdict(set)
    
    def assign_channels(self) -> Dict[str, List[AssignedChannel]]:
        self._assignments = {}
        self._used_frequencies = defaultdict(set)
        
        self._assign_emergency_channel()
        self._assign_repeater_channels()
        self._assign_station_channels()
        
        return self._assignments
    
    def _assign_emergency_channel(self):
        emergency_channel = AssignedChannel(
            frequency=self.emergency_frequency,
            channel_number=1,
            station_id="*",
            shift_id="*",
            is_repeater=False,
            repeater_id=None,
            purpose="emergency",
            priority=1,
        )
        if "*" not in self._assignments:
            self._assignments["*"] = []
        self._assignments["*"].append(emergency_channel)
        self._used_frequencies[self.emergency_frequency].add("*")
    
    def _assign_repeater_channels(self):
        channel_num = 2
        for repeater_id, repeater in self.rules.repeaters.items():
            tx_channel = AssignedChannel(
                frequency=repeater.tx_frequency,
                channel_number=channel_num,
                station_id=repeater_id,
                shift_id="*",
                is_repeater=True,
                repeater_id=repeater_id,
                purpose="repeater",
                priority=2,
            )
            if repeater_id not in self._assignments:
                self._assignments[repeater_id] = []
            self._assignments[repeater_id].append(tx_channel)
            self._used_frequencies[repeater.tx_frequency].add(repeater_id)
            channel_num += 1
    
    def _assign_station_channels(self):
        available_freqs = [f for f in self.VHF_CHANNELS if f not in self._used_frequencies]
        channel_base = len(self._used_frequencies) + 1
        
        for station_id, shifts in self.rules._station_shifts.items():
            if not shifts:
                continue
            
            station = self.rules.stations.get(station_id)
            if not station:
                continue
            
            station_channels: List[AssignedChannel] = []
            used_for_station: Set[float] = set()
            
            coverage_info = self.rules.is_station_covered(station)
            if coverage_info[0] and coverage_info[2]:
                for repeater in coverage_info[2]:
                    if repeater.tx_frequency not in used_for_station:
                        channel = AssignedChannel(
                            frequency=repeater.tx_frequency,
                            channel_number=channel_base + len(station_channels),
                            station_id=station_id,
                            shift_id="*",
                            is_repeater=True,
                            repeater_id=repeater.id,
                            purpose="general",
                            priority=3,
                        )
                        station_channels.append(channel)
                        used_for_station.add(repeater.tx_frequency)
            
            if available_freqs and len(station_channels) < 2:
                for freq in available_freqs[:2 - len(station_channels)]:
                    channel = AssignedChannel(
                        frequency=freq,
                        channel_number=channel_base + len(station_channels),
                        station_id=station_id,
                        shift_id="*",
                        is_repeater=False,
                        repeater_id=None,
                        purpose="general",
                        priority=4,
                    )
                    station_channels.append(channel)
                    self._used_frequencies[freq].add(station_id)
                    used_for_station.add(freq)
            
            self._assignments[station_id] = station_channels
    
    def get_assigned_channels(self, station_id: str = None) -> List[AssignedChannel]:
        if station_id is None:
            all_channels = []
            for channels in self._assignments.values():
                all_channels.extend(channels)
            return all_channels
        return self._assignments.get(station_id, [])


class DeviceAssigner:
    def __init__(self, rules: SchedulerRules):
        self.rules = rules
        self._assignments: Dict[str, str] = {}
        self._shift_device_map: Dict[str, str] = {}
    
    def assign_devices(self) -> Dict[str, str]:
        self._assignments = {}
        self._shift_device_map = {}
        
        available_devices = [
            d for d in self.rules.devices.values()
            if d.status == "available"
        ]
        available_devices.sort(
            key=lambda d: (-d.current_charge_percent, -d.battery_capacity_mah)
        )
        
        device_idx = 0
        total_devices = len(available_devices)
        
        for shift in self.rules.shifts:
            if shift.assigned_device and shift.assigned_device in self.rules.devices:
                self._shift_device_map[shift.id] = shift.assigned_device
                self._assignments[shift.assigned_device] = shift.id
                continue
            
            if device_idx < total_devices:
                device = available_devices[device_idx]
                self._shift_device_map[shift.id] = device.id
                self._assignments[device.id] = shift.id
                device_idx += 1
            else:
                pass
        
        return self._assignments
    
    def get_device_for_shift(self, shift_id: str) -> Optional[str]:
        return self._shift_device_map.get(shift_id)
    
    def get_shift_for_device(self, device_id: str) -> Optional[str]:
        return self._assignments.get(device_id)


def calculate_haversine_distance(
    lat1: float, lon1: float, lat2: float, lon2: float
) -> float:
    import math
    
    R = 6371.0
    
    lat1_rad = math.radians(lat1)
    lon1_rad = math.radians(lon1)
    lat2_rad = math.radians(lat2)
    lon2_rad = math.radians(lon2)
    
    dlat = lat2_rad - lat1_rad
    dlon = lon2_rad - lon1_rad
    
    a = math.sin(dlat / 2) ** 2 + math.cos(lat1_rad) * math.cos(lat2_rad) * math.sin(dlon / 2) ** 2
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c
