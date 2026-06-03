"""安全半径表导入服务."""
import csv
from datetime import datetime
from io import TextIOWrapper
from typing import List, Dict, Tuple, Optional

from ..models import db, SafetyRadius, OperationRecord


Z_THRESHOLD = 0.0  # Z轴基准值，大于此值按旧习惯可能写反


class RadiusImportService:
    """安全半径导入服务."""

    @staticmethod
    def detect_z_reversed(z_value: float, z_axis_direction: str) -> Tuple[bool, str]:
        """
        检测Z轴方向是否按旧习惯写反.
        
        关键规则：检测到写反时只标记，不归正，留给现场班组复核.
        
        Args:
            z_value: Z坐标值
            z_axis_direction: 标注的Z轴方向
            
        Returns:
            (是否写反, 检测说明)
        """
        is_reversed = False
        note = ""

        if z_axis_direction == "up" and z_value < Z_THRESHOLD:
            is_reversed = True
            note = f"Z值{z_value}小于基准值{Z_THRESHOLD}，标注方向up，疑似按旧习惯写反"
        elif z_axis_direction == "down" and z_value > Z_THRESHOLD:
            is_reversed = True
            note = f"Z值{z_value}大于基准值{Z_THRESHOLD}，标注方向down，疑似按旧习惯写反"

        return is_reversed, note

    @staticmethod
    def import_from_records(
        records: List[Dict],
        operator: str,
        description: str = "安全半径表导入"
    ) -> Tuple[OperationRecord, List[Dict]]:
        """
        从记录列表导入安全半径表.
        
        Args:
            records: 记录列表，每条包含record_no, crane_no, operation_date, x, y, z, radius, z_axis_direction
            operator: 操作人
            
        Returns:
            (操作记录, 检测结果列表)
        """
        op_record = OperationRecord(
            operation_type="import",
            operator=operator,
            description=description,
            affected_count=0
        )
        db.session.add(op_record)
        db.session.flush()

        results = []
        imported_count = 0

        for record in records:
            record_no = record.get("record_no")
            existing = SafetyRadius.query.filter_by(record_no=record_no).first()
            if existing:
                results.append({
                    "record_no": record_no,
                    "status": "skipped",
                    "message": "记录已存在，跳过"
                })
                continue

            is_reversed, detect_note = RadiusImportService.detect_z_reversed(
                float(record.get("z", 0)),
                record.get("z_axis_direction", "up")
            )

            status = "normal" if not is_reversed else "z_reversed"
            if is_reversed:
                status = "z_reversed"

            sr = SafetyRadius(
                record_no=record_no,
                crane_no=record.get("crane_no"),
                operation_date=datetime.strptime(record.get("operation_date"), "%Y-%m-%d").date(),
                x=float(record.get("x", 0)),
                y=float(record.get("y", 0)),
                z=float(record.get("z", 0)),
                radius=float(record.get("radius", 0)),
                z_axis_direction=record.get("z_axis_direction", "up"),
                is_z_reversed=is_reversed,
                status=status,
                source="import",
                operation_record_id=op_record.id
            )
            db.session.add(sr)
            imported_count += 1

            results.append({
                "record_no": record_no,
                "status": status,
                "is_z_reversed": is_reversed,
                "detect_note": detect_note,
                "message": "导入成功" + ("，Z轴疑似写反，留待现场班组复核" if is_reversed else "")
            })

        op_record.affected_count = imported_count
        db.session.commit()

        return op_record, results

    @staticmethod
    def import_from_csv(
        csv_file,
        operator: str,
        description: str = "安全半径表CSV导入"
    ) -> Tuple[OperationRecord, List[Dict]]:
        """从CSV文件导入."""
        if isinstance(csv_file, str):
            f = open(csv_file, "r", encoding="utf-8")
        else:
            f = TextIOWrapper(csv_file, encoding="utf-8")

        reader = csv.DictReader(f)
        records = list(reader)
        f.close()

        return RadiusImportService.import_from_records(records, operator, description)

    @staticmethod
    def get_pending_review() -> List[SafetyRadius]:
        """获取待现场班组复核的Z轴写反记录."""
        return SafetyRadius.query.filter_by(status="z_reversed").all()

    @staticmethod
    def manual_correct(
        record_id: int,
        correct_z: Optional[float] = None,
        correct_direction: Optional[str] = None,
        operator: str = "许工"
    ) -> Tuple[OperationRecord, SafetyRadius]:
        """
        人工修正Z轴记录（不归正，只做修正记录）.
        
        Args:
            record_id: 记录ID
            correct_z: 修正后的Z值
            correct_direction: 修正后的方向
            operator: 操作人
        """
        sr = SafetyRadius.query.get(record_id)
        if not sr:
            raise ValueError(f"记录{record_id}不存在")

        op_record = OperationRecord(
            operation_type="manual_correction",
            operator=operator,
            description=f"人工修正记录{sr.record_no}的Z轴方向",
            affected_count=1
        )
        db.session.add(op_record)
        db.session.flush()

        if correct_z is not None:
            sr.z = correct_z
        if correct_direction is not None:
            sr.z_axis_direction = correct_direction

        sr.is_z_reversed = False
        sr.status = "normal"
        sr.source = "manual"
        sr.operation_record_id = op_record.id

        db.session.commit()

        return op_record, sr
