import math
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
from dataclasses import dataclass

try:
    from astropy.coordinates import SkyCoord, AltAz, get_body, EarthLocation
    from astropy.time import Time
    from astropy import units as u
    ASTROPY_AVAILABLE = True
except ImportError:
    ASTROPY_AVAILABLE = False

from .database import (
    Database, ConflictType, ObservationTarget, ScanResult, 
    WeatherForecast, MaintenanceSchedule, DarkFrame
)


@dataclass
class ScanReport:
    target_name: str
    target_id: int
    conflicts: List[Dict[str, Any]]
    is_ok: bool
    estimated_moon_angle: Optional[float] = None
    estimated_cloud_cover: Optional[float] = None
    has_dark_frame: bool = False


class ConflictScanner:
    def __init__(self, db: Database, observatory_location: Optional[Dict] = None):
        self.db = db
        self.observatory_location = observatory_location or {
            'lat': 30.0,
            'lon': 120.0,
            'elevation': 100.0
        }

    def scan_all_targets(self, observation_time: Optional[datetime] = None) -> List[ScanReport]:
        if observation_time is None:
            observation_time = datetime.now()

        targets = self.db.get_all_targets()
        reports = []

        for target in targets:
            report = self.scan_single_target(target, observation_time)
            reports.append(report)

        return reports

    def scan_single_target(
        self, 
        target: ObservationTarget, 
        observation_time: datetime
    ) -> ScanReport:
        conflicts = []
        moon_angle = None
        cloud_cover = None
        has_dark_frame = True

        end_time = observation_time + timedelta(seconds=target.required_exposure + 60)

        maintenance_conflicts = self._check_maintenance_conflict(
            observation_time, end_time
        )
        if maintenance_conflicts:
            for m in maintenance_conflicts:
                conflicts.append({
                    'type': ConflictType.MAINTENANCE_CONFLICT.value,
                    'severity': 'high',
                    'details': f"维护时间冲突: {m['telescope_id']} - {m['description']} "
                              f"({m['start_time'].strftime('%Y-%m-%d %H:%M')} ~ "
                              f"{m['end_time'].strftime('%H:%M')})"
                })

        moon_angle = self._calculate_moon_angle(target, observation_time)
        if moon_angle is not None and moon_angle < target.min_moon_angle:
            conflicts.append({
                'type': ConflictType.MOON_ANGLE_TOO_SMALL.value,
                'severity': 'high' if moon_angle < 15 else 'medium',
                'details': f"月亮角距太小: 当前 {moon_angle:.1f}°, "
                          f"目标要求 >= {target.min_moon_angle}°"
            })

        weather = self.db.get_weather_at_time(observation_time)
        if weather:
            cloud_cover = weather.cloud_cover
            if cloud_cover > target.max_cloud_cover:
                conflicts.append({
                    'type': ConflictType.CLOUD_COVER_EXCEEDED.value,
                    'severity': 'high',
                    'details': f"云量超限: 当前 {cloud_cover*100:.0f}%, "
                              f"目标要求 <= {target.max_cloud_cover*100:.0f}%"
                })

        dark_frame = self.db.get_dark_frame(
            target.required_exposure,
            target.required_binning,
            target.required_gain
        )
        if dark_frame is None or dark_frame.count == 0:
            has_dark_frame = False
            conflicts.append({
                'type': ConflictType.MISSING_DARK_FRAME.value,
                'severity': 'medium',
                'details': f"缺少暗场校准帧: 曝光 {target.required_exposure}s, "
                          f"binning {target.required_binning}x, 增益 {target.required_gain}"
            })

        is_ok = len(conflicts) == 0

        for conflict in conflicts:
            scan_result = ScanResult(
                id=None,
                target_id=target.id,
                conflict_type=conflict['type'],
                conflict_details=conflict['details'],
                severity=conflict['severity']
            )
            self.db.add_scan_result(scan_result)

        return ScanReport(
            target_name=target.target_name,
            target_id=target.id,
            conflicts=conflicts,
            is_ok=is_ok,
            estimated_moon_angle=moon_angle,
            estimated_cloud_cover=cloud_cover,
            has_dark_frame=has_dark_frame
        )

    def _check_maintenance_conflict(
        self, 
        start_time: datetime, 
        end_time: datetime
    ) -> List[Dict]:
        maintenances = self.db.get_maintenance_by_time_range(start_time, end_time)
        
        conflicts = []
        for m in maintenances:
            if (m.start_time < end_time and m.end_time > start_time):
                conflicts.append({
                    'telescope_id': m.telescope_id,
                    'description': m.description,
                    'start_time': m.start_time,
                    'end_time': m.end_time
                })
        
        return conflicts

    def _calculate_moon_angle(
        self, 
        target: ObservationTarget, 
        observation_time: datetime
    ) -> Optional[float]:
        if not ASTROPY_AVAILABLE:
            return self._simple_moon_angle_estimate(target, observation_time)

        try:
            target_coord = SkyCoord(
                ra=target.ra * u.hour,
                dec=target.dec * u.deg,
                frame='icrs'
            )

            obs_time = Time(observation_time)
            
            loc = EarthLocation(
                lat=self.observatory_location['lat'] * u.deg,
                lon=self.observatory_location['lon'] * u.deg,
                height=self.observatory_location['elevation'] * u.m
            )

            moon_coord = get_body('moon', obs_time, loc)
            
            separation = target_coord.separation(moon_coord.icrs)
            
            return separation.degree
        except Exception:
            return self._simple_moon_angle_estimate(target, observation_time)

    def _simple_moon_angle_estimate(
        self, 
        target: ObservationTarget, 
        observation_time: datetime
    ) -> float:
        day_of_year = observation_time.timetuple().tm_yday
        
        moon_ra = (day_of_year * 13.176 + 12.0) % 24
        moon_dec = 23.5 * math.sin(math.radians(day_of_year * 0.0172))
        
        ra_diff = abs(target.ra - moon_ra)
        if ra_diff > 12:
            ra_diff = 24 - ra_diff
        
        dec_diff = abs(target.dec - moon_dec)
        
        ra_diff_deg = ra_diff * 15
        
        angle = math.sqrt(ra_diff_deg ** 2 + dec_diff ** 2)
        
        return max(angle, 0.0)

    def get_scan_summary(self) -> Dict[str, Any]:
        targets = self.db.get_all_targets()
        scan_results = self.db.get_all_scan_results()

        total_targets = len(targets)
        targets_with_conflicts = set()
        conflict_counts = {
            ConflictType.MAINTENANCE_CONFLICT.value: 0,
            ConflictType.MOON_ANGLE_TOO_SMALL.value: 0,
            ConflictType.CLOUD_COVER_EXCEEDED.value: 0,
            ConflictType.MISSING_DARK_FRAME.value: 0,
        }

        for result in scan_results:
            targets_with_conflicts.add(result['target_id'])
            conflict_type = result['conflict_type']
            if conflict_type in conflict_counts:
                conflict_counts[conflict_type] += 1

        targets_ok = total_targets - len(targets_with_conflicts)

        return {
            'total_targets': total_targets,
            'targets_ok': targets_ok,
            'targets_with_issues': len(targets_with_conflicts),
            'conflict_breakdown': conflict_counts,
            'issues': scan_results
        }
