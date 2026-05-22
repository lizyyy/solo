import json
import time
from typing import List, Tuple, Optional
from sqlalchemy.orm import Session

from pharmacy_expiry_tracker.models.orm import (
    ImportSource,
    ImportRawRecord,
    ExpiryRecord,
    Evidence,
    ChangeLog
)
from pharmacy_expiry_tracker.models.enums import (
    ImportSourceType,
    RecordStatus,
    ChangeType,
    LiabilityResult
)
from pharmacy_expiry_tracker.importers.excel_importer import ExcelImporter
from pharmacy_expiry_tracker.importers.base_importer import ImportResultItem
from pharmacy_expiry_tracker.utils.helpers import (
    generate_record_no,
    calculate_file_hash,
    get_days_near_expiry,
    get_expiry_category
)
from pharmacy_expiry_tracker.utils.exceptions import (
    ValidationException,
    PartialFailureException
)


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_importer(self, source_type: ImportSourceType, skip_duplicates: bool = True):
        if source_type in [
            ImportSourceType.INVENTORY_EXPORT,
            ImportSourceType.MANUAL_TRANSFER,
            ImportSourceType.HISTORY_ARCHIVE
        ]:
            return ExcelImporter(source_type, skip_duplicates=skip_duplicates)
        elif source_type == ImportSourceType.RETURN_PHOTO:
            return ExcelImporter(source_type, skip_duplicates=skip_duplicates)
        else:
            raise ValidationException(f"不支持的导入源类型: {source_type}")

    def _save_evidence(
        self,
        record_id: int,
        source_type: ImportSourceType,
        file_name: str,
        file_content: bytes,
        uploaded_by: str
    ) -> Evidence:
        evidence = Evidence(
            expiry_record_id=record_id,
            evidence_type=source_type.value,
            file_name=file_name,
            file_content=file_content,
            file_hash=calculate_file_hash(file_content),
            description=f"导入来源: {source_type.value}",
            uploaded_by=uploaded_by,
            is_original=True
        )
        self.db.add(evidence)
        return evidence

    def _create_record_from_parsed(
        self,
        parsed,
        import_source_id: int,
        raw_record_id: int,
        created_by: str
    ) -> ExpiryRecord:
        days_near = get_days_near_expiry(parsed.expiry_date.date())

        record = ExpiryRecord(
            record_no=generate_record_no(),
            import_source_id=import_source_id,
            raw_record_id=raw_record_id,
            pharmacy_code=parsed.pharmacy_code,
            pharmacy_name=parsed.pharmacy_name,
            region=parsed.region,
            town=parsed.town,
            drug_code=parsed.drug_code,
            drug_name=parsed.drug_name,
            drug_spec=parsed.drug_spec,
            batch_no=parsed.batch_no,
            expiry_date=parsed.expiry_date,
            quantity=parsed.quantity,
            unit=parsed.unit,
            days_near_expiry=days_near,
            expiry_category=get_expiry_category(days_near),
            liability_result=LiabilityResult.PENDING.value,
            liability_amount=0.0,
            status=RecordStatus.DRAFT.value,
            is_frozen=False,
            created_by=created_by,
            remarks=parsed.remarks
        )
        self.db.add(record)
        self.db.flush()
        return record

    def import_file(
        self,
        source_type: ImportSourceType,
        file_name: str,
        file_content: bytes,
        uploaded_by: str,
        notes: Optional[str] = None,
        skip_duplicates: bool = True,
        allow_partial: bool = True
    ) -> Tuple[ImportSource, List[ImportResultItem]]:
        start_time = time.time()

        import_source = ImportSource(
            source_type=source_type.value,
            file_name=file_name,
            file_content=file_content,
            file_hash=calculate_file_hash(file_content),
            file_size=len(file_content),
            uploaded_by=uploaded_by,
            notes=notes,
            is_complete=False
        )
        self.db.add(import_source)
        self.db.flush()

        existing_records = self.db.query(ExpiryRecord).all()

        importer = self._get_importer(source_type, skip_duplicates)
        importer.allow_partial = allow_partial

        try:
            results, summary = importer.import_file(file_content, existing_records)
        except Exception as e:
            import_source.is_complete = True
            import_source.notes = f"导入失败: {str(e)}"
            self.db.commit()
            raise ValidationException(f"文件解析失败: {str(e)}")

        import_source.total_rows = summary["total_rows"]

        success_count = 0
        failure_count = 0

        for result_item in results:
            raw_record = ImportRawRecord(
                import_source_id=import_source.id,
                row_number=result_item.row_number,
                raw_data=json.dumps(
                    result_item.parsed_data.raw_data if result_item.parsed_data else {},
                    ensure_ascii=False
                ),
                parsed_success=result_item.success,
                error_message=result_item.error_message
            )
            self.db.add(raw_record)
            self.db.flush()

            if result_item.success and result_item.parsed_data:
                try:
                    record = self._create_record_from_parsed(
                        result_item.parsed_data,
                        import_source.id,
                        raw_record.id,
                        uploaded_by
                    )

                    self._save_evidence(
                        record.id,
                        source_type,
                        file_name,
                        file_content,
                        uploaded_by
                    )

                    change_log = ChangeLog(
                        expiry_record_id=record.id,
                        change_type=ChangeType.IMPORT.value,
                        old_status=None,
                        new_status=RecordStatus.DRAFT.value,
                        old_values=None,
                        new_values=json.dumps({
                            "pharmacy_code": record.pharmacy_code,
                            "drug_code": record.drug_code,
                            "batch_no": record.batch_no,
                            "quantity": record.quantity
                        }, ensure_ascii=False),
                        change_reason=f"从 {source_type.value} 导入",
                        changed_by=uploaded_by,
                        user_role="system"
                    )
                    self.db.add(change_log)

                    result_item.record_id = record.id
                    result_item.record_no = record.record_no
                    success_count += 1

                except Exception as e:
                    result_item.success = False
                    result_item.error_message = f"保存失败: {str(e)}"
                    raw_record.parsed_success = False
                    raw_record.error_message = result_item.error_message
                    failure_count += 1
            elif not result_item.success:
                failure_count += 1

        import_source.success_rows = success_count
        import_source.failed_rows = failure_count
        import_source.is_complete = True

        elapsed = time.time() - start_time

        self.db.commit()
        self.db.refresh(import_source)

        if failure_count > 0 and success_count == 0:
            raise ValidationException(
                f"全部导入失败，共 {failure_count} 条记录失败",
                details={"failed_rows": failure_count, "elapsed_seconds": elapsed}
            )
        elif failure_count > 0 and not allow_partial:
            self.db.rollback()
            raise ValidationException(
                f"存在失败记录且不允许部分导入，已回滚。失败 {failure_count} 条",
                details={"failed_rows": failure_count}
            )

        return import_source, results

    def get_import_source(self, import_id: int) -> Optional[ImportSource]:
        return self.db.query(ImportSource).filter(ImportSource.id == import_id).first()

    def get_import_sources(self, skip: int = 0, limit: int = 100) -> List[ImportSource]:
        return self.db.query(ImportSource).order_by(
            ImportSource.uploaded_at.desc()
        ).offset(skip).limit(limit).all()

    def get_raw_records(self, import_source_id: int) -> List[ImportRawRecord]:
        return self.db.query(ImportRawRecord).filter(
            ImportRawRecord.import_source_id == import_source_id
        ).order_by(ImportRawRecord.row_number).all()
