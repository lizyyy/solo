from collections import defaultdict
from typing import List, Optional, Tuple

from .models import (
    AttachmentIndex,
    BaseRecord,
    ConflictEntry,
    ConflictStatus,
    JudgmentChange,
    LookbackResult,
    PaymentRecord,
    RecordType,
    RefundRecord,
)


class ConflictDetector:
    def __init__(self):
        self.conflicts: List[ConflictEntry] = []
        self._conflict_counter = 0

    def _next_conflict_id(self) -> str:
        self._conflict_counter += 1
        return f"CONFLICT-{self._conflict_counter:04d}"

    def detect_duplicate_claims(self, records: List[BaseRecord]) -> List[ConflictEntry]:
        amount_date_groups = defaultdict(list)
        for r in records:
            if r.amount is not None and r.record_type == RecordType.PAYMENT:
                key = (round(r.amount, 2), r.currency, r.date)
                amount_date_groups[key].append(r)

        for key, group in amount_date_groups.items():
            if len(group) < 2:
                continue

            batch_ids = set(r.batch_id for r in group)
            if len(batch_ids) > 1:
                evidence = {
                    "金额": f"{key[0]} {key[1]}",
                    "日期": key[2] or "未填写",
                    "涉及批次": sorted(batch_ids),
                    "涉及记录": [
                        {
                            "record_id": r.record_id,
                            "batch_id": r.batch_id,
                            "source_file": r.source_file,
                            "description": r.description,
                        }
                        for r in group
                    ],
                }
                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.DUPLICATE_CLAIM,
                    record_ids=[r.record_id for r in group],
                    evidence=evidence,
                    suggested_action=(
                        f"同一笔 {key[0]} {key[1]} 金额在同日有 {len(batch_ids)} 个批次认领，"
                        "请确认是否为重复认款。建议：核对收银后台原始流水，确认实际到账次数后指定归属批次。"
                    ),
                )
                self.conflicts.append(conflict)

        amount_only_groups = defaultdict(list)
        for r in records:
            if r.amount is not None and r.record_type == RecordType.PAYMENT:
                key = (round(r.amount, 2), r.currency)
                amount_only_groups[key].append(r)

        for key, group in amount_only_groups.items():
            if len(group) < 2:
                continue

            batch_ids = set(r.batch_id for r in group if r.batch_id)
            if len(batch_ids) <= 1:
                continue

            already_flagged_ids = set()
            for c in self.conflicts:
                if c.conflict_type == ConflictStatus.DUPLICATE_CLAIM:
                    already_flagged_ids.update(c.record_ids)

            all_ids_in_group = set(r.record_id for r in group)
            if all_ids_in_group.issubset(already_flagged_ids):
                continue

            new_ids = all_ids_in_group - already_flagged_ids
            if not new_ids:
                continue

            evidence = {
                "金额": f"{key[0]} {key[1]}",
                "涉及批次": sorted(batch_ids),
                "跨日期认领": True,
                "涉及记录": [
                    {
                        "record_id": r.record_id,
                        "batch_id": r.batch_id,
                        "date": r.date,
                        "source_file": r.source_file,
                        "description": r.description,
                    }
                    for r in group
                ],
            }
            conflict = ConflictEntry(
                conflict_id=self._next_conflict_id(),
                conflict_type=ConflictStatus.DUPLICATE_CLAIM,
                record_ids=list(all_ids_in_group),
                evidence=evidence,
                suggested_action=(
                    f"同一金额 {key[0]} {key[1]} 被 {len(batch_ids)} 个批次在不同日期认领，"
                    "这是典型的重复认款场景。"
                    "建议：核对收银后台原始流水，确认该金额实际到账次数，指定唯一归属批次。"
                ),
            )
            self.conflicts.append(conflict)

        same_id_groups = defaultdict(list)
        for r in records:
            same_id_groups[r.record_id].append(r)

        for record_id, group in same_id_groups.items():
            if len(group) < 2:
                continue
            different_source = set(r.source_file for r in group)
            if len(different_source) > 1:
                evidence = {
                    "记录ID": record_id,
                    "来源文件": sorted(different_source),
                    "各来源详情": [
                        {"source": r.source_file, "batch_id": r.batch_id, "amount": r.amount}
                        for r in group
                    ],
                }
                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.DUPLICATE_CLAIM,
                    record_ids=[r.record_id for r in group],
                    evidence=evidence,
                    suggested_action=(
                        f"记录 {record_id} 在多个来源文件中出现，请确认是否为同一条目被重复导入。"
                        "建议：以收银后台导出为准，标记其他来源为参考。"
                    ),
                )
                self.conflicts.append(conflict)

        return self.conflicts

    def detect_data_mismatch(
        self,
        records: List[BaseRecord],
        source_priority: Optional[List[str]] = None,
    ) -> List[ConflictEntry]:
        if source_priority is None:
            source_priority = []

        id_groups = defaultdict(list)
        for r in records:
            id_groups[r.record_id].append(r)

        for record_id, group in id_groups.items():
            if len(group) < 2:
                continue

            amounts = set()
            dates = set()
            for r in group:
                if r.amount is not None:
                    amounts.add(round(r.amount, 2))
                if r.date:
                    dates.add(r.date)

            if len(amounts) > 1 or len(dates) > 1:
                evidence = {
                    "记录ID": record_id,
                    "金额差异": sorted(amounts) if len(amounts) > 1 else None,
                    "日期差异": sorted(dates) if len(dates) > 1 else None,
                    "各来源详情": [
                        {
                            "source": r.source_file,
                            "batch_id": r.batch_id,
                            "amount": r.amount,
                            "date": r.date,
                        }
                        for r in group
                    ],
                }

                primary_source = ""
                for src in source_priority:
                    if any(r.source_file == src for r in group):
                        primary_source = src
                        break

                suggestion = (
                    f"记录 {record_id} 在不同来源中金额或日期不一致。\n"
                )
                if primary_source:
                    suggestion += f"建议以「{primary_source}」为准，其他来源作为对照。"
                else:
                    suggestion += "建议：以收银后台导出为准，导入数据作为参考，人工确认后标注。"

                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.DATA_MISMATCH,
                    record_ids=[r.record_id for r in group],
                    evidence=evidence,
                    suggested_action=suggestion,
                )
                self.conflicts.append(conflict)

        return self.conflicts

    def detect_null_fields(self, records: List[BaseRecord]) -> List[ConflictEntry]:
        for r in records:
            null_fields = []
            if r.amount is None:
                null_fields.append("金额(amount)")
            if not r.date:
                null_fields.append("日期(date)")
            if not r.batch_id:
                null_fields.append("批次(batch_id)")
            if r.record_type == RecordType.PAYMENT:
                if isinstance(r, PaymentRecord):
                    if not r.transaction_no:
                        null_fields.append("流水号(transaction_no)")
            if r.record_type == RecordType.REFUND:
                if isinstance(r, RefundRecord):
                    if not r.original_payment_id:
                        null_fields.append("原付款ID(original_payment_id)")

            if null_fields:
                evidence = {
                    "记录ID": r.record_id,
                    "记录类型": r.record_type.value,
                    "空值字段": null_fields,
                    "来源文件": r.source_file,
                    "原始数据": r.raw_data,
                }
                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.NULL_FIELD,
                    record_ids=[r.record_id],
                    evidence=evidence,
                    suggested_action=(
                        f"记录 {r.record_id} 有 {len(null_fields)} 个关键字段为空："
                        f"{', '.join(null_fields)}。"
                        "建议：补全后再纳入汇总，或标注为待确认条目。"
                    ),
                )
                self.conflicts.append(conflict)

        return self.conflicts

    def detect_boundary_records(self, records: List[BaseRecord]) -> List[ConflictEntry]:
        payments = [r for r in records if r.record_type == RecordType.PAYMENT and r.amount is not None]
        if not payments:
            return self.conflicts

        positive_amounts = [r.amount for r in payments if r.amount > 0]
        avg = sum(positive_amounts) / len(positive_amounts) if positive_amounts else 0

        for r in payments:
            if r.amount <= 0:
                evidence = {
                    "记录ID": r.record_id,
                    "金额": r.amount,
                    "异常类型": "非正数金额",
                    "来源文件": r.source_file,
                }
                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.BOUNDARY,
                    record_ids=[r.record_id],
                    evidence=evidence,
                    suggested_action=(
                        f"记录 {r.record_id} 金额为 {r.amount}，属于非正数边界情况。"
                        "建议：确认是否为冲账或调整记录，标注后单独统计。"
                    ),
                )
                self.conflicts.append(conflict)

            if avg > 0 and r.amount > avg * 5:
                evidence = {
                    "记录ID": r.record_id,
                    "金额": r.amount,
                    "平均金额": round(avg, 2),
                    "倍数": round(r.amount / avg, 1),
                    "异常类型": "金额远超平均值",
                    "来源文件": r.source_file,
                }
                conflict = ConflictEntry(
                    conflict_id=self._next_conflict_id(),
                    conflict_type=ConflictStatus.BOUNDARY,
                    record_ids=[r.record_id],
                    evidence=evidence,
                    suggested_action=(
                        f"记录 {r.record_id} 金额 {r.amount} 是平均值 {round(avg, 2)} 的 "
                        f"{round(r.amount / avg, 1)} 倍，属于边界异常。"
                        "建议：核实大额交易是否有对应的审批邮件，确认后标注。"
                    ),
                )
                self.conflicts.append(conflict)

        return self.conflicts

    def process_late_attachments(
        self,
        records: List[BaseRecord],
        attachments: List[AttachmentIndex],
    ) -> Tuple[List[ConflictEntry], List[JudgmentChange]]:
        record_map = {r.record_id: r for r in records}
        changes: List[JudgmentChange] = []

        late_attachments = [a for a in attachments if a.is_late]

        for att in late_attachments:
            related = record_map.get(att.related_record_id)
            if related is None:
                continue

            evidence = {
                "附件ID": att.attachment_id,
                "附件名": att.file_name,
                "关联记录": att.related_record_id,
                "上传时间": att.uploaded_at,
                "晚到": True,
                "原记录来源": related.source_file,
                "原记录金额": related.amount,
                "原记录日期": related.date,
            }

            conflict = ConflictEntry(
                conflict_id=self._next_conflict_id(),
                conflict_type=ConflictStatus.LATE_ATTACHMENT,
                record_ids=[att.related_record_id],
                evidence=evidence,
                suggested_action=(
                    f"附件「{att.file_name}」晚于主记录到达，不能直接覆盖原有判断。"
                    "建议：将附件内容作为补充证据，保留原判断记录，"
                    "由阿宁确认是否需要调整后手动更新。"
                ),
            )
            self.conflicts.append(conflict)

            change = JudgmentChange(
                record_id=att.related_record_id,
                old_judgment="initial",
                new_judgment="revised",
                change_reason=(
                    f"晚到附件「{att.file_name}」已纳入参考，原判断保留。"
                    f"附件上传时间: {att.uploaded_at}。"
                    "此条目需要人工确认是否调整。"
                ),
                changed_at=att.uploaded_at,
                changed_by="system",
                attachment_id=att.attachment_id,
            )
            changes.append(change)

        return self.conflicts, changes

    def get_all_conflicts(self) -> List[ConflictEntry]:
        return self.conflicts

    def get_conflicts_by_type(self, conflict_type: ConflictStatus) -> List[ConflictEntry]:
        return [c for c in self.conflicts if c.conflict_type == conflict_type]
