"""坐标原点说明补录服务."""
from datetime import datetime
from typing import List, Optional

from ..models import db, OriginNote, SafetyRadius, OperationRecord


class OriginNoteService:
    """坐标原点说明服务."""

    @staticmethod
    def add_note(
        note_no: str,
        crane_no: str,
        record_no: str,
        origin_x: float,
        origin_y: float,
        origin_z: float,
        old_caliber: Optional[str] = None,
        z_direction_note: Optional[str] = None,
        operator: str = "许工",
        operation_record_id: Optional[int] = None
    ) -> OriginNote:
        """
        补录坐标原点说明.
        
        Args:
            note_no: 说明编号
            crane_no: 岸桥编号
            record_no: 关联记录编号
            origin_x, origin_y, origin_z: 原点坐标
            old_caliber: 旧口径说明
            z_direction_note: Z轴方向备注
            operator: 补录人
        """
        note = OriginNote(
            note_no=note_no,
            crane_no=crane_no,
            record_no=record_no,
            origin_x=origin_x,
            origin_y=origin_y,
            origin_z=origin_z,
            old_caliber=old_caliber,
            z_direction_note=z_direction_note,
            operator=operator,
            is_applied=False
        )

        if operation_record_id:
            op_record = OperationRecord.query.get(operation_record_id)
            if not op_record:
                raise ValueError(f"操作记录{operation_record_id}不存在")

        db.session.add(note)

        sr = SafetyRadius.query.filter_by(record_no=record_no).first()
        if sr:
            sr.origin_note_id = note.id
            sr.source = "origin"
            sr.status = "updated"

        db.session.commit()

        return note

    @staticmethod
    def get_notes_by_record(record_no: str) -> List[OriginNote]:
        """根据记录编号查询原点说明."""
        return OriginNote.query.filter_by(record_no=record_no).all()

    @staticmethod
    def get_unapplied_notes() -> List[OriginNote]:
        """获取未应用到回放的原点说明."""
        return OriginNote.query.filter_by(is_applied=False).all()

    @staticmethod
    def mark_applied(note_id: int) -> OriginNote:
        """标记原点说明已应用."""
        note = OriginNote.query.get(note_id)
        if not note:
            raise ValueError(f"原点说明{note_id}不存在")
        note.is_applied = True
        db.session.commit()
        return note

    @staticmethod
    def create_origin_operation(
        operator: str = "许工",
        description: str = "设备工程师许工补看坐标原点说明"
    ) -> OperationRecord:
        """创建补录操作记录."""
        op_record = OperationRecord(
            operation_type="origin",
            operator=operator,
            description=description,
            affected_count=0
        )
        db.session.add(op_record)
        db.session.commit()
        return op_record
