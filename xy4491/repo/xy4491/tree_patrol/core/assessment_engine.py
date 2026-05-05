from datetime import datetime
from typing import List, Dict, Any
from collections import defaultdict

from tree_patrol.models import (
    TreeStatus,
    TreeRecord,
    PatrolRecord,
    WeatherAlert,
    PruningOrder,
    Complaint,
    TreeAssessment
)


class AssessmentEngine:
    def __init__(self):
        self.high_risk_issues = [
            "枝干枯梢",
            "土壤松动",
            "需加固",
            "根部严重腐烂",
            "树干倾斜"
        ]
        self.medium_risk_issues = [
            "轻微虫害",
            "根部轻微腐烂",
            "枝叶枯黄"
        ]

    def assess_tree(
        self,
        tree: TreeRecord,
        patrols: List[PatrolRecord],
        alerts: List[WeatherAlert],
        pruning_orders: List[PruningOrder],
        complaints: List[Complaint],
        assessment_date: datetime = None
    ) -> TreeAssessment:
        
        if assessment_date is None:
            assessment_date = datetime.now()
        
        reasons = []
        status = TreeStatus.OPEN
        
        tree_patrols = [p for p in patrols if p.tree_id == tree.id]
        tree_pruning_orders = [po for po in pruning_orders if po.tree_id == tree.id]
        tree_complaints = [c for c in complaints if c.tree_id == tree.id]
        
        tree_alerts = []
        for alert in alerts:
            if tree.location in alert.affected_areas:
                tree_alerts.append(alert)
        
        if tree.status == "需关注":
            reasons.append("古树状态标记为需关注")
            if status == TreeStatus.OPEN:
                status = TreeStatus.NEEDS_REVIEW
        
        for patrol in tree_patrols:
            for issue in patrol.issues_found:
                if issue in self.high_risk_issues:
                    reasons.append(f"巡护发现高风险问题: {issue} (巡护员: {patrol.inspector})")
                    if issue == "需加固" or issue == "土壤松动":
                        status = TreeStatus.NEEDS_REINFORCEMENT
                    else:
                        status = TreeStatus.CLOSED
                elif issue in self.medium_risk_issues:
                    reasons.append(f"巡护发现中风险问题: {issue} (巡护员: {patrol.inspector})")
                    if status == TreeStatus.OPEN:
                        status = TreeStatus.NEEDS_REVIEW
        
        for alert in tree_alerts:
            if alert.severity in ["红色", "橙色", "黄色"]:
                reasons.append(f"天气预警影响: {alert.alert_type} ({alert.severity}级)")
                if alert.severity in ["红色", "橙色"]:
                    status = TreeStatus.CLOSED
                elif alert.severity == "黄色" and status == TreeStatus.OPEN:
                    status = TreeStatus.NEEDS_REVIEW
        
        for order in tree_pruning_orders:
            if order.status == "待执行":
                reasons.append(f"有待执行的修剪工单: {order.reason} (计划日期: {order.scheduled_date.strftime('%Y-%m-%d')})")
                if status == TreeStatus.OPEN:
                    status = TreeStatus.NEEDS_REVIEW
        
        for complaint in tree_complaints:
            if complaint.status == "待处理":
                reasons.append(f"有待处理的游客投诉: {complaint.complaint_type} - {complaint.description[:50]}...")
                if complaint.complaint_type == "安全隐患" and status in [TreeStatus.OPEN, TreeStatus.NEEDS_REVIEW]:
                    status = TreeStatus.NEEDS_REVIEW
        
        if not reasons:
            reasons.append("无异常发现，状态正常")
        
        assessment = TreeAssessment(
            tree_id=tree.id,
            assessment_date=assessment_date,
            status=status,
            reasons=reasons,
            patrol_records=[p.id for p in tree_patrols],
            weather_alerts=[a.id for a in tree_alerts],
            pruning_orders=[po.id for po in tree_pruning_orders],
            complaints=[c.id for c in tree_complaints]
        )
        
        return assessment

    def assess_all_trees(
        self,
        trees: List[TreeRecord],
        patrols: List[PatrolRecord],
        alerts: List[WeatherAlert],
        pruning_orders: List[PruningOrder],
        complaints: List[Complaint],
        assessment_date: datetime = None
    ) -> List[TreeAssessment]:
        
        assessments = []
        for tree in trees:
            assessment = self.assess_tree(
                tree, patrols, alerts, pruning_orders, complaints, assessment_date
            )
            assessments.append(assessment)
        return assessments

    def get_assessment_summary(self, assessments: List[TreeAssessment]) -> Dict[str, Any]:
        summary = {
            "total_trees": len(assessments),
            "status_counts": defaultdict(int),
            "details": []
        }
        
        for assessment in assessments:
            summary["status_counts"][assessment.status.value] += 1
            summary["details"].append({
                "tree_id": assessment.tree_id,
                "status": assessment.status.value,
                "reasons_count": len(assessment.reasons)
            })
        
        return dict(summary)
