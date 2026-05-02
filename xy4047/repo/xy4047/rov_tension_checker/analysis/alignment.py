"""时间线对齐模块"""

from dataclasses import dataclass
from datetime import datetime, timedelta
from typing import Any, Dict, List, Optional

from rov_tension_checker.data_import.unit_converters import UnitConverter


@dataclass
class AlignedSample:
    timestamp: datetime
    
    vessel_latitude: Optional[float] = None
    vessel_longitude: Optional[float] = None
    vessel_x: Optional[float] = None
    vessel_y: Optional[float] = None
    vessel_heading: Optional[float] = None
    vessel_speed: Optional[float] = None
    
    rov_depth: Optional[float] = None
    rov_cable_length: Optional[float] = None
    rov_heading: Optional[float] = None
    rov_thrust_forward: Optional[float] = None
    rov_thrust_vertical: Optional[float] = None
    rov_altitude: Optional[float] = None
    
    current_speed: Optional[float] = None
    current_direction: Optional[float] = None
    
    reference_latitude: Optional[float] = None
    reference_longitude: Optional[float] = None
    
    def to_dict(self) -> Dict[str, Any]:
        return {
            'timestamp': self.timestamp.isoformat(),
            'vessel_latitude': self.vessel_latitude,
            'vessel_longitude': self.vessel_longitude,
            'vessel_x': self.vessel_x,
            'vessel_y': self.vessel_y,
            'vessel_heading': self.vessel_heading,
            'vessel_speed': self.vessel_speed,
            'rov_depth': self.rov_depth,
            'rov_cable_length': self.rov_cable_length,
            'rov_heading': self.rov_heading,
            'rov_thrust_forward': self.rov_thrust_forward,
            'rov_thrust_vertical': self.rov_thrust_vertical,
            'rov_altitude': self.rov_altitude,
            'current_speed': self.current_speed,
            'current_direction': self.current_direction,
        }


