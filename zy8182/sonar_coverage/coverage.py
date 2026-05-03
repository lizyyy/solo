from dataclasses import dataclass, field
from datetime import datetime
from typing import List, Optional, Tuple, Dict
import math

from .geo import (
    Point, haversine_distance, bearing, cross_track_distance,
    along_track_distance, point_at_bearing_distance, project_point_on_segment
)
from .models import (
    SurveyLine, TrackPoint, SonarParameters, ExclusionZone,
    CoverageSegment, Issue, IssueType, IssueSeverity
)
from .time_utils import time_diff_seconds


@dataclass
class CoverageResult:
    segments: List[CoverageSegment] = field(default_factory=list)
    issues: List[Issue] = field(default_factory=list)
    total_planned_length_m: float = 0.0
    total_covered_length_m: float = 0.0
    total_gap_length_m: float = 0.0
    total_overlap_m: float = 0.0
    coverage_percentage: float = 0.0
    gap_percentage: float = 0.0
    overlap_percentage: float = 0.0


class CoverageCalculator:
    def __init__(
        self,
        survey_lines: List[SurveyLine],
        track_points: List[TrackPoint],
        sonar_params: SonarParameters,
        exclusion_zones: Optional[List[ExclusionZone]] = None,
        config: Optional[dict] = None
    ):
        self.survey_lines = survey_lines
        self.track_points = track_points
        self.sonar_params = sonar_params
        self.exclusion_zones = exclusion_zones or []
        self.config = config or {}
        
        self.snap_distance_m = self.config.get('snap_distance_m', 50.0)
        self.min_gap_threshold_m = self.config.get('min_gap_threshold_m', 2.0)
        self.min_overlap_threshold_m = self.config.get('min_overlap_threshold_m', 5.0)
        self.issue_counter = 0
    
    def calculate(self) -> CoverageResult:
        result = CoverageResult()
        
        for line in self.survey_lines:
            result.total_planned_length_m += line.length()
        
        segments = self._match_track_to_lines()
        result.segments = segments
        
        self._calculate_swath_coverage(segments)
        
        gaps, gaps_total = self._find_gaps(segments)
        result.issues.extend(gaps)
        result.total_gap_length_m = gaps_total
        
        overlaps, overlaps_total = self._find_overlaps(segments)
        result.issues.extend(overlaps)
        result.total_overlap_m = overlaps_total
        
        for segment in segments:
            result.total_covered_length_m += segment.length()
        
        if result.total_planned_length_m > 0:
            result.coverage_percentage = (result.total_covered_length_m / result.total_planned_length_m) * 100
            result.gap_percentage = (result.total_gap_length_m / result.total_planned_length_m) * 100
            result.overlap_percentage = (result.total_overlap_m / result.total_planned_length_m) * 100
        
        return result
    
    def _match_track_to_lines(self) -> List[CoverageSegment]:
        segments = []
        
        for line in self.survey_lines:
            line_track = []
            line_length = line.length()
            line_bearing = line.bearing()
            
            for tp in self.track_points:
                xt_dist = cross_track_distance(tp.point, line.start_point, line.end_point)
                
                if xt_dist <= self.snap_distance_m:
                    at_dist = along_track_distance(tp.point, line.start_point, line.end_point)
                    
                    if 0 <= at_dist <= line_length:
                        line_track.append(tp)
            
            if line_track:
                line_track.sort(key=lambda t: t.timestamp)
                
                avg_speed = 0.0
                if len(line_track) > 1:
                    speeds = [tp.speed for tp in line_track if tp.speed > 0]
                    if speeds:
                        avg_speed = sum(speeds) / len(speeds)
                
                segment = CoverageSegment(
                    segment_id=f"seg_{line.line_id}",
                    survey_line=line,
                    track_points=line_track,
                    start_time=line_track[0].timestamp if line_track else None,
                    end_time=line_track[-1].timestamp if line_track else None,
                    actual_swath_left=self.sonar_params.swath_width_left,
                    actual_swath_right=self.sonar_params.swath_width_right,
                    avg_speed=avg_speed,
                    coverage_percentage=100.0 if line_track else 0.0,
                    status="partially_covered" if line_track else "not_covered"
                )
                segments.append(segment)
        
        return segments
    
    def _calculate_swath_coverage(self, segments: List[CoverageSegment]):
        for segment in segments:
            if not segment.track_points:
                continue
            
            line = segment.survey_line
            line_bearing = line.bearing()
            
            left_perp_bearing = (line_bearing - 90) % 360
            right_perp_bearing = (line_bearing + 90) % 360
            
            segment.actual_swath_left = self.sonar_params.swath_width_left
            segment.actual_swath_right = self.sonar_params.swath_width_right
    
    def _find_gaps(self, segments: List[CoverageSegment]) -> Tuple[List[Issue], float]:
        issues = []
        total_gap_length = 0.0
        
        covered_regions: Dict[str, List[Tuple[float, float]]] = {}
        
        for segment in segments:
            line_id = segment.survey_line.line_id
            line = segment.survey_line
            line_length = line.length()
            
            if line_id not in covered_regions:
                covered_regions[line_id] = []
            
            if segment.track_points:
                first_tp = segment.track_points[0]
                last_tp = segment.track_points[-1]
                
                start_at = along_track_distance(first_tp.point, line.start_point, line.end_point)
                end_at = along_track_distance(last_tp.point, line.start_point, line.end_point)
                
                start_at = max(0, min(start_at, line_length))
                end_at = max(0, min(end_at, line_length))
                
                if start_at > end_at:
                    start_at, end_at = end_at, start_at
                
                covered_regions[line_id].append((start_at, end_at))
        
        for line in self.survey_lines:
            line_id = line.line_id
            line_length = line.length()
            
            regions = covered_regions.get(line_id, [])
            
            if not regions:
                self.issue_counter += 1
                issues.append(Issue(
                    issue_id=f"ISSUE_{self.issue_counter:04d}",
                    issue_type=IssueType.GAP,
                    severity=IssueSeverity.CRITICAL,
                    description=f"测线 {line_id} 完全未覆盖",
                    location=line.start_point,
                    related_line=line_id,
                    metrics={"gap_length_m": line_length}
                ))
                total_gap_length += line_length
                continue
            
            regions.sort()
            merged = []
            for start, end in regions:
                if not merged:
                    merged.append([start, end])
                else:
                    last_start, last_end = merged[-1]
                    if start <= last_end + self.min_gap_threshold_m:
                        merged[-1][1] = max(last_end, end)
                    else:
                        merged.append([start, end])
            
            if merged[0][0] > self.min_gap_threshold_m:
                gap_length = merged[0][0]
                total_gap_length += gap_length
                
                mid_pos = gap_length / 2
                mid_point = point_at_bearing_distance(
                    line.start_point, line.bearing(), mid_pos
                )
                
                self.issue_counter += 1
                issues.append(Issue(
                    issue_id=f"ISSUE_{self.issue_counter:04d}",
                    issue_type=IssueType.GAP,
                    severity=self._gap_severity(gap_length),
                    description=f"测线 {line_id} 起点漏扫: {gap_length:.2f}m",
                    location=mid_point,
                    related_line=line_id,
                    metrics={"gap_length_m": gap_length, "position": "start"}
                ))
            
            for i in range(1, len(merged)):
                prev_end = merged[i-1][1]
                curr_start = merged[i][0]
                gap_length = curr_start - prev_end
                
                if gap_length > self.min_gap_threshold_m:
                    total_gap_length += gap_length
                    
                    mid_pos = prev_end + gap_length / 2
                    mid_point = point_at_bearing_distance(
                        line.start_point, line.bearing(), mid_pos
                    )
                    
                    self.issue_counter += 1
                    issues.append(Issue(
                        issue_id=f"ISSUE_{self.issue_counter:04d}",
                        issue_type=IssueType.GAP,
                        severity=self._gap_severity(gap_length),
                        description=f"测线 {line_id} 中间漏扫: {gap_length:.2f}m",
                        location=mid_point,
                        related_line=line_id,
                        metrics={"gap_length_m": gap_length, "position": "middle"}
                    ))
            
            if merged[-1][1] < line_length - self.min_gap_threshold_m:
                gap_length = line_length - merged[-1][1]
                total_gap_length += gap_length
                
                mid_pos = merged[-1][1] + gap_length / 2
                mid_point = point_at_bearing_distance(
                    line.start_point, line.bearing(), mid_pos
                )
                
                self.issue_counter += 1
                issues.append(Issue(
                    issue_id=f"ISSUE_{self.issue_counter:04d}",
                    issue_type=IssueType.GAP,
                    severity=self._gap_severity(gap_length),
                    description=f"测线 {line_id} 终点漏扫: {gap_length:.2f}m",
                    location=mid_point,
                    related_line=line_id,
                    metrics={"gap_length_m": gap_length, "position": "end"}
                ))
        
        return issues, total_gap_length
    
    def _gap_severity(self, gap_length_m: float) -> IssueSeverity:
        if gap_length_m > 50:
            return IssueSeverity.CRITICAL
        elif gap_length_m > 20:
            return IssueSeverity.HIGH
        elif gap_length_m > 10:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
    
    def _find_overlaps(self, segments: List[CoverageSegment]) -> Tuple[List[Issue], float]:
        issues = []
        total_overlap = 0.0
        
        for i, seg1 in enumerate(segments):
            line1 = seg1.survey_line
            line1_id = line1.line_id
            line1_length = line1.length()
            line1_bearing = line1.bearing()
            
            swath1_left = seg1.actual_swath_left
            swath1_right = seg1.actual_swath_right
            total_swath1 = swath1_left + swath1_right
            
            for j, seg2 in enumerate(segments[i+1:], i+1):
                line2 = seg2.survey_line
                line2_id = line2.line_id
                
                line2_bearing = line2.bearing()
                bearing_diff = abs(line1_bearing - line2_bearing)
                if bearing_diff > 180:
                    bearing_diff = 360 - bearing_diff
                
                if bearing_diff > 10 and bearing_diff < 170:
                    continue
                
                xt_dist_start = cross_track_distance(line2.start_point, line1.start_point, line1.end_point)
                xt_dist_end = cross_track_distance(line2.end_point, line1.start_point, line1.end_point)
                min_xt_dist = min(xt_dist_start, xt_dist_end)
                
                swath2_left = seg2.actual_swath_left
                swath2_right = seg2.actual_swath_right
                
                if min_xt_dist < self.min_overlap_threshold_m + total_swath1 / 2:
                    overlap_amount = (total_swath1 / 2 + (swath2_left + swath2_right) / 2) - min_xt_dist
                    
                    if overlap_amount > self.min_overlap_threshold_m:
                        total_overlap += overlap_amount
                        
                        mid_point = Point(
                            (line1.start_point.lat + line2.start_point.lat) / 2,
                            (line1.start_point.lon + line2.start_point.lon) / 2
                        )
                        
                        self.issue_counter += 1
                        issues.append(Issue(
                            issue_id=f"ISSUE_{self.issue_counter:04d}",
                            issue_type=IssueType.OVERLAP,
                            severity=self._overlap_severity(overlap_amount, total_swath1),
                            description=f"测线 {line1_id} 与 {line2_id} 重叠: {overlap_amount:.2f}m",
                            location=mid_point,
                            related_line=f"{line1_id},{line2_id}",
                            metrics={"overlap_m": overlap_amount}
                        ))
        
        return issues, total_overlap
    
    def _overlap_severity(self, overlap_m: float, total_swath_m: float) -> IssueSeverity:
        overlap_ratio = overlap_m / total_swath_m
        if overlap_ratio > 0.5:
            return IssueSeverity.HIGH
        elif overlap_ratio > 0.3:
            return IssueSeverity.MEDIUM
        else:
            return IssueSeverity.LOW
