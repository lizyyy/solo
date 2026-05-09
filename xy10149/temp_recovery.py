import os
import shutil
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config
from utils import logger, save_json, get_timestamp, colorize, format_exception, format_table


class TempRecovery:
    def __init__(self):
        config.ensure_dirs()
        self.recoveries: List[Dict[str, Any]] = []

    def create_recovery_dir(self, backup_id: str) -> str:
        recovery_id = f"recovery_{backup_id}_{get_timestamp()}"
        recovery_path = os.path.join(config.RECOVERIES_DIR, recovery_id)
        os.makedirs(recovery_path, exist_ok=True)
        logger.info(f"创建临时恢复目录: {recovery_path}")
        return recovery_path

    def restore_backup(
        self,
        backup_info: Dict[str, Any],
        inject_failure: Optional[str] = None,
    ) -> Dict[str, Any]:
        recovery_id = f"recovery_{backup_info['backup_id']}_{get_timestamp()}"
        recovery_path = self.create_recovery_dir(backup_info["backup_id"])
        start_time = datetime.now()

        recovery_result = {
            "recovery_id": recovery_id,
            "backup_id": backup_info["backup_id"],
            "recovery_path": recovery_path,
            "start_time": start_time.isoformat(),
            "status": "in_progress",
            "restored_tables": [],
            "failed_tables": [],
            "errors": [],
            "metadata": {},
        }

        try:
            logger.info(f"开始恢复备份: {backup_info['backup_id']}")
            logger.info(f"恢复模式: {'模拟' if config.MOCK_MODE else '真实'}")

            if inject_failure:
                logger.warning(f"注入故障模式: {inject_failure}")
                recovery_result["metadata"]["injected_failure"] = inject_failure

            backup_tables = backup_info.get("tables", []).copy()

            if inject_failure == "missing_table":
                if "transactions" in backup_tables:
                    backup_tables.remove("transactions")
                    recovery_result["errors"].append({
                        "error_type": "MissingTable",
                        "table": "transactions",
                        "message": "备份文件中缺少 transactions 表",
                        "context": "备份显示成功但该表未被实际备份",
                    })

            if inject_failure == "corrupted_data":
                recovery_result["errors"].append({
                    "error_type": "CorruptedData",
                    "table": "users",
                    "message": "users 表数据校验失败，存在异常记录",
                    "context": "备份数据完整性问题，可能是备份过程中数据损坏",
                })

            for table_name in backup_tables:
                try:
                    self._restore_table(table_name, recovery_path, backup_info)
                    recovery_result["restored_tables"].append(table_name)
                except Exception as e:
                    err_info = format_exception(e)
                    err_info["table"] = table_name
                    recovery_result["failed_tables"].append(table_name)
                    recovery_result["errors"].append(err_info)
                    logger.error(f"恢复表失败: {table_name} - {e}")

            recovery_result["end_time"] = datetime.now().isoformat()
            recovery_result["duration_seconds"] = (datetime.now() - start_time).total_seconds()

            if recovery_result["errors"]:
                recovery_result["status"] = "failed"
                logger.warning(f"恢复完成但存在错误: {len(recovery_result['errors'])} 个")
            else:
                recovery_result["status"] = "success"
                logger.info(f"恢复成功: 恢复了 {len(recovery_result['restored_tables'])} 张表")

        except Exception as e:
            recovery_result["end_time"] = datetime.now().isoformat()
            recovery_result["duration_seconds"] = (datetime.now() - start_time).total_seconds()
            recovery_result["status"] = "failed"
            recovery_result["errors"].append(format_exception(e))
            logger.error(f"恢复过程异常: {e}")

        result_file = os.path.join(recovery_path, "recovery_result.json")
        save_json(result_file, recovery_result)

        self.recoveries.append(recovery_result)
        return recovery_result

    def _restore_table(
        self,
        table_name: str,
        recovery_path: str,
        backup_info: Dict[str, Any],
    ) -> None:
        table_file = os.path.join(recovery_path, f"{table_name}.json")
        mock_data = {
            "table_name": table_name,
            "backup_id": backup_info["backup_id"],
            "restored_at": get_timestamp(),
            "row_count": 1000,
            "schema": {
                "columns": ["id", "name", "created_at"],
                "constraints": ["PRIMARY KEY (id)"],
            },
            "sample_data": [
                {"id": 1, "name": "example_1", "created_at": "2024-01-01"},
                {"id": 2, "name": "example_2", "created_at": "2024-01-02"},
            ],
        }
        save_json(table_file, mock_data)
        logger.info(f"已恢复表: {table_name}")

    def verify_recovery(self, recovery_result: Dict[str, Any]) -> Dict[str, Any]:
        recovery_path = recovery_result["recovery_path"]
        verification = {
            "recovery_id": recovery_result["recovery_id"],
            "verified_at": get_timestamp(),
            "tables_verified": [],
            "tables_missing": [],
            "issues": [],
        }

        restored_tables = recovery_result.get("restored_tables", [])
        for table_name in restored_tables:
            table_file = os.path.join(recovery_path, f"{table_name}.json")
            if os.path.exists(table_file):
                verification["tables_verified"].append(table_name)
            else:
                verification["tables_missing"].append(table_name)
                verification["issues"].append({
                    "type": "FileMissing",
                    "table": table_name,
                    "message": f"恢复文件不存在: {table_file}",
                })

        verification["total_verified"] = len(verification["tables_verified"])
        verification["total_missing"] = len(verification["tables_missing"])
        verification["status"] = "success" if not verification["issues"] else "warning"

        logger.info(f"验证完成: {verification['total_verified']} 表确认存在, {verification['total_missing']} 表缺失")
        return verification

    def cleanup(self, recovery_id: str) -> bool:
        for recovery in self.recoveries:
            if recovery["recovery_id"] == recovery_id:
                recovery_path = recovery["recovery_path"]
                if os.path.exists(recovery_path):
                    shutil.rmtree(recovery_path)
                    logger.info(f"已清理恢复目录: {recovery_path}")
                self.recoveries.remove(recovery)
                return True
        logger.warning(f"未找到恢复记录: {recovery_id}")
        return False

    def display_result(self, recovery_result: Dict[str, Any]) -> None:
        status = recovery_result["status"]
        status_color = "green" if status == "success" else "red"

        print(colorize(f"\n恢复结果: {recovery_result['recovery_id']}", "blue"))
        print(colorize(f"状态: {status}", status_color))
        print(f"开始时间: {recovery_result['start_time']}")
        print(f"结束时间: {recovery_result.get('end_time', 'N/A')}")
        print(f"耗时: {recovery_result.get('duration_seconds', 0):.2f} 秒")
        print(f"恢复路径: {recovery_result['recovery_path']}")

        if recovery_result["restored_tables"]:
            print(colorize("\n成功恢复的表:", "green"))
            for t in recovery_result["restored_tables"]:
                print(f"  ✓ {t}")

        if recovery_result["failed_tables"]:
            print(colorize("\n恢复失败的表:", "red"))
            for t in recovery_result["failed_tables"]:
                print(f"  ✗ {t}")

        if recovery_result["errors"]:
            print(colorize("\n错误详情:", "red"))
            err_table = [
                {
                    "序号": i + 1,
                    "错误类型": e.get("error_type", "Unknown"),
                    "描述": e.get("message", e.get("error_message", "N/A")),
                }
                for i, e in enumerate(recovery_result["errors"])
            ]
            print(format_table(err_table))


temp_recovery = TempRecovery()
