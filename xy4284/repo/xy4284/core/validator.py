import json
from datetime import datetime, timedelta
from pathlib import Path
from typing import Dict, List, Optional, Any, Tuple
from dataclasses import dataclass, asdict
from enum import Enum

from config import config


class ValidationIssueType(Enum):
    TIME_OUT_OF_RANGE = "time_out_of_range"
    LOCATION_MISMATCH = "location_mismatch"
    DEPTH_MISMATCH = "depth_mismatch"
    BOX_NUMBER_MISMATCH = "box_number_mismatch"
    HOLE_NUMBER_MISMATCH = "hole_number_mismatch"
    NOTE_ID_MISMATCH = "note_id_mismatch"
    MISSING_CSV_RECORD = "missing_csv_record"
    MISSING_NOTE = "missing_note"
    DUPLICATE_PHOTO = "duplicate_photo"
    INVALID_FILENAME = "invalid_filename"


@dataclass
class ValidationIssue:
    issue_type: ValidationIssueType
    severity: str
    message: str
    file_name: str
    hole_number: Optional[str] = None
    box_number: Optional[int] = None
    depth_start: Optional[float] = None
    depth_end: Optional[float] = None
    expected_value: Optional[Any] = None
    actual_value: Optional[Any] = None
    additional_info: Optional[Dict[str, Any]] = None
    
    def to_dict(self) -> Dict[str, Any]:
        result = asdict(self)
        result['issue_type'] = self.issue_type.value
        return result