class TimelineAligner:
    def __init__(
        self,
        time_step: float = 1.0,
        interpolation_method: str = 'linear'
    ):
        self.time_step = time_step
        self.interpolation_method = interpolation_method
    
    def _parse_timestamp(self, row: Dict[str, Any]) -> Optional[datetime]:
        ts = row.get('_parsed_timestamp')
        if ts is not None:
            return ts
        
        ts_str = row.get('timestamp')
        if ts_str:
            if isinstance(ts_str, datetime):
                return ts_str
            try:
                return datetime.fromisoformat(str(ts_str))
            except (ValueError, TypeError):
                pass
        return None
    
    def _get_all_timestamps(
        self,
        track_rows: List[Dict[str, Any]],
        rov_rows: List[Dict[str, Any]]
    ) -> List[datetime]:
        all_timestamps: set = set()
        
        for row in track_rows:
            ts = self._parse_timestamp(row)
            if ts:
                all_timestamps.add(ts)
        
        for row in rov_rows:
            ts = self._parse_timestamp(row)
            if ts:
                all_timestamps.add(ts)
        
        return sorted(all_timestamps)
    
    def _create_uniform_timeline(
        self,
        timestamps: List[datetime]
    ) -> List[datetime]:
        if not timestamps:
            return []
        
        start_time = timestamps[0]
        end_time = timestamps[-1]
        
        uniform_timeline: List[datetime] = []
        current_time = start_time
        time_step_delta = timedelta(seconds=self.time_step)
        
        while current_time <= end_time:
            uniform_timeline.append(current_time)
            current_time += time_step_delta
        
        return uniform_timeline
    
    def _linear_interpolate(
        self,
        x: float,
        x0: float,
        y0: Optional[float],
        x1: float,
        y1: Optional[float]
    ) -> Optional[float]:
        if y0 is None and y1 is None:
            return None
        if y0 is None:
            return y1
        if y1 is None:
            return y0
        if x0 == x1:
            return y0
        
        t = (x - x0) / (x1 - x0)
        return y0 + t * (y1 - y0)
    
    def _find_nearest_points(
        self,
        target_ts: datetime,
        sorted_rows: List[Dict[str, Any]],
        key_field: str
    ) -> tuple[Optional[Dict[str, Any]], Optional[Dict[str, Any]]]:
        target_sec = (target_ts - datetime(1970, 1, 1)).total_seconds()
        
        before_row: Optional[Dict[str, Any]] = None
        after_row: Optional[Dict[str, Any]] = None
        
        for row in sorted_rows:
            row_ts = self._parse_timestamp(row)
            if row_ts is None:
                continue
            
            row_sec = (row_ts - datetime(1970, 1, 1)).total_seconds()
            
            if row_sec <= target_sec:
                before_row = row
            else:
                after_row = row
                break
        
        return before_row, after_row
    
    def _get_geographic_reference(
        self,
        track_rows: List[Dict[str, Any]]
    ) -> tuple[Optional[float], Optional[float]]:
        for row in track_rows:
            lat = row.get('latitude')
            lon = row.get('longitude')
            if lat is not None and lon is not None:
                try:
                    return float(lat), float(lon)
                except (ValueError, TypeError):
                    continue
        return None, None
    
    def _get_local_coords(
        self,
        row: Dict[str, Any],
        ref_lat: Optional[float],
        ref_lon: Optional[float]
    ) -> tuple[Optional[float], Optional[float]]:
        x = row.get('x')
        y = row.get('y')
        
        if x is not None and y is not None:
            try:
                return float(x), float(y)
            except (ValueError, TypeError):
                pass
        
        lat = row.get('latitude')
        lon = row.get('longitude')
        
        if lat is not None and lon is not None and ref_lat is not None and ref_lon is not None:
            try:
                lat_f = float(lat)
                lon_f = float(lon)
                x, y = UnitConverter.lat_lon_to_local(lat_f, lon_f, ref_lat, ref_lon)
                return x, y
            except (ValueError, TypeError):
                pass
        
        return None, None
    
    def _get_current_for_depth(
        self,
        depth: Optional[float],
        current_profile: List[Dict[str, Any]]
    ) -> tuple[Optional[float], Optional[float]]:
        if depth is None or not current_profile:
            return None, None
        
        try:
            depth_f = float(depth)
        except (ValueError, TypeError):
            return None, None
        
        for layer in current_profile:
            depth_from = float(layer.get('depth_from', 0))
            depth_to = layer.get('depth_to')
            
            if depth_to is None:
                if depth_f >= depth_from:
                    return layer.get('speed'), layer.get('direction')
            else:
                try:
                    depth_to_f = float(depth_to)
                    if depth_from <= depth_f <= depth_to_f:
                        return layer.get('speed'), layer.get('direction')
                except (ValueError, TypeError):
                    continue
        
        if current_profile:
            last_layer = current_profile[-1]
            return last_layer.get('speed'), last_layer.get('direction')
        
        return None, None
    
    def align(
        self,
        track_data: List[Dict[str, Any]],
        rov_data: List[Dict[str, Any]],
        current_profile: List[Dict[str, Any]],
        use_uniform_timeline: bool = True
    ) -> List[AlignedSample]:
        if not track_data and not rov_data:
            return []
        
        ref_lat, ref_lon = self._get_geographic_reference(track_data)
        
        sorted_track = sorted(
            track_data,
            key=lambda r: self._parse_timestamp(r) or datetime.min
        )
        sorted_rov = sorted(
            rov_data,
            key=lambda r: self._parse_timestamp(r) or datetime.min
        )
        
        all_timestamps = self._get_all_timestamps(sorted_track, sorted_rov)
        
        if use_uniform_timeline:
            timeline = self._create_uniform_timeline(all_timestamps)
        else:
            timeline = all_timestamps
        
        aligned_samples: List[AlignedSample] = []
        
        for target_ts in timeline:
            sample = AlignedSample(
                timestamp=target_ts,
                reference_latitude=ref_lat,
                reference_longitude=ref_lon
            )
            
            track_before, track_after = self._find_nearest_points(
                target_ts, sorted_track, 'timestamp'
            )
            
            if track_before or track_after:
                target_sec = (target_ts - datetime(1970, 1, 1)).total_seconds()
                
                if track_before:
                    ts_before = self._parse_timestamp(track_before)
                    sec_before = (ts_before - datetime(1970, 1, 1)).total_seconds() if ts_before else target_sec
                    sample.vessel_latitude = track_before.get('latitude')
                    sample.vessel_longitude = track_before.get('longitude')
                    sample.vessel_heading = track_before.get('heading')
                    sample.vessel_speed = track_before.get('speed')
                    x, y = self._get_local_coords(track_before, ref_lat, ref_lon)
                    sample.vessel_x = x
                    sample.vessel_y = y
                    
                    if track_after and self.interpolation_method == 'linear':
                        ts_after = self._parse_timestamp(track_after)
                        sec_after = (ts_after - datetime(1970, 1, 1)).total_seconds() if ts_after else target_sec
                        
                        sample.vessel_heading = self._linear_interpolate(
                            target_sec, sec_before, track_before.get('heading'),
                            sec_after, track_after.get('heading')
                        )
                        sample.vessel_speed = self._linear_interpolate(
                            target_sec, sec_before, track_before.get('speed'),
                            sec_after, track_after.get('speed')
                        )
                
                elif track_after:
                    sample.vessel_latitude = track_after.get('latitude')
                    sample.vessel_longitude = track_after.get('longitude')
                    sample.vessel_heading = track_after.get('heading')
                    sample.vessel_speed = track_after.get('speed')
                    x, y = self._get_local_coords(track_after, ref_lat, ref_lon)
                    sample.vessel_x = x
                    sample.vessel_y = y
            
            rov_before, rov_after = self._find_nearest_points(
                target_ts, sorted_rov, 'timestamp'
            )
            
            if rov_before or rov_after:
                target_sec = (target_ts - datetime(1970, 1, 1)).total_seconds()
                
                if rov_before:
                    ts_before = self._parse_timestamp(rov_before)
                    sec_before = (ts_before - datetime(1970, 1, 1)).total_seconds() if ts_before else target_sec
                    
                    sample.rov_depth = rov_before.get('depth')
                    sample.rov_cable_length = rov_before.get('cable_length')
                    sample.rov_heading = rov_before.get('heading')
                    sample.rov_thrust_forward = rov_before.get('thrust_forward') or rov_before.get('thrust_total')
                    sample.rov_thrust_vertical = rov_before.get('thrust_vertical')
                    sample.rov_altitude = rov_before.get('altitude')
                    
                    if rov_after and self.interpolation_method == 'linear':
                        ts_after = self._parse_timestamp(rov_after)
                        sec_after = (ts_after - datetime(1970, 1, 1)).total_seconds() if ts_after else target_sec
                        
                        sample.rov_depth = self._linear_interpolate(
                            target_sec, sec_before, rov_before.get('depth'),
                            sec_after, rov_after.get('depth')
                        )
                        sample.rov_cable_length = self._linear_interpolate(
                            target_sec, sec_before, rov_before.get('cable_length'),
                            sec_after, rov_after.get('cable_length')
                        )
                        sample.rov_heading = self._linear_interpolate(
                            target_sec, sec_before, rov_before.get('heading'),
                            sec_after, rov_after.get('heading')
                        )
                
                elif rov_after:
                    sample.rov_depth = rov_after.get('depth')
                    sample.rov_cable_length = rov_after.get('cable_length')
                    sample.rov_heading = rov_after.get('heading')
                    sample.rov_thrust_forward = rov_after.get('thrust_forward') or rov_after.get('thrust_total')
                    sample.rov_thrust_vertical = rov_after.get('thrust_vertical')
                    sample.rov_altitude = rov_after.get('altitude')
            
            if sample.rov_depth is not None:
                speed, direction = self._get_current_for_depth(
                    sample.rov_depth, current_profile
                )
                sample.current_speed = speed
                sample.current_direction = direction
            
            aligned_samples.append(sample)
        
        return aligned_samples
