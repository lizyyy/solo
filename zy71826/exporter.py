import csv
import json
import uuid
import hashlib
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from pathlib import Path
from collections import defaultdict

from models import DispatchRecord, RecordStatus
from dispatcher import UndergroundDispatcher


class DataExporter:
    def __init__(self, dispatcher: UndergroundDispatcher, export_path: str = "./exports"):
        self.dispatcher = dispatcher
        self.export_path = Path(export_path)
        self.export_path.mkdir(parents=True, exist_ok=True)
        self.export_log_file = self.export_path / "export_log.json"
        self.export_history: List[Dict[str, Any]] = self._load_export_history()

    def _load_export_history(self) -> List[Dict[str, Any]]:
        if self.export_log_file.exists():
            with open(self.export_log_file, 'r', encoding='utf-8') as f:
                return json.load(f)
        return []

    def _save_export_history(self):
        with open(self.export_log_file, 'w', encoding='utf-8') as f:
            json.dump(self.export_history, f, ensure_ascii=False, indent=2, default=str)

    def _generate_export_batch_id(self) -> str:
        return f"EXPORT_{datetime.now().strftime('%Y%m%d_%H%M%S')}_{uuid.uuid4().hex[:6]}"

    def _calc_export_checksum(self, records: List[DispatchRecord]) -> str:
        record_ids = sorted([r.record_id for r in records])
        content = "|".join(record_ids) + f"|{len(records)}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()

    def _check_duplicate_export(self, activity_id: str, checksum: str) -> Optional[Dict[str, Any]]:
        for entry in self.export_history:
            if entry.get("activity_id") == activity_id and entry.get("checksum") == checksum:
                return entry
        return None

    def get_exportable_records(self, activity_id: Optional[str] = None,
                               status_filter: Optional[List[RecordStatus]] = None,
                               include_duplicates: bool = False) -> List[DispatchRecord]:
        if activity_id:
            records = self.dispatcher.get_records_by_activity(activity_id)
        else:
            records = list(self.dispatcher.records.values())

        if status_filter:
            records = [r for r in records if r.current_status in status_filter]

        if not include_duplicates:
            records = [r for r in records if r.current_status != RecordStatus.DUPLICATE]

        return sorted(records, key=lambda r: r.player_record.completion_time)

    def prepare_export_data(self, records: List[DispatchRecord]) -> Tuple[List[Dict[str, Any]], Dict[str, Any]]:
        export_rows = []
        summary = defaultdict(int)
        summary['total_records'] = len(records)
        summary['total_reward'] = 0.0

        for record in records:
            pr = record.player_record
            has_anomalies = len([a for a in record.anomalies if not a.resolved]) > 0
            anomaly_types = "; ".join([a.anomaly_type.value for a in record.anomalies]) if record.anomalies else ""
            correction_count = len(record.manual_corrections)

            row = {
                "记录ID": record.record_id,
                "玩家ID": pr.player_id,
                "活动ID": pr.activity_id,
                "任务ID": pr.task_id,
                "完成时间": pr.completion_time.strftime("%Y-%m-%d %H:%M:%S"),
                "奖励金额": pr.reward_amount,
                "当前状态": record.current_status.value,
                "数据来源": pr.source,
                "是否有未解决异常": "是" if has_anomalies else "否",
                "异常类型": anomaly_types,
                "人工更正次数": correction_count,
                "处理时间": record.processed_at.strftime("%Y-%m-%d %H:%M:%S") if record.processed_at else "",
                "批次ID": record.batch_id or "",
                "导出批次": "",
                "备注": ""
            }
            export_rows.append(row)
            summary[record.current_status.value] += 1
            summary['total_reward'] += pr.reward_amount
            if correction_count > 0:
                summary['with_corrections'] += 1
            if has_anomalies:
                summary['with_anomalies'] += 1

        summary['total_reward'] = round(summary['total_reward'], 2)
        return export_rows, dict(summary)

    def export_to_csv(self, activity_id: Optional[str] = None,
                      status_filter: Optional[List[RecordStatus]] = None,
                      include_duplicates: bool = False,
                      operator: str = "system",
                      force: bool = False) -> Dict[str, Any]:
        records = self.get_exportable_records(activity_id, status_filter, include_duplicates)

        if not records:
            return {
                "success": False,
                "message": "没有可导出的记录",
                "exported_count": 0
            }

        checksum = self._calc_export_checksum(records)
        existing_export = self._check_duplicate_export(activity_id or "ALL", checksum)

        if existing_export and not force:
            return {
                "success": False,
                "duplicate": True,
                "message": f"检测到相同内容已导出过，导出批次: {existing_export['export_batch_id']}",
                "existing_export": existing_export,
                "exported_count": 0
            }

        export_batch_id = self._generate_export_batch_id()
        export_rows, summary = self.prepare_export_data(records)

        for row in export_rows:
            row["导出批次"] = export_batch_id

        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        activity_suffix = f"_{activity_id}" if activity_id else "_all"
        filename = f"reward_export{activity_suffix}_{timestamp}.csv"
        filepath = self.export_path / filename

        fieldnames = list(export_rows[0].keys())
        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=fieldnames)
            writer.writeheader()
            writer.writerows(export_rows)

        for record in records:
            record.exported = True
            record.exported_at = datetime.now()
            record.export_batch_id = export_batch_id
            if record.current_status in [RecordStatus.REWARD_READY, RecordStatus.MANUAL_CORRECTED]:
                record.transition_status(RecordStatus.EXPORTED, operator, "已导出待复盘")

        self.dispatcher._save_records()

        log_entry = {
            "export_batch_id": export_batch_id,
            "activity_id": activity_id or "ALL",
            "filename": filename,
            "filepath": str(filepath),
            "checksum": checksum,
            "operator": operator,
            "exported_at": datetime.now().isoformat(),
            "record_count": len(records),
            "summary": summary,
            "record_ids": [r.record_id for r in records],
            "force_export": force
        }
        self.export_history.append(log_entry)
        self._save_export_history()

        return {
            "success": True,
            "duplicate": False,
            "export_batch_id": export_batch_id,
            "filename": filename,
            "filepath": str(filepath),
            "exported_count": len(records),
            "summary": summary,
            "message": f"成功导出 {len(records)} 条记录"
        }

    def export_summary_to_csv(self, activity_id: Optional[str] = None) -> Dict[str, Any]:
        stats = self.dispatcher.get_statistics()

        export_batch_id = self._generate_export_batch_id()
        timestamp = datetime.now().strftime("%Y%m%d_%H%M%S")
        activity_suffix = f"_{activity_id}" if activity_id else "_all"
        filename = f"export_summary{activity_suffix}_{timestamp}.csv"
        filepath = self.export_path / filename

        rows = []
        rows.append({"统计项": "总记录数", "数量": stats.get('total', 0)})
        for status in RecordStatus:
            rows.append({"统计项": f"状态: {status.value}", "数量": stats.get(status.value, 0)})
        rows.append({"统计项": "异常总数", "数量": stats.get('anomalies_total', 0)})
        rows.append({"统计项": "未解决异常数", "数量": stats.get('anomalies_unresolved', 0)})

        if activity_id:
            activity_records = self.dispatcher.get_records_by_activity(activity_id)
            activity_stats = defaultdict(int)
            for r in activity_records:
                activity_stats[r.current_status.value] += 1
            activity_stats['total'] = len(activity_records)
            rows.append({})
            rows.append({"统计项": f"===== 活动 {activity_id} 明细 =====", "数量": ""})
            rows.append({"统计项": "活动总记录数", "数量": activity_stats['total']})
            for status in RecordStatus:
                rows.append({"统计项": f"  状态: {status.value}", "数量": activity_stats.get(status.value, 0)})

        with open(filepath, 'w', newline='', encoding='utf-8-sig') as f:
            writer = csv.DictWriter(f, fieldnames=["统计项", "数量"])
            writer.writeheader()
            writer.writerows(rows)

        return {
            "success": True,
            "export_batch_id": export_batch_id,
            "filename": filename,
            "filepath": str(filepath),
            "stats": stats
        }

    def verify_export_consistency(self, export_batch_id: str) -> Dict[str, Any]:
        export_entry = None
        for entry in self.export_history:
            if entry.get("export_batch_id") == export_batch_id:
                export_entry = entry
                break

        if not export_entry:
            return {
                "success": False,
                "message": f"未找到导出批次 {export_batch_id}",
                "consistent": False
            }

        record_ids = export_entry.get("record_ids", [])
        current_records = []
        missing_records = []
        modified_records = []

        for rid in record_ids:
            record = self.dispatcher.get_record(rid)
            if not record:
                missing_records.append(rid)
                continue
            current_records.append(record)

        current_checksum = self._calc_export_checksum(current_records)
        checksum_match = current_checksum == export_entry.get("checksum")

        for rid in record_ids:
            record = self.dispatcher.get_record(rid)
            if record:
                if record.export_batch_id != export_batch_id:
                    modified_records.append({
                        "record_id": rid,
                        "current_export_batch": record.export_batch_id,
                        "expected": export_batch_id
                    })

        export_rows, summary = self.prepare_export_data(current_records)
        exported_summary = export_entry.get("summary", {})

        summary_match = (summary.get('total_records') == exported_summary.get('total_records') and
                         abs(summary.get('total_reward', 0) - exported_summary.get('total_reward', 0)) < 0.01)

        consistent = (checksum_match and not missing_records and
                      not modified_records and summary_match)

        return {
            "success": True,
            "consistent": consistent,
            "checksum_match": checksum_match,
            "exported_checksum": export_entry.get("checksum"),
            "current_checksum": current_checksum,
            "missing_records": missing_records,
            "modified_records": modified_records,
            "summary_match": summary_match,
            "exported_summary": exported_summary,
            "current_summary": summary,
            "message": "数据一致" if consistent else "检测到数据不一致",
            "export_entry": export_entry
        }

    def get_export_history(self, activity_id: Optional[str] = None) -> List[Dict[str, Any]]:
        if activity_id:
            return [e for e in self.export_history if e.get("activity_id") == activity_id]
        return self.export_history

    def review_before_export(self, activity_id: Optional[str] = None) -> Dict[str, Any]:
        records = self.get_exportable_records(activity_id)
        export_rows, summary = self.prepare_export_data(records)

        issues = []
        for record in records:
            unresolved = [a for a in record.anomalies if not a.resolved]
            if unresolved:
                issues.append({
                    "record_id": record.record_id,
                    "player_id": record.player_record.player_id,
                    "issue": f"存在 {len(unresolved)} 个未解决异常",
                    "anomalies": [a.anomaly_type.value for a in unresolved]
                })

        return {
            "preview_count": len(records),
            "preview_summary": summary,
            "issues": issues,
            "issue_count": len(issues),
            "can_export": len(issues) == 0,
            "recommendation": "可以安全导出" if len(issues) == 0 else f"存在 {len(issues)} 条记录有未解决异常，请先处理"
        }
