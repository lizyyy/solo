import csv
import json
import os
from datetime import datetime
from typing import Dict, Any, List
from models import HiddenDanger, PhotoRecord, ReviewRecord, BadRecord

class DataImporter:
    def __init__(self, db):
        self.db = db
    
    def import_hazards_csv(self, csv_file: str) -> Dict[str, int]:
        success_count = 0
        failed_count = 0
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    hazard = self._parse_hazard_row(row, line_num)
                    self.db.insert_hazard(hazard)
                    success_count += 1
                except Exception as e:
                    self._save_bad_record(
                        source_type='hazard_csv',
                        source_file=csv_file,
                        line_number=line_num,
                        raw_data=json.dumps(row, ensure_ascii=False),
                        failure_reason=str(e),
                        suggestion=self._get_hazard_suggestion(e, row)
                    )
                    failed_count += 1
        
        return {'success': success_count, 'failed': failed_count}
    
    def _parse_hazard_row(self, row: Dict[str, str], line_num: int) -> HiddenDanger:
        hazard_id = row.get('隐患编号') or row.get('hazard_id') or row.get('id')
        if not hazard_id:
            raise ValueError(f"缺少必填字段: 隐患编号/hazard_id")
        
        description = row.get('隐患描述') or row.get('description') or ''
        if not description:
            raise ValueError(f"缺少必填字段: 隐患描述/description")
        
        now = datetime.now().isoformat()
        
        return HiddenDanger(
            id=None,
            hazard_id=str(hazard_id).strip(),
            description=description.strip(),
            location=(row.get('位置') or row.get('location') or '').strip(),
            person_in_charge=(row.get('责任人') or row.get('负责人') or row.get('person_in_charge') or '').strip(),
            status=(row.get('状态') or row.get('status') or 'open').strip().lower(),
            exception_type=(row.get('异常类型') or row.get('exception_type') or row.get('类型') or '').strip(),
            discovered_date=(row.get('发现日期') or row.get('discovered_date') or '').strip(),
            deadline=(row.get('整改期限') or row.get('deadline') or '').strip(),
            created_at=now,
            updated_at=now
        )
    
    def _get_hazard_suggestion(self, error: Exception, row: Dict) -> str:
        error_str = str(error)
        if '隐患编号' in error_str or 'hazard_id' in error_str:
            return "请检查CSV文件是否包含'隐患编号'或'hazard_id'列，并确保该列有值"
        if '隐患描述' in error_str or 'description' in error_str:
            return "请检查CSV文件是否包含'隐患描述'或'description'列，并确保该列有值"
        if 'date' in error_str.lower() or '日期' in error_str:
            return "日期格式建议使用 YYYY-MM-DD"
        return "请检查必填字段是否完整，数据格式是否正确"
    
    def import_photos_json(self, json_file: str) -> Dict[str, int]:
        success_count = 0
        failed_count = 0
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        photos = data if isinstance(data, list) else data.get('photos', data.get('records', []))
        
        for idx, photo_data in enumerate(photos):
            try:
                photo = self._parse_photo_data(photo_data)
                self.db.insert_photo(photo)
                success_count += 1
            except Exception as e:
                self._save_bad_record(
                    source_type='photo_json',
                    source_file=json_file,
                    line_number=idx + 1,
                    raw_data=json.dumps(photo_data, ensure_ascii=False),
                    failure_reason=str(e),
                    suggestion=self._get_photo_suggestion(e, photo_data)
                )
                failed_count += 1
        
        return {'success': success_count, 'failed': failed_count}
    
    def _parse_photo_data(self, data: Dict) -> PhotoRecord:
        photo_id = data.get('photo_id') or data.get('照片编号') or data.get('id')
        hazard_id = data.get('hazard_id') or data.get('隐患编号')
        
        if not photo_id:
            raise ValueError("缺少必填字段: photo_id/照片编号")
        if not hazard_id:
            raise ValueError("缺少必填字段: hazard_id/隐患编号")
        
        return PhotoRecord(
            id=None,
            photo_id=str(photo_id),
            hazard_id=str(hazard_id),
            file_path=data.get('file_path') or data.get('文件路径') or '',
            photo_type=data.get('type') or data.get('photo_type') or data.get('类型') or '',
            uploaded_at=data.get('uploaded_at') or data.get('上传时间') or '',
            uploaded_by=data.get('uploaded_by') or data.get('上传人') or ''
        )
    
    def _get_photo_suggestion(self, error: Exception, data: Dict) -> str:
        error_str = str(error)
        if 'photo_id' in error_str or '照片编号' in error_str:
            return "每条照片记录必须包含唯一的photo_id或照片编号"
        if 'hazard_id' in error_str or '隐患编号' in error_str:
            return "照片必须关联对应的隐患编号(hazard_id)"
        return "请检查JSON格式是否正确，必填字段是否完整"
    
    def import_reviews(self, file_path: str) -> Dict[str, int]:
        if file_path.endswith('.json'):
            return self._import_reviews_json(file_path)
        elif file_path.endswith('.csv'):
            return self._import_reviews_csv(file_path)
        else:
            raise ValueError(f"不支持的文件格式: {file_path}")
    
    def _import_reviews_csv(self, csv_file: str) -> Dict[str, int]:
        success_count = 0
        failed_count = 0
        
        with open(csv_file, 'r', encoding='utf-8') as f:
            reader = csv.DictReader(f)
            for line_num, row in enumerate(reader, start=2):
                try:
                    review = self._parse_review_row(row)
                    self.db.insert_review(review)
                    success_count += 1
                except Exception as e:
                    self._save_bad_record(
                        source_type='review_csv',
                        source_file=csv_file,
                        line_number=line_num,
                        raw_data=json.dumps(row, ensure_ascii=False),
                        failure_reason=str(e),
                        suggestion=self._get_review_suggestion(e)
                    )
                    failed_count += 1
        
        return {'success': success_count, 'failed': failed_count}
    
    def _import_reviews_json(self, json_file: str) -> Dict[str, int]:
        success_count = 0
        failed_count = 0
        
        with open(json_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
            
        reviews = data if isinstance(data, list) else data.get('reviews', data.get('records', []))
        
        for idx, review_data in enumerate(reviews):
            try:
                review = self._parse_review_data(review_data)
                self.db.insert_review(review)
                success_count += 1
            except Exception as e:
                self._save_bad_record(
                    source_type='review_json',
                    source_file=json_file,
                    line_number=idx + 1,
                    raw_data=json.dumps(review_data, ensure_ascii=False),
                    failure_reason=str(e),
                    suggestion=self._get_review_suggestion(e)
                )
                failed_count += 1
        
        return {'success': success_count, 'failed': failed_count}
    
    def _parse_review_row(self, row: Dict) -> ReviewRecord:
        review_id = row.get('复查编号') or row.get('review_id') or row.get('id')
        hazard_id = row.get('隐患编号') or row.get('hazard_id')
        
        if not review_id:
            raise ValueError("缺少必填字段: 复查编号/review_id")
        if not hazard_id:
            raise ValueError("缺少必填字段: 隐患编号/hazard_id")
        
        now = datetime.now().isoformat()
        
        return ReviewRecord(
            id=None,
            review_id=str(review_id),
            hazard_id=str(hazard_id),
            reviewer=(row.get('复查人') or row.get('reviewer') or '').strip(),
            review_date=(row.get('复查日期') or row.get('review_date') or '').strip(),
            result=(row.get('复查结果') or row.get('result') or '').strip(),
            remarks=(row.get('备注') or row.get('remarks') or '').strip(),
            created_at=now
        )
    
    def _parse_review_data(self, data: Dict) -> ReviewRecord:
        return self._parse_review_row(data)
    
    def _get_review_suggestion(self, error: Exception) -> str:
        error_str = str(error)
        if '复查编号' in error_str or 'review_id' in error_str:
            return "每条复查记录必须包含唯一的复查编号/review_id"
        if '隐患编号' in error_str or 'hazard_id' in error_str:
            return "复查记录必须关联对应的隐患编号(hazard_id)"
        return "请检查必填字段是否完整，数据格式是否正确"
    
    def _save_bad_record(self, source_type: str, source_file: str, line_number: int,
                        raw_data: str, failure_reason: str, suggestion: str):
        bad = BadRecord(
            id=None,
            source_type=source_type,
            source_file=os.path.basename(source_file),
            line_number=line_number,
            raw_data=raw_data,
            failure_reason=failure_reason,
            suggestion=suggestion,
            created_at=datetime.now().isoformat()
        )
        self.db.insert_bad_record(bad)
