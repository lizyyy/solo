from dataclasses import dataclass, field
from datetime import datetime, timedelta
from typing import List, Dict, Any, Optional, Tuple
import numpy as np
import logging
import uuid

from eeg_aligner.models import (
    StimulusEvent,
    ClockCalibration,
    EEGChannelSummary,
    EventType,
    ValidationIssue,
    IssueType,
    IssueSeverity,
)

logger = logging.getLogger(__name__)


@dataclass
class DriftEstimate:
    drift_ms: float
    drift_confidence: float
    intercept_ms: float = 0.0
    slope_ppm: float = 0.0
    method: str = ""
    sync_points: List[Dict[str, Any]] = field(default_factory=list)
    issues: List[ValidationIssue] = field(default_factory=list)


class ClockDriftEstimator:
    MIN_SYNC_POINTS = 2
    MAX_OUTLIER_STD = 3.0

    def __init__(self):
        self.issues: List[ValidationIssue] = []

    def estimate_drift(
        self,
        events: List[StimulusEvent],
        calibrations: List[ClockCalibration],
        eeg_summaries: List[EEGChannelSummary],
    ) -> DriftEstimate:
        logger.info("Estimating clock drift")
        self.issues = []

        sync_points = self._collect_sync_points(events, calibrations)
        
        if not sync_points:
            drift = self._estimate_without_sync(events, eeg_summaries)
            return drift
        
        if len(sync_points) < self.MIN_SYNC_POINTS:
            self._add_issue(
                issue_type=IssueType.CLOCK_DRIFT,
                severity=IssueSeverity.WARNING,
                message=f"Only {len(sync_points)} sync points found, minimum {self.MIN_SYNC_POINTS} recommended",
                details={"sync_points_count": len(sync_points)},
                suggestion="Add more sync events for better drift estimation"
            )
            return self._estimate_from_few_points(sync_points)
        
        drift = self._estimate_linear_drift(sync_points)
        return drift

    def _collect_sync_points(
        self,
        events: List[StimulusEvent],
        calibrations: List[ClockCalibration],
    ) -> List[Dict[str, Any]]:
        sync_points = []
        
        sync_events = [e for e in events if e.event_type == EventType.SYNC]
        logger.info(f"Found {len(sync_events)} sync events")
        
        for event in sync_events:
            point = {
                "stimulus_time": event.timestamp,
                "eeg_time": event.eeg_timestamp,
                "event_code": event.event_code,
                "event_id": event.event_id,
                "source": "event_sync"
            }
            
            if event.eeg_timestamp:
                drift = (event.eeg_timestamp - event.timestamp).total_seconds() * 1000
                point["measured_drift_ms"] = drift
                sync_points.append(point)
        
        for calib in calibrations:
            point = {
                "stimulus_time": calib.stimulus_clock_time,
                "eeg_time": calib.eeg_clock_time,
                "calibration_time": calib.calibration_time,
                "calibration_id": calib.calibration_id,
                "measured_drift_ms": calib.drift_ms,
                "source": "calibration"
            }
            
            if calib.sync_event_code:
                point["event_code"] = calib.sync_event_code
            
            sync_points.append(point)
        
        sync_points.sort(key=lambda p: p["stimulus_time"])
        logger.info(f"Collected {len(sync_points)} sync points total")
        
        return sync_points

    def _estimate_without_sync(
        self,
        events: List[StimulusEvent],
        eeg_summaries: List[EEGChannelSummary],
    ) -> DriftEstimate:
        logger.warning("Estimating drift without sync points - using default assumptions")
        
        self._add_issue(
            issue_type=IssueType.CLOCK_DRIFT,
            severity=IssueSeverity.WARNING,
            message="No sync points available. Using zero drift assumption.",
            details={},
            suggestion="Add sync events or calibration records for accurate alignment"
        )
        
        eeg_timestamps = [e.eeg_timestamp for e in events if e.eeg_timestamp]
        
        if eeg_timestamps and events:
            stimulus_times = [e.timestamp for e in events if e.eeg_timestamp]
            if stimulus_times and eeg_timestamps:
                avg_drift = np.mean([
                    (eeg - stim).total_seconds() * 1000
                    for eeg, stim in zip(eeg_timestamps, stimulus_times)
                ])
                
                return DriftEstimate(
                    drift_ms=avg_drift,
                    drift_confidence=0.5,
                    method="average_offset",
                    issues=self.issues.copy()
                )
        
        return DriftEstimate(
            drift_ms=0.0,
            drift_confidence=0.3,
            method="zero_assumption",
            issues=self.issues.copy()
        )

    def _estimate_from_few_points(self, sync_points: List[Dict[str, Any]]) -> DriftEstimate:
        if len(sync_points) == 1:
            drift = sync_points[0]["measured_drift_ms"]
            return DriftEstimate(
                drift_ms=drift,
                drift_confidence=0.6,
                intercept_ms=drift,
                method="single_point",
                sync_points=sync_points,
                issues=self.issues.copy()
            )
        else:
            drifts = [p["measured_drift_ms"] for p in sync_points]
            avg_drift = np.mean(drifts)
            std_drift = np.std(drifts)
            
            confidence = 0.7 if std_drift < 100 else 0.5
            
            return DriftEstimate(
                drift_ms=avg_drift,
                drift_confidence=confidence,
                intercept_ms=avg_drift,
                method="average_drift",
                sync_points=sync_points,
                issues=self.issues.copy()
            )

    def _estimate_linear_drift(self, sync_points: List[Dict[str, Any]]) -> DriftEstimate:
        logger.info("Performing linear drift estimation")
        
        times = []
        drifts = []
        
        for i, point in enumerate(sync_points):
            if i == 0:
                times.append(0.0)
            else:
                delta = (point["stimulus_time"] - sync_points[0]["stimulus_time"]).total_seconds()
                times.append(delta)
            drifts.append(point["measured_drift_ms"])
        
        times_np = np.array(times)
        drifts_np = np.array(drifts)
        
        if len(times_np) >= 3:
            clean_times, clean_drifts, outliers = self._remove_outliers(times_np, drifts_np)
            
            if outliers:
                self._add_issue(
                    issue_type=IssueType.CLOCK_DRIFT,
                    severity=IssueSeverity.WARNING,
                    message=f"Removed {len(outliers)} outlier sync points",
                    details={"outlier_count": len(outliers)},
                    suggestion="Check if sync events were triggered correctly"
                )
        else:
            clean_times, clean_drifts = times_np, drifts_np
        
        if len(clean_times) < 2:
            return self._estimate_from_few_points(sync_points)
        
        slope, intercept = np.polyfit(clean_times, clean_drifts, 1)
        
        slope_ppm = (slope / 1000.0) * 1e6
        
        predictions = intercept + slope * clean_times
        residuals = clean_drifts - predictions
        mse = np.mean(residuals ** 2)
        rmse = np.sqrt(mse)
        
        confidence = self._calculate_confidence(rmse, slope_ppm, len(clean_times))
        
        avg_drift = np.mean(clean_drifts)
        
        sync_points_with_fit = []
        for i, point in enumerate(sync_points):
            point_copy = point.copy()
            point_copy["fitted_drift_ms"] = intercept + slope * times[i]
            point_copy["residual_ms"] = drifts[i] - point_copy["fitted_drift_ms"]
            sync_points_with_fit.append(point_copy)
        
        return DriftEstimate(
            drift_ms=avg_drift,
            drift_confidence=confidence,
            intercept_ms=intercept,
            slope_ppm=slope_ppm,
            method="linear_regression",
            sync_points=sync_points_with_fit,
            issues=self.issues.copy()
        )

    def _remove_outliers(
        self, times: np.ndarray, drifts: np.ndarray
    ) -> Tuple[np.ndarray, np.ndarray, List[int]]:
        z_scores = np.abs((drifts - np.mean(drifts)) / np.std(drifts))
        outliers = np.where(z_scores > self.MAX_OUTLIER_STD)[0]
        
        if len(outliers) > 0:
            mask = np.ones(len(drifts), dtype=bool)
            mask[outliers] = False
            return times[mask], drifts[mask], outliers.tolist()
        
        return times, drifts, []

    def _calculate_confidence(self, rmse: float, slope_ppm: float, n_points: int) -> float:
        base_confidence = 0.9
        
        if rmse > 100:
            base_confidence *= 0.8
        if rmse > 500:
            base_confidence *= 0.7
        
        if abs(slope_ppm) > 50:
            base_confidence *= 0.8
        if abs(slope_ppm) > 100:
            base_confidence *= 0.7
        
        if n_points < 3:
            base_confidence *= 0.8
        elif n_points >= 5:
            base_confidence = min(0.95, base_confidence * 1.1)
        
        return max(0.3, min(1.0, base_confidence))

    def _add_issue(
        self,
        issue_type: IssueType,
        severity: IssueSeverity,
        message: str,
        details: Optional[Dict[str, Any]] = None,
        suggestion: str = ""
    ):
        issue = ValidationIssue(
            issue_id=str(uuid.uuid4()),
            issue_type=issue_type,
            severity=severity,
            message=message,
            details=details or {},
            suggestion=suggestion
        )
        self.issues.append(issue)

    def get_issues(self) -> List[ValidationIssue]:
        return self.issues
