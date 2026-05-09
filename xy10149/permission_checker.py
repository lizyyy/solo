import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config
from utils import format_table, logger, colorize


class PermissionChecker:
    def __init__(self):
        config.ensure_dirs()

    def check_db_permissions(
        self,
        inject_missing: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        logger.info("开始检查数据库权限...")

        result = {
            "check_type": "database_permissions",
            "checked_at": datetime.now().isoformat(),
            "database": {
                "host": config.DB_HOST,
                "port": config.DB_PORT,
                "user": config.DB_USER,
                "database": config.DB_NAME,
            },
            "required_permissions": config.REQUIRED_PERMISSIONS.copy(),
            "actual_permissions": [],
            "missing_permissions": [],
            "recommendations": [],
        }

        actual = config.REQUIRED_PERMISSIONS.copy()
        if inject_missing:
            for perm in inject_missing:
                if perm in actual:
                    actual.remove(perm)
                    result["missing_permissions"].append(perm)

        result["actual_permissions"] = actual

        for perm in config.REQUIRED_PERMISSIONS:
            if perm in actual:
                logger.info(f"  ✓ 权限 {perm}: 已授予")
            else:
                logger.warning(f"  ✗ 权限 {perm}: 缺失")
                result["recommendations"].append(
                    f"需要授予权限: GRANT {perm} ON DATABASE {config.DB_NAME} TO {config.DB_USER};"
                )

        result["count_total"] = len(result["required_permissions"])
        result["count_granted"] = len(result["actual_permissions"])
        result["count_missing"] = len(result["missing_permissions"])
        result["status"] = "passed" if not result["missing_permissions"] else "failed"

        logger.info(
            f"权限检查完成: {result['count_granted']}/{result['count_total']} 权限已授予"
        )

        return result

    def check_file_permissions(
        self,
        paths: List[str],
    ) -> Dict[str, Any]:
        logger.info("开始检查文件系统权限...")

        result = {
            "check_type": "file_permissions",
            "checked_at": datetime.now().isoformat(),
            "paths": [],
            "issues": [],
        }

        for path in paths:
            path_info = {
                "path": path,
                "exists": os.path.exists(path),
                "readable": os.access(path, os.R_OK) if os.path.exists(path) else False,
                "writable": os.access(path, os.W_OK) if os.path.exists(path) else False,
                "executable": os.access(path, os.X_OK) if os.path.exists(path) else False,
            }

            if not path_info["exists"]:
                result["issues"].append({
                    "path": path,
                    "issue": "路径不存在",
                    "severity": "error",
                })
            else:
                if not path_info["readable"]:
                    result["issues"].append({
                        "path": path,
                        "issue": "无法读取",
                        "severity": "error",
                    })
                if not path_info["writable"]:
                    result["issues"].append({
                        "path": path,
                        "issue": "无法写入",
                        "severity": "error",
                    })

            result["paths"].append(path_info)

        result["status"] = "passed" if not result["issues"] else "failed"
        result["summary"] = {
            "total_paths": len(paths),
            "with_issues": len(result["issues"]),
        }

        logger.info(
            f"文件权限检查完成: {result['summary']['total_paths'] - result['summary']['with_issues']} 路径正常"
        )

        return result

    def check_restoration_privileges(
        self,
        inject_missing_perms: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        logger.info("开始检查恢复操作所需的特殊权限...")

        required_privileges = [
            {"privilege": "CREATE TABLE", "description": "创建表结构的权限"},
            {"privilege": "INSERT", "description": "插入数据的权限"},
            {"privilege": "TRUNCATE", "description": "清理临时表的权限"},
            {"privilege": "CREATE INDEX", "description": "创建索引的权限"},
            {"privilege": "CREATE CONSTRAINT", "description": "创建约束的权限"},
            {"privilege": "CREATE TRIGGER", "description": "创建触发器的权限"},
        ]

        result = {
            "check_type": "restoration_privileges",
            "checked_at": datetime.now().isoformat(),
            "required_privileges": required_privileges,
            "privileges_granted": [],
            "privileges_missing": [],
        }

        missing_set = set(inject_missing_perms or [])

        for priv_info in required_privileges:
            priv_name = priv_info["privilege"]
            if priv_name in missing_set:
                result["privileges_missing"].append(priv_info)
                logger.warning(f"  ✗ {priv_name}: 缺失")
            else:
                result["privileges_granted"].append(priv_info)
                logger.info(f"  ✓ {priv_name}: 已授予")

        result["status"] = "passed" if not result["privileges_missing"] else "failed"
        result["summary"] = {
            "total": len(required_privileges),
            "granted": len(result["privileges_granted"]),
            "missing": len(result["privileges_missing"]),
        }

        return result

    def run_full_check(
        self,
        inject_db_perms_missing: Optional[List[str]] = None,
        inject_privileges_missing: Optional[List[str]] = None,
    ) -> Dict[str, Any]:
        logger.info("=" * 60)
        logger.info("开始执行完整权限检查")
        logger.info("=" * 60)

        results = {
            "check_time": datetime.now().isoformat(),
            "database_permissions": self.check_db_permissions(inject_missing=inject_db_perms_missing),
            "restoration_privileges": self.check_restoration_privileges(
                inject_missing_perms=inject_privileges_missing
            ),
            "file_permissions": self.check_file_permissions([
                config.BACKUPS_DIR,
                config.RECOVERIES_DIR,
                config.TEMP_DIR,
            ]),
        }

        all_passed = all(
            r["status"] == "passed"
            for r in results.values()
            if isinstance(r, dict) and "status" in r
        )
        results["overall_status"] = "passed" if all_passed else "failed"

        logger.info("=" * 60)
        logger.info(f"完整权限检查结果: {'通过' if all_passed else '失败'}")
        logger.info("=" * 60)

        return results

    def display_result(self, result: Dict[str, Any], title: str = "权限检查结果") -> None:
        status = result.get("status", result.get("overall_status", "unknown"))
        status_color = "green" if status in ["passed", "success"] else "red"

        print(colorize(f"\n{title}", "blue"))
        print(colorize(f"状态: {status}", status_color))

        if "overall_status" in result:
            print(colorize("\n各检查项结果:", "green"))
            for check_name, check_result in result.items():
                if isinstance(check_result, dict) and "status" in check_result:
                    sub_status = check_result["status"]
                    sub_color = "green" if sub_status == "passed" else "red"
                    print(f"  {check_name}: {colorize(sub_status, sub_color)}")

        if "required_permissions" in result:
            print(colorize("\n数据库权限详情:", "green"))
            perm_table = []
            all_perms = set(result["required_permissions"])
            actual = set(result.get("actual_permissions", []))

            for perm in sorted(all_perms):
                perm_table.append({
                    "权限": perm,
                    "状态": colorize("已授予", "green") if perm in actual else colorize("缺失", "red"),
                })
            print(format_table(perm_table))

        if "privileges_granted" in result or "privileges_missing" in result:
            print(colorize("\n恢复所需特权:", "green"))
            priv_table = []
            for p in result.get("privileges_granted", []):
                priv_table.append({
                    "特权": p["privilege"],
                    "描述": p["description"],
                    "状态": colorize("已授予", "green"),
                })
            for p in result.get("privileges_missing", []):
                priv_table.append({
                    "特权": p["privilege"],
                    "描述": p["description"],
                    "状态": colorize("缺失", "red"),
                })
            print(format_table(priv_table))

        if "paths" in result:
            print(colorize("\n文件路径权限:", "green"))
            file_table = []
            for p in result["paths"]:
                file_table.append({
                    "路径": p["path"],
                    "存在": "是" if p["exists"] else "否",
                    "可读": "是" if p["readable"] else "否",
                    "可写": "是" if p["writable"] else "否",
                })
            print(format_table(file_table))

        if "recommendations" in result and result["recommendations"]:
            print(colorize("\n修复建议:", "yellow"))
            for rec in result["recommendations"]:
                print(f"  • {rec}")


permission_checker = PermissionChecker()