class DataValidator:
    """数据校验器 - 校验照片、CSV、GPX、OCR文本之间的一致性"""
    
    def __init__(self, 
                 scan_results: Dict[str, Any],
                 csv_records: List[Dict[str, Any]],
                 gpx_data: Dict[str, Any],
                 ocr_notes: List[Dict[str, Any]]):
        self.scan_results = scan_results
        self.csv_records = csv_records
        self.gpx_data = gpx_data
        self.ocr_notes = ocr_notes
        
        self.issues: List[ValidationIssue] = []
        self.validated_photos: List[Dict[str, Any]] = []
        
        self.csv_hole_box_map = self._build_csv_hole_box_map()
        self.gpx_time_range = self._get_gpx_time_range()
    
    def _build_csv_hole_box_map(self) -> Dict[str, Dict[int, List[Dict[str, Any]]]]:
        """构建CSV记录的孔号-箱号映射"""
        hole_map: Dict[str, Dict[int, List[Dict[str, Any]]]] = {}
        
        for record in self.csv_records:
            hole_num = record.get('hole_number', '')
            box_num = record.get('box_number')
            
            if not hole_num or box_num is None:
                continue
            
            if hole_num not in hole_map:
                hole_map[hole_num] = {}
            if box_num not in hole_map[hole_num]:
                hole_map[hole_num][box_num] = []
            
            hole_map[hole_num][box_num].append(record)
        
        return hole_map
    
    def _get_gpx_time_range(self) -> Tuple[Optional[datetime], Optional[datetime]]:
        """获取GPX数据的时间范围"""
        all_times = []
        
        for point in self.gpx_data.get('track_points', []) + self.gpx_data.get('waypoints', []):
            if point.get('time'):
                all_times.append(point['time'])
        
        if not all_times:
            return (None, None)
        
        return (min(all_times), max(all_times))
    
    def validate(self) -> Dict[str, Any]:
        """执行所有校验"""
        self.issues = []
        self.validated_photos = []
        
        photos = self.scan_results.get('photos', [])
        
        for photo in photos:
            photo_info = self._validate_photo(photo)
            if photo_info:
                self.validated_photos.append(photo_info)
        
        self._validate_cross_references()
        
        return {
            'validated_photos': self.validated_photos,
            'issues': [issue.to_dict() for issue in self.issues],
            'issue_summary': self._get_issue_summary()
        }
    
    def _validate_photo(self, photo: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """校验单张照片"""
        photo_path = Path(photo['path'])
        filename = photo['name']
        
        from core.scanner import FileScanner
        scanner = FileScanner(str(photo_path.parent))
        
        hole_number = scanner.extract_hole_number(filename)
        box_number = scanner.extract_box_number(filename)
        depth_range = scanner.extract_depth_range(filename)
        
        if not hole_number:
            self._add_issue(
                issue_type=ValidationIssueType.INVALID_FILENAME,
                severity="error",
                message=f"无法从文件名提取孔号: {filename}",
                file_name=filename
            )
            return None
        
        photo_info = {
            **photo,
            'hole_number': hole_number,
            'box_number': box_number,
            'depth_start': depth_range.get('start') if depth_range else None,
            'depth_end': depth_range.get('end') if depth_range else None,
            'validation_status': 'pending'
        }
        
        self._validate_photo_time_location(photo_info)
        self._validate_photo_csv_match(photo_info)
        self._validate_photo_note_match(photo_info)
        
        photo_info['validation_status'] = 'valid' if not any(
            issue.file_name == filename and issue.severity == 'error'
            for issue in self.issues
        ) else 'has_errors'
        
        return photo_info
    
    def _validate_photo_time_location(self, photo_info: Dict[str, Any]):
        """校验照片时间与GPS位置"""
        gpx_start, gpx_end = self.gpx_time_range
        
        if not gpx_start or not gpx_end:
            return
        
        photo_time_str = photo_info.get('modified_time') or photo_info.get('created_time')
        if not photo_time_str:
            return
        
        try:
            photo_time = datetime.fromisoformat(photo_time_str)
        except ValueError:
            return
        
        tolerance = timedelta(minutes=config.TIME_TOLERANCE_MINUTES)
        
        if photo_time < (gpx_start - tolerance) or photo_time > (gpx_end + tolerance):
            self._add_issue(
                issue_type=ValidationIssueType.TIME_OUT_OF_RANGE,
                severity="warning",
                message=f"照片时间超出GPS轨迹范围: {photo_time_str}",
                file_name=photo_info['name'],
                hole_number=photo_info.get('hole_number'),
                box_number=photo_info.get('box_number'),
                expected_value=f"{gpx_start} ~ {gpx_end}",
                actual_value=photo_time_str
            )
        
        all_points = self.gpx_data.get('track_points', []) + self.gpx_data.get('waypoints', [])
        if all_points:
            closest_point = self._find_closest_point_by_time(photo_time, all_points)
            if closest_point:
                photo_info['gps_latitude'] = closest_point.get('latitude')
                photo_info['gps_longitude'] = closest_point.get('longitude')
                photo_info['gps_elevation'] = closest_point.get('elevation')
                photo_info['gps_time'] = closest_point.get('time')
    
    def _find_closest_point_by_time(self, target_time: datetime, 
                                      points: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
        """根据时间查找最近的GPS点"""
        closest_point = None
        min_diff = None
        
        for point in points:
            point_time = point.get('time')
            if not point_time:
                continue
            
            time_diff = abs((point_time - target_time).total_seconds())
            
            if min_diff is None or time_diff < min_diff:
                min_diff = time_diff
                closest_point = point
        
        return closest_point
    
    def _validate_photo_csv_match(self, photo_info: Dict[str, Any]):
        """校验照片与CSV记录的匹配"""
        hole_number = photo_info.get('hole_number')
        box_number = photo_info.get('box_number')
        depth_start = photo_info.get('depth_start')
        depth_end = photo_info.get('depth_end')
        
        if not hole_number or box_number is None:
            return
        
        csv_box_records = self.csv_hole_box_map.get(hole_number, {}).get(box_number, [])
        
        if not csv_box_records:
            self._add_issue(
                issue_type=ValidationIssueType.MISSING_CSV_RECORD,
                severity="warning",
                message=f"未找到孔号 {hole_number} 箱号 {box_number} 的CSV记录",
                file_name=photo_info['name'],
                hole_number=hole_number,
                box_number=box_number
            )
            return
        
        if depth_start is not None and depth_end is not None:
            matched = False
            for record in csv_box_records:
                rec_start = record.get('depth_start')
                rec_end = record.get('depth_end')
                
                if rec_start is not None and rec_end is not None:
                    overlap = self._check_depth_overlap(
                        depth_start, depth_end,
                        rec_start, rec_end
                    )
                    if overlap:
                        matched = True
                        photo_info['matched_csv_record'] = record
                        break
            
            if not matched:
                self._add_issue(
                    issue_type=ValidationIssueType.DEPTH_MISMATCH,
                    severity="warning",
                    message=f"照片深度区间 {depth_start}-{depth_end} 与CSV记录不匹配",
                    file_name=photo_info['name'],
                    hole_number=hole_number,
                    box_number=box_number,
                    depth_start=depth_start,
                    depth_end=depth_end,
                    expected_value=[f"{r.get('depth_start')}-{r.get('depth_end')}" for r in csv_box_records],
                    actual_value=f"{depth_start}-{depth_end}"
                )
        else:
            if csv_box_records:
                photo_info['matched_csv_record'] = csv_box_records[0]
    
    def _check_depth_overlap(self, s1: float, e1: float, s2: float, e2: float) -> bool:
        """检查两个深度区间是否有重叠"""
        tolerance = config.DEPTH_TOLERANCE
        return not (e1 + tolerance < s2 or e2 + tolerance < s1)
    
    def _validate_photo_note_match(self, photo_info: Dict[str, Any]):
        """校验照片与OCR备注的匹配"""
        hole_number = photo_info.get('hole_number')
        box_number = photo_info.get('box_number')
        
        if not hole_number:
            return
        
        matching_notes = []
        for note in self.ocr_notes:
            note_hole = note.get('hole_number')
            note_box = note.get('box_number')
            
            if note_hole == hole_number:
                if box_number is None or note_box == box_number:
                    matching_notes.append(note)
        
        if matching_notes:
            photo_info['matching_notes'] = matching_notes
    
    def _validate_cross_references(self):
        """校验交叉引用"""
        all_hole_numbers = set()
        
        for photo in self.validated_photos:
            hole = photo.get('hole_number')
            if hole:
                all_hole_numbers.add(hole)
        
        for record in self.csv_records:
            hole = record.get('hole_number')
            if hole:
                all_hole_numbers.add(hole)
        
        for hole in all_hole_numbers:
            self._validate_hole_consistency(hole)
    
    def _validate_hole_consistency(self, hole_number: str):
        """校验单个孔号的一致性"""
        hole_photos = [p for p in self.validated_photos if p.get('hole_number') == hole_number]
        hole_csv = []
        for box_num, records in self.csv_hole_box_map.get(hole_number, {}).items():
            hole_csv.extend(records)
        
        photo_boxes = set(p.get('box_number') for p in hole_photos if p.get('box_number') is not None)
        csv_boxes = set(r.get('box_number') for r in hole_csv if r.get('box_number') is not None)
        
        photos_without_csv = photo_boxes - csv_boxes
        csv_without_photos = csv_boxes - photo_boxes
        
        for box in photos_without_csv:
            self._add_issue(
                issue_type=ValidationIssueType.MISSING_CSV_RECORD,
                severity="warning",
                message=f"孔号 {hole_number} 箱号 {box} 有照片但无CSV记录",
                file_name=f"孔号{hole_number}_箱号{box}",
                hole_number=hole_number,
                box_number=box
            )
        
        for box in csv_without_photos:
            matching_photos = [p for p in hole_photos if p.get('box_number') is None]
            if not matching_photos:
                self._add_issue(
                    issue_type=ValidationIssueType.MISSING_CSV_RECORD,
                    severity="info",
                    message=f"孔号 {hole_number} 箱号 {box} 有CSV记录但无对应照片",
                    file_name=f"孔号{hole_number}_箱号{box}",
                    hole_number=hole_number,
                    box_number=box
                )
    
    def _add_issue(self, 
                   issue_type: ValidationIssueType,
                   severity: str,
                   message: str,
                   file_name: str,
                   hole_number: Optional[str] = None,
                   box_number: Optional[int] = None,
                   depth_start: Optional[float] = None,
                   depth_end: Optional[float] = None,
                   expected_value: Optional[Any] = None,
                   actual_value: Optional[Any] = None,
                   additional_info: Optional[Dict[str, Any]] = None):
        """添加校验问题"""
        issue = ValidationIssue(
            issue_type=issue_type,
            severity=severity,
            message=message,
            file_name=file_name,
            hole_number=hole_number,
            box_number=box_number,
            depth_start=depth_start,
            depth_end=depth_end,
            expected_value=expected_value,
            actual_value=actual_value,
            additional_info=additional_info
        )
        self.issues.append(issue)
    
    def _get_issue_summary(self) -> Dict[str, Any]:
        """获取问题摘要"""
        summary = {
            'total': len(self.issues),
            'by_severity': {},
            'by_type': {},
            'by_hole': {}
        }
        
        for issue in self.issues:
            severity = issue.severity
            issue_type = issue.issue_type.value
            hole = issue.hole_number or 'unknown'
            
            summary['by_severity'][severity] = summary['by_severity'].get(severity, 0) + 1
            summary['by_type'][issue_type] = summary['by_type'].get(issue_type, 0) + 1
            summary['by_hole'][hole] = summary['by_hole'].get(hole, 0) + 1
        
        return summary
    
    def save_review_file(self, output_path: str):
        """保存review.json文件"""
        review_data = {
            'review_time': datetime.now().isoformat(),
            'issue_summary': self._get_issue_summary(),
            'issues': [issue.to_dict() for issue in self.issues],
            'validated_photos_count': len(self.validated_photos),
            'total_csv_records': len(self.csv_records),
            'total_gpx_points': len(self.gpx_data.get('track_points', [])) + 
                               len(self.gpx_data.get('waypoints', [])),
            'total_ocr_notes': len(self.ocr_notes)
        }
        
        output_file = Path(output_path)
        output_file.parent.mkdir(parents=True, exist_ok=True)
        
        with open(output_file, 'w', encoding='utf-8') as f:
            json.dump(review_data, f, ensure_ascii=False, indent=2, default=str)
