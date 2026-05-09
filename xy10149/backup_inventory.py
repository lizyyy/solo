import os
from datetime import datetime
from typing import Any, Dict, List, Optional

from config import config
from utils import format_table, logger, load_json, save_json, get_timestamp, colorize


class BackupInventory:
    def __init__(self):
        config.ensure_dirs()
        self.inventory_file = os.path.join(config.BACKUPS_DIR, "inventory.json")
        self.inventory = self._load_inventory()

    def _load_inventory(self) -> List[Dict[str, Any]]:
        return load_json(self.inventory_file, default=[])

    def _save_inventory(self) -> None:
        save_json(self.inventory_file, self.inventory)

    def add_backup(
        self,
        backup_id: str,
        backup_path: str,
        backup_type: str = "full",
        status: str = "success",
        tables: Optional[List[str]] = None,
        size_bytes: int = 0,
        metadata: Optional[Dict[str, Any]] = None,
    ) -> Dict[str, Any]:
        backup_info = {
            "backup_id": backup_id,
            "timestamp": get_timestamp(),
            "datetime": datetime.now().isoformat(),
            "backup_type": backup_type,
            "status": status,
            "backup_path": backup_path,
            "tables": tables or [],
            "table_count": len(tables or []),
            "size_bytes": size_bytes,
            "size_mb": round(size_bytes / 1024 / 1024, 2),
            "metadata": metadata or {},
            "drill_runs": [],
            "last_drill_status": None,
            "last_drill_time": None,
        }
        self.inventory.insert(0, backup_info)
        self._save_inventory()
        logger.info(f"已添加备份记录: {backup_id}")
        return backup_info

    def update_backup(
        self,
        backup_id: str,
        updates: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        for item in self.inventory:
            if item["backup_id"] == backup_id:
                item.update(updates)
                self._save_inventory()
                logger.info(f"已更新备份记录: {backup_id}")
                return item
        return None

    def add_drill_result(
        self,
        backup_id: str,
        drill_result: Dict[str, Any],
    ) -> Optional[Dict[str, Any]]:
        for item in self.inventory:
            if item["backup_id"] == backup_id:
                item["drill_runs"].append(drill_result)
                item["last_drill_status"] = drill_result.get("overall_status")
                item["last_drill_time"] = drill_result.get("start_time")
                self._save_inventory()
                logger.info(f"已为备份 {backup_id} 添加演练结果")
                return item
        return None

    def get_backup(self, backup_id: str) -> Optional[Dict[str, Any]]:
        for item in self.inventory:
            if item["backup_id"] == backup_id:
                return item
        return None

    def list_backups(
        self,
        status_filter: Optional[str] = None,
        drill_status_filter: Optional[str] = None,
        limit: Optional[int] = None,
    ) -> List[Dict[str, Any]]:
        result = self.inventory
        if status_filter:
            result = [b for b in result if b["status"] == status_filter]
        if drill_status_filter:
            result = [
                b
                for b in result
                if b.get("last_drill_status") == drill_status_filter
            ]
        if limit:
            result = result[:limit]
        return result

    def display_list(self, backups: Optional[List[Dict[str, Any]]] = None) -> None:
        if backups is None:
            backups = self.inventory

        if not backups:
            print(colorize("没有备份记录", "yellow"))
            return

        table_data = []
        for b in backups:
            drill_status = b.get("last_drill_status", "未演练")
            drill_color = "green" if drill_status == "success" else ("red" if drill_status == "failed" else "yellow")
            table_data.append({
                "备份ID": b["backup_id"][:20],
                "时间": b["timestamp"],
                "类型": b["backup_type"],
                "状态": b["status"],
                "表数量": str(b["table_count"]),
                "大小": f"{b['size_mb']} MB",
                "演练状态": colorize(drill_status, drill_color),
            })
        print(format_table(table_data))

    def display_detail(self, backup_id: str) -> None:
        backup = self.get_backup(backup_id)
        if not backup:
            print(colorize(f"未找到备份: {backup_id}", "red"))
            return

        print(colorize(f"\n备份详情: {backup_id}", "blue"))
        print(colorize("基本信息", "green"))
        basic_info = [
            {"项": "备份ID", "值": backup["backup_id"]},
            {"项": "时间戳", "值": backup["timestamp"]},
            {"项": "类型", "值": backup["backup_type"]},
            {"项": "状态", "值": backup["status"]},
            {"项": "路径", "值": backup["backup_path"]},
            {"项": "表数量", "值": str(backup["table_count"])},
            {"项": "大小", "值": f"{backup['size_mb']} MB"},
        ]
        print(format_table(basic_info))

        if backup["tables"]:
            print(colorize("\n表列表", "green"))
            table_rows = [
                {"序号": i + 1, "表名": t}
                for i, t in enumerate(backup["tables"])
            ]
            print(format_table(table_rows))

        if backup["drill_runs"]:
            print(colorize("\n演练历史", "green"))
            drill_rows = []
            for i, d in enumerate(backup["drill_runs"]):
                status = d.get("overall_status", "unknown")
                status_color = "green" if status == "success" else "red"
                drill_rows.append({
                    "序号": i + 1,
                    "时间": d.get("start_time", ""),
                    "结果": colorize(status, status_color),
                    "缺表数": len(d.get("missing_tables", [])),
                    "权限缺失数": len(d.get("missing_permissions", [])),
                    "校验失败数": len(d.get("validation_failures", [])),
                })
            print(format_table(drill_rows))

    def export_inventory(self, output_path: str) -> str:
        save_json(output_path, self.inventory)
        print(colorize(f"已导出清单到: {output_path}", "green"))
        return output_path


inventory = BackupInventory()
