"""
数据导入模块
支持CSV格式的数据导入
"""

import csv
from datetime import datetime
from typing import List, Dict, Any
from .models import InspectionRecord, UPSStatus, ACAlarm
from .storage import DataStore


class DataImporter:
    """数据导入器"""

    def __init__(self, store: DataStore):
        self.store = store

    def _parse_float(self, value: str) -> float:
        """解析浮点数值"""
        if not value:
            return 0.0
        cleaned = value.strip().replace(',', '')
        try:
            return float(cleaned)
        except ValueError:
            return 0.0

    def import_inspections(self, file_path: str) -> Dict[str, Any]:
        """导入巡检数据"""
        results = {
            "total": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
            "records": []
        }

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    record = InspectionRecord(
                        inspection_time=row["巡检时间"].strip(),
                        room_id=row["机房ID"].strip(),
                        room_name=row["机房名称"].strip(),
                        inspector=row["巡检人"].strip(),
                        temperature=self._parse_float(row["温度"]),
                        temperature_unit=row.get("温度单位", "℃").strip(),
                        humidity=self._parse_float(row["湿度"]),
                        humidity_unit=row.get("湿度单位", "%").strip(),
                        remarks=row.get("备注", "").strip()
                    )
                    result = self.store.save_inspection(record)
                    if result["action"] == "created":
                        results["created"] += 1
                    else:
                        results["updated"] += 1
                    results["records"].append(result)
                except Exception as e:
                    results["errors"] += 1
                    results["records"].append({
                        "action": "error",
                        "error": str(e),
                        "row": row
                    })

        return results

    def import_ups_status(self, file_path: str) -> Dict[str, Any]:
        """导入UPS状态"""
        results = {
            "total": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
            "records": []
        }

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    status = UPSStatus(
                        ups_id=row["UPSID"].strip(),
                        ups_name=row["UPS名称"].strip(),
                        inspection_time=row["巡检时间"].strip(),
                        battery_voltage=self._parse_float(row["电池电压"]),
                        load_percent=self._parse_float(row["负载百分比"]),
                        status=row["状态"].strip(),
                        remarks=row.get("备注", "").strip()
                    )
                    result = self.store.save_ups_status(status)
                    if result["action"] == "created":
                        results["created"] += 1
                    else:
                        results["updated"] += 1
                    results["records"].append(result)
                except Exception as e:
                    results["errors"] += 1
                    results["records"].append({
                        "action": "error",
                        "error": str(e),
                        "row": row
                    })

        return results

    def import_ac_alarms(self, file_path: str) -> Dict[str, Any]:
        """导入空调告警"""
        results = {
            "total": 0,
            "created": 0,
            "updated": 0,
            "errors": 0,
            "records": []
        }

        with open(file_path, 'r', encoding='utf-8-sig') as f:
            reader = csv.DictReader(f)
            for row in reader:
                results["total"] += 1
                try:
                    alarm = ACAlarm(
                        ac_id=row["空调ID"].strip(),
                        ac_name=row["空调名称"].strip(),
                        alarm_time=row["告警时间"].strip(),
                        alarm_code=row["告警代码"].strip(),
                        alarm_message=row["告警信息"].strip(),
                        status=row["处理状态"].strip(),
                        handled_by=row.get("处理人", "").strip(),
                        handled_time=row.get("处理时间", "").strip(),
                        resolution=row.get("处理结果", "").strip()
                    )
                    result = self.store.save_ac_alarm(alarm)
                    if result["action"] == "created":
                        results["created"] += 1
                    else:
                        results["updated"] += 1
                    results["records"].append(result)
                except Exception as e:
                    results["errors"] += 1
                    results["records"].append({
                        "action": "error",
                        "error": str(e),
                        "row": row
                    })

        return results

    def get_merge_info(self, date: str) -> Dict[str, Any]:
        """获取补录数据的合并信息"""
        inspections = self.store.get_inspections_by_date(date)
        ups_list = self.store.get_ups_by_date(date)
        ac_alarms = self.store.get_ac_alarms_by_date(date)

        def can_edit(r):
            return datetime.now().isoformat() < r.created_at[:10] + "T23:59:59"

        return {
            "date": date,
            "inspections": {
                "count": len(inspections),
                "can_correct": [r.inspection_time for r in inspections if can_edit(r)],
                "must_reject": [r.inspection_time for r in inspections if not can_edit(r)]
            },
            "ups": {
                "count": len(ups_list),
                "can_correct": [r.inspection_time for r in ups_list if can_edit(r)],
                "must_reject": [r.inspection_time for r in ups_list if not can_edit(r)]
            },
            "ac_alarms": {
                "count": len(ac_alarms)
            }
        }
