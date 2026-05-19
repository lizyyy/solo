import csv
import json
import os
from datetime import datetime
from typing import List, Dict, Any, Optional, Tuple
from sqlalchemy.orm import Session
from .models import (
    get_db, init_db, Room, CleaningRecord, Photo, Complaint,
    ImportRecord, ErrorRecord, OperationHistory
)
from .masker import SensitiveMasker, get_masked_logger
import logging

logger = get_masked_logger(__name__)


class ValidationError(Exception):
    def __init__(self, message: str, error_type: str, suggestion: str = None):
        self.message = message
        self.error_type = error_type
        self.suggestion = suggestion or "请检查数据格式是否正确"
        super().__init__(self.message)


class DataImporter:
    def __init__(self, db: Optional[Session] = None):
        self.db = db or get_db()
        init_db()

    def _log_operation(self, operation_type: str, details: str, affected_records: int = 0):
        history = OperationHistory(
            operation_type=operation_type,
            operation_details=details,
            operator="cli_user",
            affected_records=affected_records
        )
        self.db.add(history)
        self.db.commit()

    def _create_error_record(
        self,
        import_record_id: int,
        position: str,
        original_data: str,
        error_type: str,
        error_message: str,
        suggestion: str = None
    ):
        error = ErrorRecord(
            import_record_id=import_record_id,
            original_position=position,
            original_data=original_data,
            error_type=error_type,
            error_message=error_message,
            suggestion=suggestion or "请检查数据格式是否正确"
        )
        self.db.add(error)

    def _parse_datetime(self, value: str, field_name: str) -> Optional[datetime]:
        if not value or value.strip() == '':
            return None
        value = value.strip()
        formats = [
            "%Y-%m-%d %H:%M:%S",
            "%Y-%m-%d %H:%M",
            "%Y-%m-%d",
            "%Y/%m/%d %H:%M:%S",
            "%Y/%m/%d",
            "%m/%d/%Y",
            "%d/%m/%Y"
        ]
        for fmt in formats:
            try:
                return datetime.strptime(value, fmt)
            except ValueError:
                continue
        raise ValidationError(
            f"{field_name} '{value}' 不是有效的日期格式",
            "DATE_FORMAT_ERROR",
            f"建议使用 YYYY-MM-DD 或 YYYY-MM-DD HH:MM:SS 格式"
        )

    def _parse_float(self, value: str, field_name: str) -> Optional[float]:
        if not value or value.strip() == '':
            return None
        value = value.strip().replace(',', '')
        try:
            return float(value)
        except ValueError:
            raise ValidationError(
                f"{field_name} '{value}' 不是有效的数字格式",
                "NUMBER_FORMAT_ERROR",
                f"请确保 {field_name} 是有效的数字"
            )

    def _parse_int(self, value: str, field_name: str) -> Optional[int]:
        if not value or value.strip() == '':
            return None
        value = value.strip()
        try:
            return int(value)
        except ValueError:
            raise ValidationError(
                f"{field_name} '{value}' 不是有效的整数格式",
                "INTEGER_FORMAT_ERROR",
                f"请确保 {field_name} 是有效的整数"
            )

    def import_room_status_csv(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_name = os.path.basename(file_path)
        import_record = ImportRecord(
            file_name=file_name,
            file_path=file_path,
            file_type="room_status_csv"
        )
        self.db.add(import_record)
        self.db.commit()

        success_count = 0
        failed_count = 0
        total_records = 0
        errors = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                total_records = len(rows)

                for row_idx, row in enumerate(rows, start=2):
                    original_data = json.dumps(row, ensure_ascii=False)
                    position = f"行 {row_idx}"

                    try:
                        room_number = row.get('room_number') or row.get('房号') or row.get('RoomNumber')
                        if not room_number:
                            raise ValidationError(
                                "缺少房号字段",
                                "MISSING_REQUIRED_FIELD",
                                "CSV文件必须包含 room_number、房号 或 RoomNumber 列"
                            )

                        room = self.db.query(Room).filter(Room.room_number == room_number).first()
                        if not room:
                            room = Room(room_number=room_number)

                        room.room_name = row.get('room_name') or row.get('房间名') or room.room_name
                        room.floor = self._parse_int(row.get('floor') or row.get('楼层'), '楼层') or room.floor
                        room.room_type = row.get('room_type') or row.get('房型') or room.room_type
                        room.status = row.get('status') or row.get('状态') or room.status

                        self.db.add(room)
                        self.db.commit()
                        success_count += 1

                    except ValidationError as e:
                        failed_count += 1
                        self._create_error_record(
                            import_record.id, position, original_data,
                            e.error_type, e.message, e.suggestion
                        )
                        errors.append({"position": position, "error": e.message, "suggestion": e.suggestion})
                    except Exception as e:
                        failed_count += 1
                        self._create_error_record(
                            import_record.id, position, original_data,
                            "UNKNOWN_ERROR", str(e), "请联系技术支持"
                        )
                        errors.append({"position": position, "error": str(e), "suggestion": "请联系技术支持"})

        except Exception as e:
            import_record.total_records = total_records
            import_record.success_count = success_count
            import_record.failed_count = failed_count
            self.db.commit()
            raise e

        import_record.total_records = total_records
        import_record.success_count = success_count
        import_record.failed_count = failed_count
        self.db.commit()

        self._log_operation(
            "IMPORT_ROOM_STATUS",
            f"导入房态CSV: {file_name}, 成功: {success_count}, 失败: {failed_count}",
            success_count
        )

        logger.info(f"房态CSV导入完成: 总计 {total_records}, 成功 {success_count}, 失败 {failed_count}")

        return {
            "import_id": import_record.id,
            "file_name": file_name,
            "total": total_records,
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }

    def import_cleaning_json(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_name = os.path.basename(file_path)
        import_record = ImportRecord(
            file_name=file_name,
            file_path=file_path,
            file_type="cleaning_json"
        )
        self.db.add(import_record)
        self.db.commit()

        success_count = 0
        failed_count = 0
        total_records = 0
        errors = []

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)

            if isinstance(data, dict):
                records = data.get('records', [data])
            elif isinstance(data, list):
                records = data
            else:
                records = [data]

            total_records = len(records)

            for idx, record in enumerate(records):
                original_data = json.dumps(record, ensure_ascii=False)
                position = f"记录 {idx + 1}"

                try:
                    room_number = record.get('room_number') or record.get('房号')
                    if not room_number:
                        raise ValidationError(
                            "缺少房号字段",
                            "MISSING_REQUIRED_FIELD",
                            "JSON记录必须包含 room_number 或 房号 字段"
                        )

                    room = self.db.query(Room).filter(Room.room_number == room_number).first()
                    if not room:
                        room = Room(room_number=room_number)
                        self.db.add(room)
                        self.db.commit()

                    cleaning_date = record.get('cleaning_date') or record.get('保洁日期')
                    if not cleaning_date:
                        raise ValidationError(
                            "缺少保洁日期字段",
                            "MISSING_REQUIRED_FIELD",
                            "JSON记录必须包含 cleaning_date 或 保洁日期 字段"
                        )

                    cleaning_record = CleaningRecord(
                        room_id=room.id,
                        cleaner_name=record.get('cleaner_name') or record.get('保洁员'),
                        cleaner_phone=record.get('cleaner_phone') or record.get('保洁员电话'),
                        checkin_date=self._parse_datetime(
                            str(record.get('checkin_date') or record.get('入住日期', '')), '入住日期'
                        ),
                        checkout_date=self._parse_datetime(
                            str(record.get('checkout_date') or record.get('退房日期', '')), '退房日期'
                        ),
                        cleaning_date=self._parse_datetime(str(cleaning_date), '保洁日期'),
                        cleaning_status=record.get('status') or record.get('状态', 'pending'),
                        quality_score=self._parse_float(
                            str(record.get('quality_score') or record.get('质量评分', '')), '质量评分'
                        ),
                        has_complaint=bool(record.get('has_complaint') or record.get('有客诉', False)),
                        complaint_count=self._parse_int(
                            str(record.get('complaint_count') or record.get('客诉次数', 0)), '客诉次数'
                        ) or 0,
                        rework_count=self._parse_int(
                            str(record.get('rework_count') or record.get('返工次数', 0)), '返工次数'
                        ) or 0,
                        notes=record.get('notes') or record.get('备注'),
                        source_file=file_name
                    )

                    self.db.add(cleaning_record)
                    self.db.commit()
                    success_count += 1

                except ValidationError as e:
                    failed_count += 1
                    self._create_error_record(
                        import_record.id, position, original_data,
                        e.error_type, e.message, e.suggestion
                    )
                    errors.append({"position": position, "error": e.message, "suggestion": e.suggestion})
                except Exception as e:
                    failed_count += 1
                    self._create_error_record(
                        import_record.id, position, original_data,
                        "UNKNOWN_ERROR", str(e), "请联系技术支持"
                    )
                    errors.append({"position": position, "error": str(e), "suggestion": "请联系技术支持"})

        except Exception as e:
            import_record.total_records = total_records
            import_record.success_count = success_count
            import_record.failed_count = failed_count
            self.db.commit()
            raise e

        import_record.total_records = total_records
        import_record.success_count = success_count
        import_record.failed_count = failed_count
        self.db.commit()

        self._log_operation(
            "IMPORT_CLEANING_RECORDS",
            f"导入保洁JSON: {file_name}, 成功: {success_count}, 失败: {failed_count}",
            success_count
        )

        logger.info(f"保洁JSON导入完成: 总计 {total_records}, 成功 {success_count}, 失败 {failed_count}")

        return {
            "import_id": import_record.id,
            "file_name": file_name,
            "total": total_records,
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }

    def import_photo_list(self, file_path: str) -> Dict[str, Any]:
        if not os.path.exists(file_path):
            raise FileNotFoundError(f"文件不存在: {file_path}")

        file_name = os.path.basename(file_path)
        import_record = ImportRecord(
            file_name=file_name,
            file_path=file_path,
            file_type="photo_list"
        )
        self.db.add(import_record)
        self.db.commit()

        success_count = 0
        failed_count = 0
        total_records = 0
        errors = []

        try:
            if file_path.endswith('.json'):
                with open(file_path, 'r', encoding='utf-8') as f:
                    data = json.load(f)
                records = data if isinstance(data, list) else [data]
                total_records = len(records)

                for idx, record in enumerate(records):
                    original_data = json.dumps(record, ensure_ascii=False)
                    position = f"记录 {idx + 1}"
                    try:
                        self._process_photo_record(record, position, original_data, import_record.id, file_name)
                        success_count += 1
                    except ValidationError as e:
                        failed_count += 1
                        self._create_error_record(
                            import_record.id, position, original_data,
                            e.error_type, e.message, e.suggestion
                        )
                        errors.append({"position": position, "error": e.message, "suggestion": e.suggestion})
                    except Exception as e:
                        failed_count += 1
                        self._create_error_record(
                            import_record.id, position, original_data,
                            "UNKNOWN_ERROR", str(e), "请联系技术支持"
                        )
                        errors.append({"position": position, "error": str(e), "suggestion": "请联系技术支持"})

            else:
                with open(file_path, 'r', encoding='utf-8') as f:
                    lines = [line.strip() for line in f if line.strip()]
                total_records = len(lines)

                for idx, line in enumerate(lines):
                    position = f"行 {idx + 1}"
                    try:
                        photo = Photo(
                            file_name=os.path.basename(line),
                            file_path=line,
                            source_file=file_name
                        )
                        self.db.add(photo)
                        self.db.commit()
                        success_count += 1
                    except Exception as e:
                        failed_count += 1
                        self._create_error_record(
                            import_record.id, position, line,
                            "UNKNOWN_ERROR", str(e), "请联系技术支持"
                        )
                        errors.append({"position": position, "error": str(e), "suggestion": "请联系技术支持"})

        except Exception as e:
            import_record.total_records = total_records
            import_record.success_count = success_count
            import_record.failed_count = failed_count
            self.db.commit()
            raise e

        import_record.total_records = total_records
        import_record.success_count = success_count
        import_record.failed_count = failed_count
        self.db.commit()

        self._log_operation(
            "IMPORT_PHOTOS",
            f"导入照片清单: {file_name}, 成功: {success_count}, 失败: {failed_count}",
            success_count
        )

        logger.info(f"照片清单导入完成: 总计 {total_records}, 成功 {success_count}, 失败 {failed_count}")

        return {
            "import_id": import_record.id,
            "file_name": file_name,
            "total": total_records,
            "success": success_count,
            "failed": failed_count,
            "errors": errors
        }

    def _process_photo_record(self, record: Dict, position: str, original_data: str, 
                             import_id: int, file_name: str):
        file_name_val = record.get('file_name') or record.get('文件名')
        if not file_name_val:
            raise ValidationError(
                "缺少文件名字段",
                "MISSING_REQUIRED_FIELD",
                "照片记录必须包含 file_name 或 文件名 字段"
            )

        room_number = record.get('room_number') or record.get('房号')
        room = None
        if room_number:
            room = self.db.query(Room).filter(Room.room_number == room_number).first()

        photo = Photo(
            room_id=room.id if room else None,
            file_name=file_name_val,
            file_path=record.get('file_path') or record.get('文件路径'),
            photo_type=record.get('type') or record.get('类型'),
            upload_time=self._parse_datetime(
                str(record.get('upload_time') or record.get('上传时间', '')), '上传时间'
            ),
            is_approved=bool(record.get('is_approved') or record.get('已审核', False)),
            notes=record.get('notes') or record.get('备注'),
            source_file=file_name
        )
        self.db.add(photo)
        self.db.commit()

    def close(self):
        self.db.close()
