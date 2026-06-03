import json
import hashlib
import os
from datetime import datetime
from typing import List, Optional, Dict, Tuple
from models import OriginPoint, ChangeRecord, ImportBatch, ArchiveSummary
from coordinate_validator import CoordinateValidator


class ArchiveManager:
    def __init__(self, storage_path: str = "./data"):
        self.storage_path = storage_path
        self.points_file = os.path.join(storage_path, "origin_points.json")
        self.batches_file = os.path.join(storage_path, "batches.json")
        self._ensure_storage()
        self._points: Dict[str, OriginPoint] = self._load_points()
        self._batches: List[ImportBatch] = self._load_batches()

    def _ensure_storage(self):
        os.makedirs(self.storage_path, exist_ok=True)
        if not os.path.exists(self.points_file):
            with open(self.points_file, 'w', encoding='utf-8') as f:
                json.dump([], f)
        if not os.path.exists(self.batches_file):
            with open(self.batches_file, 'w', encoding='utf-8') as f:
                json.dump([], f)

    def _load_points(self) -> Dict[str, OriginPoint]:
        with open(self.points_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return {p['id']: OriginPoint(**p) for p in data}

    def _load_batches(self) -> List[ImportBatch]:
        with open(self.batches_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        return [ImportBatch(**b) for b in data]

    def _save_points(self):
        data = [p.model_dump(mode='json') for p in self._points.values()]
        with open(self.points_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _save_batches(self):
        data = [b.model_dump(mode='json') for b in self._batches]
        with open(self.batches_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _generate_point_id(self, raw_content: str, line_number: int, source_file: str) -> str:
        content = f"{source_file}:{line_number}:{raw_content.strip()}"
        return hashlib.md5(content.encode('utf-8')).hexdigest()[:16]

    def _generate_batch_id(self) -> str:
        return datetime.now().strftime("BATCH%Y%m%d%H%M%S")

    def import_origin_points(
        self,
        source_file: str,
        lines: List[str],
        operator: str,
        skip_duplicates: bool = True
    ) -> ImportBatch:
        batch_id = self._generate_batch_id()
        new_records = 0
        updated_records = 0
        skipped_records = 0

        for line_num, raw_content in enumerate(lines, start=1):
            raw_content = raw_content.strip()
            if not raw_content:
                continue

            point_id = self._generate_point_id(raw_content, line_num, source_file)
            
            if point_id in self._points:
                if skip_duplicates:
                    skipped_records += 1
                    continue
                else:
                    point = self._points[point_id]
                    point.version += 1
                    point.updated_at = datetime.now()
                    updated_records += 1
            else:
                coord_type, values = CoordinateValidator.detect_coordinate_type(raw_content)
                status = CoordinateValidator.determine_processing_status(coord_type)
                
                point = OriginPoint(
                    id=point_id,
                    source_file=source_file,
                    original_line_number=line_num,
                    raw_content=raw_content,
                    coordinate_type=coord_type,
                    processing_status=status,
                    import_batch=batch_id,
                    **(values or {})
                )
                self._points[point_id] = point
                new_records += 1

        batch = ImportBatch(
            batch_id=batch_id,
            source_file=source_file,
            operator=operator,
            total_records=new_records + updated_records + skipped_records,
            new_records=new_records,
            updated_records=updated_records,
            skipped_records=skipped_records
        )
        self._batches.append(batch)
        self._save_points()
        self._save_batches()
        return batch

    def update_point_field(
        self,
        point_id: str,
        field_name: str,
        new_value: any,
        operator: str,
        reason: Optional[str] = None
    ) -> bool:
        if point_id not in self._points:
            return False
        
        point = self._points[point_id]
        old_value = getattr(point, field_name, None)
        
        if old_value == new_value:
            return False
        
        change = ChangeRecord(
            operator=operator,
            field_name=field_name,
            old_value=old_value,
            new_value=new_value,
            reason=reason
        )
        point.change_history.append(change)
        setattr(point, field_name, new_value)
        point.manual_modified = True
        point.version += 1
        point.updated_at = datetime.now()
        
        self._save_points()
        return True

    def rollback_point(self, point_id: str, operator: str) -> bool:
        if point_id not in self._points:
            return False
        
        point = self._points[point_id]
        if not point.change_history:
            return False
        
        point.processing_status = 'rollbacked'
        change = ChangeRecord(
            operator=operator,
            field_name='processing_status',
            old_value=point.processing_status,
            new_value='rollbacked',
            reason='执行回滚操作'
        )
        point.change_history.append(change)
        point.version += 1
        point.updated_at = datetime.now()
        
        self._save_points()
        return True

    def get_point(self, point_id: str) -> Optional[OriginPoint]:
        return self._points.get(point_id)

    def get_point_history(self, point_id: str) -> List[ChangeRecord]:
        point = self._points.get(point_id)
        return point.change_history if point else []

    def get_all_points(self) -> List[OriginPoint]:
        return list(self._points.values())

    def get_points_by_status(self, status: str) -> List[OriginPoint]:
        return [p for p in self._points.values() if p.processing_status == status]

    def get_points_by_type(self, coord_type: str) -> List[OriginPoint]:
        return [p for p in self._points.values() if p.coordinate_type == coord_type]

    def get_batches(self) -> List[ImportBatch]:
        return self._batches

    def get_summary(self) -> ArchiveSummary:
        from collections import defaultdict
        by_type = defaultdict(int)
        by_status = defaultdict(int)
        
        for p in self._points.values():
            by_type[p.coordinate_type] += 1
            by_status[p.processing_status] += 1
        
        last_updated = max((p.updated_at for p in self._points.values()), default=datetime.now())
        
        return ArchiveSummary(
            total_records=len(self._points),
            by_coordinate_type=dict(by_type),
            by_status=dict(by_status),
            last_updated=last_updated
        )

    def compare_versions(self, point_id: str) -> Dict[str, any]:
        point = self._points.get(point_id)
        if not point:
            return {}
        
        changes = []
        current = {
            'remark': point.remark,
            'inspection_photo_id': point.inspection_photo_id,
            'site_instruction': point.site_instruction
        }
        
        for change in point.change_history:
            changes.append({
                'timestamp': change.timestamp,
                'operator': change.operator,
                'field': change.field_name,
                'from': change.old_value,
                'to': change.new_value,
                'reason': change.reason
            })
        
        return {
            'point_id': point_id,
            'current_version': point.version,
            'original_line': point.original_line_number,
            'raw_content': point.raw_content,
            'current_values': current,
            'change_history': changes
        }

    def export_for_inspection(self) -> Dict[str, any]:
        inspection_points = {
            p.id: p
            for p in self.get_all_points()
            if p.coordinate_type == 'mixed' or p.processing_status == 'needs_review'
        }
        
        return {
            'summary': self.get_summary().model_dump(mode='json'),
            'needs_inspection': [
                {
                    'point_id': p.id,
                    'original_line': p.original_line_number,
                    'raw_content': p.raw_content,
                    'source_file': p.source_file,
                    'coordinate_type': p.coordinate_type,
                    'processing_status': p.processing_status,
                    'latitude': p.latitude,
                    'longitude': p.longitude,
                    'metric_x': p.metric_x,
                    'metric_y': p.metric_y
                }
                for p in inspection_points.values()
            ],
            'boundary_rules': CoordinateValidator.validate_boundary_rules()
        }
