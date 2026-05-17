from typing import List, Dict
from collections import defaultdict
from datetime import datetime
from .models import InspectionRecord, TeamSummary, InspectionReport, DefectType, RiskLevel


class InspectionAnalyzer:
    def __init__(self):
        pass

    def analyze(self, records: List[InspectionRecord], report_date: str = None) -> InspectionReport:
        if not report_date:
            report_date = datetime.now().strftime("%Y-%m-%d")

        team_summaries = self._summarize_by_team(records)

        report = InspectionReport(
            report_date=report_date,
            records=records,
            team_summaries=team_summaries,
        )

        return report

    def _summarize_by_team(self, records: List[InspectionRecord]) -> List[TeamSummary]:
        team_data: Dict[str, TeamSummary] = {}

        for record in records:
            team = record.team or "未分配"
            if team not in team_data:
                team_data[team] = TeamSummary(team=team)

            summary = team_data[team]
            summary.total_items += 1

            if record.is_completed:
                summary.completed_items += 1
            else:
                if record.defect_type == DefectType.SAFETY:
                    summary.safety_defects += 1
                elif record.defect_type == DefectType.MAINTENANCE:
                    summary.maintenance_defects += 1

                if record.risk_level == RiskLevel.HIGH:
                    summary.high_risk += 1
                elif record.risk_level == RiskLevel.MEDIUM:
                    summary.medium_risk += 1
                else:
                    summary.low_risk += 1

        return sorted(team_data.values(), key=lambda x: x.team)

    def get_defect_records(self, records: List[InspectionRecord]) -> List[InspectionRecord]:
        return [r for r in records if not r.is_completed]

    def get_safety_defects(self, records: List[InspectionRecord]) -> List[InspectionRecord]:
        return [r for r in records if not r.is_completed and r.defect_type == DefectType.SAFETY]

    def get_maintenance_defects(self, records: List[InspectionRecord]) -> List[InspectionRecord]:
        return [r for r in records if not r.is_completed and r.defect_type == DefectType.MAINTENANCE]

    def get_high_risk_defects(self, records: List[InspectionRecord]) -> List[InspectionRecord]:
        return [r for r in records if not r.is_completed and r.risk_level == RiskLevel.HIGH]

    def filter_by_team(self, records: List[InspectionRecord], team: str) -> List[InspectionRecord]:
        return [r for r in records if r.team == team]

    def filter_by_date_range(self, records: List[InspectionRecord], start_date: str, end_date: str) -> List[InspectionRecord]:
        result = []
        for r in records:
            try:
                record_date = datetime.strptime(r.date, "%Y-%m-%d")
                start = datetime.strptime(start_date, "%Y-%m-%d")
                end = datetime.strptime(end_date, "%Y-%m-%d")
                if start <= record_date <= end:
                    result.append(r)
            except ValueError:
                continue
        return result

    def get_statistics(self, records: List[InspectionRecord]) -> Dict:
        total = len(records)
        completed = sum(1 for r in records if r.is_completed)
        defects = total - completed

        safety_defects = sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.SAFETY)
        maintenance_defects = sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.MAINTENANCE)
        env_defects = sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.ENVIRONMENT)
        op_defects = sum(1 for r in records if not r.is_completed and r.defect_type == DefectType.OPERATION)

        high_risk = sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.HIGH)
        medium_risk = sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.MEDIUM)
        low_risk = sum(1 for r in records if not r.is_completed and r.risk_level == RiskLevel.LOW)

        return {
            "total": total,
            "completed": completed,
            "defects": defects,
            "completion_rate": round((completed / total * 100) if total > 0 else 0, 2),
            "safety_defects": safety_defects,
            "maintenance_defects": maintenance_defects,
            "environment_defects": env_defects,
            "operation_defects": op_defects,
            "high_risk": high_risk,
            "medium_risk": medium_risk,
            "low_risk": low_risk,
        }
