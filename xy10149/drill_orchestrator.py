import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config
from utils import logger, get_timestamp, colorize, print_separator
from backup_inventory import inventory
from temp_recovery import temp_recovery
from validation_checker import validation_checker
from permission_checker import permission_checker
from failure_samples import failure_samples
from report_generator import report_generator


class DrillOrchestrator:
    def __init__(self):
        config.ensure_dirs()

    def run_normal_drill(self, backup_id: Optional[str] = None) -> Dict[str, Any]:
        print_separator("开始执行正常流程演练")
        logger.info("=" * 60)
        logger.info("开始正常流程演练")
        logger.info("=" * 60)

        drill_id = f"drill_normal_{get_timestamp()}"

        backup_info = self._get_or_create_backup(backup_id, "normal")

        print_separator("步骤 1: 权限检查")
        permission_result = permission_checker.run_full_check()
        permission_checker.display_result(permission_result)

        print_separator("步骤 2: 表完整性检查")
        table_check = validation_checker.check_missing_tables(backup_info)
        validation_checker.display_result(table_check, "表完整性检查结果")

        print_separator("步骤 3: 临时恢复")
        recovery_result = temp_recovery.restore_backup(backup_info)
        temp_recovery.display_result(recovery_result)

        print_separator("步骤 4: 数据校验")
        validation_result = validation_checker.run_data_validation_queries(
            recovery_result, backup_info
        )
        validation_checker.display_result(validation_result, "数据校验结果")

        print_separator("步骤 5: 生成演练报告")
        report = report_generator.generate_drill_report(
            backup_info=backup_info,
            recovery_result=recovery_result,
            table_check=table_check,
            permission_check=permission_result,
            validation_result=validation_result,
            drill_id=drill_id,
            scenario_type="normal",
            scenario_desc="正常流程演练 - 备份完整、权限充足、数据一致",
        )
        report_generator.display_report(report)

        drill_summary = {
            "drill_id": drill_id,
            "scenario": "normal",
            "overall_status": report["summary"]["overall_status"],
            "backup_id": backup_info["backup_id"],
            "recovery_id": recovery_result.get("recovery_id"),
            "report_path": os.path.join(
                config.REPORTS_DIR, f"{drill_id}_report.json"
            ),
            "details": report,
        }

        inventory.add_drill_result(backup_info["backup_id"], {
            "drill_id": drill_id,
            "scenario": "normal",
            "start_time": recovery_result.get("start_time"),
            "end_time": recovery_result.get("end_time"),
            "overall_status": report["summary"]["overall_status"],
            "missing_tables": table_check.get("tables_missing", []),
            "missing_permissions": (
                permission_result.get("database_permissions", {}).get("missing_permissions", [])
            ),
            "validation_failures": validation_result.get("failures", []),
            "report_id": drill_id,
        })

        print_separator("正常流程演练完成")

        return drill_summary

    def run_failure_drill(
        self,
        sample_id: str = "missing_critical_table",
        backup_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        print_separator(f"开始执行失败流程演练 - {sample_id}")
        logger.info("=" * 60)
        logger.info(f"开始失败流程演练: {sample_id}")
        logger.info("=" * 60)

        drill_id = f"drill_fail_{sample_id}_{get_timestamp()}"
        sample = failure_samples.get_sample(sample_id)
        inject_params = failure_samples.get_inject_params(sample_id)

        failure_samples.display_sample_detail(sample_id)

        if sample_id == "missing_critical_table":
            backup_tables = inject_params.get("backup_tables", config.CRITICAL_TABLES.copy())
            backup_info = self._get_or_create_backup(
                backup_id, "failure_missing_table", tables=backup_tables
            )
        else:
            backup_info = self._get_or_create_backup(backup_id, f"failure_{sample_id}")

        print_separator("步骤 1: 权限检查")
        if sample_id == "insufficient_permissions":
            inject_perms = inject_params.get("inject_permissions_missing", [])
            permission_result = permission_checker.run_full_check(
                inject_db_perms_missing=inject_perms[:2],
                inject_privileges_missing=inject_perms[2:] if len(inject_perms) > 2 else None,
            )
        else:
            permission_result = permission_checker.run_full_check()
        permission_checker.display_result(permission_result)

        print_separator("步骤 2: 表完整性检查")
        table_check = validation_checker.check_missing_tables(backup_info)
        validation_checker.display_result(table_check, "表完整性检查结果")

        print_separator("步骤 3: 临时恢复")
        inject_failure = inject_params.get("inject_failure")
        recovery_result = temp_recovery.restore_backup(
            backup_info,
            inject_failure=inject_failure,
        )
        temp_recovery.display_result(recovery_result)

        print_separator("步骤 4: 数据校验")
        validation_result = validation_checker.run_data_validation_queries(
            recovery_result, backup_info
        )
        validation_checker.display_result(validation_result, "数据校验结果")

        print_separator("步骤 5: 生成演练报告")
        report = report_generator.generate_drill_report(
            backup_info=backup_info,
            recovery_result=recovery_result,
            table_check=table_check,
            permission_check=permission_result,
            validation_result=validation_result,
            drill_id=drill_id,
            scenario_type="failure",
            scenario_desc=f"失败流程演练 - {sample.get('name', sample_id)}: {sample.get('description', '')}",
        )
        report_generator.display_report(report)

        drill_summary = {
            "drill_id": drill_id,
            "scenario": f"failure_{sample_id}",
            "overall_status": report["summary"]["overall_status"],
            "backup_id": backup_info["backup_id"],
            "recovery_id": recovery_result.get("recovery_id"),
            "sample_id": sample_id,
            "report_path": os.path.join(
                config.REPORTS_DIR, f"{drill_id}_report.json"
            ),
            "details": report,
        }

        inventory.add_drill_result(backup_info["backup_id"], {
            "drill_id": drill_id,
            "scenario": f"failure_{sample_id}",
            "start_time": recovery_result.get("start_time"),
            "end_time": recovery_result.get("end_time"),
            "overall_status": report["summary"]["overall_status"],
            "missing_tables": table_check.get("tables_missing", []),
            "missing_permissions": (
                permission_result.get("database_permissions", {}).get("missing_permissions", [])
            ),
            "validation_failures": validation_result.get("failures", []),
            "report_id": drill_id,
            "injected_failure": sample_id,
        })

        print_separator("失败流程演练完成")

        return drill_summary

    def _get_or_create_backup(
        self,
        backup_id: Optional[str],
        scenario: str,
        tables: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        if backup_id:
            existing = inventory.get_backup(backup_id)
            if existing:
                logger.info(f"使用已有备份: {backup_id}")
                return existing
            logger.warning(f"未找到备份 {backup_id}，将创建新备份")

        new_backup_id = f"bkp_{scenario}_{get_timestamp()}"
        backup_path = os.path.join(
            config.BACKUPS_DIR,
            f"{new_backup_id}.tar.gz",
        )

        actual_tables = tables or config.CRITICAL_TABLES.copy()

        backup_info = inventory.add_backup(
            backup_id=new_backup_id,
            backup_path=backup_path,
            backup_type="full",
            status="success",
            tables=actual_tables,
            size_bytes=5 * 1024 * 1024,
            metadata={
                "scenario": scenario,
                "created_for": "backup_recovery_drill",
            },
        )

        logger.info(f"已创建模拟备份: {new_backup_id}")
        return backup_info

    def run_both_scenarios(self) -> Dict[str, Any]:
        print(colorize("\n" + "=" * 80, "blue"))
        print(colorize("      备份恢复演练 - 完整测试套件", "blue"))
        print(colorize("=" * 80, "blue"))

        results = {
            "started_at": datetime.now().isoformat(),
            "scenarios": [],
        }

        print(colorize("\n" + "#" * 80, "yellow"))
        print(colorize("#  场景 1: 正常流程演练", "yellow"))
        print(colorize("#" * 80, "yellow"))
        normal_result = self.run_normal_drill()
        results["scenarios"].append({
            "type": "normal",
            "result": normal_result,
        })

        print(colorize("\n" + "#" * 80, "yellow"))
        print(colorize("#  场景 2: 失败流程演练 (关键表缺失)", "yellow"))
        print(colorize("#" * 80, "yellow"))
        fail_result = self.run_failure_drill(sample_id="missing_critical_table")
        results["scenarios"].append({
            "type": "failure_missing_table",
            "sample_id": "missing_critical_table",
            "result": fail_result,
        })

        results["completed_at"] = datetime.now().isoformat()
        results["summary"] = {
            "total_scenarios": len(results["scenarios"]),
            "passed": sum(
                1 for s in results["scenarios"]
                if s["result"]["overall_status"] == "success"
            ),
            "failed": sum(
                1 for s in results["scenarios"]
                if s["result"]["overall_status"] == "failed"
            ),
        }

        print(colorize("\n" + "=" * 80, "blue"))
        print(colorize("                    完整测试套件完成", "blue"))
        print(colorize("=" * 80, "blue"))
        print(colorize(f"\n总计: {results['summary']['total_scenarios']} 个场景", "green"))
        print(colorize(f"通过: {results['summary']['passed']}", "green"))
        print(colorize(f"失败: {results['summary']['failed']}", "red" if results["summary"]["failed"] > 0 else "green"))

        return results


drill_orchestrator = DrillOrchestrator()
