import csv
import io
import json
import uuid
from datetime import datetime
from typing import List, Optional, Tuple, Dict, Any

from models import (
    PredictionRecord, RecordStatus, RecordSource, STATUS_LABEL_CN,
    ParameterVersion, HandCalculation, ConflictEvidence, ProcessingLog,
    StatusChange, ReviewInfo, ExportRecord
)


class RecordProcessor:
    def __init__(self):
        self.records: List[PredictionRecord] = []
        self.parameter_versions: List[ParameterVersion] = []
        self.hand_calculations: List[HandCalculation] = []
        self.conflicts: List[ConflictEvidence] = []
        self.logs: List[ProcessingLog] = []
        self._next_record_id = 1
        self._snapshot_stack: List[Dict] = []

    def _log_action(self, record_id: int, action: str, operator: str, details: Dict = None):
        log = ProcessingLog(
            log_id=str(uuid.uuid4())[:8],
            record_id=record_id,
            action=action,
            operator=operator,
            details=details or {}
        )
        self.logs.append(log)

    def _change_status(self, record: PredictionRecord, to_status: RecordStatus,
                       operator: str, reason: str,
                       original_value: float = None, new_value: float = None,
                       next_handler: str = None):
        from_status = record.status.value
        change = StatusChange(
            from_status=from_status,
            to_status=to_status.value,
            operator=operator,
            reason=reason,
            original_value=original_value,
            new_value=new_value,
            next_handler=next_handler
        )
        record.record_status_change(change)
        record.status = to_status
        self._log_action(
            record.record_id,
            f"STATUS_{from_status.upper()}_TO_{to_status.value.upper()}",
            operator,
            {"reason": reason, "next_handler": next_handler or ""}
        )

    def _find_record(self, record_id: int) -> Optional[PredictionRecord]:
        for r in self.records:
            if r.record_id == record_id:
                return r
        return None

    def detect_id_gaps(self) -> List[Tuple[int, int]]:
        if not self.records:
            return []
        record_ids = sorted(r.record_id for r in self.records)
        gaps = []
        for i in range(len(record_ids) - 1):
            expected = record_ids[i] + 1
            actual = record_ids[i + 1]
            if actual != expected:
                gaps.append((record_ids[i], actual))
        return gaps

    def mark_gap_records(self, operator: str = "system"):
        gaps = self.detect_id_gaps()
        for gap_start, gap_end in gaps:
            record = self._find_record(gap_end)
            if record and record.status not in (RecordStatus.CONFIRMED, RecordStatus.REJECTED):
                gap_info = {"gap_start": gap_start, "gap_end": gap_end,
                            "detected_by": operator, "detected_at": datetime.now().isoformat()}
                record.gap_info = gap_info
                original_pred = record.predicted_foot_traffic
                record.original_predicted = record.original_predicted or original_pred
                record.original_lambda = record.original_lambda or record.poisson_lambda
                self._change_status(
                    record,
                    RecordStatus.GAP_DETECTED,
                    operator,
                    f"编号断档检测: 前一编号{gap_start}，当前编号{gap_end}，人工删除导致不连续",
                    original_value=original_pred,
                    next_handler="教研组张老师"
                )
                record.notes = (f"编号断档检测: 前一编号 {gap_start}, 当前编号 {gap_end}。"
                                f"下一步：转交教研组复核，不提前归正常")

    def import_parameter_sheet(self, records_data: List[Dict], operator: str) -> List[PredictionRecord]:
        imported_records = []
        for data in records_data:
            orig_pred = data["predicted_foot_traffic"]
            orig_lambda = data.get("poisson_lambda", 0.0)
            record = PredictionRecord(
                record_id=self._next_record_id,
                date=data["date"],
                store_id=data["store_id"],
                predicted_foot_traffic=orig_pred,
                poisson_lambda=orig_lambda,
                status=RecordStatus.NORMAL,
                source=RecordSource.IMPORT,
                version=self._get_latest_version(),
                original_predicted=orig_pred,
                original_lambda=orig_lambda
            )
            self.records.append(record)
            imported_records.append(record)
            self._next_record_id += 1
            self._log_action(
                record.record_id,
                "IMPORT",
                operator,
                {"source": "parameter_sheet",
                 "original_predicted": orig_pred,
                 "original_lambda": orig_lambda}
            )
        self.mark_gap_records(operator)
        return imported_records

    def _get_latest_version(self) -> str:
        if not self.parameter_versions:
            return "v1.0"
        return max(pv.version for pv in self.parameter_versions)

    def add_hand_calculation(self, calc_data: Dict, operator: str) -> HandCalculation:
        linked_record_id = None
        for r in self.records:
            if r.date == calc_data["date"] and r.store_id == calc_data["store_id"]:
                linked_record_id = r.record_id
                break
        calc = HandCalculation(
            calc_id=f"HC-{len(self.hand_calculations) + 1:03d}",
            date=calc_data["date"],
            store_id=calc_data["store_id"],
            manual_value=calc_data["manual_value"],
            formula_used=calc_data["formula_used"],
            created_by=operator,
            linked_record_id=linked_record_id
        )
        self.hand_calculations.append(calc)
        if linked_record_id is not None:
            self._log_action(
                linked_record_id,
                "HAND_CALC_LINKED",
                operator,
                {"hand_calc_id": calc.calc_id, "manual_value": calc.manual_value}
            )
        return calc

    def check_conflicts(self) -> List[ConflictEvidence]:
        new_conflicts = []
        for calc in self.hand_calculations:
            for record in self.records:
                if (record.date == calc.date and
                    record.store_id == calc.store_id and
                    record.status != RecordStatus.REJECTED):
                    diff = abs(record.predicted_foot_traffic - calc.manual_value)
                    if diff > 0.01 and calc.calc_id not in [
                        (c.hand_calc_id for c in self.conflicts if c.record_id == record.record_id)
                    ]:
                        already = False
                        for existing in self.conflicts:
                            if existing.record_id == record.record_id and existing.hand_calc_id == calc.calc_id:
                                already = True
                                break
                        if already:
                            continue
                        conflict = ConflictEvidence(
                            conflict_id=f"CF-{len(self.conflicts) + 1:03d}",
                            record_id=record.record_id,
                            parameter_value=record.predicted_foot_traffic,
                            hand_calc_value=calc.manual_value,
                            description=(f"参数调试表值 {record.predicted_foot_traffic} vs "
                                         f"手算反例值 {calc.manual_value}, 差异 {diff:.2f}"),
                            hand_calc_id=calc.calc_id
                        )
                        self.conflicts.append(conflict)
                        new_conflicts.append(conflict)
                        record.conflict_ids.append(conflict.conflict_id)
                        calc.linked_record_id = record.record_id

                        next_handler = "运营规划阿岚"
                        if record.status == RecordStatus.GAP_DETECTED:
                            next_handler = "教研组张老师+运营规划阿岚（先复核断档，再处理冲突）"

                        self._change_status(
                            record,
                            RecordStatus.PENDING_REVIEW,
                            "system",
                            (f"与手算反例{calc.calc_id}冲突：{conflict.description}。"
                             f"请先列出冲突证据，再由运营规划阿岚确认或驳回，系统不自动拍板"),
                            original_value=record.predicted_foot_traffic,
                            new_value=calc.manual_value,
                            next_handler=next_handler
                        )
        return new_conflicts

    def pause_record(self, record_id: int, operator: str, reason: str) -> bool:
        record = self._find_record(record_id)
        if not record:
            return False
        if record.status in (RecordStatus.CONFIRMED, RecordStatus.REJECTED):
            return False
        self._snapshot_stack.append({
            "record_id": record_id,
            "paused_status": record.status.value,
            "snapshot_at": datetime.now().isoformat()
        })
        self._change_status(
            record,
            RecordStatus.PAUSED,
            operator,
            f"暂停处理：{reason}",
            next_handler="待续局后继续处理"
        )
        record.notes = (f"【已暂停】原状态{STATUS_LABEL_CN.get(record.state_history[-1].from_status, record.state_history[-1].from_status)}，"
                        f"原因：{reason}。续局后继续按原流程处理。")
        return True

    def resume_record(self, record_id: int, operator: str, resume_reason: str) -> bool:
        record = self._find_record(record_id)
        if not record or record.status != RecordStatus.PAUSED:
            return False
        target_status_val = None
        for snap in reversed(self._snapshot_stack):
            if snap["record_id"] == record_id:
                target_status_val = snap["paused_status"]
                self._snapshot_stack.remove(snap)
                break
        if not target_status_val:
            target_status_val = RecordStatus.PENDING_REVIEW.value
        target_status = RecordStatus(target_status_val)
        self._change_status(
            record,
            RecordStatus.RESUMED,
            operator,
            f"续局：{resume_reason}，恢复至暂停前流程"
        )
        next_handler = "教研组张老师" if target_status_val == RecordStatus.GAP_DETECTED.value else "运营规划阿岚"
        self._change_status(
            record,
            target_status,
            operator,
            f"续局完成，回到{STATUS_LABEL_CN.get(target_status_val, target_status_val)}状态",
            next_handler=next_handler
        )
        return True

    def teaching_review_record(self, record_id: int, operator: str,
                               original_statement: str,
                               processing_reason: str,
                               next_handler: str,
                               corrected_value: float = None,
                               approve_gap: bool = True) -> bool:
        record = self._find_record(record_id)
        if not record:
            return False
        record.review_info = ReviewInfo(
            original_statement=original_statement,
            corrected_value=corrected_value,
            processing_reason=processing_reason,
            next_handler=next_handler,
            reviewed_by=operator,
            reviewed_at=datetime.now()
        )
        self._change_status(
            record,
            RecordStatus.TEACHING_REVIEW,
            operator,
            (f"教研组复核：{processing_reason}。原始说法：{original_statement}。"
             f"下一步：{next_handler}"),
            original_value=record.original_predicted,
            new_value=corrected_value,
            next_handler=next_handler
        )
        if approve_gap and corrected_value is not None:
            record.predicted_foot_traffic = corrected_value
        record.notes = (f"【教研组复核意见】原始说法：{original_statement} | "
                        f"处理原因：{processing_reason} | "
                        f"改后值：{corrected_value if corrected_value else '未改，保留原值'} | "
                        f"下一步找谁：{next_handler}")
        return True

    def resolve_conflict(self, conflict_id: str, resolution: str, operator: str,
                         resolve_reason: str = "") -> bool:
        for conflict in self.conflicts:
            if conflict.conflict_id == conflict_id:
                conflict.resolution = resolution
                conflict.resolved_by = operator
                conflict.resolved_at = datetime.now()
                record = self._find_record(conflict.record_id)
                if not record:
                    return False
                if resolution == "confirm":
                    final_reason = f"运营规划{operator}确认采用参数调试表值"
                    if resolve_reason:
                        final_reason += f"。理由：{resolve_reason}"
                    self._change_status(
                        record,
                        RecordStatus.CONFIRMED,
                        operator,
                        final_reason,
                        original_value=conflict.hand_calc_value,
                        new_value=conflict.parameter_value,
                        next_handler="数据组更新参数版本页"
                    )
                    record.notes = (f"运营规划{operator}确认：采用参数值{conflict.parameter_value}，"
                                    f"驳回手算反例{conflict.hand_calc_id}的{conflict.hand_calc_value}。"
                                    f"理由：{resolve_reason or '参数值更符合最新泊松模型校准结果'}")
                elif resolution == "reject":
                    final_reason = f"运营规划{operator}驳回参数值，采用手算反例值"
                    if resolve_reason:
                        final_reason += f"。理由：{resolve_reason}"
                    self._change_status(
                        record,
                        RecordStatus.REJECTED,
                        operator,
                        final_reason,
                        original_value=conflict.parameter_value,
                        new_value=conflict.hand_calc_value,
                        next_handler="数据组更新参数版本页"
                    )
                    record.predicted_foot_traffic = conflict.hand_calc_value
                    record.notes = (f"运营规划{operator}驳回：采用手算反例值{conflict.hand_calc_value}，"
                                    f"替换原参数值{conflict.parameter_value}。"
                                    f"理由：{resolve_reason or '手算反例更贴合门店实际情况'}")
                else:
                    return False
                self._log_action(
                    record.record_id,
                    f"RESOLVE_{resolution.upper()}",
                    operator,
                    {"conflict_id": conflict_id, "reason": resolve_reason}
                )
                return True
        return False

    def import_old_caliber_record(self, record_data: Dict, operator: str) -> PredictionRecord:
        orig_pred = record_data["predicted_foot_traffic"]
        orig_lambda = record_data.get("poisson_lambda", 0.0)
        record = PredictionRecord(
            record_id=self._next_record_id,
            date=record_data["date"],
            store_id=record_data["store_id"],
            predicted_foot_traffic=orig_pred,
            poisson_lambda=orig_lambda,
            status=RecordStatus.OLD_CALIBER,
            source=RecordSource.HAND_CALCULATION,
            version=record_data.get("version", "v0.9-old"),
            previous_version=record_data.get("previous_version"),
            original_predicted=orig_pred,
            original_lambda=orig_lambda,
            notes=(f"旧口径补录记录，来自手算反例，由{operator}导入。"
                   f"口径版本：{record_data.get('version', 'v0.9-old')}，"
                   f"不参与当前v1.0+的正常结果汇总")
        )
        self.records.append(record)
        self._next_record_id += 1
        self._log_action(
            record.record_id,
            "OLD_CALIBER_IMPORT",
            operator,
            {"source": "hand_calculation_backfill",
             "old_version": record_data.get("version", "v0.9-old")}
        )
        return record

    def create_parameter_version(self, lambda_value: float, effective_date: str,
                                  created_by: str, reason: str,
                                  related_record_ids: List[int] = None,
                                  tradeoff_note: str = "") -> ParameterVersion:
        new_version_num = len(self.parameter_versions) + 1
        version = ParameterVersion(
            version=f"v{new_version_num}.0",
            lambda_value=lambda_value,
            effective_date=effective_date,
            created_by=created_by,
            reason=reason,
            related_record_ids=related_record_ids or [],
            tradeoff_note=tradeoff_note
        )
        for pv in self.parameter_versions:
            pv.is_active = False
        self.parameter_versions.append(version)
        for rid in (related_record_ids or []):
            record = self._find_record(rid)
            if record:
                old_ver = record.version
                record.previous_version = old_ver
                record.version = version.version
                if record.poisson_lambda and abs(record.poisson_lambda) > 1e-9:
                    record.poisson_lambda = lambda_value
                self._log_action(
                    rid,
                    "PARAMETER_VERSION_UPDATED",
                    created_by,
                    {"new_version": version.version, "old_version": old_ver,
                     "new_lambda": lambda_value, "reason": reason}
                )
        self._log_action(
            0,
            "NEW_PARAMETER_VERSION",
            created_by,
            {"version": version.version, "lambda": lambda_value,
             "effective_date": effective_date, "tradeoff": tradeoff_note}
        )
        return version

    def get_parameter_version_page(self) -> Dict:
        active_version = None
        for pv in self.parameter_versions:
            if pv.is_active:
                active_version = pv
                break
        related_records_info = []
        if active_version and active_version.related_record_ids:
            for rid in active_version.related_record_ids:
                r = self._find_record(rid)
                if r:
                    related_records_info.append({
                        "record_id": r.record_id,
                        "date": r.date,
                        "final_predicted": r.predicted_foot_traffic,
                        "original_predicted": r.original_predicted,
                        "status": r.status.value,
                        "status_label": STATUS_LABEL_CN.get(r.status.value, r.status.value)
                    })
        return {
            "active_version": active_version,
            "history": sorted(self.parameter_versions, key=lambda x: x.created_at, reverse=True),
            "total_versions": len(self.parameter_versions),
            "related_records": related_records_info,
            "consistency_check": self._check_version_history_consistency()
        }

    def _check_version_history_consistency(self) -> Dict:
        issues = []
        for pv in self.parameter_versions:
            for rid in pv.related_record_ids:
                r = self._find_record(rid)
                if r and r.version != pv.version:
                    issues.append(f"记录{rid}版本{r.version}与参数版本{pv.version}不一致")
        return {
            "has_issues": len(issues) > 0,
            "issues": issues,
            "total_parameter_versions": len(self.parameter_versions),
            "records_checked": len(self.records)
        }

    def get_processing_history(self) -> List[Dict]:
        history = []
        for record in sorted(self.records, key=lambda x: x.record_id):
            history.append(self._record_to_list_row(record))
        return history

    def _record_to_list_row(self, record: PredictionRecord) -> Dict:
        return {
            "record_id": record.record_id,
            "date": record.date,
            "store_id": record.store_id,
            "predicted": record.predicted_foot_traffic,
            "original_predicted": record.original_predicted,
            "lambda": record.poisson_lambda,
            "original_lambda": record.original_lambda,
            "status": record.status.value,
            "status_label": STATUS_LABEL_CN.get(record.status.value, record.status.value),
            "source": record.source.value,
            "version": record.version,
            "notes": record.notes,
            "has_gap": record.gap_info is not None,
            "has_conflict": len(record.conflict_ids) > 0,
            "review_next_handler": record.review_info.next_handler,
            "state_count": len(record.state_history)
        }

    def get_record_detail(self, record_id: int) -> Optional[Dict]:
        record = self._find_record(record_id)
        if not record:
            return None
        related_conflicts = [c for c in self.conflicts if c.record_id == record_id]
        related_hand_calcs = [h for h in self.hand_calculations if h.linked_record_id == record_id]
        return {
            "basic": self._record_to_list_row(record),
            "gap_info": record.gap_info,
            "conflicts": [
                {
                    "conflict_id": c.conflict_id,
                    "parameter_value": c.parameter_value,
                    "hand_calc_value": c.hand_calc_value,
                    "description": c.description,
                    "resolution": c.resolution,
                    "resolved_by": c.resolved_by
                } for c in related_conflicts
            ],
            "hand_calculations": [
                {
                    "calc_id": h.calc_id,
                    "manual_value": h.manual_value,
                    "formula_used": h.formula_used,
                    "created_by": h.created_by
                } for h in related_hand_calcs
            ],
            "state_history": [
                {
                    "step": idx + 1,
                    "from": STATUS_LABEL_CN.get(sc.from_status, sc.from_status),
                    "to": STATUS_LABEL_CN.get(sc.to_status, sc.to_status),
                    "operator": sc.operator,
                    "reason": sc.reason,
                    "original_value": sc.original_value,
                    "new_value": sc.new_value,
                    "next_handler": sc.next_handler,
                    "at": sc.changed_at.strftime("%Y-%m-%d %H:%M:%S")
                } for idx, sc in enumerate(record.state_history)
            ],
            "review_info": {
                "original_statement": record.review_info.original_statement,
                "corrected_value": record.review_info.corrected_value,
                "processing_reason": record.review_info.processing_reason,
                "next_handler": record.review_info.next_handler,
                "reviewed_by": record.review_info.reviewed_by,
                "reviewed_at": record.review_info.reviewed_at.strftime("%Y-%m-%d %H:%M:%S") if record.review_info.reviewed_at else None
            },
            "logs": [
                {
                    "log_id": log.log_id,
                    "action": log.action,
                    "operator": log.operator,
                    "at": log.timestamp.strftime("%Y-%m-%d %H:%M:%S"),
                    "details": log.details
                } for log in sorted(self.logs, key=lambda x: x.timestamp) if log.record_id == record_id
            ]
        }

    def get_summary(self) -> Dict:
        total = len(self.records)
        by_status = {}
        for r in self.records:
            key = r.status.value
            by_status[key] = by_status.get(key, 0) + 1
        gap_count = sum(1 for r in self.records if r.gap_info)
        conflict_count = sum(1 for r in self.records if r.conflict_ids)
        paused_count = sum(1 for r in self.records if r.status == RecordStatus.PAUSED)
        need_teaching = sum(1 for r in self.records if r.status in (
            RecordStatus.GAP_DETECTED, RecordStatus.TEACHING_REVIEW))
        need_operation = sum(1 for r in self.records if r.status == RecordStatus.PENDING_REVIEW)
        active_pv = None
        for pv in self.parameter_versions:
            if pv.is_active:
                active_pv = pv
                break
        return {
            "total_records": total,
            "by_status": {k: {"count": v, "label": STATUS_LABEL_CN.get(k, k)} for k, v in by_status.items()},
            "gap_count": gap_count,
            "conflict_count": conflict_count,
            "paused_count": paused_count,
            "need_teaching_review": need_teaching,
            "need_operation_review": need_operation,
            "active_parameter_version": active_pv.version if active_pv else "v1.0(未创建)",
            "active_lambda": active_pv.lambda_value if active_pv else None,
            "total_parameter_versions": len(self.parameter_versions)
        }

    def get_export_records(self) -> List[ExportRecord]:
        exports = []
        for record in sorted(self.records, key=lambda x: x.record_id):
            exports.append(ExportRecord(
                record_id=record.record_id,
                date=record.date,
                store_id=record.store_id,
                predicted_foot_traffic=record.predicted_foot_traffic,
                poisson_lambda=record.poisson_lambda,
                status=record.status.value,
                status_label=STATUS_LABEL_CN.get(record.status.value, record.status.value),
                source=record.source.value,
                version=record.version,
                notes=record.notes or "",
                original_predicted=record.original_predicted,
                original_lambda=record.original_lambda,
                review_original_statement=record.review_info.original_statement,
                review_corrected_value=record.review_info.corrected_value,
                review_processing_reason=record.review_info.processing_reason,
                review_next_handler=record.review_info.next_handler,
                state_count=len(record.state_history),
                has_gap=record.gap_info is not None,
                has_conflict=len(record.conflict_ids) > 0
            ))
        return exports

    def export_to_csv(self) -> str:
        exports = self.get_export_records()
        if not exports:
            return ""
        output = io.StringIO()
        fieldnames = [f for f in exports[0].__dataclass_fields__.keys()]
        writer = csv.DictWriter(output, fieldnames=fieldnames)
        writer.writeheader()
        for e in exports:
            writer.writerow(e.__dict__)
        return output.getvalue()

    def export_to_json(self) -> str:
        exports = [e.__dict__ for e in self.get_export_records()]
        return json.dumps(exports, ensure_ascii=False, indent=2, default=str)

    def get_report(self) -> Dict:
        summary = self.get_summary()
        version_page = self.get_parameter_version_page()
        history = self.get_processing_history()
        pending_items = []
        for r in sorted(self.records, key=lambda x: x.record_id):
            if r.status in (RecordStatus.GAP_DETECTED, RecordStatus.PENDING_REVIEW,
                            RecordStatus.PAUSED, RecordStatus.TEACHING_REVIEW):
                pending_items.append({
                    "record_id": r.record_id,
                    "status": r.status.value,
                    "status_label": STATUS_LABEL_CN.get(r.status.value, r.status.value),
                    "next_handler": (r.review_info.next_handler or
                                     (r.state_history[-1].next_handler if r.state_history else "待分配")),
                    "issue": r.notes or "待处理"
                })
        return {
            "generated_at": datetime.now().isoformat(),
            "summary": summary,
            "parameter_version_page": {
                "active": {
                    "version": version_page["active_version"].version,
                    "lambda": version_page["active_version"].lambda_value,
                    "effective_date": version_page["active_version"].effective_date,
                    "created_by": version_page["active_version"].created_by,
                    "reason": version_page["active_version"].reason,
                    "tradeoff_note": version_page["active_version"].tradeoff_note
                } if version_page["active_version"] else None,
                "history_count": version_page["total_versions"],
                "related_records": version_page["related_records"],
                "consistency": version_page["consistency_check"]
            },
            "history_list": history,
            "pending_items": pending_items
        }

    def simulate_manual_deletion(self, record_id: int, operator: str) -> bool:
        for i, record in enumerate(self.records):
            if record.record_id == record_id:
                del self.records[i]
                self._log_action(
                    record_id,
                    "MANUAL_DELETE",
                    operator,
                    {"note": "人工删除一行记录，可能造成后续编号断档"}
                )
                return True
        return False
