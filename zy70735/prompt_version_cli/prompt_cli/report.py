import json
from typing import Dict, Any
from tabulate import tabulate
from datetime import datetime


class ReportGenerator:
    @staticmethod
    def generate_human_report(summary: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append(f"模型提示版本实验流量命中摘要报告")
        lines.append(f"模板名称: {summary['template_name']}")
        lines.append(f"生成时间: {summary['generated_at']}")
        lines.append("=" * 80)
        lines.append("")
        
        lines.append("【总体统计】")
        lines.append(f"  总版本数: {summary['total_versions']}")
        lines.append(f"  总命中数: {summary['total_hits']}")
        lines.append(f"  总回滚数: {summary['total_rollbacks']}")
        lines.append("")
        
        lines.append("【版本详情】")
        if summary["versions"]:
            version_headers = ["版本ID", "发布人", "发布时间", "内容哈希", "命中数", "描述"]
            version_data = []
            for v in summary["versions"]:
                version_data.append([
                    v["version_id"],
                    v["publisher"],
                    v["publish_time"][:19] if v["publish_time"] else "-",
                    v.get("content_hash", "-"),
                    v.get("hit_count", 0),
                    v["description"][:30] + "..." if len(v["description"]) > 30 else v["description"]
                ])
            lines.append(tabulate(version_data, headers=version_headers, tablefmt="simple"))
        else:
            lines.append("  (无版本数据)")
        lines.append("")
        
        lines.append("【当前流量分配】")
        if summary.get("latest_traffic"):
            traffic = summary["latest_traffic"]
            lines.append(f"  更新时间: {traffic['update_time'][:19]}")
            lines.append(f"  操作人: {traffic['operator']}")
            lines.append("")
            traffic_headers = ["版本ID", "流量占比(%)"]
            traffic_data = [[k, v] for k, v in traffic["allocations"].items()]
            lines.append(tabulate(traffic_data, headers=traffic_headers, tablefmt="simple"))
        else:
            lines.append("  (无流量分配数据)")
        lines.append("")
        
        lines.append("【回滚事件】")
        if summary["rollbacks"]:
            rollback_headers = ["回滚ID", "从版本", "到版本", "操作人", "原因", "时间"]
            rollback_data = []
            for r in summary["rollbacks"]:
                rollback_data.append([
                    r["rollback_id"],
                    r["from_version"],
                    r["to_version"],
                    r["operator"],
                    r["reason"][:20] + "..." if len(r["reason"]) > 20 else r["reason"],
                    r["rollback_time"][:19]
                ])
            lines.append(tabulate(rollback_data, headers=rollback_headers, tablefmt="simple"))
        else:
            lines.append("  (无回滚事件)")
        lines.append("")
        
        lines.append("【版本命中分布】")
        if summary["versions"]:
            hit_headers = ["版本ID", "命中数", "占比(%)"]
            hit_data = []
            total_hits = summary["total_hits"]
            for v in summary["versions"]:
                count = v.get("hit_count", 0)
                percentage = (count / total_hits * 100) if total_hits > 0 else 0
                hit_data.append([v["version_id"], count, f"{percentage:.1f}"])
            lines.append(tabulate(hit_data, headers=hit_headers, tablefmt="simple"))
        lines.append("")
        
        lines.append("=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)
        
        return "\n".join(lines)

    @staticmethod
    def generate_machine_report(summary: Dict[str, Any]) -> str:
        return json.dumps(summary, ensure_ascii=False, indent=2)

    @staticmethod
    def validate_consistency(human_report: str, machine_report: str) -> Dict[str, Any]:
        try:
            machine_data = json.loads(machine_report)
        except json.JSONDecodeError:
            return {"valid": False, "error": "机器可读报告JSON解析失败"}
        
        checks = []
        
        checks.append({
            "field": "template_name",
            "passed": machine_data["template_name"] in human_report,
            "expected": machine_data["template_name"]
        })
        
        checks.append({
            "field": "total_versions",
            "passed": str(machine_data["total_versions"]) in human_report,
            "expected": str(machine_data["total_versions"])
        })
        
        checks.append({
            "field": "total_hits",
            "passed": str(machine_data["total_hits"]) in human_report,
            "expected": str(machine_data["total_hits"])
        })
        
        checks.append({
            "field": "total_rollbacks",
            "passed": str(machine_data["total_rollbacks"]) in human_report,
            "expected": str(machine_data["total_rollbacks"])
        })
        
        for v in machine_data["versions"]:
            checks.append({
                "field": f"version_{v['version_id']}",
                "passed": v["version_id"] in human_report,
                "expected": v["version_id"]
            })
        
        all_passed = all(c["passed"] for c in checks)
        
        return {
            "valid": all_passed,
            "checks": checks,
            "summary": {
                "total": len(checks),
                "passed": sum(1 for c in checks if c["passed"]),
                "failed": sum(1 for c in checks if not c["passed"])
            }
        }
