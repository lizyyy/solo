"""
风险检查引擎
检查温度、湿度、UPS电池、空调告警等风险
"""

import uuid
from typing import List, Dict, Any
from .storage import DataStore
from .models import Risk
from .config import (
    DEFAULT_THRESHOLD, DEFAULT_UPS_CONFIG, DEFAULT_AC_CONFIG,
    RISK_TYPES, RISK_LEVELS
)


class RiskChecker:
    """风险检查器"""

    def __init__(self, store: DataStore):
        self.store = store
        self.threshold = DEFAULT_THRESHOLD
        self.ups_config = DEFAULT_UPS_CONFIG
        self.ac_config = DEFAULT_AC_CONFIG

    def _create_risk(self, date: str, risk_type: str, source: str,
                     message: str) -> Risk:
        """创建风险记录"""
        info = RISK_TYPES.get(risk_type, {})
        return Risk(
            risk_id=f"RISK-{uuid.uuid4().hex[:8].upper()}",
            date=date,
            type=risk_type,
            code=info.get("code", "UNK001"),
            level=info.get("level", "low"),
            source=source,
            message=message,
            suggestion=info.get("suggestion", "请联系技术人员处理")
        )

    def check_temperature(self, record) -> List[Risk]:
        """检查温度"""
        risks = []
        date = record.inspection_date

        if record.temperature_unit not in self.threshold.temp_unit_allowed:
            risks.append(self._create_risk(
                date, "TEMPERATURE_UNIT_ERROR",
                f"机房:{record.room_name}",
                f"巡检人{record.inspector}记录的温度单位'{record.temperature_unit}'不正确，应为℃"
            ))

        if (record.temperature < self.threshold.temp_min or
                record.temperature > self.threshold.temp_max):
            risks.append(self._create_risk(
                date, "TEMPERATURE_EXCEED",
                f"机房:{record.room_name}",
                f"温度{record.temperature}{record.temperature_unit}超出阈值范围({self.threshold.temp_min}-{self.threshold.temp_max}℃)"
            ))

        return risks

    def check_humidity(self, record) -> List[Risk]:
        """检查湿度"""
        risks = []
        date = record.inspection_date

        if record.humidity_unit not in self.threshold.humidity_unit_allowed:
            risks.append(self._create_risk(
                date, "HUMIDITY_UNIT_ERROR",
                f"机房:{record.room_name}",
                f"巡检人{record.inspector}记录的湿度单位'{record.humidity_unit}'不正确，应为%"
            ))

        if (record.humidity < self.threshold.humidity_min or
                record.humidity > self.threshold.humidity_max):
            risks.append(self._create_risk(
                date, "HUMIDITY_EXCEED",
                f"机房:{record.room_name}",
                f"湿度{record.humidity}{record.humidity_unit}超出阈值范围({self.threshold.humidity_min}-{self.threshold.humidity_max}%)"
            ))

        return risks

    def check_ups(self, ups) -> List[Risk]:
        """检查UPS"""
        risks = []
        date = ups.inspection_date

        if ups.battery_voltage < self.ups_config.battery_voltage_min:
            risks.append(self._create_risk(
                date, "UPS_BATTERY_LOW",
                f"UPS:{ups.ups_name}",
                f"电池电压{ups.battery_voltage}V低于阈值{self.ups_config.battery_voltage_min}V"
            ))

        if ups.load_percent > self.ups_config.load_normal_max:
            risks.append(self._create_risk(
                date, "UPS_LOAD_HIGH",
                f"UPS:{ups.ups_name}",
                f"负载{ups.load_percent}%超过阈值{self.ups_config.load_normal_max}%"
            ))

        return risks

    def check_ac_alarms(self, alarms) -> List[Risk]:
        """检查空调告警"""
        risks = []

        for alarm in alarms:
            if alarm.status not in self.ac_config.alarm_handled_statuses:
                date = alarm.inspection_date
                risks.append(self._create_risk(
                    date, "AC_ALARM_UNHANDLED",
                    f"空调:{alarm.ac_name}",
                    f"告警{alarm.alarm_code}: {alarm.alarm_message}，当前状态:{alarm.status}（未处理）"
                ))

        return risks

    def check_missing_review(self, date: str, has_inspections: bool) -> List[Risk]:
        """检查是否缺少复核"""
        risks = []
        review = self.store.get_review_by_date(date)

        if has_inspections and not review:
            risks.append(self._create_risk(
                date, "MISSING_REVIEW",
                "系统",
                f"日期{date}的巡检数据已录入，但尚未完成人工复核"
            ))

        return risks

    def check_date(self, date: str) -> Dict[str, Any]:
        """检查指定日期的所有风险"""
        self.store.clear_risks_by_date(date)

        all_risks = []

        inspections = self.store.get_inspections_by_date(date)
        for rec in inspections:
            all_risks.extend(self.check_temperature(rec))
            all_risks.extend(self.check_humidity(rec))

        ups_list = self.store.get_ups_by_date(date)
        for ups in ups_list:
            all_risks.extend(self.check_ups(ups))

        alarms = self.store.get_ac_alarms_by_date(date)
        all_risks.extend(self.check_ac_alarms(alarms))

        all_risks.extend(self.check_missing_review(date, len(inspections) > 0))

        existing_ids = set()
        unique_risks = []
        for r in all_risks:
            key = (r.date, r.type, r.source, r.message)
            if key not in existing_ids:
                existing_ids.add(key)
                unique_risks.append(r)
                self.store.save_risk(r)

        grouped = {
            "high": [],
            "medium": [],
            "low": []
        }
        for r in unique_risks:
            grouped[r.level].append(r)

        return {
            "date": date,
            "total": len(unique_risks),
            "by_level": {
                "high": len(grouped["high"]),
                "medium": len(grouped["medium"]),
                "low": len(grouped["low"])
            },
            "risks": unique_risks,
            "stats": {
                "inspections": len(inspections),
                "ups": len(ups_list),
                "alarms": len(alarms)
            }
        }
