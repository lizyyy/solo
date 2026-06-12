from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime

from .models import IntersectionPhoto, HeatmapIssue, ProcessingStatus


BOUNDARY_RULES = {
    "night_sampling": {
        "rule_id": "RULE_001",
        "name": "夜间缺采样判定规则",
        "description": "当热力图夜间时段(22:00-次日06:00)采样点数不足日间平均的30%时，判定为'夜间缺采样导致热力图偏低'，不得直接标记为正常",
        "threshold": 0.3,
        "night_hours": list(range(22, 24)) + list(range(0, 7)),
        "required_action": "提交街道规划员复核，不得自动归为正常",
        "rollback_supported": True,
    },
    "bus_card_missing": {
        "rule_id": "RULE_002",
        "name": "公交刷卡时段缺失规则",
        "description": "未补录公交刷卡时段时，不得生成最终热力图结论",
        "required_action": "先由市政巡检员补录公交刷卡时段",
        "rollback_supported": True,
    },
    "data_deduplication": {
        "rule_id": "RULE_003",
        "name": "数据去重规则",
        "description": "重复导入同一批路口照片时，通过源文件+原始行内容生成唯一ID，跳过已存在记录，数量不翻倍",
        "required_action": "自动去重，记录跳过数量",
        "rollback_supported": False,
    },
    "history_tracking": {
        "rule_id": "RULE_004",
        "name": "历史追踪规则",
        "description": "任何字段修改（包括备注）必须记录改前值、改后值、操作人、时间、原因，可追溯",
        "required_action": "自动记录，不可删除",
        "rollback_supported": True,
    },
    "review_mandatory": {
        "rule_id": "RULE_005",
        "name": "人工复核强制规则",
        "description": "热力图存在异常标记时，必须经过街道规划员复核才能标记为最终状态",
        "required_action": "强制进入待复核状态",
        "rollback_supported": True,
    },
}


class BoundaryRuleEngine:
    @staticmethod
    def detect_night_low_sampling(heatmap_data: Dict[str, Any]) -> Tuple[bool, float, str]:
        if not heatmap_data or "hourly_samples" not in heatmap_data:
            return False, 0.0, "无小时采样数据"
        
        hourly = heatmap_data["hourly_samples"]
        rule = BOUNDARY_RULES["night_sampling"]
        night_hours = rule["night_hours"]
        threshold = rule["threshold"]
        
        day_samples = []
        night_samples = []
        
        for hour_str, count in hourly.items():
            hour = int(hour_str)
            if hour in night_hours:
                night_samples.append(count)
            else:
                day_samples.append(count)
        
        if not day_samples:
            return False, 0.0, "无日间采样数据"
        if not night_samples:
            return True, 0.0, "完全无夜间采样数据"
        
        day_avg = sum(day_samples) / len(day_samples)
        night_avg = sum(night_samples) / len(night_samples)
        
        if day_avg == 0:
            return False, 0.0, "日间采样为0"
        
        ratio = night_avg / day_avg
        is_low = ratio < threshold
        
        reason = f"夜间平均采样 {night_avg:.1f}，日间平均 {day_avg:.1f}，比值 {ratio:.2%} {'低于' if is_low else '达到'} 阈值 {threshold:.0%}"
        
        return is_low, ratio, reason

    @staticmethod
    def validate_before_heatmap_generation(photo: IntersectionPhoto) -> Tuple[bool, List[str]]:
        issues = []
        
        if photo.bus_card_hours is None or len(photo.bus_card_hours) == 0:
            issues.append("未补录公交刷卡时段（RULE_002）")
        
        return len(issues) == 0, issues

    @staticmethod
    def determine_heatmap_issue(heatmap_data: Dict[str, Any]) -> Tuple[HeatmapIssue, str]:
        is_low, ratio, reason = BoundaryRuleEngine.detect_night_low_sampling(heatmap_data)
        if is_low:
            return HeatmapIssue.LOW_NIGHT_SAMPLING, reason
        return HeatmapIssue.NONE, "正常"

    @staticmethod
    def determine_next_status(
        photo: IntersectionPhoto,
        heatmap_issue: HeatmapIssue,
    ) -> ProcessingStatus:
        if heatmap_issue != HeatmapIssue.NONE:
            return ProcessingStatus.PENDING_REVIEW
        return ProcessingStatus.HEATMAP_GENERATED

    @staticmethod
    def can_rollback(photo: IntersectionPhoto) -> Tuple[bool, str]:
        if photo.current_status == ProcessingStatus.ROLLED_BACK:
            return False, "已处于回滚状态"
        
        if photo.current_status in [
            ProcessingStatus.BUS_CARD_DATA_ADDED,
            ProcessingStatus.HEATMAP_GENERATED,
            ProcessingStatus.PENDING_REVIEW,
            ProcessingStatus.REVIEWED_NORMAL,
            ProcessingStatus.REVIEWED_LOW_SAMPLING,
        ]:
            return True, "可回滚至上一状态"
        
        return False, f"当前状态 {photo.current_status.value} 不支持回滚"

    @staticmethod
    def get_rollback_target(photo: IntersectionPhoto) -> Optional[ProcessingStatus]:
        status_flow = [
            ProcessingStatus.IMPORTED,
            ProcessingStatus.BUS_CARD_DATA_ADDED,
            ProcessingStatus.HEATMAP_GENERATED,
            ProcessingStatus.PENDING_REVIEW,
        ]
        
        reviewed_statuses = [
            ProcessingStatus.REVIEWED_NORMAL,
            ProcessingStatus.REVIEWED_LOW_SAMPLING,
        ]
        
        if photo.current_status in reviewed_statuses:
            return ProcessingStatus.PENDING_REVIEW
        
        current_idx = None
        for i, s in enumerate(status_flow):
            if s == photo.current_status:
                current_idx = i
                break
        
        if current_idx is None or current_idx <= 0:
            return None
        
        return status_flow[current_idx - 1]

    @staticmethod
    def get_all_rules() -> Dict[str, Any]:
        return BOUNDARY_RULES

    @staticmethod
    def get_rule(rule_id: str) -> Optional[Dict[str, Any]]:
        for key, rule in BOUNDARY_RULES.items():
            if rule["rule_id"] == rule_id:
                return rule
        return None
