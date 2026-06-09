from typing import Dict, List, Any

from .models import (
    PetRecord,
    ProcessingStatus,
    WeightReport,
)


class RecordStatus:
    PASSED = "已放行"
    NEED_EVIDENCE = "待补证据"
    MANUALLY_REVISED = "人工改过"
    ABNORMAL = "异常"


class StatusClassifier:
    def __init__(self):
        pass

    @staticmethod
    def classify(record: PetRecord) -> Dict[str, Any]:
        status_tags: List[str] = []
        raw_status = record.current_status.value

        if record.duplicate_issues:
            status_tags.append(RecordStatus.ABNORMAL)

        if record.is_manually_modified:
            status_tags.append(RecordStatus.MANUALLY_REVISED)

        if raw_status == ProcessingStatus.PASSED.value:
            if RecordStatus.ABNORMAL not in status_tags:
                status_tags.append(RecordStatus.PASSED)
        elif raw_status == ProcessingStatus.NEED_EVIDENCE.value:
            status_tags.append(RecordStatus.NEED_EVIDENCE)
        elif raw_status == ProcessingStatus.ABNORMAL.value:
            if RecordStatus.ABNORMAL not in status_tags:
                status_tags.append(RecordStatus.ABNORMAL)

        display_status = StatusClassifier._resolve_display_priority(status_tags, raw_status)

        return {
            "record_id": record.record_id,
            "registration_id": record.fostering_registration.registration_id,
            "raw_status": raw_status,
            "display_status": display_status,
            "status_tags": status_tags,
            "is_passed": RecordStatus.PASSED in status_tags or (
                raw_status == ProcessingStatus.PASSED.value
                and RecordStatus.ABNORMAL not in status_tags
            ),
            "is_need_evidence": (
                RecordStatus.NEED_EVIDENCE in status_tags
                or raw_status == ProcessingStatus.NEED_EVIDENCE.value
            ),
            "is_manually_revised": RecordStatus.MANUALLY_REVISED in status_tags,
            "is_abnormal": RecordStatus.ABNORMAL in status_tags,
            "conclusion_changed": len(record.processing_history) > 0 and any(
                h.previous_status != h.new_status for h in record.processing_history
            ),
            "history_count": len(record.processing_history),
        }

    @staticmethod
    def _resolve_display_priority(tags: List[str], raw_status: str) -> str:
        priority_order = [
            RecordStatus.ABNORMAL,
            RecordStatus.MANUALLY_REVISED,
            RecordStatus.NEED_EVIDENCE,
            RecordStatus.PASSED,
        ]
        for tag in priority_order:
            if tag in tags:
                return tag
        return raw_status

    def classify_report(self, report: WeightReport) -> Dict[str, List[Dict[str, Any]]]:
        buckets: Dict[str, List[Dict[str, Any]]] = {
            RecordStatus.PASSED: [],
            RecordStatus.NEED_EVIDENCE: [],
            RecordStatus.MANUALLY_REVISED: [],
            RecordStatus.ABNORMAL: [],
        }
        for record in report.records:
            info = self.classify(record)
            if info["is_abnormal"]:
                buckets[RecordStatus.ABNORMAL].append(info)
            elif info["is_manually_revised"]:
                buckets[RecordStatus.MANUALLY_REVISED].append(info)
            elif info["is_need_evidence"]:
                buckets[RecordStatus.NEED_EVIDENCE].append(info)
            elif info["is_passed"]:
                buckets[RecordStatus.PASSED].append(info)
            else:
                buckets[RecordStatus.NEED_EVIDENCE].append(info)
        return buckets

    def build_interface_response(self, report: WeightReport) -> Dict[str, Any]:
        buckets = self.classify_report(report)
        summary = report.get_summary()
        duplicate_issues = [issue.to_dict() for issue in report.all_duplicate_issues]

        interface_records = []
        for record in report.records:
            info = self.classify(record)
            registration_dict = record.fostering_registration.to_dict()
            processing_dict = record.to_dict()

            record_mapping = self._build_registration_mapping(record)

            interface_records.append(
                {
                    **info,
                    "original_registration": registration_dict,
                    "processing_result": processing_dict,
                    "registration_processing_link": record_mapping,
                    "evidence_list": [e.to_dict() for e in record.evidence_materials],
                    "history_list": [h.to_dict() for h in record.processing_history],
                    "duplicate_issues": [d.to_dict() for d in record.duplicate_issues],
                    "_for_frontend_wen": {
                        "pet_aliases": "、".join(record.fostering_registration.pet_aliases),
                        "original_statement": record.fostering_registration.original_statement,
                        "final_result": info["display_status"],
                        "action_required": self._action_for_wen(info, record),
                    },
                }
            )

        return {
            "report_summary": summary,
            "status_buckets": {
                k: [
                    {
                        "record_id": r["record_id"],
                        "registration_id": r["registration_id"],
                        "display_status": r["display_status"],
                    }
                    for r in v
                ]
                for k, v in buckets.items()
            },
            "duplicate_alias_summary": duplicate_issues,
            "exit_messages": self._build_exit_messages(report),
            "records": interface_records,
        }

    @staticmethod
    def _build_registration_mapping(record: PetRecord) -> Dict[str, Any]:
        reg = record.fostering_registration
        proc = record.to_dict()
        return {
            "登记表编号": reg.registration_id,
            "关联记录编号": record.record_id,
            "寄养人原始说法": reg.original_statement,
            "宠物别名原始登记": "、".join(reg.pet_aliases),
            "接口处理结果": proc["处理状态"],
            "前台最终确认状态": record.current_status.value,
            "前后说法一致性": StatusClassifier._check_statement_consistency(reg, record),
            "需要前台跟进事项": StatusClassifier._wen_followup_items(reg, record),
        }

    @staticmethod
    def _check_statement_consistency(
        reg, record: PetRecord
    ) -> str:
        if record.duplicate_issues:
            return "不一致：存在别名重复，需人工确认"
        if record.current_status == ProcessingStatus.NEED_EVIDENCE:
            return "部分一致：说法可匹配，但缺少证据照片"
        if record.is_manually_modified:
            return "已人工调整：原始说法与最终结论不一致，已人工改判"
        return "一致：原始说法与处理结论匹配"

    @staticmethod
    def _wen_followup_items(reg, record: PetRecord) -> List[str]:
        items = []
        if record.duplicate_issues:
            for issue in record.duplicate_issues:
                items.append(
                    f"请确认别名「{issue.alias}」归属，涉及登记表："
                    + "、".join(issue.related_registration_ids)
                )
        if record.current_status == ProcessingStatus.NEED_EVIDENCE:
            items.append(
                f"请补充「{reg.owner_name}家的{'、'.join(reg.pet_aliases)}」"
                f"减重证据照片（当前：{record.current_weight}kg / 目标：{record.target_weight}kg）"
            )
        if not items:
            items.append("无需跟进，已完成闭环")
        return items

    @staticmethod
    def _action_for_wen(info: Dict[str, Any], record: PetRecord) -> str:
        if info["is_abnormal"]:
            return "📛 暂停：存在别名重复，先人工确认归属"
        if info["is_need_evidence"]:
            return "📸 催图：向寄养人索要最新体重照片"
        if info["is_manually_revised"]:
            return "✅ 归档：已人工改过，通知寄养人结论"
        if info["is_passed"]:
            return "✅ 放行：减重达标，生成报告"
        return "⏳ 待处理：请检查状态"

    @staticmethod
    def _build_exit_messages(report: WeightReport) -> List[str]:
        messages = []
        if report.all_duplicate_issues:
            messages.append("=" * 50)
            messages.append("⚠️  以下为必须人工处理的阻塞项（未解决前禁止放行）：")
            messages.append("=" * 50)
            for issue in report.all_duplicate_issues:
                messages.append(issue.format_exit_message())
                messages.append("-" * 50)
        return messages
