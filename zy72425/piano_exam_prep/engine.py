from typing import List, Optional, Tuple
from datetime import datetime

from .models import (
    RehearsalSignUp, RepertoireRecord, ChangeHistory, ChangeEntry,
    ContractInfo, WeeklyReportEntry, ImportResultItem, ImportResultType,
    WorkflowStage, ReviewStatus, DiscrepancyType
)
from .storage import Storage, new_id


class PrepEngine:
    """钢琴考级曲目准备引擎 - 核心业务逻辑"""

    def __init__(self, storage: Storage):
        self.storage = storage

    # ==================== 第一步：排练群接龙导入 ====================

    def import_signups(self, batch_id: str, lines: List[str], operator: str) -> List[ImportResultItem]:
        """
        导入排练群接龙
        返回: 每条接龙的明细结果（不靠总数糊过去）
        边界规则：
        - 重复导入同一批接龙不会使数量翻倍（按 source_hash 去重）
        - 原始行号完整保留
        - 每条标注: NEW(新记录) / HISTORY_DUPLICATE(历史重复) / BATCH_DUPLICATE(本次批次内重复)
        """
        results: List[ImportResultItem] = []
        seen_in_batch = set()

        for idx, line in enumerate(lines, start=1):
            line = line.strip()
            if not line:
                continue

            student_name, song_name = self._parse_signup_line(line)

            signup = RehearsalSignUp(
                batch_id=batch_id,
                original_line_number=idx,
                student_name=student_name,
                song_name_raw=song_name,
                raw_text=line,
                import_note=f"由 {operator} 批量导入",
            )

            source_hash = signup.source_hash()

            if source_hash in seen_in_batch:
                results.append(ImportResultItem(
                    original_line_number=idx,
                    student_name=student_name,
                    song_name_raw=song_name,
                    result_type=ImportResultType.BATCH_DUPLICATE,
                    source_hash=source_hash,
                    note="同一批接龙内重复，跳过",
                ))
                continue

            seen_in_batch.add(source_hash)

            if self.storage.signup_exists(source_hash):
                record = self._find_record_by_signup(student_name, song_name)
                results.append(ImportResultItem(
                    original_line_number=idx,
                    student_name=student_name,
                    song_name_raw=song_name,
                    result_type=ImportResultType.HISTORY_DUPLICATE,
                    record_id=record.record_id if record else None,
                    source_hash=source_hash,
                    note="历史批次已导入，跳过",
                ))
                continue

            self.storage.save_signup(signup)

            record = self._find_or_create_record(student_name, song_name, operator)
            if source_hash not in record.source_signup_hashes:
                record.source_signup_hashes.append(source_hash)
                record.updated_at = datetime.now()
                self.storage.save_record(record)

            results.append(ImportResultItem(
                original_line_number=idx,
                student_name=student_name,
                song_name_raw=song_name,
                result_type=ImportResultType.NEW,
                record_id=record.record_id,
                source_hash=source_hash,
                note="新增记录",
            ))

        return results

    def _parse_signup_line(self, line: str) -> Tuple[str, str]:
        """解析接龙行，格式如 '1. 张三 - 小星星' 或 '张三《小星星》'"""
        line = line.strip()
        if "." in line and line[0].isdigit():
            _, rest = line.split(".", 1)
            line = rest.strip()

        if " - " in line:
            name, song = line.split(" - ", 1)
            return name.strip(), song.strip()
        if "《" in line and "》" in line:
            name = line[:line.index("《")].strip()
            song = line[line.index("《") + 1:line.index("》")].strip()
            return name, song
        if "-" in line:
            name, song = line.split("-", 1)
            return name.strip(), song.strip()

        parts = line.split(None, 1)
        if len(parts) == 2:
            return parts[0], parts[1]
        return parts[0] if parts else "", ""

    def _find_record_by_signup(self, student_name: str, song_name: str) -> Optional[RepertoireRecord]:
        """按学生+歌名查找已有记录（只读，不创建）"""
        for record in self.storage.list_records():
            if record.student_name == student_name and record.song_display_name == song_name:
                return record
        return None

    def _find_or_create_record(self, student_name: str, song_name: str, operator: str) -> RepertoireRecord:
        """查找或创建曲目记录 - 避免重复"""
        for record in self.storage.list_records():
            if record.student_name == student_name and record.song_display_name == song_name:
                return record

        record = RepertoireRecord(
            record_id=new_id("REC"),
            student_name=student_name,
            song_display_name=song_name,
            workflow_stage=WorkflowStage.IMPORTED,
            review_status=ReviewStatus.PENDING,
        )
        self.storage.save_record(record)

        self._log_change(
            record_id=record.record_id,
            operator=operator,
            operation="创建记录",
            changes=[
                ChangeEntry("student_name", None, student_name),
                ChangeEntry("song_display_name", None, song_name),
                ChangeEntry("workflow_stage", None, WorkflowStage.IMPORTED.value),
            ],
            note="从排练群接龙导入创建",
        )
        return record

    # ==================== 第二步：合同页截图补录 ====================

    def supplement_contract(
        self,
        record_id: str,
        contract_id: str,
        song_copyright_name: str,
        screenshot_path: str,
        operator: str,
        note: Optional[str] = None,
    ) -> RepertoireRecord:
        """
        补录合同页截图信息
        边界规则：
        - 现场名 != 版权名时，自动标记为 NEEDS_REVIEW，留给音乐老师复核
        - 不自动归一化，不自动判定为正常
        """
        record = self.storage.load_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        old_contract = record.contract_info
        old_status = record.review_status
        old_stage = record.workflow_stage
        old_disc_type = record.discrepancy_type
        old_disc_note = record.discrepancy_note

        contract = ContractInfo(
            contract_id=contract_id,
            song_copyright_name=song_copyright_name,
            screenshot_path=screenshot_path,
            supplemented_by=operator,
            note=note,
        )
        record.contract_info = contract
        record.workflow_stage = WorkflowStage.CONTRACT_SUPPLEMENTED
        record.updated_at = datetime.now()

        changes = [
            ChangeEntry("contract_id", old_contract.contract_id if old_contract else None, contract_id),
            ChangeEntry("song_copyright_name", old_contract.song_copyright_name if old_contract else None, song_copyright_name),
            ChangeEntry("screenshot_path", old_contract.screenshot_path if old_contract else None, screenshot_path),
            ChangeEntry("workflow_stage", old_stage.value, WorkflowStage.CONTRACT_SUPPLEMENTED.value),
        ]

        if record.has_name_discrepancy():
            record.review_status = ReviewStatus.NEEDS_REVIEW
            record.discrepancy_type = DiscrepancyType.NAME_MISMATCH
            new_note = f"现场名「{record.song_display_name}」与版权名「{song_copyright_name}」不一致，需音乐老师复核"
            if old_disc_note:
                record.discrepancy_note = f"{old_disc_note}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator} 补录合同] {new_note}"
            else:
                record.discrepancy_note = new_note
            changes.append(ChangeEntry("review_status", old_status.value, ReviewStatus.NEEDS_REVIEW.value))
            changes.append(ChangeEntry("discrepancy_type", old_disc_type.value if old_disc_type else None, DiscrepancyType.NAME_MISMATCH.value))
            changes.append(ChangeEntry("discrepancy_note", old_disc_note, record.discrepancy_note))
        else:
            record.review_status = ReviewStatus.PENDING
            record.discrepancy_type = None
            if old_status != ReviewStatus.PENDING:
                changes.append(ChangeEntry("review_status", old_status.value, ReviewStatus.PENDING.value))
            if old_disc_note:
                new_note = f"{old_disc_note}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator} 补录合同] 歌名一致，解除需复核状态"
                record.discrepancy_note = new_note
                changes.append(ChangeEntry("discrepancy_note", old_disc_note, new_note))

        self.storage.save_record(record)
        self._log_change(
            record_id=record.record_id,
            operator=operator,
            operation="补录合同信息",
            changes=changes,
            note=note,
        )
        return record

    # ==================== 第三步：音乐老师复核 ====================

    def review_record(
        self,
        record_id: str,
        operator: str,
        confirm: bool,
        final_song_name: Optional[str] = None,
        review_note: Optional[str] = None,
    ) -> RepertoireRecord:
        """
        音乐老师复核
        - confirm=True: 确认为正常
        - confirm=False: 驳回，需重新补录
        - 可选 final_song_name: 统一后的最终歌名
        """
        record = self.storage.load_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        old_status = record.review_status
        old_song_name = record.song_display_name
        old_confirmed_by = record.confirmed_by
        old_confirmed_at = record.confirmed_at
        old_disc_note = record.discrepancy_note

        changes = []

        if confirm:
            record.review_status = ReviewStatus.CONFIRMED
            record.confirmed_by = operator
            record.confirmed_at = datetime.now()
            changes.append(ChangeEntry("review_status", old_status.value, ReviewStatus.CONFIRMED.value))
            changes.append(ChangeEntry("confirmed_by", old_confirmed_by, operator))
            changes.append(ChangeEntry("confirmed_at", old_confirmed_at.isoformat() if old_confirmed_at else None, record.confirmed_at.isoformat()))

            if final_song_name and final_song_name != old_song_name:
                record.song_display_name = final_song_name
                changes.append(ChangeEntry("song_display_name", old_song_name, final_song_name))
                if record.discrepancy_note:
                    new_note = f"{record.discrepancy_note}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator} 复核通过] 统一为: {final_song_name}"
                    record.discrepancy_note = new_note
                    changes.append(ChangeEntry("discrepancy_note", old_disc_note, new_note))
        else:
            record.review_status = ReviewStatus.REJECTED
            changes.append(ChangeEntry("review_status", old_status.value, ReviewStatus.REJECTED.value))
            if review_note:
                if old_disc_note:
                    new_note = f"{old_disc_note}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator} 复核驳回] {review_note}"
                else:
                    new_note = f"[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator} 复核驳回] {review_note}"
                record.discrepancy_note = new_note
                changes.append(ChangeEntry("discrepancy_note", old_disc_note, new_note))

        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_change(
            record_id=record.record_id,
            operator=operator,
            operation="复核" + ("通过" if confirm else "驳回"),
            changes=changes,
            note=review_note,
        )
        return record

    # ==================== 第四步：生成周报 ====================

    def generate_weekly_report(self, operator: str) -> List[WeeklyReportEntry]:
        """生成给店长看的周报，并更新工作流阶段"""
        records = self.storage.list_records()
        entries = []

        for record in records:
            old_stage = record.workflow_stage
            record.workflow_stage = WorkflowStage.WEEKLY_REPORT_GENERATED
            record.updated_at = datetime.now()
            self.storage.save_record(record)

            if old_stage != WorkflowStage.WEEKLY_REPORT_GENERATED:
                self._log_change(
                    record_id=record.record_id,
                    operator=operator,
                    operation="纳入周报",
                    changes=[ChangeEntry("workflow_stage", old_stage.value, WorkflowStage.WEEKLY_REPORT_GENERATED.value)],
                )

            entries.append(WeeklyReportEntry(
                student_name=record.student_name,
                song_display_name=record.song_display_name,
                review_status=record.review_status,
                discrepancy_note=record.discrepancy_note,
                has_contract=record.contract_info is not None,
            ))

        return entries

    # ==================== 变更历史追踪 ====================

    def _log_change(
        self,
        record_id: str,
        operator: str,
        operation: str,
        changes: List[ChangeEntry],
        note: Optional[str] = None,
    ) -> None:
        """记录变更历史 - 每一次操作都留下证据"""
        history = ChangeHistory(
            history_id=new_id("HIST"),
            record_id=record_id,
            operator=operator,
            operation=operation,
            changes=changes,
            note=note,
        )
        self.storage.save_history(history)

    def update_remark(
        self,
        record_id: str,
        field_name: str,
        new_value: str,
        operator: str,
        change_note: Optional[str] = None,
        append: bool = False,
    ) -> RepertoireRecord:
        """
        修改备注或单个字段 - 自动记录改前改后
        例如：店长只改一条备注，历史里能看出差别
        append=True 时：在原值后面追加新内容，保留原话和修改痕迹
        """
        record = self.storage.load_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        old_value = getattr(record, field_name, None)
        old_str = str(old_value) if old_value is not None else None

        if append and old_value:
            final_value = f"{old_value}\n[{datetime.now().strftime('%Y-%m-%d %H:%M')} {operator}] {new_value}"
            if change_note:
                final_value += f"（原因: {change_note}）"
        else:
            final_value = new_value

        if old_str == final_value:
            return record

        setattr(record, field_name, final_value)
        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_change(
            record_id=record_id,
            operator=operator,
            operation=f"修改{field_name}" + ("（追加）" if append else "（覆盖）"),
            changes=[ChangeEntry(field_name, old_str, final_value)],
            note=change_note,
        )
        return record

    def rollback(self, record_id: str, history_id: str, operator: str) -> RepertoireRecord:
        """
        回滚到指定历史点之前的状态
        边界规则：写在代码里，不靠口头约定
        - 回滚操作本身也会留下历史记录
        - 只回滚该历史点及之后的所有变更
        """
        record = self.storage.load_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        all_history = self.storage.list_history(record_id)
        target_idx = None
        for i, h in enumerate(all_history):
            if h.history_id == history_id:
                target_idx = i
                break
        if target_idx is None:
            raise ValueError(f"历史记录不存在: {history_id}")

        changes_to_rollback = all_history[target_idx:]
        rollback_changes = []

        for h in reversed(changes_to_rollback):
            for c in reversed(h.changes):
                current_val = self._get_field_value(record, c.field_name)
                current_str = str(current_val) if current_val is not None else None
                rollback_changes.append(ChangeEntry(c.field_name, current_str, c.old_value))
                self._set_field_value(record, c.field_name, c.old_value)

        record.updated_at = datetime.now()
        self.storage.save_record(record)

        self._log_change(
            record_id=record_id,
            operator=operator,
            operation=f"回滚至 {history_id} 之前",
            changes=rollback_changes,
            note=f"回滚操作，共撤销 {len(changes_to_rollback)} 条历史记录",
        )
        return record

    def _get_field_value(self, record: RepertoireRecord, field_name: str):
        """读取字段值，处理嵌套对象和枚举，统一返回字符串或None"""
        if field_name == "confirmed_at":
            return record.confirmed_at.isoformat() if record.confirmed_at else None

        if hasattr(record, field_name) and field_name != "contract_info":
            val = getattr(record, field_name)
            if val is None:
                return None
            if hasattr(val, "value"):
                return val.value
            return str(val)

        if record.contract_info and hasattr(record.contract_info, field_name):
            val = getattr(record.contract_info, field_name)
            if val is None:
                return None
            if field_name == "supplemented_at":
                return val.isoformat()
            return str(val)

        return None

    def _set_field_value(self, record: RepertoireRecord, field_name: str, value: Optional[str]) -> None:
        """设置字段值，处理嵌套对象和枚举"""
        if field_name == "confirmed_at":
            record.confirmed_at = datetime.fromisoformat(value) if value else None
            return

        if field_name == "workflow_stage":
            record.workflow_stage = WorkflowStage(value) if value else WorkflowStage.IMPORTED
            return
        if field_name == "review_status":
            record.review_status = ReviewStatus(value) if value else ReviewStatus.PENDING
            return
        if field_name == "discrepancy_type":
            record.discrepancy_type = DiscrepancyType(value) if value else None
            return

        if hasattr(record, field_name) and field_name != "contract_info":
            setattr(record, field_name, value)
            return

        contract_fields = {"contract_id", "song_copyright_name", "screenshot_path", "supplemented_by", "supplemented_at", "note"}
        if field_name in contract_fields:
            if not record.contract_info:
                record.contract_info = ContractInfo(
                    contract_id="",
                    song_copyright_name="",
                    screenshot_path="",
                    supplemented_by="",
                )
            if field_name == "supplemented_at":
                record.contract_info.supplemented_at = datetime.fromisoformat(value) if value else datetime.now()
            else:
                setattr(record.contract_info, field_name, value if value else "")

    # ==================== 三段追溯查询 ====================

    def trace_record(self, record_id: str) -> dict:
        """
        三段追溯：排练群接龙来源 → 合同页截图补录 → 人工确认
        音乐老师复查时不用重新翻聊天记录
        """
        record = self.storage.load_record(record_id)
        if not record:
            raise ValueError(f"记录不存在: {record_id}")

        signups = []
        for h in record.source_signup_hashes:
            s = self.storage.load_signup(h)
            if s:
                signups.append({
                    "batch_id": s.batch_id,
                    "original_line_number": s.original_line_number,
                    "student_name": s.student_name,
                    "song_name_raw": s.song_name_raw,
                    "raw_text": s.raw_text,
                    "imported_at": s.imported_at.isoformat(),
                })

        contract = None
        if record.contract_info:
            contract = {
                "contract_id": record.contract_info.contract_id,
                "song_copyright_name": record.contract_info.song_copyright_name,
                "screenshot_path": record.contract_info.screenshot_path,
                "supplemented_by": record.contract_info.supplemented_by,
                "supplemented_at": record.contract_info.supplemented_at.isoformat(),
                "note": record.contract_info.note,
            }

        review = {
            "review_status": record.review_status.value,
            "confirmed_by": record.confirmed_by,
            "confirmed_at": record.confirmed_at.isoformat() if record.confirmed_at else None,
            "discrepancy_type": record.discrepancy_type.value if record.discrepancy_type else None,
            "discrepancy_note": record.discrepancy_note,
        }

        history = [h.human_readable() for h in self.storage.list_history(record_id)]

        return {
            "record_id": record_id,
            "student_name": record.student_name,
            "song_display_name": record.song_display_name,
            "stage_1_signup_source": signups,
            "stage_2_contract_supplement": contract,
            "stage_3_manual_confirmation": review,
            "full_change_history": history,
        }
