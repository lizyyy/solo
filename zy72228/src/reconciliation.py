import uuid
from datetime import datetime, date
from typing import List, Dict, Optional
from .models import (
    ReconciliationNote,
    MarginRecord,
    CounterFlow,
    ConflictRecord,
    ApprovalStatus,
    RecordSource
)


class ReconciliationManager:
    def __init__(self):
        self.notes: Dict[str, ReconciliationNote] = {}
        self.notes_by_date: Dict[date, List[str]] = {}

    def create_note(
        self,
        trade_date: date,
        content: str,
        created_by: str,
        related_record_ids: List[str] = None,
        related_flow_ids: List[str] = None
    ) -> ReconciliationNote:
        note_id = f"NOTE{datetime.now().strftime('%Y%m%d%H%M%S')}{uuid.uuid4().hex[:4]}"
        
        note = ReconciliationNote(
            note_id=note_id,
            trade_date=trade_date,
            content=content,
            related_record_ids=related_record_ids or [],
            related_flow_ids=related_flow_ids or [],
            created_by=created_by
        )
        
        self.notes[note_id] = note
        
        if trade_date not in self.notes_by_date:
            self.notes_by_date[trade_date] = []
        self.notes_by_date[trade_date].append(note_id)
        
        return note

    def update_note(
        self,
        note_id: str,
        new_content: str,
        updated_by: str,
        add_record_ids: List[str] = None,
        add_flow_ids: List[str] = None
    ) -> Optional[ReconciliationNote]:
        note = self.notes.get(note_id)
        if not note:
            return None
        
        note.history.append({
            "version": note.version,
            "content": note.content,
            "related_record_ids": note.related_record_ids.copy(),
            "related_flow_ids": note.related_flow_ids.copy(),
            "updated_by": note.updated_by or note.created_by,
            "updated_time": note.updated_time or note.created_time
        })
        
        note.content = new_content
        note.version += 1
        note.updated_by = updated_by
        note.updated_time = datetime.now()
        
        if add_record_ids:
            note.related_record_ids.extend([rid for rid in add_record_ids if rid not in note.related_record_ids])
        if add_flow_ids:
            note.related_flow_ids.extend([fid for fid in add_flow_ids if fid not in note.related_flow_ids])
        
        return note

    def get_note(self, note_id: str) -> Optional[ReconciliationNote]:
        return self.notes.get(note_id)

    def get_notes_by_date(self, trade_date: date) -> List[ReconciliationNote]:
        note_ids = self.notes_by_date.get(trade_date, [])
        return [self.notes[nid] for nid in note_ids if nid in self.notes]

    def get_notes_by_record(self, record_id: str) -> List[ReconciliationNote]:
        return [
            note for note in self.notes.values()
            if record_id in note.related_record_ids
        ]

    def get_notes_by_flow(self, flow_id: str) -> List[ReconciliationNote]:
        return [
            note for note in self.notes.values()
            if flow_id in note.related_flow_ids
        ]

    def format_note_for_display(self, note: ReconciliationNote, show_history: bool = True) -> str:
        lines = [
            "=" * 60,
            f"📝 对账说明 - {note.note_id}",
            "=" * 60,
            f"📅 交易日期: {note.trade_date.strftime('%Y-%m-%d')}",
            f"✍️  创建人: {note.created_by}",
            f"⏰ 创建时间: {note.created_time.strftime('%Y-%m-%d %H:%M:%S')}",
            f"📄 版本: v{note.version}",
        ]
        
        if note.updated_by:
            lines.extend([
                f"✏️  更新人: {note.updated_by}",
                f"⏰ 更新时间: {note.updated_time.strftime('%Y-%m-%d %H:%M:%S')}",
            ])
        
        lines.extend([
            "",
            "📋 对账说明内容:",
            note.content,
            "",
        ])
        
        if note.related_record_ids:
            lines.append(f"🔗 关联保证金记录: {', '.join(note.related_record_ids)}")
        
        if note.related_flow_ids:
            lines.append(f"🔗 关联柜台流水: {', '.join(note.related_flow_ids)}")
        
        if show_history and note.history:
            lines.extend([
                "",
                "📜 历史版本:",
                "-" * 60,
            ])
            for hist in reversed(note.history):
                lines.extend([
                    f"版本 v{hist['version']}",
                    f"更新人: {hist['updated_by']}",
                    f"更新时间: {hist['updated_time'].strftime('%Y-%m-%d %H:%M:%S')}",
                    f"内容: {hist['content']}",
                    "",
                ])
        
        lines.append("=" * 60)
        return "\n".join(lines)

    def generate_reconciliation_report(
        self,
        trade_date: date,
        records: List[MarginRecord],
        flows: List[CounterFlow],
        conflicts: List[ConflictRecord] = None
    ) -> str:
        notes = self.get_notes_by_date(trade_date)
        approved_records = [r for r in records if r.approval_status in [ApprovalStatus.APPROVED, ApprovalStatus.REVIEWED]]
        pending_records = [r for r in records if r.approval_status in [ApprovalStatus.PENDING, ApprovalStatus.PENDING_REVIEW]]
        rejected_records = [r for r in records if r.approval_status == ApprovalStatus.REJECTED]
        
        conflict_list = conflicts or []
        pending_conflicts = [c for c in conflict_list if c.resolution == ApprovalStatus.PENDING]
        approved_conflicts = [c for c in conflict_list if c.resolution == ApprovalStatus.APPROVED]
        rejected_conflicts = [c for c in conflict_list if c.resolution == ApprovalStatus.REJECTED]
        
        lines = [
            "=" * 70,
            f"📊 大宗商品保证金联动对账报告 - {trade_date.strftime('%Y-%m-%d')}",
            "=" * 70,
            "",
            f"📈 统计概览:",
            f"   柜台流水笔数: {len(flows)}",
            f"   保证金记录笔数: {len(records)}",
            f"   已确认: {len(approved_records)}",
            f"   待确认: {len(pending_records)}",
            f"   已驳回: {len(rejected_records)}",
            f"   对账说明条数: {len(notes)}",
            "",
        ]
        
        if conflict_list:
            lines.extend([
                f"⚠️  尾号冲突状态:",
                f"   总冲突: {len(conflict_list)}",
                f"   待确认: {len(pending_conflicts)}",
                f"   已确认: {len(approved_conflicts)}",
                f"   已驳回: {len(rejected_conflicts)}",
                "",
            ])
            for c in conflict_list:
                status_label = c.resolution.value
                lines.append(
                    f"   流水号 {c.flow_id}: 柜台尾号={c.flow_tail_counter} 邮件尾号={c.flow_tail_email} -> {status_label}"
                )
            lines.append("")
        
        if notes:
            lines.extend([
                "📝 对账说明:",
                "-" * 70,
            ])
            for note in notes:
                lines.extend([
                    f"[{note.note_id}] {note.created_by} @ {note.created_time.strftime('%H:%M:%S')}",
                    f"    {note.content[:100]}..." if len(note.content) > 100 else f"    {note.content}",
                    "",
                ])
        
        if pending_records:
            lines.extend([
                "⏳ 待确认记录:",
                "-" * 70,
            ])
            for rec in pending_records:
                lines.extend([
                    f"[{rec.record_id}] {rec.margin_type} {rec.direction} {rec.amount:,.2f}",
                    f"    来源: {rec.source.value}",
                    f"    状态: {rec.approval_status.value}",
                    "",
                ])
        
        lines.append("=" * 70)
        return "\n".join(lines)

    def check_reconciliation_consistency(
        self,
        trade_date: date,
        records: List[MarginRecord],
        flows: List[CounterFlow]
    ) -> Dict[str, any]:
        notes = self.get_notes_by_date(trade_date)
        records_on_date = [r for r in records if r.trade_date == trade_date]
        flows_on_date = [f for f in flows if f.trade_date == trade_date]
        
        record_ids_in_notes = set()
        for note in notes:
            record_ids_in_notes.update(note.related_record_ids)
        
        flow_ids_in_notes = set()
        for note in notes:
            flow_ids_in_notes.update(note.related_flow_ids)
        
        unrecorded_records = [r.record_id for r in records_on_date if r.record_id not in record_ids_in_notes]
        unrecorded_flows = [f.flow_id for f in flows_on_date if f.flow_id not in flow_ids_in_notes]
        
        return {
            "date": trade_date,
            "total_records": len(records_on_date),
            "total_flows": len(flows_on_date),
            "notes_count": len(notes),
            "records_with_notes": len(record_ids_in_notes),
            "flows_with_notes": len(flow_ids_in_notes),
            "unrecorded_records": unrecorded_records,
            "unrecorded_flows": unrecorded_flows,
            "has_notes_for_all": len(unrecorded_records) == 0 and len(unrecorded_flows) == 0
        }

    def delete_note(self, note_id: str) -> bool:
        if note_id in self.notes:
            note = self.notes[note_id]
            if note.trade_date in self.notes_by_date:
                self.notes_by_date[note.trade_date] = [
                    nid for nid in self.notes_by_date[note.trade_date] if nid != note_id
                ]
            del self.notes[note_id]
            return True
        return False
