import uuid
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple

from models import Discrepancy, DiscrepancySource, CallRecord
from storage import DataStorage


class DiscrepancyDetector:
    def __init__(self, storage: DataStorage):
        self.storage = storage

    def detect_discrepancies(
        self,
        task_id: str,
        report_data: List[Dict[str, Any]],
        report_source: str = "人工报表"
    ) -> Dict[str, Any]:
        calls = self.storage.get_calls_by_task(task_id)
        call_map = {c.call_id: c for c in calls}

        report_map = {}
        for item in report_data:
            call_id = item.get("call_id")
            if call_id:
                report_map[call_id] = item

        detected = []
        resolved = []

        for call_id, report_item in report_map.items():
            if call_id not in call_map:
                continue

            call = call_map[call_id]

            fields_to_check = ["ai_result", "manual_result"]
            for field in fields_to_check:
                grayscale_value = getattr(call, field, None)
                report_value = report_item.get(field)

                if grayscale_value is None or report_value is None:
                    continue

                if str(grayscale_value).strip() != str(report_value).strip():
                    source, responsible, description = self._analyze_discrepancy_source(
                        call, field, grayscale_value, report_value
                    )

                    existing_discrepancies = self.storage.get_discrepancies(
                        task_id=task_id, resolved=False
                    )
                    is_new = True
                    for d in existing_discrepancies:
                        if d.call_id == call_id and d.field_name == field:
                            is_new = False
                            break

                    if is_new:
                        discrepancy = Discrepancy(
                            discrepancy_id=str(uuid.uuid4()),
                            call_id=call_id,
                            task_id=task_id,
                            field_name=field,
                            grayscale_value=str(grayscale_value),
                            report_value=str(report_value),
                            source=source,
                            responsible_person=responsible,
                            description=description
                        )
                        self.storage.save_discrepancy(discrepancy)
                        detected.append(discrepancy.to_dict())
                    else:
                        resolved.append({
                            "call_id": call_id,
                            "field": field,
                            "status": "已存在未解决的差异记录"
                        })

        return {
            "task_id": task_id,
            "total_checked": len(report_map),
            "new_discrepancies": len(detected),
            "existing_issues": len(resolved),
            "discrepancies": detected
        }

    def _analyze_discrepancy_source(
        self,
        call: CallRecord,
        field: str,
        grayscale_value: str,
        report_value: str
    ) -> Tuple[DiscrepancySource, str, str]:
        audit_logs = self.storage.get_audit_logs(call.call_id)
        manual_changes = [log for log in audit_logs if log.field_name == field]

        if len(manual_changes) > 0:
            last_change = manual_changes[0]
            source = DiscrepancySource.MANUAL_CHANGE
            responsible = last_change.operator
            description = (
                f"该字段最后一次人工改判由 {last_change.operator} "
                f"于 {last_change.operate_time.strftime('%Y-%m-%d %H:%M:%S')} 修改，"
                f"从「{last_change.old_value}」改为「{last_change.new_value}」。"
                f"灰度系统值：{grayscale_value}，报表值：{report_value}"
            )
        elif call.is_grayscale:
            source = DiscrepancySource.GRAYSCALE_RECORD
            responsible = "灰度系统"
            description = (
                f"该记录来自灰度版本 {call.grayscale_version}，"
                f"可能存在灰度逻辑与正式报表不一致。"
                f"灰度系统值：{grayscale_value}，报表值：{report_value}"
            )
        else:
            source = DiscrepancySource.BOTH
            responsible = "待确认"
            description = (
                f"差异来源待确认，需要同时联系灰度负责人和报表制作人核实。"
                f"灰度系统值：{grayscale_value}，报表值：{report_value}"
            )

        return source, responsible, description

    def get_discrepancy_detail(self, discrepancy_id: str) -> Optional[Dict[str, Any]]:
        discrepancies = self.storage.get_discrepancies()
        for d in discrepancies:
            if d.discrepancy_id == discrepancy_id:
                call = self.storage.get_call(d.call_id)
                audit_logs = self.storage.get_audit_logs(d.call_id)
                field_changes = [log for log in audit_logs if log.field_name == d.field_name]

                return {
                    "discrepancy": d.to_dict(),
                    "call_info": call.to_dict() if call else None,
                    "change_history": [log.to_dict() for log in field_changes],
                    "next_step": self._get_next_step(d)
                }
        return None

    def _get_next_step(self, discrepancy: Discrepancy) -> Dict[str, Any]:
        if discrepancy.source == DiscrepancySource.MANUAL_CHANGE:
            return {
                "action": "联系人工改判人",
                "contact": discrepancy.responsible_person,
                "method": "核实改判依据，确认报表是否需要更新",
                "escalation": "如有争议，请提交质检组复核"
            }
        elif discrepancy.source == DiscrepancySource.GRAYSCALE_RECORD:
            return {
                "action": "联系灰度负责人",
                "contact": "算法团队灰度负责人",
                "method": "确认灰度逻辑是否正确，是否需要同步到正式环境",
                "escalation": "如确认灰度bug，请提交缺陷工单"
            }
        else:
            return {
                "action": "双方核实",
                "contact": f"改判人: {discrepancy.responsible_person} + 算法团队",
                "method": "开三方会同步数据，定位差异根源",
                "escalation": "如无法达成一致，请升级至业务主管"
            }

    def resolve_discrepancy(
        self,
        discrepancy_id: str,
        resolver: str,
        resolution: str
    ) -> Dict[str, Any]:
        discrepancies = self.storage.get_discrepancies()
        for d in discrepancies:
            if d.discrepancy_id == discrepancy_id:
                d.resolved = True
                d.resolved_at = datetime.now()
                d.resolver = resolver
                d.description += f"【解决说明】{resolution}"
                self.storage.save_discrepancy(d)
                return {
                    "success": True,
                    "discrepancy_id": discrepancy_id,
                    "resolved_by": resolver,
                    "resolved_at": d.resolved_at.isoformat()
                }
        return {"success": False, "error": "差异记录不存在"}

    def get_discrepancy_summary(self, task_id: Optional[str] = None) -> Dict[str, Any]:
        all_discrepancies = self.storage.get_discrepancies(task_id=task_id)
        unresolved = [d for d in all_discrepancies if not d.resolved]
        resolved = [d for d in all_discrepancies if d.resolved]

        source_distribution = {}
        for d in all_discrepancies:
            source = d.source.value
            source_distribution[source] = source_distribution.get(source, 0) + 1

        field_distribution = {}
        for d in all_discrepancies:
            field = d.field_name
            field_distribution[field] = field_distribution.get(field, 0) + 1

        responsible_persons = {}
        for d in unresolved:
            person = d.responsible_person
            responsible_persons[person] = responsible_persons.get(person, 0) + 1

        return {
            "total_discrepancies": len(all_discrepancies),
            "unresolved_count": len(unresolved),
            "resolved_count": len(resolved),
            "source_distribution": source_distribution,
            "field_distribution": field_distribution,
            "responsible_pending": responsible_persons,
            "unresolved_discrepancies": [d.to_dict() for d in unresolved]
        }
