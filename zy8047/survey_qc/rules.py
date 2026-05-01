"""Rules layer for survey validation."""

from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional, Union


@dataclass
class ValidationIssue:
    route_id: str
    issue_type: str
    severity: str
    message: str
    photo_id: Optional[str] = None
    details: Dict[str, Any] = field(default_factory=dict)


class RulesEngine:
    def __init__(self, rules: Dict[str, Any]):
        self.rules = rules
        self.min_overlap = rules.get("overlap", {}).get("min_percent", 60)
        self.altitude_tolerance = rules.get("altitude", {}).get("tolerance_m", 10)
        self.target_altitude = rules.get("altitude", {}).get("target_m", 120)
        self.min_gsd = rules.get("gsd", {}).get("min_cm_px", 2.0)
        self.max_gsd = rules.get("gsd", {}).get("max_cm_px", 10.0)

    def validate_overlap(self, actual_overlap: float, route_id: str) -> Optional[ValidationIssue]:
        if actual_overlap < self.min_overlap:
            return ValidationIssue(
                route_id=route_id,
                issue_type="LOW_OVERLAP",
                severity="HIGH",
                message=f"Overlap {actual_overlap:.1f}% below minimum {self.min_overlap}%",
                details={"actual": actual_overlap, "minimum": self.min_overlap},
            )
        return None

    def validate_altitude(self, actual_altitude: float, route_id: str, photo_id: Optional[str] = None) -> Optional[ValidationIssue]:
        diff = abs(actual_altitude - self.target_altitude)
        if diff > self.altitude_tolerance:
            return ValidationIssue(
                route_id=route_id,
                issue_type="ALTITUDE_DEVIATION",
                severity="HIGH" if diff > self.altitude_tolerance * 2 else "MEDIUM",
                message=f"Altitude {actual_altitude:.1f}m deviates from target {self.target_altitude:.1f}m",
                photo_id=photo_id,
                details={"actual": actual_altitude, "target": self.target_altitude, "diff": diff},
            )
        return None

    def validate_gsd(self, gsd: float, route_id: str, photo_id: Optional[str] = None) -> Optional[ValidationIssue]:
        if gsd < self.min_gsd or gsd > self.max_gsd:
            severity = "HIGH" if gsd < self.min_gsd * 0.5 or gsd > self.max_gsd * 2 else "MEDIUM"
            return ValidationIssue(
                route_id=route_id,
                issue_type="GSD_OUT_OF_RANGE",
                severity=severity,
                message=f"GSD {gsd:.2f} cm/px outside range [{self.min_gsd}, {self.max_gsd}]",
                photo_id=photo_id,
                details={"actual": gsd, "min": self.min_gsd, "max": self.max_gsd},
            )
        return None

    def validate_gps_missing(self, route_id: str, photo_id: str) -> ValidationIssue:
        return ValidationIssue(
            route_id=route_id,
            issue_type="GPS_MISSING",
            severity="HIGH",
            message="Photo missing GPS coordinates",
            photo_id=photo_id,
        )

    def validate_time_disorder(self, route_id: str, photo_id: str, prev_time: Any, curr_time: Any) -> ValidationIssue:
        return ValidationIssue(
            route_id=route_id,
            issue_type="TIME_DISORDER",
            severity="MEDIUM",
            message=f"Time stamp disorder: {curr_time} before {prev_time}",
            photo_id=photo_id,
            details={"previous_time": str(prev_time), "current_time": str(curr_time)},
        )
