from typing import Dict, List, Any, Optional
from collections import defaultdict
from datetime import datetime
from .models import CloudBill, BillStatus, ProjectStatus
from .storage import Storage
from .engine import RuleEngine


class ReportGenerator:
    def __init__(self, storage: Storage, engine: RuleEngine):
        self.storage = storage
        self.engine = engine

    def _get_project_name(self, code: Optional[str]) -> str:
        if not code:
            return "未归属"
        project = self.storage.projects.get(code)
        if project:
            return f"{project.name}({code})"
        return code

    def generate_summary(self) -> Dict[str, Any]:
        all_bills = self.storage.bills.all()
        total_cost = sum(b.cost for b in all_bills)
        currency = all_bills[0].currency if all_bills else "CNY"

        by_status = defaultdict(lambda: {"count": 0, "cost": 0.0})
        by_raw_project = defaultdict(lambda: {"count": 0, "cost": 0.0})
        by_effective_project = defaultdict(lambda: {"count": 0, "cost": 0.0})

        for bill in all_bills:
            by_status[bill.status.value]["count"] += 1
            by_status[bill.status.value]["cost"] += bill.cost

            raw_proj = bill.raw_tags.project or "UNASSIGNED"
            by_raw_project[raw_proj]["count"] += 1
            by_raw_project[raw_proj]["cost"] += bill.cost

            eff_proj = bill.effective_tags().project or "UNASSIGNED"
            by_effective_project[eff_proj]["count"] += 1
            by_effective_project[eff_proj]["cost"] += bill.cost

        project_diff = self._calculate_project_diff(by_raw_project, by_effective_project)

        unassigned_bills = [b for b in all_bills if b.status in [BillStatus.UNASSIGNED, BillStatus.RAW]]
        inactive_project_bills = [b for b in all_bills if b.status == BillStatus.INACTIVE_PROJECT]

        owners_with_unassigned = set()
        for bill in unassigned_bills:
            owner = bill.effective_tags().owner
            if owner:
                owners_with_unassigned.add(owner)

        return {
            "total": {
                "bill_count": len(all_bills),
                "total_cost": total_cost,
                "currency": currency
            },
            "by_status": dict(by_status),
            "before_after_diff": project_diff,
            "unassigned": {
                "count": len(unassigned_bills),
                "cost": sum(b.cost for b in unassigned_bills),
                "bills": [
                    {
                        "bill_id": b.bill_id,
                        "resource_id": b.resource_id,
                        "resource_type": b.resource_type,
                        "cost": b.cost,
                        "raw_tags": b.raw_tags.to_dict(),
                        "fixed_tags": b.fixed_tags.to_dict() if b.fixed_tags else None,
                        "issues": self.engine.check_bill(b)["issues"]
                    }
                    for b in unassigned_bills[:20]
                ],
                "owners_involved": list(owners_with_unassigned)
            },
            "inactive_project": {
                "count": len(inactive_project_bills),
                "cost": sum(b.cost for b in inactive_project_bills),
                "bills": [
                    {
                        "bill_id": b.bill_id,
                        "project": b.raw_tags.project,
                        "resource_type": b.resource_type,
                        "cost": b.cost
                    }
                    for b in inactive_project_bills[:10]
                ]
            }
        }

    def _calculate_project_diff(self, raw, effective):
        all_projects = set(list(raw.keys()) + list(effective.keys()))
        diff = []

        for proj in all_projects:
            raw_data = raw.get(proj, {"count": 0, "cost": 0.0})
            eff_data = effective.get(proj, {"count": 0, "cost": 0.0})

            count_diff = eff_data["count"] - raw_data["count"]
            cost_diff = eff_data["cost"] - raw_data["cost"]

            if count_diff != 0 or cost_diff != 0:
                diff.append({
                    "project": self._get_project_name(proj if proj != "UNASSIGNED" else None),
                    "raw": {"count": raw_data["count"], "cost": raw_data["cost"]},
                    "fixed": {"count": eff_data["count"], "cost": eff_data["cost"]},
                    "diff_count": count_diff,
                    "diff_cost": round(cost_diff, 2)
                })

        diff.sort(key=lambda x: abs(x["diff_cost"]), reverse=True)
        return diff

    def generate_detailed_report(self, output_file: Optional[str] = None) -> Dict[str, Any]:
        summary = self.generate_summary()

        report = {
            "generated_at": datetime.now().isoformat(),
            "summary": summary,
            "recommendations": self._generate_recommendations(summary)
        }

        if output_file:
            import json
            with open(output_file, 'w', encoding='utf-8') as f:
                json.dump(report, f, ensure_ascii=False, indent=2)

        return report

    def _generate_recommendations(self, summary: Dict[str, Any]) -> List[Dict[str, Any]]:
        recommendations = []
        total_cost = summary["total"]["total_cost"]

        unassigned_cost = summary["unassigned"]["cost"]
        if unassigned_cost > 0:
            pct = (unassigned_cost / total_cost * 100) if total_cost > 0 else 0
            recommendations.append({
                "priority": "high" if pct > 5 else "medium",
                "category": "unassigned",
                "message": f"还有 {summary['unassigned']['count']} 条账单未归属，"
                          f"涉及金额 {unassigned_cost:.2f} {summary['total']['currency']} ({pct:.1f}%)，"
                          f"需要尽快人工处理。"
            })

        inactive_cost = summary["inactive_project"]["cost"]
        if inactive_cost > 0:
            recommendations.append({
                "priority": "high",
                "category": "inactive_project",
                "message": f"检测到 {summary['inactive_project']['count']} 条停用项目仍在计费，"
                          f"涉及金额 {inactive_cost:.2f} {summary['total']['currency']}，"
                          f"请检查资源是否应停止或重新分配项目。"
            })

        for diff in summary["before_after_diff"]:
            if diff["diff_cost"] != 0:
                direction = "增加" if diff["diff_cost"] > 0 else "减少"
                recommendations.append({
                    "priority": "info",
                    "category": "project_shift",
                    "message": f"项目 {diff['project']} {direction}成本 "
                              f"{abs(diff['diff_cost']):.2f} {summary['total']['currency']}"
                })

        if not recommendations:
            recommendations.append({
                "priority": "info",
                "category": "all_good",
                "message": "所有账单标签完整，成本归属清晰。"
            })

        return recommendations
