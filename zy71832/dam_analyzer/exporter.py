import os
import csv
import json
from datetime import datetime
from typing import List, Dict, Any, Optional, Callable
import pandas as pd
from .config import Config
from .models import BattleRecord, RecordStatus
from .anomaly_detector import Anomaly


class Exporter:
    def __init__(self, config: Config):
        self.config = config
        self.export_criteria = {
            "include_fields": [
                "记录ID", "回合", "阵营", "玩家ID", "行动类型", "结果",
                "伤害", "治疗", "分数变化", "目标", "备注", "状态",
                "导入来源", "导入时间", "人工修改原因"
            ],
            "sort_by": ["回合", "阵营", "玩家ID"],
            "sort_ascending": [True, True, True],
        }

    def set_export_criteria(self, **kwargs) -> None:
        if "include_fields" in kwargs:
            self.export_criteria["include_fields"] = kwargs["include_fields"]
        if "sort_by" in kwargs:
            self.export_criteria["sort_by"] = kwargs["sort_by"]
        if "sort_ascending" in kwargs:
            self.export_criteria["sort_ascending"] = kwargs["sort_ascending"]

    def filter_records(
        self,
        records: List[BattleRecord],
        round_start: Optional[int] = None,
        round_end: Optional[int] = None,
        teams: Optional[List[str]] = None,
        players: Optional[List[str]] = None,
        statuses: Optional[List[RecordStatus]] = None,
        action_types: Optional[List[str]] = None,
        custom_filter: Optional[Callable[[BattleRecord], bool]] = None,
    ) -> List[BattleRecord]:
        filtered = records

        if round_start is not None:
            filtered = [r for r in filtered if r.round_num >= round_start]
        if round_end is not None:
            filtered = [r for r in filtered if r.round_num <= round_end]
        if teams:
            filtered = [r for r in filtered if r.team in teams]
        if players:
            filtered = [r for r in filtered if r.player_id in players]
        if statuses:
            filtered = [r for r in filtered if r.status in statuses]
        if action_types:
            filtered = [r for r in filtered if any(at in r.action_type for at in action_types)]
        if custom_filter:
            filtered = [r for r in filtered if custom_filter(r)]

        return filtered

    def _apply_export_format(self, records: List[BattleRecord]) -> List[Dict[str, Any]]:
        df_data = [r.to_dict() for r in records]

        if df_data:
            df = pd.DataFrame(df_data)
            sort_fields = []
            sort_ascending = []

            for field, ascending in zip(
                self.export_criteria["sort_by"], self.export_criteria["sort_ascending"]
            ):
                if field in df.columns:
                    sort_fields.append(field)
                    sort_ascending.append(ascending)

            if sort_fields:
                df = df.sort_values(by=sort_fields, ascending=sort_ascending)

            include_fields = [f for f in self.export_criteria["include_fields"] if f in df.columns]
            if include_fields:
                df = df[include_fields]

            return df.to_dict("records")

        return []

    def export_to_excel(
        self,
        records: List[BattleRecord],
        filename: Optional[str] = None,
        anomalies: Optional[List[Anomaly]] = None,
        sheet_name: str = "战斗记录",
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime(self.config.timestamp_format)
            filename = f"battle_records_{timestamp}.xlsx"

        filepath = os.path.join(self.config.output_dir, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        formatted_data = self._apply_export_format(records)

        with pd.ExcelWriter(filepath, engine="openpyxl") as writer:
            pd.DataFrame(formatted_data).to_excel(writer, sheet_name=sheet_name, index=False)

            if anomalies:
                anomaly_data = [a.to_dict() for a in anomalies]
                pd.DataFrame(anomaly_data).to_excel(writer, sheet_name="异常记录", index=False)

            summary_data = self._generate_summary(records)
            pd.DataFrame([summary_data]).T.to_excel(writer, sheet_name="导出摘要", header=False)

        return filepath

    def export_to_csv(
        self,
        records: List[BattleRecord],
        filename: Optional[str] = None,
        anomalies: Optional[List[Anomaly]] = None,
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime(self.config.timestamp_format)
            filename = f"battle_records_{timestamp}.csv"

        filepath = os.path.join(self.config.output_dir, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        formatted_data = self._apply_export_format(records)

        with open(filepath, "w", encoding="utf-8-sig", newline="") as f:
            if formatted_data:
                writer = csv.DictWriter(f, fieldnames=formatted_data[0].keys())
                writer.writeheader()
                writer.writerows(formatted_data)

        return filepath

    def export_to_json(
        self,
        records: List[BattleRecord],
        filename: Optional[str] = None,
        anomalies: Optional[List[Anomaly]] = None,
    ) -> str:
        if filename is None:
            timestamp = datetime.now().strftime(self.config.timestamp_format)
            filename = f"battle_records_{timestamp}.json"

        filepath = os.path.join(self.config.output_dir, filename)
        os.makedirs(os.path.dirname(filepath), exist_ok=True)

        formatted_data = self._apply_export_format(records)
        export_data = {
            "export_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "export_criteria": self.export_criteria,
            "record_count": len(records),
            "records": formatted_data,
        }

        if anomalies:
            export_data["anomalies"] = [a.to_dict() for a in anomalies]

        with open(filepath, "w", encoding="utf-8") as f:
            json.dump(export_data, f, ensure_ascii=False, indent=2)

        return filepath

    def _generate_summary(self, records: List[BattleRecord]) -> Dict[str, Any]:
        summary = {
            "导出时间": datetime.now().strftime("%Y-%m-%d %H:%M:%S"),
            "记录总数": len(records),
            "回合范围": f"{min(r.round_num for r in records)}-{max(r.round_num for r in records)}" if records else "无",
            "进攻方记录数": len([r for r in records if r.team == "进攻方"]),
            "防守方记录数": len([r for r in records if r.team == "防守方"]),
            "已确认记录数": len([r for r in records if r.status == RecordStatus.CONFIRMED]),
            "待补记录数": len([r for r in records if r.status == RecordStatus.PENDING]),
            "人工修改记录数": len([r for r in records if r.status == RecordStatus.MANUAL_MODIFIED]),
            "总伤害": sum(r.damage or 0 for r in records),
            "总治疗": sum(r.healing or 0 for r in records),
            "导出排序规则": " > ".join(self.export_criteria["sort_by"]),
            "导出字段数": len(self.export_criteria["include_fields"]),
        }
        return summary

    def export_consistency_check(self, records: List[BattleRecord]) -> Dict[str, Any]:
        check_result = {
            "is_consistent": True,
            "issues": [],
            "stats": {},
        }

        round_numbers = {r.round_num for r in records}
        if not round_numbers:
            check_result["is_consistent"] = False
            check_result["issues"].append("无有效记录")
            return check_result

        min_round, max_round = min(round_numbers), max(round_numbers)
        missing_rounds = [r for r in range(min_round, max_round + 1) if r not in round_numbers]
        if missing_rounds:
            check_result["is_consistent"] = False
            check_result["issues"].append(f"缺失回合: {missing_rounds}")

        for round_num in range(min_round, max_round + 1):
            round_records = [r for r in records if r.round_num == round_num]
            teams = {r.team for r in round_records}

            if "进攻方" not in teams:
                check_result["issues"].append(f"第{round_num}回合无进攻方记录")
            if "防守方" not in teams:
                check_result["issues"].append(f"第{round_num}回合无防守方记录")

        pending_count = len([r for r in records if r.status == RecordStatus.PENDING])
        if pending_count > 0:
            check_result["issues"].append(f"存在{pending_count}条待补记录")

        check_result["stats"] = {
            "总记录数": len(records),
            "回合范围": f"{min_round}-{max_round}",
            "缺失回合数": len(missing_rounds),
            "待补记录数": pending_count,
            "人工修改数": len([r for r in records if r.status == RecordStatus.MANUAL_MODIFIED]),
            "涉及阵营数": len({r.team for r in records}),
            "涉及玩家数": len({r.player_id for r in records}),
        }

        return check_result
