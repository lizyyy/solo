"""
数据存储模块
负责数据的持久化和查询
"""

import json
import os
from datetime import datetime
from typing import Dict, List, Optional, Any
from .models import (
    InspectionRecord, UPSStatus, ACAlarm, Risk, ReviewRecord
)


class DataStore:
    """数据存储类"""

    def __init__(self, data_dir: str = "./data"):
        self.data_dir = data_dir
        self.files = {
            "inspections": os.path.join(data_dir, "inspections.json"),
            "ups": os.path.join(data_dir, "ups_status.json"),
            "ac_alarms": os.path.join(data_dir, "ac_alarms.json"),
            "risks": os.path.join(data_dir, "risks.json"),
            "reviews": os.path.join(data_dir, "reviews.json")
        }
        self._init_storage()

    def _init_storage(self):
        """初始化存储目录和文件"""
        if not os.path.exists(self.data_dir):
            os.makedirs(self.data_dir)

        for file_path in self.files.values():
            if not os.path.exists(file_path):
                with open(file_path, 'w', encoding='utf-8') as f:
                    json.dump([], f, ensure_ascii=False, indent=2)

    def _load(self, name: str) -> List[Dict]:
        """加载数据"""
        with open(self.files[name], 'r', encoding='utf-8') as f:
            return json.load(f)

    def _save(self, name: str, data: List[Dict]):
        """保存数据"""
        with open(self.files[name], 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def save_inspection(self, record: InspectionRecord) -> Dict[str, Any]:
        """保存巡检记录，重复时间则更新"""
        data = self._load("inspections")
        key = (record.inspection_time, record.room_id)

        for i, existing in enumerate(data):
            if (existing["inspection_time"] == record.inspection_time and
                    existing["room_id"] == record.room_id):
                old_data = existing.copy()
                record.updated_at = datetime.now().isoformat()
                record.created_at = existing["created_at"]
                data[i] = record.to_dict()
                self._save("inspections", data)
                return {
                    "action": "updated",
                    "old": old_data,
                    "new": record.to_dict(),
                    "key": key
                }

        data.append(record.to_dict())
        self._save("inspections", data)
        return {
            "action": "created",
            "old": None,
            "new": record.to_dict(),
            "key": key
        }

    def save_ups_status(self, status: UPSStatus) -> Dict[str, Any]:
        """保存UPS状态，重复时间则更新"""
        data = self._load("ups")
        key = (status.inspection_time, status.ups_id)

        for i, existing in enumerate(data):
            if (existing["inspection_time"] == status.inspection_time and
                    existing["ups_id"] == status.ups_id):
                old_data = existing.copy()
                status.updated_at = datetime.now().isoformat()
                status.created_at = existing["created_at"]
                data[i] = status.to_dict()
                self._save("ups", data)
                return {
                    "action": "updated",
                    "old": old_data,
                    "new": status.to_dict(),
                    "key": key
                }

        data.append(status.to_dict())
        self._save("ups", data)
        return {
            "action": "created",
            "old": None,
            "new": status.to_dict(),
            "key": key
        }

    def save_ac_alarm(self, alarm: ACAlarm) -> Dict[str, Any]:
        """保存空调告警"""
        data = self._load("ac_alarms")
        key = (alarm.alarm_time, alarm.ac_id, alarm.alarm_code)

        for i, existing in enumerate(data):
            if (existing["alarm_time"] == alarm.alarm_time and
                    existing["ac_id"] == alarm.ac_id and
                    existing["alarm_code"] == alarm.alarm_code):
                old_data = existing.copy()
                alarm.updated_at = datetime.now().isoformat()
                alarm.created_at = existing["created_at"]
                data[i] = alarm.to_dict()
                self._save("ac_alarms", data)
                return {
                    "action": "updated",
                    "old": old_data,
                    "new": alarm.to_dict(),
                    "key": key
                }

        data.append(alarm.to_dict())
        self._save("ac_alarms", data)
        return {
            "action": "created",
            "old": None,
            "new": alarm.to_dict(),
            "key": key
        }

    def save_risk(self, risk: Risk):
        """保存风险记录"""
        data = self._load("risks")
        for i, existing in enumerate(data):
            if existing["risk_id"] == risk.risk_id:
                data[i] = risk.to_dict()
                self._save("risks", data)
                return
        data.append(risk.to_dict())
        self._save("risks", data)

    def save_review(self, review: ReviewRecord):
        """保存复核记录"""
        data = self._load("reviews")
        for i, existing in enumerate(data):
            if existing["date"] == review.date:
                data[i] = review.to_dict()
                self._save("reviews", data)
                return
        data.append(review.to_dict())
        self._save("reviews", data)

    def get_inspections_by_date(self, date: str) -> List[InspectionRecord]:
        """按日期获取巡检记录"""
        data = self._load("inspections")
        return [
            InspectionRecord.from_dict(r)
            for r in data if r.get("inspection_time", "").startswith(date)
        ]

    def get_ups_by_date(self, date: str) -> List[UPSStatus]:
        """按日期获取UPS状态"""
        data = self._load("ups")
        return [
            UPSStatus.from_dict(r)
            for r in data if r.get("inspection_time", "").startswith(date)
        ]

    def get_ac_alarms_by_date(self, date: str) -> List[ACAlarm]:
        """按日期获取空调告警"""
        data = self._load("ac_alarms")
        return [
            ACAlarm.from_dict(r)
            for r in data if r.get("alarm_time", "").startswith(date)
        ]

    def get_risks_by_date(self, date: str) -> List[Risk]:
        """按日期获取风险"""
        data = self._load("risks")
        return [Risk.from_dict(r) for r in data if r.get("date") == date]

    def get_review_by_date(self, date: str) -> Optional[ReviewRecord]:
        """按日期获取复核记录"""
        data = self._load("reviews")
        for r in data:
            if r.get("date") == date:
                return ReviewRecord.from_dict(r)
        return None

    def get_all_inspections(self) -> List[InspectionRecord]:
        """获取所有巡检记录"""
        data = self._load("inspections")
        return [InspectionRecord.from_dict(r) for r in data]

    def get_all_ups_status(self) -> List[UPSStatus]:
        """获取所有UPS状态"""
        data = self._load("ups")
        return [UPSStatus.from_dict(r) for r in data]

    def get_all_ac_alarms(self) -> List[ACAlarm]:
        """获取所有空调告警"""
        data = self._load("ac_alarms")
        return [ACAlarm.from_dict(r) for r in data]

    def get_all_risks(self, status: Optional[str] = None) -> List[Risk]:
        """获取所有风险"""
        data = self._load("risks")
        risks = [Risk.from_dict(r) for r in data]
        if status:
            risks = [r for r in risks if r.status == status]
        return risks

    def get_risk_by_id(self, risk_id: str) -> Optional[Risk]:
        """按ID获取风险"""
        data = self._load("risks")
        for r in data:
            if r.get("risk_id") == risk_id:
                return Risk.from_dict(r)
        return None

    def clear_risks_by_date(self, date: str):
        """清除指定日期的风险（用于重新检查）"""
        data = self._load("risks")
        data = [r for r in data if r.get("date") != date]
        self._save("risks", data)
