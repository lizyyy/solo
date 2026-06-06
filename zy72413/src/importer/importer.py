import hashlib
import uuid
from datetime import datetime
from typing import List, Optional, Tuple
import json

from ..models import (
    DJShow,
    RehearsalImport,
    Batch,
    BatchStatus,
    Ticket,
    TicketType,
    ImportResult,
    ModificationRecord,
)
from ..rules import BoundaryRuleEngine


class ImportEngine:
    @staticmethod
    def compute_source_hash(raw_content: str) -> str:
        return hashlib.sha256(raw_content.encode("utf-8")).hexdigest()

    @staticmethod
    def find_existing_import(
        show: DJShow,
        source_hash: str,
    ) -> Optional[RehearsalImport]:
        for imp in show.rehearsal_imports:
            if imp.source_hash == source_hash:
                return imp
        return None

    @staticmethod
    def parse_rehearsal_text(
        raw_content: str,
        show_id: str,
        source_ref: str,
    ) -> List[Batch]:
        batches = []
        lines = raw_content.strip().split("\n")
        current_batch: Optional[Batch] = None

        for line in lines:
            line = line.strip()
            if not line:
                continue

            if line.startswith("批次:") or line.startswith("【批次】"):
                batch_name = line.replace("批次:", "").replace("【批次】", "").strip()
                current_batch = Batch(
                    id=f"batch_{uuid.uuid4().hex[:8]}",
                    name=batch_name,
                    show_id=show_id,
                )
                batches.append(current_batch)
                continue

            if current_batch is None:
                current_batch = Batch(
                    id=f"batch_{uuid.uuid4().hex[:8]}",
                    name="默认批次",
                    show_id=show_id,
                )
                batches.append(current_batch)

            ticket = ImportEngine._parse_ticket_line(line, show_id, source_ref)
            if ticket:
                current_batch.tickets.append(ticket)

        return [b for b in batches if b.tickets]

    @staticmethod
    def _parse_ticket_line(
        line: str,
        show_id: str,
        source_ref: str,
    ) -> Optional[Ticket]:
        if "赠票" in line:
            ticket_type = TicketType.COMPLIMENTARY
        elif "售票" in line or "购票" in line:
            ticket_type = TicketType.PAID
        else:
            ticket_type = TicketType.UNKNOWN

        parts = line.split()
        guest_name = parts[0] if parts else None

        seat = None
        for part in parts:
            if "排" in part and "座" in part:
                seat = part
                break

        price = None
        for part in parts:
            if part.startswith("¥") or part.startswith("￥"):
                try:
                    price = float(part.replace("¥", "").replace("￥", ""))
                except ValueError:
                    pass
                break

        note = None
        if "备注:" in line:
            note = line.split("备注:", 1)[1].strip()
        elif "备注：" in line:
            note = line.split("备注：", 1)[1].strip()

        if not guest_name and ticket_type == TicketType.UNKNOWN:
            return None

        return Ticket(
            id=f"ticket_{uuid.uuid4().hex[:8]}",
            type=ticket_type,
            seat=seat,
            price=price,
            guest_name=guest_name,
            source_ref=source_ref,
            note=note,
        )

    @staticmethod
    def import_rehearsal(
        show: DJShow,
        source_filename: str,
        raw_content: str,
        imported_by: str,
    ) -> ImportResult:
        source_hash = ImportEngine.compute_source_hash(raw_content)
        result = ImportResult(success=True, show_id=show.id)

        existing_import = ImportEngine.find_existing_import(show, source_hash)
        if existing_import:
            result.is_duplicate = True
            result.existing_import_id = existing_import.id
            result.warnings.append(
                f"检测到重复导入: 文件 {source_filename} 已于 "
                f"{existing_import.imported_at.strftime('%Y-%m-%d %H:%M')} 导入，跳过以避免票量翻倍"
            )
            return result

        source_ref = f"import:{source_filename}:{source_hash[:8]}"
        new_batches = ImportEngine.parse_rehearsal_text(raw_content, show.id, source_ref)

        rehearsal_import = RehearsalImport(
            id=f"import_{uuid.uuid4().hex[:8]}",
            show_id=show.id,
            source_filename=source_filename,
            source_hash=source_hash,
            imported_by=imported_by,
            raw_content=raw_content,
        )

        for batch in new_batches:
            is_mixed, detail = BoundaryRuleEngine.check_batch_mixed(batch)
            if is_mixed:
                batch.status = BatchStatus.MIXED
                batch.mixed_issue_found = True
                result.mixed_batches_found.append(f"{batch.name}: {detail}")
                result.warnings.append(detail)
            rehearsal_import.batch_ids.append(batch.id)
            show.batches.append(batch)
            result.tickets_imported += len(batch.tickets)

        show.rehearsal_imports.append(rehearsal_import)
        result.batches_created = len(new_batches)

        return result

    @staticmethod
    def update_import_note(
        show: DJShow,
        import_id: str,
        new_note: str,
        operator: str,
    ) -> bool:
        for imp in show.rehearsal_imports:
            if imp.id == import_id:
                old_note = imp.note
                imp.note = new_note

                show.modification_history.append(
                    ModificationRecord(
                        id=f"mod_{uuid.uuid4().hex[:8]}",
                        show_id=show.id,
                        entity_type="rehearsal_import",
                        entity_id=imp.id,
                        field_name="note",
                        old_value=old_note,
                        new_value=new_note,
                        modified_by=operator,
                        reason="更新备注",
                    )
                )
                return True
        return False

    @staticmethod
    def get_import_diff(
        show: DJShow,
        import_id: str,
    ) -> List[Tuple[str, str, str]]:
        diffs = []
        for mod in show.modification_history:
            if mod.entity_type == "rehearsal_import" and mod.entity_id == import_id:
                diffs.append(
                    (
                        mod.modified_at.strftime("%Y-%m-%d %H:%M"),
                        mod.field_name,
                        f"{mod.old_value} → {mod.new_value}",
                    )
                )
        return diffs
