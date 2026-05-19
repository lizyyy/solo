import os
import csv
import json
from datetime import datetime
from typing import Dict, Any, List, Optional
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models import (
    ImportRecord, ImportStatus, ImportType,
    BadRecord, Hazard, HazardStatus
)
from app.services.validation_service import validation_service
from app.schemas.common import BadRecordCreate


class ImportService:
    def __init__(self, db: Session):
        self.db = db

    def _get_import_file_path(self, filename: str) -> str:
        return os.path.join(settings.IMPORT_DIR, filename)

    def create_import_record(
        self,
        import_type: ImportType,
        filename: str,
        imported_by: Optional[str] = None
    ) -> ImportRecord:
        file_path = self._get_import_file_path(filename)
        file_size = os.path.getsize(file_path) if os.path.exists(file_path) else 0
        
        record = ImportRecord(
            import_type=import_type,
            status=ImportStatus.PENDING,
            file_name=filename,
            file_path=file_path,
            file_size=file_size,
            imported_by=imported_by
        )
        self.db.add(record)
        self.db.commit()
        self.db.refresh(record)
        return record

    def update_import_status(
        self,
        record: ImportRecord,
        status: ImportStatus,
        total: int = 0,
        success: int = 0,
        failed: int = 0
    ) -> None:
        record.status = status
        record.total_records = total
        record.success_count = success
        record.failed_count = failed
        if status in [ImportStatus.COMPLETED, ImportStatus.FAILED, ImportStatus.PARTIAL]:
            record.completed_at = datetime.utcnow()
        self.db.commit()

    def save_bad_record(
        self,
        import_record_id: int,
        row_number: int,
        original_data: Dict[str, Any],
        errors: List[Any]
    ) -> None:
        error_type = validation_service.get_error_type(errors)
        error_message = "; ".join([f"{e.field}: {e.message}" for e in errors])
        suggested_fix = validation_service.generate_suggested_fix(errors)
        
        bad_record = BadRecord(
            import_record_id=import_record_id,
            row_number=row_number,
            original_data=original_data,
            error_type=error_type,
            error_message=error_message,
            suggested_fix=suggested_fix,
            field_errors=[e.model_dump() for e in errors]
        )
        self.db.add(bad_record)

    def import_hazards_csv(
        self,
        filename: str,
        imported_by: Optional[str] = None
    ) -> Dict[str, Any]:
        import_record = self.create_import_record(
            ImportType.HAZARD_CSV,
            filename,
            imported_by
        )
        import_record.started_at = datetime.utcnow()
        import_record.status = ImportStatus.PROCESSING
        self.db.commit()

        file_path = self._get_import_file_path(filename)
        
        success_count = 0
        failed_count = 0
        total_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=1):
                    total_count += 1
                    
                    validation_result = validation_service.validate_hazard_row(row, row_num)
                    
                    if validation_result.is_valid and validation_result.cleaned_data:
                        try:
                            existing = self.db.query(Hazard).filter(
                                Hazard.hazard_code == validation_result.cleaned_data['hazard_code']
                            ).first()
                            
                            if existing:
                                errors = [type('ErrorObj', (), {
                                    'field': 'hazard_code',
                                    'message': '隐患编号已存在',
                                    'suggested_value': None
                                })()]
                                self.save_bad_record(import_record.id, row_num, row, errors)
                                failed_count += 1
                                continue
                            
                            hazard = Hazard(
                                hazard_code=validation_result.cleaned_data['hazard_code'],
                                title=validation_result.cleaned_data['title'],
                                description=validation_result.cleaned_data.get('description'),
                                location=validation_result.cleaned_data.get('location'),
                                level=validation_result.cleaned_data.get('level'),
                                status=HazardStatus.PENDING,
                                discovered_by=validation_result.cleaned_data.get('discovered_by'),
                                discovered_at=validation_result.cleaned_data.get('discovered_at'),
                                department=validation_result.cleaned_data.get('department'),
                                category=validation_result.cleaned_data.get('category'),
                                responsible_person=validation_result.cleaned_data.get('responsible_person'),
                                responsible_phone=validation_result.cleaned_data.get('responsible_phone'),
                                deadline=validation_result.cleaned_data.get('deadline'),
                                remarks=validation_result.cleaned_data.get('remarks')
                            )
                            self.db.add(hazard)
                            success_count += 1
                        except Exception as e:
                            errors = [type('ErrorObj', (), {
                                'field': 'database',
                                'message': str(e),
                                'suggested_value': None
                            })()]
                            self.save_bad_record(import_record.id, row_num, row, errors)
                            failed_count += 1
                    else:
                        self.save_bad_record(import_record.id, row_num, row, validation_result.errors)
                        failed_count += 1
                
                self.db.commit()
            
            status = ImportStatus.COMPLETED if failed_count == 0 else ImportStatus.PARTIAL
            if success_count == 0 and failed_count > 0:
                status = ImportStatus.FAILED
            
            self.update_import_status(import_record, status, total_count, success_count, failed_count)
            
            return {
                "import_id": import_record.id,
                "status": status.value,
                "total": total_count,
                "success": success_count,
                "failed": failed_count
            }
            
        except Exception as e:
            self.update_import_status(import_record, ImportStatus.FAILED, total_count, success_count, failed_count)
            raise e

    def import_photos_json(
        self,
        filename: str,
        imported_by: Optional[str] = None
    ) -> Dict[str, Any]:
        from app.models import Photo, PhotoType
        
        import_record = self.create_import_record(
            ImportType.PHOTO_JSON,
            filename,
            imported_by
        )
        import_record.started_at = datetime.utcnow()
        import_record.status = ImportStatus.PROCESSING
        self.db.commit()

        file_path = self._get_import_file_path(filename)
        
        success_count = 0
        failed_count = 0
        total_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8') as f:
                data = json.load(f)
                photos_data = data.get('photos', []) if isinstance(data, dict) else data
                
                for idx, photo_data in enumerate(photos_data, start=1):
                    total_count += 1
                    
                    try:
                        hazard_code = photo_data.get('hazard_code')
                        hazard = self.db.query(Hazard).filter(
                            Hazard.hazard_code == hazard_code
                        ).first()
                        
                        if not hazard:
                            errors = [type('ErrorObj', (), {
                                'field': 'hazard_code',
                                'message': f'隐患编号 {hazard_code} 不存在',
                                'suggested_value': None
                            })()]
                            self.save_bad_record(import_record.id, idx, photo_data, errors)
                            failed_count += 1
                            continue
                        
                        photo_type_str = photo_data.get('photo_type', 'inspection')
                        photo_type = PhotoType.INSPECTION
                        if photo_type_str == 'rectification':
                            photo_type = PhotoType.RECTIFICATION
                        elif photo_type_str == 'review':
                            photo_type = PhotoType.REVIEW
                        
                        photo = Photo(
                            hazard_id=hazard.id,
                            photo_type=photo_type,
                            file_name=photo_data.get('file_name', ''),
                            file_path=photo_data.get('file_path', ''),
                            file_size=photo_data.get('file_size'),
                            taken_by=photo_data.get('taken_by'),
                            taken_at=datetime.fromisoformat(photo_data['taken_at']) if photo_data.get('taken_at') else None,
                            description=photo_data.get('description')
                        )
                        self.db.add(photo)
                        success_count += 1
                    except Exception as e:
                        errors = [type('ErrorObj', (), {
                            'field': 'general',
                            'message': str(e),
                            'suggested_value': None
                        })()]
                        self.save_bad_record(import_record.id, idx, photo_data, errors)
                        failed_count += 1
                
                self.db.commit()
            
            status = ImportStatus.COMPLETED if failed_count == 0 else ImportStatus.PARTIAL
            if success_count == 0 and failed_count > 0:
                status = ImportStatus.FAILED
            
            self.update_import_status(import_record, status, total_count, success_count, failed_count)
            
            return {
                "import_id": import_record.id,
                "status": status.value,
                "total": total_count,
                "success": success_count,
                "failed": failed_count
            }
            
        except Exception as e:
            self.update_import_status(import_record, ImportStatus.FAILED, total_count, success_count, failed_count)
            raise e

    def import_review_records(
        self,
        filename: str,
        imported_by: Optional[str] = None
    ) -> Dict[str, Any]:
        from app.models import Review, ReviewResult
        
        import_record = self.create_import_record(
            ImportType.REVIEW_RECORD,
            filename,
            imported_by
        )
        import_record.started_at = datetime.utcnow()
        import_record.status = ImportStatus.PROCESSING
        self.db.commit()

        file_path = self._get_import_file_path(filename)
        
        success_count = 0
        failed_count = 0
        total_count = 0

        try:
            with open(file_path, 'r', encoding='utf-8-sig') as f:
                reader = csv.DictReader(f)
                
                for row_num, row in enumerate(reader, start=1):
                    total_count += 1
                    
                    try:
                        hazard_code = row.get('hazard_code')
                        hazard = self.db.query(Hazard).filter(
                            Hazard.hazard_code == hazard_code
                        ).first()
                        
                        if not hazard:
                            errors = [type('ErrorObj', (), {
                                'field': 'hazard_code',
                                'message': f'隐患编号 {hazard_code} 不存在',
                                'suggested_value': None
                            })()]
                            self.save_bad_record(import_record.id, row_num, row, errors)
                            failed_count += 1
                            continue
                        
                        result_str = row.get('result', 'pass').lower()
                        result = ReviewResult.PASS
                        if result_str == 'fail':
                            result = ReviewResult.FAIL
                        elif result_str == 'rectify':
                            result = ReviewResult.NEED_RECTIFY
                        
                        is_passed = result == ReviewResult.PASS
                        
                        reviewed_at = None
                        if row.get('reviewed_at'):
                            reviewed_at = datetime.fromisoformat(row['reviewed_at']) if 'T' in row['reviewed_at'] else datetime.strptime(row['reviewed_at'], '%Y-%m-%d')
                        
                        review = Review(
                            hazard_id=hazard.id,
                            reviewer=row.get('reviewer'),
                            reviewer_phone=row.get('reviewer_phone'),
                            reviewed_at=reviewed_at or datetime.utcnow(),
                            result=result,
                            is_passed=is_passed,
                            comments=row.get('comments'),
                            suggestions=row.get('suggestions')
                        )
                        self.db.add(review)
                        success_count += 1
                    except Exception as e:
                        errors = [type('ErrorObj', (), {
                            'field': 'general',
                            'message': str(e),
                            'suggested_value': None
                        })()]
                        self.save_bad_record(import_record.id, row_num, row, errors)
                        failed_count += 1
                
                self.db.commit()
            
            status = ImportStatus.COMPLETED if failed_count == 0 else ImportStatus.PARTIAL
            if success_count == 0 and failed_count > 0:
                status = ImportStatus.FAILED
            
            self.update_import_status(import_record, status, total_count, success_count, failed_count)
            
            return {
                "import_id": import_record.id,
                "status": status.value,
                "total": total_count,
                "success": success_count,
                "failed": failed_count
            }
            
        except Exception as e:
            self.update_import_status(import_record, ImportStatus.FAILED, total_count, success_count, failed_count)
            raise e

    def get_bad_records(self, import_id: int) -> List[BadRecord]:
        return self.db.query(BadRecord).filter(
            BadRecord.import_record_id == import_id
        ).order_by(BadRecord.row_number).all()

    def get_import_history(self, skip: int = 0, limit: int = 50) -> List[ImportRecord]:
        return self.db.query(ImportRecord).order_by(
            ImportRecord.created_at.desc()
        ).offset(skip).limit(limit).all()
