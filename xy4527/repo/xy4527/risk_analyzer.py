import json
from typing import Dict, Any, Tuple
from database import RiskStatus


class RiskAnalyzer:
    MISALIGNMENT_THRESHOLD_WARNING = 5.0
    MISALIGNMENT_THRESHOLD_CRITICAL = 10.0
    
    ATTITUDE_PLANE_THRESHOLD_WARNING = 30.0
    ATTITUDE_PLANE_THRESHOLD_CRITICAL = 50.0
    ATTITUDE_ELEVATION_THRESHOLD_WARNING = 20.0
    ATTITUDE_ELEVATION_THRESHOLD_CRITICAL = 40.0
    ATTITUDE_ROLL_THRESHOLD_WARNING = 5.0
    ATTITUDE_ROLL_THRESHOLD_CRITICAL = 10.0
    
    GROUTING_MIN_VOLUME = 3.0
    GROUTING_THRESHOLD_WARNING = 4.0
    GROUTING_THRESHOLD_CRITICAL = 3.5
    
    RECHECK_GAP_THRESHOLD_WARNING = 30.0
    RECHECK_GAP_THRESHOLD_CRITICAL = 50.0
    RECHECK_GAP_MAX_RINGS = 5

    @classmethod
    def analyze_segment_misalignment(cls, segment_layout: str) -> Tuple[RiskStatus, str]:
        if not segment_layout:
            return RiskStatus.NORMAL, "无管片排版数据"
        
        try:
            layout = json.loads(segment_layout)
        except json.JSONDecodeError:
            return RiskStatus.NORMAL, f"管片排版数据格式错误: {segment_layout}"
        
        misalignments = []
        max_misalignment = 0.0
        
        segments = layout.get("segments", [])
        if not segments:
            return RiskStatus.NORMAL, "无管片数据"
        
        for i, seg in enumerate(segments):
            prev_seg = segments[i - 1] if i > 0 else segments[-1]
            elevation = seg.get("elevation", 0)
            prev_elevation = prev_seg.get("elevation", 0)
            misalignment = abs(elevation - prev_elevation)
            max_misalignment = max(max_misalignment, misalignment)
            if misalignment > cls.MISALIGNMENT_THRESHOLD_WARNING:
                misalignments.append(f"管片{i+1}与相邻管片错台{misalignment:.1f}mm")
        
        if max_misalignment >= cls.MISALIGNMENT_THRESHOLD_CRITICAL:
            return RiskStatus.CRITICAL, f"严重错台: 最大错台{max_misalignment:.1f}mm, 超过临界值{cls.MISALIGNMENT_THRESHOLD_CRITICAL}mm。详情: {'; '.join(misalignments)}"
        elif max_misalignment >= cls.MISALIGNMENT_THRESHOLD_WARNING:
            return RiskStatus.WARNING, f"存在错台风险: 最大错台{max_misalignment:.1f}mm, 超过警告值{cls.MISALIGNMENT_THRESHOLD_WARNING}mm。详情: {'; '.join(misalignments)}"
        else:
            return RiskStatus.NORMAL, f"管片错台正常: 最大错台{max_misalignment:.1f}mm"

    @classmethod
    def analyze_attitude(cls, measurement_deviation: str) -> Tuple[RiskStatus, str]:
        if not measurement_deviation:
            return RiskStatus.NORMAL, "无姿态测量数据"
        
        try:
            deviation = json.loads(measurement_deviation)
        except json.JSONDecodeError:
            return RiskStatus.NORMAL, f"姿态数据格式错误: {measurement_deviation}"
        
        issues = []
        max_risk = RiskStatus.NORMAL
        
        plane_deviation = abs(deviation.get("plane_deviation", 0))
        if plane_deviation >= cls.ATTITUDE_PLANE_THRESHOLD_CRITICAL:
            issues.append(f"平面偏差{plane_deviation:.1f}mm超过临界值{cls.ATTITUDE_PLANE_THRESHOLD_CRITICAL}mm")
            max_risk = RiskStatus.CRITICAL
        elif plane_deviation >= cls.ATTITUDE_PLANE_THRESHOLD_WARNING:
            issues.append(f"平面偏差{plane_deviation:.1f}mm超过警告值{cls.ATTITUDE_PLANE_THRESHOLD_WARNING}mm")
            if max_risk == RiskStatus.NORMAL:
                max_risk = RiskStatus.WARNING
        
        elevation_deviation = abs(deviation.get("elevation_deviation", 0))
        if elevation_deviation >= cls.ATTITUDE_ELEVATION_THRESHOLD_CRITICAL:
            issues.append(f"高程偏差{elevation_deviation:.1f}mm超过临界值{cls.ATTITUDE_ELEVATION_THRESHOLD_CRITICAL}mm")
            max_risk = RiskStatus.CRITICAL
        elif elevation_deviation >= cls.ATTITUDE_ELEVATION_THRESHOLD_WARNING:
            issues.append(f"高程偏差{elevation_deviation:.1f}mm超过警告值{cls.ATTITUDE_ELEVATION_THRESHOLD_WARNING}mm")
            if max_risk == RiskStatus.NORMAL:
                max_risk = RiskStatus.WARNING
        
        roll = abs(deviation.get("roll", 0))
        if roll >= cls.ATTITUDE_ROLL_THRESHOLD_CRITICAL:
            issues.append(f"滚动角{roll:.1f}mm超过临界值{cls.ATTITUDE_ROLL_THRESHOLD_CRITICAL}mm")
            max_risk = RiskStatus.CRITICAL
        elif roll >= cls.ATTITUDE_ROLL_THRESHOLD_WARNING:
            issues.append(f"滚动角{roll:.1f}mm超过警告值{cls.ATTITUDE_ROLL_THRESHOLD_WARNING}mm")
            if max_risk == RiskStatus.NORMAL:
                max_risk = RiskStatus.WARNING
        
        if issues:
            return max_risk, f"姿态超限: {'; '.join(issues)}"
        else:
            return RiskStatus.NORMAL, f"姿态正常: 平面偏差{plane_deviation:.1f}mm, 高程偏差{elevation_deviation:.1f}mm, 滚动角{roll:.1f}mm"

    @classmethod
    def analyze_grouting(cls, grouting_volume: float) -> Tuple[RiskStatus, str]:
        if grouting_volume is None:
            return RiskStatus.WARNING, "无注浆量数据"
        
        if grouting_volume < cls.GROUTING_MIN_VOLUME:
            return RiskStatus.CRITICAL, f"注浆严重不足: {grouting_volume:.2f}m³, 低于最小值{cls.GROUTING_MIN_VOLUME}m³"
        elif grouting_volume < cls.GROUTING_THRESHOLD_CRITICAL:
            return RiskStatus.CRITICAL, f"注浆严重不足: {grouting_volume:.2f}m³, 低于临界值{cls.GROUTING_THRESHOLD_CRITICAL}m³"
        elif grouting_volume < cls.GROUTING_THRESHOLD_WARNING:
            return RiskStatus.WARNING, f"注浆量偏低: {grouting_volume:.2f}m³, 低于警告值{cls.GROUTING_THRESHOLD_WARNING}m³"
        else:
            return RiskStatus.NORMAL, f"注浆量正常: {grouting_volume:.2f}m³"

    @classmethod
    def analyze_recheck_gap(cls, ring_number: int, last_recheck_ring: int = None) -> Tuple[RiskStatus, str]:
        if last_recheck_ring is None:
            return RiskStatus.WARNING, "无最近复测环号数据"
        
        gap = ring_number - last_recheck_ring
        
        if gap < 0:
            return RiskStatus.WARNING, f"复测环号{last_recheck_ring}大于当前环号{ring_number}, 数据可能有误"
        
        if gap >= cls.RECHECK_GAP_THRESHOLD_CRITICAL:
            return RiskStatus.CRITICAL, f"复测缺口严重: 当前环{ring_number}距最近复测环{last_recheck_ring}已间隔{gap}环, 超过临界值{cls.RECHECK_GAP_THRESHOLD_CRITICAL}环"
        elif gap >= cls.RECHECK_GAP_THRESHOLD_WARNING:
            return RiskStatus.WARNING, f"复测缺口警告: 当前环{ring_number}距最近复测环{last_recheck_ring}已间隔{gap}环, 超过警告值{cls.RECHECK_GAP_THRESHOLD_WARNING}环"
        else:
            return RiskStatus.NORMAL, f"复测缺口正常: 距最近复测环{last_recheck_ring}间隔{gap}环"

    @classmethod
    def determine_overall_risk(cls, risks: Dict[str, RiskStatus]) -> RiskStatus:
        if RiskStatus.CRITICAL in risks.values():
            return RiskStatus.CRITICAL
        elif RiskStatus.WARNING in risks.values():
            return RiskStatus.WARNING
        return RiskStatus.NORMAL

    @classmethod
    def analyze_all(cls, ring_record) -> Dict[str, Any]:
        last_recheck_ring = None
        if ring_record.measurement_deviation:
            try:
                deviation = json.loads(ring_record.measurement_deviation)
                last_recheck_ring = deviation.get("last_recheck_ring")
            except:
                pass
        
        misalignment_risk, misalignment_details = cls.analyze_segment_misalignment(ring_record.segment_layout)
        attitude_risk, attitude_details = cls.analyze_attitude(ring_record.measurement_deviation)
        grouting_risk, grouting_details = cls.analyze_grouting(ring_record.grouting_volume)
        recheck_gap_risk, recheck_gap_details = cls.analyze_recheck_gap(ring_record.ring_number, last_recheck_ring)
        
        risks = {
            "misalignment": misalignment_risk,
            "attitude": attitude_risk,
            "grouting": grouting_risk,
            "recheck_gap": recheck_gap_risk
        }
        
        overall_risk = cls.determine_overall_risk(risks)
        
        return {
            "misalignment_risk": misalignment_risk,
            "misalignment_details": misalignment_details,
            "attitude_risk": attitude_risk,
            "attitude_details": attitude_details,
            "grouting_risk": grouting_risk,
            "grouting_details": grouting_details,
            "recheck_gap_risk": recheck_gap_risk,
            "recheck_gap_details": recheck_gap_details,
            "overall_risk": overall_risk
        }
