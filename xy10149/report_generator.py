import os
from datetime import datetime
from typing import Any, Dict, List

from config import config
from utils import format_table, logger, save_json, get_timestamp, colorize


class ReportGenerator:
    def __init__(self):
        config.ensure_dirs()

    def generate_drill_report(
        self,
        backup_info: Dict[str, Any],
        recovery_result: Dict[str, Any],
        table_check: Dict[str, Any],
        permission_check: Dict[str, Any],
        validation_result: Dict[str, Any],
        drill_id: str,
        scenario_type: str = "normal",
        scenario_desc: str = "正常流程演练",
    ) -> Dict[str, Any]:
        logger.info(f"生成演练报告: {drill_id}")

        start_time = recovery_result.get("start_time", datetime.now().isoformat())
        end_time = recovery_result.get("end_time", datetime.now().isoformat())

        missing_tables = table_check.get("tables_missing", [])
        table_status = table_check.get("status", "unknown")

        permission_status = permission_check.get("overall_status", permission_check.get("status", "unknown"))
        missing_permissions = []
        if "database_permissions" in permission_check:
            missing_permissions = permission_check["database_permissions"].get("missing_permissions", [])

        validation_failures = validation_result.get("failures", [])
        validation_status = validation_result.get("status", "unknown")

        all_passed = (
            table_status == "passed"
            and permission_status in ["passed", "success"]
            and validation_status == "passed"
            and recovery_result.get("status") == "success"
        )
        overall_status = "success" if all_passed else "failed"

        report = {
            "drill_id": drill_id,
            "generated_at": datetime.now().isoformat(),
            "timestamp": get_timestamp(),
            "scenario_type": scenario_type,
            "scenario_description": scenario_desc,
            "summary": {
                "overall_status": overall_status,
                "start_time": start_time,
                "end_time": end_time,
                "duration_seconds": recovery_result.get("duration_seconds", 0),
                "backup_id": backup_info["backup_id"],
                "backup_time": backup_info["timestamp"],
            },
            "backup_details": {
                "backup_id": backup_info["backup_id"],
                "backup_type": backup_info["backup_type"],
                "backup_status": backup_info["status"],
                "backup_path": backup_info["backup_path"],
                "tables_in_backup": backup_info.get("tables", []),
                "table_count": backup_info.get("table_count", 0),
                "size_mb": backup_info.get("size_mb", 0),
            },
            "recovery_result": {
                "recovery_id": recovery_result.get("recovery_id"),
                "recovery_path": recovery_result.get("recovery_path"),
                "status": recovery_result.get("status"),
                "restored_tables": recovery_result.get("restored_tables", []),
                "failed_tables": recovery_result.get("failed_tables", []),
                "restored_count": len(recovery_result.get("restored_tables", [])),
                "failed_count": len(recovery_result.get("failed_tables", [])),
                "errors": recovery_result.get("errors", []),
            },
            "table_integrity_check": {
                "status": table_status,
                "critical_tables_expected": table_check.get("critical_tables_expected", []),
                "tables_present": table_check.get("tables_present", []),
                "tables_missing": missing_tables,
                "count_expected": len(table_check.get("critical_tables_expected", [])),
                "count_present": table_check.get("count_present", 0),
                "count_missing": table_check.get("count_missing", 0),
            },
            "permission_check": {
                "overall_status": permission_status,
                "database_permissions": permission_check.get("database_permissions", {}),
                "restoration_privileges": permission_check.get("restoration_privileges", {}),
                "file_permissions": permission_check.get("file_permissions", {}),
                "missing_permissions": missing_permissions,
            },
            "data_validation": {
                "status": validation_status,
                "summary": validation_result.get("summary", {}),
                "failures": validation_failures,
                "total_queries": validation_result.get("summary", {}).get("total_queries", 0),
                "queries_passed": validation_result.get("summary", {}).get("passed", 0),
                "queries_failed": validation_result.get("summary", {}).get("failed", 0),
            },
            "issues_found": [],
            "recommendations": [],
            "next_steps": [],
        }

        if missing_tables:
            report["issues_found"].append({
                "severity": "critical",
                "category": "table_missing",
                "description": f"缺少 {len(missing_tables)} 张关键表",
                "details": missing_tables,
            })
            report["recommendations"].append(
                "立即检查备份脚本配置，确保所有关键表都被包含在备份范围内"
            )
            report["recommendations"].append(
                "在备份完成后增加表完整性校验步骤"
            )
            report["next_steps"].append("修复备份配置后重新执行演练")

        if missing_permissions:
            report["issues_found"].append({
                "severity": "high",
                "category": "permission_missing",
                "description": f"缺少 {len(missing_permissions)} 项必要权限",
                "details": missing_permissions,
            })
            report["recommendations"].append(
                "为恢复用户授予缺失的数据库权限"
            )
            report["recommendations"].append(
                "定期（至少每月）验证恢复用户的权限完整性"
            )
            report["next_steps"].append("授予缺失权限后重新执行演练")

        if validation_failures:
            report["issues_found"].append({
                "severity": "high",
                "category": "data_validation",
                "description": f"数据校验发现 {len(validation_failures)} 个问题",
                "details": validation_failures,
            })
            report["recommendations"].append(
                "检查备份数据的完整性，可能需要追溯到更早的备份点"
            )
            report["next_steps"].append("验证失败的数据表，考虑使用其他备份")

        if recovery_result.get("errors"):
            for err in recovery_result["errors"]:
                report["issues_found"].append({
                    "severity": "medium",
                    "category": "recovery_error",
                    "description": err.get("message", err.get("error_message", "未知错误")),
                    "details": err,
                })

        if overall_status == "success":
            report["recommendations"].append("继续保持当前的备份和恢复流程")
            report["recommendations"].append("建议定期（至少每月）执行一次完整演练")
            report["next_steps"].append("记录本次演练结果，安排下次演练时间")

        report_file_json = os.path.join(
            config.REPORTS_DIR,
            f"{drill_id}_report.json",
        )
        save_json(report_file_json, report)

        report_file_txt = self._generate_text_report(report)
        txt_path = os.path.join(
            config.REPORTS_DIR,
            f"{drill_id}_report.txt",
        )
        with open(txt_path, "w", encoding="utf-8") as f:
            f.write(report_file_txt)

        logger.info(f"演练报告已生成: {report_file_json}")
        logger.info(f"文本报告已生成: {txt_path}")

        return report

    def _generate_text_report(self, report: Dict[str, Any]) -> str:
        lines = []
        lines.append("=" * 80)
        lines.append("                      备份恢复演练报告")
        lines.append("=" * 80)
        lines.append("")
        lines.append(f"报告编号: {report['drill_id']}")
        lines.append(f"生成时间: {report['generated_at']}")
        lines.append(f"演练场景: {report['scenario_type']} - {report['scenario_description']}")
        lines.append("")

        summary = report["summary"]
        status_color = "[通过]" if summary["overall_status"] == "success" else "[失败]"
        lines.append("-" * 80)
        lines.append("演练摘要")
        lines.append("-" * 80)
        lines.append(f"  总体结果: {status_color}")
        lines.append(f"  开始时间: {summary['start_time']}")
        lines.append(f"  结束时间: {summary['end_time']}")
        lines.append(f"  耗时: {summary['duration_seconds']:.2f} 秒")
        lines.append(f"  备份ID: {summary['backup_id']}")
        lines.append(f"  备份时间: {summary['backup_time']}")
        lines.append("")

        backup = report["backup_details"]
        lines.append("-" * 80)
        lines.append("备份信息")
        lines.append("-" * 80)
        lines.append(f"  备份类型: {backup['backup_type']}")
        lines.append(f"  备份状态: {backup['backup_status']}")
        lines.append(f"  备份路径: {backup['backup_path']}")
        lines.append(f"  表数量: {backup['table_count']}")
        lines.append(f"  大小: {backup['size_mb']} MB")
        lines.append(f"  包含的表: {', '.join(backup['tables_in_backup'])}")
        lines.append("")

        recovery = report["recovery_result"]
        lines.append("-" * 80)
        lines.append("恢复结果")
        lines.append("-" * 80)
        lines.append(f"  恢复状态: {recovery['status']}")
        lines.append(f"  恢复ID: {recovery['recovery_id']}")
        lines.append(f"  恢复路径: {recovery['recovery_path']}")
        lines.append(f"  成功恢复: {recovery['restored_count']} 张表")
        lines.append(f"  恢复失败: {recovery['failed_count']} 张表")
        if recovery["restored_tables"]:
            lines.append(f"  成功表: {', '.join(recovery['restored_tables'])}")
        if recovery["failed_tables"]:
            lines.append(f"  失败表: {', '.join(recovery['failed_tables'])}")
        lines.append("")

        table_check = report["table_integrity_check"]
        lines.append("-" * 80)
        lines.append("表完整性检查")
        lines.append("-" * 80)
        lines.append(f"  状态: {table_check['status']}")
        lines.append(f"  预期关键表数: {table_check['count_expected']}")
        lines.append(f"  实际存在数: {table_check['count_present']}")
        lines.append(f"  缺失数: {table_check['count_missing']}")
        if table_check["tables_missing"]:
            lines.append(f"  缺失的表: {', '.join(table_check['tables_missing'])}")
        lines.append("")

        validation = report["data_validation"]
        lines.append("-" * 80)
        lines.append("数据校验结果")
        lines.append("-" * 80)
        lines.append(f"  状态: {validation['status']}")
        lines.append(f"  总查询数: {validation['total_queries']}")
        lines.append(f"  通过: {validation['queries_passed']}")
        lines.append(f"  失败: {validation['queries_failed']}")
        if validation["failures"]:
            lines.append("  失败详情:")
            for f in validation["failures"]:
                lines.append(f"    - 表: {f['table']}, 查询: {f['query_name']}, 原因: {f['reason']}")
        lines.append("")

        if report["issues_found"]:
            lines.append("=" * 80)
            lines.append("发现的问题")
            lines.append("=" * 80)
            for i, issue in enumerate(report["issues_found"], 1):
                lines.append(f"\n问题 {i}:")
                lines.append(f"  严重程度: {issue['severity']}")
                lines.append(f"  类别: {issue['category']}")
                lines.append(f"  描述: {issue['description']}")
                if issue["details"]:
                    lines.append(f"  详情: {issue['details']}")

        if report["recommendations"]:
            lines.append("\n" + "=" * 80)
            lines.append("修复建议")
            lines.append("=" * 80)
            for i, rec in enumerate(report["recommendations"], 1):
                lines.append(f"  {i}. {rec}")

        if report["next_steps"]:
            lines.append("\n" + "=" * 80)
            lines.append("后续行动")
            lines.append("=" * 80)
            for i, step in enumerate(report["next_steps"], 1):
                lines.append(f"  {i}. {step}")

        lines.append("\n" + "=" * 80)
        lines.append("报告结束")
        lines.append("=" * 80)

        return "\n".join(lines)

    def display_report(self, report: Dict[str, Any]) -> None:
        summary = report["summary"]
        overall = summary["overall_status"]
        status_color = "green" if overall == "success" else "red"

        print(colorize("\n" + "=" * 80, "blue"))
        print(colorize("                      备份恢复演练报告", "blue"))
        print(colorize("=" * 80, "blue"))

        print(colorize(f"\n演练结果: {overall}", status_color))
        print(f"报告编号: {report['drill_id']}")
        print(f"生成时间: {report['generated_at']}")
        print(f"场景类型: {report['scenario_type']}")
        print(f"场景描述: {report['scenario_description']}")

        print(colorize("\n--- 摘要 ---", "green"))
        summary_table = [
            {"项目": "总体状态", "值": colorize(overall, status_color)},
            {"项目": "开始时间", "值": summary["start_time"]},
            {"项目": "结束时间", "值": summary["end_time"]},
            {"项目": "耗时", "值": f"{summary['duration_seconds']:.2f} 秒"},
            {"项目": "备份ID", "值": summary["backup_id"]},
        ]
        print(format_table(summary_table))

        if report["issues_found"]:
            print(colorize("\n--- 发现的问题 ---", "red"))
            issues_table = []
            for i, issue in enumerate(report["issues_found"], 1):
                issues_table.append({
                    "序号": i,
                    "严重程度": issue["severity"],
                    "类别": issue["category"],
                    "描述": issue["description"],
                })
            print(format_table(issues_table))

        if report["recommendations"]:
            print(colorize("\n--- 修复建议 ---", "yellow"))
            for i, rec in enumerate(report["recommendations"], 1):
                print(f"  {i}. {rec}")

        print(colorize(f"\n报告文件已保存到: {config.REPORTS_DIR}", "blue"))
        print(colorize(f"JSON报告: {report['drill_id']}_report.json", "blue"))
        print(colorize(f"文本报告: {report['drill_id']}_report.txt", "blue"))


report_generator = ReportGenerator()
